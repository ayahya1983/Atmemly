# ATMEMLY — AWS deploy notes (eu-west-1)

## Status: LIVE (May 03, 2026)

The full single-box stack is up and serving traffic.

| URL                                       | Status |
| ----------------------------------------- | ------ |
| http://63.34.129.118/                     | 200 (marketplace SPA) |
| http://63.34.129.118/admin/               | 200 (admin SPA, login screen) |
| http://63.34.129.118/api/healthz          | 200 `{"status":"ok"}` |

## Live values

| Key                       | Value                                                       |
| ------------------------- | ----------------------------------------------------------- |
| Region                    | `eu-west-1`                                                 |
| AWS Account               | `670687146435`                                              |
| Elastic IP                | `63.34.129.118`                                             |
| EC2 instance              | `i-09d44904cddfaa638` (`t3.small`)                          |
| EC2 public DNS            | `ec2-63-34-129-118.eu-west-1.compute.amazonaws.com`         |
| AMI                       | `ami-02dcb5eb199a201cf` (Ubuntu 22.04 LTS, hvm-ssd, amd64)  |
| RDS endpoint              | `atmemly-db.c52wkasmcc7r.eu-west-1.rds.amazonaws.com:5432`  |
| RDS engine                | Postgres 16.6, `db.t4g.micro`, 20 GB gp3, single-AZ         |
| S3 uploads bucket         | `atmemly-uploads-f960865d` (private, versioned, SSE-S3)     |
| SSM parameter prefix      | `/atmemly/`                                                 |
| EC2 IAM role              | `atmemly-ec2-role` (SSM read for `/atmemly/*`, S3 RW)       |
| SSH key (Terraform-gen.)  | regenerated locally on each `terraform apply`; **never committed** (see `infra/aws/terraform/.gitignore`) |

`terraform output` reproduces all of the above on demand.

## Probe matrix (May 03, 2026 — all pass)

| Probe                              | Result      |
| ---------------------------------- | ----------- |
| `aws sts get-caller-identity`      | OK (`user/Replit`) |
| `aws ec2 describe-vpcs`            | OK          |
| `aws rds describe-db-instances`    | OK          |
| `aws s3 ls`                        | OK          |
| `aws ssm describe-parameters`      | OK          |
| `aws iam get-user`                 | OK          |
| `aws iam list-attached-user-policies` | OK — `AdministratorAccess` is now attached |
| `aws kms list-keys`                | OK          |

## Hardening checklist (do before this is real production traffic)

- [ ] Restrict `ssh_allowed_cidr` to a known operator `/32`, **or**
      remove inbound :22 entirely and rely on AWS SSM Session Manager
      (`aws ssm start-session --target <instance-id>`). The EC2 IAM
      role already has `AmazonSSMManagedInstanceCore`, so SSM works
      out of the box.
- [ ] Replace `?sslmode=no-verify` on `DATABASE_URL` with proper RDS
      CA trust: bake the AWS RDS global CA bundle into the api-server
      image and use `?sslmode=verify-full`.
- [ ] Provide your own SSH pubkey via `-var "ssh_public_key=…"` so
      Terraform never holds the private half on disk.
- [ ] Add CloudWatch alarms (EC2 status, RDS storage/CPU, `/api/healthz`
      external probe) and an SNS topic for alerts.
- [ ] Move from local Terraform state to a remote encrypted backend
      (S3 + DynamoDB lock) so state isn't only on one operator's box.
- [ ] Front the EIP with HTTPS (ACM cert + nginx 443 + custom domain).

## Security tradeoffs in this revision

- `ssh_allowed_cidr=0.0.0.0/0` (no stable operator IP available from
  the Replit executor). SSH is still key-only, but anyone on the
  internet can probe port 22. Tighten this with
  `terraform apply -var "ssh_allowed_cidr=<your-ip>/32"` once a stable
  egress IP exists.
- HTTP only on port 80; HTTPS / custom domain is task #25.
- Admin/marketplace bundles are baked in by `deploy.sh` from the
  current source on the box (no git pull, since this clone has no
  public git remote — see `SKIP_GIT=1` below).

## SSH key handling

When `var.ssh_public_key` is empty, the Terraform module generates an
ED25519 keypair **once** (on the first apply) and writes the private
key to `infra/aws/terraform/atmemly-ec2.pem`. Subsequent applies will
reuse the same keypair — the key is **not** rotated automatically, so
losing this file means losing SSH access until you taint and rotate
(see below). **That file is gitignored and must never be committed.**
For a more durable setup, provide your own pubkey via
`-var "ssh_public_key=ssh-ed25519 AAAA…"` so Terraform never holds
the private half.

If a stale key was previously committed, the only safe path is to
rotate via:

```bash
terraform taint 'tls_private_key.generated[0]' \
                'local_file.generated_key[0]' \
                aws_key_pair.main \
                random_password.db \
                random_password.session_secret
terraform apply -auto-approve
```

then SSH in with the OLD key one last time, append the NEW pubkey to
`~/.ssh/authorized_keys` on the EC2 host, and remove the old line —
AWS does not push key changes to running instances.

## Redeploy

The deploy script lives at `/opt/atmemly/app/infra/aws/scripts/deploy.sh`
on the EC2 host.

```bash
# From your laptop, push fresh source then redeploy:
EIP=63.34.129.118
KEY=infra/aws/terraform/atmemly-ec2.pem

git archive --format=tar.gz -o /tmp/atmemly.tgz HEAD
scp -i $KEY /tmp/atmemly.tgz ubuntu@$EIP:/tmp/
ssh -i $KEY ubuntu@$EIP \
  'cd /opt/atmemly/app && tar xzf /tmp/atmemly.tgz && \
   sudo SKIP_GIT=1 /opt/atmemly/app/infra/aws/scripts/deploy.sh'

# Same, but also re-seed the demo data (DESTRUCTIVE — wipes the DB):
ssh -i $KEY ubuntu@$EIP \
  'cd /opt/atmemly/app && tar xzf /tmp/atmemly.tgz && \
   sudo SEED=1 SKIP_GIT=1 /opt/atmemly/app/infra/aws/scripts/deploy.sh'
```

`SKIP_GIT=1` is required while there's no public git remote; the
script skips `git fetch` automatically when there's no `.git` directory.
Once a remote is wired up, drop `SKIP_GIT=1` and `deploy.sh` will
`git pull` on its own.

## Adding new SSM secrets (Stripe, PayTabs, SSO…)

```bash
aws ssm put-parameter --region eu-west-1 --type SecureString \
  --name /atmemly/STRIPE_SECRET_KEY --value 'sk_live_xxx'
ssh -i $KEY ubuntu@$EIP 'sudo /usr/local/bin/atmemly-fetch-env && \
  sudo docker compose -f /opt/atmemly/app/infra/aws/docker-compose.prod.yml \
       up -d --force-recreate api-server'
```

## Teardown

```bash
cd infra/aws/terraform && terraform destroy -auto-approve
# S3 bucket has force_destroy=false — empty it manually first:
aws s3 rm s3://atmemly-uploads-f960865d --recursive
```

## Estimated monthly cost

~$35–40 USD/mo on-demand in eu-west-1 (t3.small EC2 + EIP +
db.t4g.micro RDS single-AZ + 20 GB gp3 + minor S3 + SSM + a little
data transfer). See `infra/aws/README.md` §7 for the breakdown.

## Fixes applied during this attempt

These were necessary to make `terraform apply` and `deploy.sh` work
end-to-end against a fresh AWS account:

1. `infra/aws/terraform/s3.tf` — removed duplicate
   `terraform { required_providers { … } }` block; consolidated the
   `random` provider into `providers.tf`.
2. `infra/aws/terraform/ec2.tf` — Ubuntu AMI filter loosened from
   `hvm-ssd-gp3` (which Canonical doesn't publish under that name in
   eu-west-1) to `hvm-ssd*`.
3. `infra/aws/terraform/variables.tf` — RDS engine version bumped from
   `16.4` (no longer offered) to `16.6`.
4. `infra/aws/terraform/iam.tf` — added the path-level ARN
   `…:parameter/atmemly` to the SSM read policy. Without it,
   `ssm:GetParametersByPath` against `/atmemly` returns AccessDenied
   even though the children are allowed.
5. `infra/aws/terraform/cloud-init.yaml.tpl` — `atmemly-fetch-env` now
   writes unquoted `KEY=VALUE` lines (so `docker --env-file` works
   correctly; the previous double-quoted form was being passed through
   verbatim into container env vars). Also removed an erroneous `$$`
   that would have rendered as a literal `$$` in the bash script.
6. `infra/aws/terraform/rds.tf` — `DATABASE_URL` now ends with
   `?sslmode=no-verify`. RDS forces TLS, and its CA isn't in the Node
   image's default trust store; `no-verify` enables TLS without
   verifying the chain (acceptable inside the VPC).
7. `infra/aws/scripts/deploy.sh`:
   - `SKIP_GIT=1` (or absence of `.git`) skips the `git fetch/reset`
     step so the box can be deployed from a tarball rather than a
     remote clone.
   - The static-bundle extraction now uses
     `docker buildx build --output type=local,dest=…` instead of
     `docker create` on a `FROM scratch` image (which had no command
     and broke `docker create`).
8. `infra/aws/docker-compose.prod.yml` — added a host bind mount for
   `/opt/atmemly/uploads → /app/uploads` so the api-server can write
   uploaded files (it runs as uid 10001 inside the container; the host
   directory is `chown 10001:10001`).
9. `infra/aws/nginx/atmemly.conf` — switched from a static `upstream`
   block to a runtime variable + Docker's embedded `resolver
   127.0.0.11`. Without this, nginx exits at start-up if it loses the
   DNS race against api-server during `docker compose up`.
10. EC2 cloud-init installs the `nginx` apt package, which binds port
    80. Cloud-init now runs `systemctl stop nginx && systemctl
    disable nginx` immediately after Docker is up, so the dockerised
    nginx can deterministically bind :80 on first boot.
11. Cloud-init now creates `/opt/atmemly/uploads` owned by uid 10001,
    matching the api-server container's runtime user, so first-boot
    deploys can write uploaded files without a manual `chown`.
12. `deploy.sh` no longer `source`s `/opt/atmemly/.env`. The file is
    consumed by `docker --env-file` verbatim; sourcing it from bash
    would try to interpret shell-significant characters in secret
    values. The script now just `grep`s for `DATABASE_URL` to sanity
    check that the SSM fetch worked.

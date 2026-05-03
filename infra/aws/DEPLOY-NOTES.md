# ATMEMLY — AWS deploy notes (eu-west-1)

## Status: LIVE (May 03, 2026)

The full single-box stack is up and serving HTTPS traffic on the customer
domain.

| URL                                       | Status |
| ----------------------------------------- | ------ |
| https://app.atmemli.com/                  | 200 (marketplace SPA, HTTP/2, Caddy + nginx) |
| https://app.atmemli.com/admin/            | 200 (admin SPA login screen) |
| https://app.atmemli.com/api/healthz       | 200 `{"status":"ok"}` |
| http://app.atmemli.com/                   | 308 → https://app.atmemli.com/ |
| http://63.34.129.118/                     | 200 (direct EIP, plain HTTP — kept open in SG for legacy clients) |

## Outage + recovery on May 03, 2026 (task #38)

**Symptom.** `https://app.atmemli.com/` showed `ERR_QUIC_PROTOCOL_ERROR`
in Chrome. Externally: TCP 443 was *connection refused*; TCP 80 was up
and serving the marketplace SPA directly from the (no-Caddy) nginx
container.

**Root cause.** Two distinct bugs combined:

1. `infra/aws/scripts/deploy.sh` claimed to "re-evaluate TLS mode after
   sourcing the SSM env", but a few lines above explicitly *does not*
   `source` `/opt/atmemly/.env` (values may contain shell-significant
   chars and are consumed via `docker --env-file`). So
   `${ATMEMLY_DOMAIN:-}` was never populated in the script's bash
   environment when invoked by GitHub Actions (`sudo -E SEED=… deploy.sh`
   does not pass `ATMEMLY_DOMAIN`). The script therefore fell back to
   `docker-compose.prod.yml` (HTTP-only), tearing down the `caddy`
   container and unbinding TCP 443.
2. The previous TLS deploy had advertised `Alt-Svc: h3=":443"` to
   browsers, but the EC2 security group only opens **TCP** 80/443 — UDP
   443 is closed end-to-end. As soon as TCP 443 stopped responding,
   Chrome reused the cached Alt-Svc, attempted QUIC over the closed
   UDP/443, and surfaced `ERR_QUIC_PROTOCOL_ERROR` instead of falling
   back cleanly.

**Fixes that landed in this repo (so the next GH Actions deploy doesn't
regress):**

* `infra/aws/scripts/deploy.sh` — after `atmemly-fetch-env` writes
  `/opt/atmemly/.env`, the script now `grep`s `ATMEMLY_DOMAIN` and
  `ATMEMLY_ACME_EMAIL` out of the env file (without `source`-ing it)
  and exports them. Both the TLS-vs-HTTP compose-file selector and the
  caddy container then see them, regardless of how the script was
  invoked. This is what the original SSM-driven TLS path was *supposed*
  to do.
* `infra/aws/caddy/Caddyfile.tpl` — added a top-level
  `servers { protocols h1 h2 }` block so Caddy no longer advertises
  HTTP/3 / sets `Alt-Svc`. Browsers now stick to HTTPS-over-TCP, which
  matches what the SG actually allows. Verified externally: response
  no longer carries an `alt-svc` header.

**Recovery steps performed (May 03, 2026, ~07:26 UTC):**

```bash
# from this workspace, with AWS creds in env:
tar czf /tmp/atmemly-infra.tgz -C <repo> infra/aws
aws s3 cp /tmp/atmemly-infra.tgz s3://atmemly-uploads-f960865d/_deploy/

aws ssm send-command --region eu-west-1 \
  --instance-ids i-09d44904cddfaa638 \
  --document-name AWS-RunShellScript \
  --parameters 'commands=["aws s3 cp s3://atmemly-uploads-f960865d/_deploy/atmemly-infra.tgz /tmp/atmemly-infra.tgz --region eu-west-1 && sudo tar -xzf /tmp/atmemly-infra.tgz -C /opt/atmemly/app && sudo SKIP_GIT_PULL=1 /opt/atmemly/app/infra/aws/scripts/deploy.sh"]'
# SSM CommandId: 3c4036f3-b5af-4162-8424-6752b3791170 — Status: Success
```

Post-fix smoke (resolves `app.atmemli.com → 63.34.129.118`):

```
https://app.atmemli.com/api/healthz   → 200 {"status":"ok"}
https://app.atmemli.com/              → HTTP/2 200, server: Caddy + nginx/1.27.5
https://app.atmemli.com/admin/        → HTTP/2 200
http://app.atmemli.com/               → 308 → https://app.atmemli.com/
Alt-Svc header                         → not present (HTTP/3 disabled)
TLS cert                               → CN=app.atmemli.com, issuer Let's Encrypt E8,
                                         valid May  3 05:42 2026 → Aug  1 05:42 2026
```

**Domain spelling note.** The customer-facing host is `app.atmemli.com`
(spelled "atmemli", no `y`). The internal env var / SSM parameter is
`ATMEMLY_DOMAIN` (spelled "atmemly", with `y`). The *value* of
`ATMEMLY_DOMAIN` is `app.atmemli.com`, so DNS, the Let's Encrypt cert
and the Caddy site block are all on the correct hostname. No rename of
the SSM parameter was performed — that would have meant editing
`atmemly-fetch-env`, the IAM policy and every other reference.

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

- [x] **DONE (May 03, 2026):** Removed inbound :22 from
      `aws_security_group.ec2`. Operator shell access is now
      exclusively via AWS SSM Session Manager
      (`aws ssm start-session --region eu-west-1 --target i-09d44904cddfaa638`).
      The EC2 IAM role already has `AmazonSSMManagedInstanceCore`
      attached, so this works without any other changes. The
      `ssh_allowed_cidr` Terraform variable was deleted along with the
      ingress rule. See "Shell access" below.
- [ ] Replace `?sslmode=no-verify` on `DATABASE_URL` with proper RDS
      CA trust: bake the AWS RDS global CA bundle into the api-server
      image and use `?sslmode=verify-full`.
- [ ] Provide your own SSH pubkey via `-var "ssh_public_key=…"` so
      Terraform never holds the private half on disk.
- [ ] Add CloudWatch alarms (EC2 status, RDS storage/CPU, `/api/healthz`
      external probe) and an SNS topic for alerts.
- [x] Move from local Terraform state to a remote encrypted backend
      (S3 + DynamoDB lock) so state isn't only on one operator's box.
      DONE — see "Remote Terraform state" section below.
- [ ] Front the EIP with HTTPS (ACM cert + nginx 443 + custom domain).

## Security tradeoffs in this revision

- Inbound :22 is **closed** in `aws_security_group.ec2`. Operator
  shell access goes through AWS SSM Session Manager — see
  "Shell access" below. This removes the previous "SSH open to
  `0.0.0.0/0` because the Replit executor has no stable egress IP"
  soft-target and means port 22 no longer shows up in internet-wide
  scans of the EIP.
- The Terraform-managed SSH keypair (`aws_key_pair.main`) is still
  installed in `~ubuntu/.ssh/authorized_keys` on the box as a
  break-glass option. It is **only usable** if a future operator
  temporarily re-opens :22 in the SG (e.g. from a known `/32`); until
  then it is dormant.
- HTTPS is live on `app.atmemli.com`; HTTP-only on the bare EIP
  remains as a fallback.
- Admin/marketplace bundles are baked in by `deploy.sh` from the
  current source on the box (no git pull, since this clone has no
  public git remote — see `SKIP_GIT=1` below).

## Shell access (SSM Session Manager)

There is **no inbound :22**. To get a shell on the EC2 box:

```bash
# Interactive shell as ssm-user (sudo to root/ubuntu as needed):
aws ssm start-session \
  --region eu-west-1 \
  --target i-09d44904cddfaa638

# One-shot command (returns stdout/stderr/exit code via SSM):
aws ssm send-command \
  --region eu-west-1 \
  --instance-ids i-09d44904cddfaa638 \
  --document-name AWS-RunShellScript \
  --parameters 'commands=["sudo systemctl status docker"]'
```

Prereqs (one-time, on the operator's laptop):

1. AWS CLI v2 with credentials that allow `ssm:StartSession` on the
   instance (the `Replit` IAM user with `AdministratorAccess` already
   has this; for least-priv, attach `AmazonSSMFullAccess` or a scoped
   policy targeting `i-09d44904cddfaa638`).
2. The Session Manager plugin:
   <https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html>

This works because the EC2 IAM role `atmemly-ec2-role` has
`AmazonSSMManagedInstanceCore` attached and the SSM agent ships with
the Ubuntu 22.04 AMI. No inbound network rules are needed — the
agent dials out to the SSM service over the existing egress.

For redeploys / scp-style file transfer, where the existing snippets
in this doc still show `ssh -i $KEY ubuntu@$EIP …`, swap to one of:

- `aws ssm start-session … --document-name AWS-StartPortForwardingSession`
  to tunnel a local port for `scp`/`rsync`, **or**
- stage the artifact in S3 (`s3://atmemly-uploads-f960865d/_deploy/`)
  and pull it down via `aws ssm send-command` (this is the path that
  the May 03 HTTPS rollout already used — see "HTTPS rollout" below).

If SSM ever becomes unreachable (agent dead, IAM role detached, etc.),
break-glass is: temporarily add an ingress rule for :22 from your
`/32` to `aws_security_group.ec2` via the AWS console, SSH in with
`atmemly-ec2.pem` to repair the agent, then remove the rule.

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

## First GitHub Actions deploy (May 03, 2026)

CI/CD via OIDC is live. Pushes to `main` on
`https://github.com/ayahya1983/Atmemly` automatically deploy.

| Item                       | Value                                                              |
| -------------------------- | ------------------------------------------------------------------ |
| Workflow                   | `.github/workflows/deploy-prod.yml`                                |
| First green run            | https://github.com/ayahya1983/Atmemly/actions/runs/25272656676     |
| Commit SHA deployed        | `575a8bda2f147dbc610c4ee95c7ebbb2dbebe26c`                         |
| OIDC role ARN              | `arn:aws:iam::670687146435:role/atmemly-github-deploy`             |
| EC2 instance ID            | `i-09d44904cddfaa638`                                              |
| SSM CommandId (run 8)      | `7d1b99d3-13d0-4bda-abda-549e2f39ddfb`                             |
| Final SSM status           | `Success`                                                          |

GitHub Actions repository **Variables** (Settings → Secrets and variables → Actions → Variables):

- `AWS_DEPLOY_ROLE_ARN` = `arn:aws:iam::670687146435:role/atmemly-github-deploy`
- `EC2_INSTANCE_ID` = `i-09d44904cddfaa638`
- `AWS_REGION` = `eu-west-1`

The OIDC trust policy only accepts:

- `repo:ayahya1983/Atmemly:ref:refs/heads/main` (push to `main`)
- `repo:ayahya1983/Atmemly:environment:prod` (manual `workflow_dispatch`
  if/when you wire up a `prod` GitHub Environment)

The role's IAM policy allows only `ssm:SendCommand` against the single
EC2 instance + `AWS-RunShellScript`, plus read-only `ssm:Get/List/Describe`
calls used by the workflow to poll command status.

**These resources are Terraform-managed.** They were originally
provisioned via direct `aws iam` CLI calls (because the local
Terraform state for the rest of the live stack — VPC, EC2, RDS, S3 —
had been lost between task runs and there was no remote backend yet,
so a blind `terraform apply` would have tried to recreate the live
infrastructure). The whole live stack has since been imported into
the new S3 remote backend (see "Remote Terraform state" below) and
`terraform plan` reports `No changes`. To reconcile or change the
OIDC pieces in the future:

```bash
cd infra/aws/terraform
terraform init
terraform plan  -var github_owner=ayahya1983 -var github_repo=Atmemly \
  -target='aws_iam_openid_connect_provider.github[0]' \
  -target='aws_iam_role.github_deploy[0]' \
  -target='aws_iam_role_policy.github_deploy[0]'
terraform apply -var github_owner=ayahya1983 -var github_repo=Atmemly \
  -target='aws_iam_openid_connect_provider.github[0]' \
  -target='aws_iam_role.github_deploy[0]' \
  -target='aws_iam_role_policy.github_deploy[0]'
terraform output github_deploy_role_arn
terraform output github_deploy_instance_id
```

The two outputs above are the canonical source for the GitHub
Actions repository Variables — paste them verbatim into
`AWS_DEPLOY_ROLE_ARN` and `EC2_INSTANCE_ID`.

`github_oidc.tf` looks the EC2 instance up via a `data "aws_instance"
"app_for_oidc"` filter on `tag:Name = atmemly-app` so the OIDC stack
can be planned/applied independently of `aws_instance.app` (which is
not yet in this Terraform state). When the rest of the infra is
eventually re-imported into Terraform under a remote backend, the
data source can stay as-is or be swapped back to a direct
`aws_instance.app.id` reference; both yield the same instance ID.

If you ever need to re-bootstrap from a totally empty state, the
import commands are:

```bash
terraform import \
  -var github_owner=ayahya1983 -var github_repo=Atmemly \
  'aws_iam_openid_connect_provider.github[0]' \
  arn:aws:iam::670687146435:oidc-provider/token.actions.githubusercontent.com
terraform import \
  -var github_owner=ayahya1983 -var github_repo=Atmemly \
  'aws_iam_role.github_deploy[0]' atmemly-github-deploy
terraform import \
  -var github_owner=ayahya1983 -var github_repo=Atmemly \
  'aws_iam_role_policy.github_deploy[0]' \
  atmemly-github-deploy:atmemly-github-deploy
```

See "Remote Terraform state" below for the S3 + DynamoDB backend that
now holds state for the entire live stack (VPC, EC2, RDS, S3, IAM,
OIDC, SSM params), so future task runs no longer have to re-import.

### Trigger a deploy

```bash
# Push-triggered (no seed):
git push origin main

# Manual run from the GitHub Actions UI ("Run workflow"):
#   ↳ workflow: Deploy to production
#   ↳ ref:      main
#   ↳ seed:     false   (set true ONLY for the rare destructive reseed)
```

### Tail / debug a run

```bash
gh run list  --workflow=deploy-prod.yml --limit 5
gh run view  <run-id> --log-failed
# or, server-side:
aws ssm get-command-invocation --region eu-west-1 \
  --instance-id i-09d44904cddfaa638 \
  --command-id <command-id> --query 'StandardOutputContent' --output text
```

### Fixes applied to make the first run green

1. `.github/workflows/deploy-prod.yml` — SSM `AWS-RunShellScript`
   executes each `commands[]` entry under `/bin/sh` (dash). The
   original wrapper passed `set -euo pipefail` as a separate command
   which dash rejects with `Illegal option -o pipefail`. Now passes a
   single `sudo -E SEED=… deploy.sh` line and trusts the script's own
   `#!/usr/bin/env bash` + `set -euo pipefail`.
2. `infra/aws/scripts/deploy.sh` — schema-push (and seed) container
   now sets `--env NODE_ENV=development`,
   `--env npm_config_frozen_lockfile=false`, and
   `--env npm_config_confirm_modules_purge=false` on the `docker run`.
   - `NODE_ENV=development` so pnpm installs devDependencies (otherwise
     `drizzle-kit`, a devDep of `@workspace/db`, is missing and
     `pnpm run push` exits with `spawn ENOENT`).
   - `npm_config_frozen_lockfile=false` because the workspace lockfile
     has overrides drift; pnpm 9 otherwise refuses with
     `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`.
   - `npm_config_confirm_modules_purge=false` to skip the interactive
     "remove and reinstall? Y/n" prompt that pnpm 9 raises when the
     existing `node_modules` doesn't match the lockfile layout.
3. `/opt/atmemly/app` on the EC2 host was re-created from a fresh
   `git clone https://github.com/ayahya1983/Atmemly.git` so subsequent
   in-script `git fetch`/`git reset --hard origin/main` works (the
   directory previously had no `.git`, which forced `SKIP_GIT=1`).

## Redeploy

The deploy script lives at `/opt/atmemly/app/infra/aws/scripts/deploy.sh`
on the EC2 host.

Inbound :22 is closed in the security group, so we stage the source
in S3 and drive the redeploy through SSM (the EC2 IAM role has both
S3 RW on the uploads bucket and `AmazonSSMManagedInstanceCore`):

```bash
# From your laptop, push fresh source then redeploy:
INSTANCE_ID=i-09d44904cddfaa638
BUCKET=atmemly-uploads-f960865d

git archive --format=tar.gz -o /tmp/atmemly.tgz HEAD
aws s3 cp /tmp/atmemly.tgz "s3://${BUCKET}/_deploy/atmemly.tgz"

aws ssm send-command --region eu-west-1 \
  --instance-ids "$INSTANCE_ID" \
  --document-name AWS-RunShellScript \
  --parameters commands='[
    "set -euo pipefail",
    "aws s3 cp s3://'"$BUCKET"'/_deploy/atmemly.tgz /tmp/atmemly.tgz",
    "cd /opt/atmemly/app && tar xzf /tmp/atmemly.tgz",
    "sudo SKIP_GIT=1 /opt/atmemly/app/infra/aws/scripts/deploy.sh"
  ]'

# Same, but also re-seed the demo data (DESTRUCTIVE — wipes the DB):
aws ssm send-command --region eu-west-1 \
  --instance-ids "$INSTANCE_ID" \
  --document-name AWS-RunShellScript \
  --parameters commands='[
    "set -euo pipefail",
    "aws s3 cp s3://'"$BUCKET"'/_deploy/atmemly.tgz /tmp/atmemly.tgz",
    "cd /opt/atmemly/app && tar xzf /tmp/atmemly.tgz",
    "sudo SEED=1 SKIP_GIT=1 /opt/atmemly/app/infra/aws/scripts/deploy.sh"
  ]'
```

`SKIP_GIT=1` is required while there's no public git remote; the
script skips `git fetch` automatically when there's no `.git` directory.
Once a remote is wired up, drop `SKIP_GIT=1` and `deploy.sh` will
`git pull` on its own.

## Adding new SSM secrets (Stripe, PayTabs, SSO…)

```bash
aws ssm put-parameter --region eu-west-1 --type SecureString \
  --name /atmemly/STRIPE_SECRET_KEY --value 'sk_live_xxx'

# Refresh /opt/atmemly/.env from SSM and bounce api-server, via SSM:
aws ssm send-command --region eu-west-1 \
  --instance-ids i-09d44904cddfaa638 \
  --document-name AWS-RunShellScript \
  --parameters commands='[
    "sudo /usr/local/bin/atmemly-fetch-env",
    "sudo docker compose -f /opt/atmemly/app/infra/aws/docker-compose.prod.yml up -d --force-recreate api-server"
  ]'
```

## Remote Terraform state

Terraform state for the live `eu-west-1` stack lives in an encrypted,
versioned S3 bucket with DynamoDB locking. The configuration is pinned
in `infra/aws/terraform/providers.tf` (see the `backend "s3"` block);
operators do not need to pass `-backend-config=…` flags.

| Item                | Value                                              |
| ------------------- | -------------------------------------------------- |
| Backend             | `s3`                                               |
| Bucket              | `atmemly-tfstate-670687146435`                     |
| State key           | `atmemly/prod/terraform.tfstate`                   |
| Region              | `eu-west-1`                                        |
| Encryption          | SSE-S3 (AES256), bucket-keys on; `encrypt = true`  |
| Versioning          | Enabled (every state push is a new object version) |
| Public access       | All four block-public-access flags ON              |
| Lock table          | DynamoDB `atmemly-tfstate-locks` (PK `LockID`, on-demand) |

The bucket and table are **bootstrap resources** — created once via
direct `aws` CLI calls (since Terraform itself needs them to exist
before `terraform init`), and tagged `Project=atmemly` /
`Purpose=terraform-state`. They are intentionally **not** declared in
the Terraform config that uses them; managing them inside their own
state would be a chicken-and-egg problem. If you ever need to recreate
the backend from scratch:

```bash
BUCKET=atmemly-tfstate-670687146435
TABLE=atmemly-tfstate-locks
aws s3api create-bucket --bucket "$BUCKET" --region eu-west-1 \
  --create-bucket-configuration LocationConstraint=eu-west-1
aws s3api put-bucket-versioning --bucket "$BUCKET" \
  --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption --bucket "$BUCKET" \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"},"BucketKeyEnabled":true}]}'
aws s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration \
  'BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true'
aws dynamodb create-table --table-name "$TABLE" --region eu-west-1 \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

### Day-to-day usage

```bash
cd infra/aws/terraform
terraform init                                                  # picks up backend automatically
terraform plan  -var github_owner=ayahya1983 -var github_repo=Atmemly
terraform apply -var github_owner=ayahya1983 -var github_repo=Atmemly
```

A clean `terraform plan` against the current live stack reports
**`No changes. Your infrastructure matches the configuration.`** —
the entire stack (VPC, IGW, subnets, route tables + associations,
security groups, EC2 + EIP + key pair, RDS + subnet group,
S3 + PAB + versioning + SSE, IAM EC2 role / instance profile / inline
policy / SSM-core attachment, GitHub OIDC provider + role + policy,
all `/atmemly/*` SSM parameters, `random_password.db` /
`random_password.session_secret`, `random_id.bucket_suffix`) was
imported into this remote state and is now under Terraform management.

### Drift suppression after import

A handful of attributes can never round-trip cleanly from a
post-creation `terraform import` (AWS does not return them on read,
or the import API doesn't capture them), so the live config carries
explicit `lifecycle { ignore_changes = […] }` blocks to keep
`terraform plan` quiet. None of these mask configuration drift you
actually care about; each is documented inline in the `.tf` file:

| Resource                                  | Ignored attributes                       | Why |
| ----------------------------------------- | ---------------------------------------- | --- |
| `aws_instance.app`                        | `ami`, `user_data`, `user_data_replace_on_change` | Ubuntu data source rolls forward; cloud-init template has been edited; `user_data_replace_on_change` is plan-only and not stored in state. To roll any of these, `terraform taint aws_instance.app` then apply. |
| `aws_key_pair.main`                       | `public_key`                             | AWS does not return public_key on read; the fingerprint is checked instead. `var.ssh_public_key` is pinned to the existing key in `variables.tf`. |
| `aws_db_instance.main`                    | `password`, `apply_immediately`          | Both are write-only on RDS. Password matches `random_password.db.result`, which is itself frozen below. |
| `aws_ssm_parameter.{db_password,database_url,session_secret,jwt_secret}` | `value`, `version` | SSM does not return SecureString values on read; without ignore the plan would always rewrite them and bump `version`. |
| `random_password.db`                      | `all`                                    | Realised value lives in `/atmemly/DB_PASSWORD` and on the RDS instance; regenerating would break the DB. |
| `random_password.session_secret`          | `all`                                    | Realised value lives in `/atmemly/SESSION_SECRET` (and is reused for `JWT_SECRET`); regenerating would log every user out. |

`var.ssh_public_key` defaults to the public half of the existing
`atmemly-key` keypair so operators can run `terraform plan` without
needing the private `.pem` (which is not in this repo). The TLS /
local-file resources that originally generated the keypair stay at
`count = 0` whenever `ssh_public_key` is non-empty.

### Bootstrap resources (out-of-band, not in state)

| Resource                                   | ARN / name                                                     |
| ------------------------------------------ | -------------------------------------------------------------- |
| State S3 bucket                            | `arn:aws:s3:::atmemly-tfstate-670687146435`                    |
| State lock DynamoDB table                  | `arn:aws:dynamodb:eu-west-1:670687146435:table/atmemly-tfstate-locks` |

Do **not** add these to Terraform config — losing the state that
manages your state bucket is exactly the failure mode this remote
backend exists to prevent.

## Teardown

```bash
cd infra/aws/terraform && terraform destroy -auto-approve
# S3 bucket has force_destroy=false — empty it manually first:
aws s3 rm s3://atmemly-uploads-f960865d --recursive
```

## Monitoring & alerting (May 03, 2026)

CloudWatch alarms + SNS topic are managed by `infra/aws/terraform/monitoring.tf`.

**Alarms wired up** (all publish to the `atmemly-alerts` SNS topic):

| Alarm                              | Source              | Trigger                                              |
| ---------------------------------- | ------------------- | ---------------------------------------------------- |
| `atmemly-ec2-status-check-failed`  | `AWS/EC2`           | `StatusCheckFailed` >= 1 for 2 minutes               |
| `atmemly-ec2-disk-used-high`       | `CWAgent`           | `disk_used_percent` > 80% on `/` for 10 minutes      |
| `atmemly-rds-free-storage-low`     | `AWS/RDS`           | `FreeStorageSpace` < 5 GB for 5 minutes              |
| `atmemly-rds-cpu-high`             | `AWS/RDS`           | `CPUUtilization` > 80% for 10 minutes                |
| `atmemly-api-healthz-down`         | `AWS/Route53` (us-east-1) | Route53 health check on `/api/healthz` failing |

**Two SNS topics** are created (both named `atmemly-alerts`): one in
`eu-west-1` for the EC2/RDS alarms, and one in `us-east-1` for the
Route53 `/api/healthz` alarm (Route53 health-check metrics only publish
to us-east-1, and CloudWatch alarm actions are region-scoped). Both
topics get the same email/SMS subscribers.

**Subscriber**: `alaa@machinesensiot.com` is auto-subscribed via the
`alert_email` variable. AWS sends **two** confirmation emails on first
apply (one per topic) — **click both "Confirm subscription" links** or
alarms will fire silently. Add more recipients with:

```bash
aws sns subscribe --region eu-west-1 \
  --topic-arn $(terraform output -raw alerts_sns_topic_arn) \
  --protocol email --notification-endpoint <addr>
aws sns subscribe --region us-east-1 \
  --topic-arn $(terraform output -raw alerts_sns_topic_arn_us_east_1) \
  --protocol email --notification-endpoint <addr>
```

Or set `alert_phone` to an E.164 number for SMS.

**EC2 disk metric prerequisite**: `disk_used_percent` is published by the
CloudWatch Agent, which is *not* installed by default. Install it once on
the box (one-time, idempotent):

```bash
aws ssm start-session --target i-09d44904cddfaa638
sudo wget -q https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i -E amazon-cloudwatch-agent.deb
sudo tee /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json >/dev/null <<'JSON'
{ "metrics": { "append_dimensions": { "InstanceId": "${aws:InstanceId}" },
  "metrics_collected": { "disk": { "measurement": ["used_percent"],
    "resources": ["/"], "metrics_collection_interval": 60 } } } }
JSON
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config -m ec2 -s \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
```

`CloudWatchAgentServerPolicy` is attached to the EC2 role by Terraform
(see `iam.tf` `cwagent` attachment), so the agent is allowed to
`PutMetricData` into the `CWAgent` namespace. If metrics don't appear
within ~5 minutes after install, check
`/opt/aws/amazon-cloudwatch-agent/logs/amazon-cloudwatch-agent.log`.

Until the agent is installed, the disk alarm sits in `INSUFFICIENT_DATA`
(intentional — `treat_missing_data = "missing"`), which does not page.

**Verify after `terraform apply`**:

```bash
aws cloudwatch describe-alarms --alarm-name-prefix atmemly- \
  --query 'MetricAlarms[].[AlarmName,StateValue]' --output table
aws sns list-subscriptions-by-topic \
  --topic-arn $(terraform output -raw alerts_sns_topic_arn)
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
10. EC2 cloud-init no longer installs the `nginx` apt package. The
    dockerised nginx in `docker-compose.prod.yml` (or caddy in
    `docker-compose.tls.yml`) is what serves traffic on :80/:443, so
    installing the system nginx only created a port-80 conflict that
    had to be worked around with `systemctl stop nginx && systemctl
    disable nginx`. Dropping the package removes the manual step on
    fresh-box rebuilds.
11. Cloud-init now creates `/opt/atmemly/uploads` owned by uid 10001,
    matching the api-server container's runtime user, so first-boot
    deploys can write uploaded files without a manual `chown`.
12. `deploy.sh` no longer `source`s `/opt/atmemly/.env`. The file is
    consumed by `docker --env-file` verbatim; sourcing it from bash
    would try to interpret shell-significant characters in secret
    values. The script now just `grep`s for `DATABASE_URL` to sanity
    check that the SSM fetch worked.

## Tooling install commands (for reproducibility)

The `.local/bin/` tools do not survive across task agent runs and
were re-installed for this attempt with the same commands as #28:

```bash
mkdir -p /home/runner/workspace/.local/bin
# AWS CLI v2
cd /tmp && curl -fsS https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip -o awscliv2.zip
unzip -q awscliv2.zip
./aws/install -i /home/runner/workspace/.local/aws-cli -b /home/runner/workspace/.local/bin

# Terraform
curl -fsS -o /tmp/tf.zip https://releases.hashicorp.com/terraform/1.9.8/terraform_1.9.8_linux_amd64.zip
(cd /tmp && unzip -o tf.zip)
mv /tmp/terraform /home/runner/workspace/.local/bin/
```

## HTTPS + custom domain (task #25 — code ready, awaiting AWS unblock)

The TLS path is wired up in code so it can be enabled the moment the
EC2/RDS stack actually exists. Nothing was applied (no AWS resources to
apply against), but everything below is on disk:

* `infra/aws/docker-compose.tls.yml` — same services as
  `docker-compose.prod.yml` plus a Caddy container that publishes
  `:80`/`:443`, terminates TLS via Let's Encrypt, and reverse-proxies
  to the (now port-internal) nginx container.
* `infra/aws/caddy/Caddyfile.tpl` — single-host Caddyfile templated on
  `$ATMEMLY_DOMAIN` and `$ATMEMLY_ACME_EMAIL`. Caddy handles HTTP→HTTPS
  redirect by default.
* `infra/aws/scripts/deploy.sh` — auto-switches to the TLS compose file
  whenever `ATMEMLY_DOMAIN` is present (in env or sourced from SSM),
  fails fast if `ATMEMLY_ACME_EMAIL` is missing, and warns if
  `CORS_ORIGINS` doesn't include `https://$ATMEMLY_DOMAIN`.
* `infra/aws/terraform/dns.tf` + new variables in `variables.tf`
  (`domain_name`, `route53_zone_id`, `create_route53_zone`,
  `create_www_record`) — Route53 wiring gated on `domain_name != ""`.
  Default behaviour (empty `domain_name`) keeps Terraform out of DNS
  entirely, since `atmemli.com` lives at the customer's existing
  registrar. The Let's Encrypt contact email is NOT a Terraform
  variable — it is set at runtime via the `/atmemly/ATMEMLY_ACME_EMAIL`
  SSM parameter, consumed by `deploy.sh` and the caddy container.
* `infra/aws/terraform/outputs.tf` — `app_url` flips to
  `https://<domain>/` when a domain is set, plus new `domain_name`,
  `route53_zone_id`, `route53_name_servers` outputs.
* `infra/aws/README.md` §5 rewritten with a concrete runbook for the
  chosen target `app.atmemli.com`.

### Target chosen by the customer

* Hostname: `app.atmemli.com` (subdomain — keeps the existing
  `atmemli.com` apex / other records at the registrar untouched)
* Let's Encrypt contact: `admin@atmemli.com`
* DNS path: customer's existing registrar (no Route53 take-over)
* Required registrar change: a single `A` record
  `app  →  <terraform output ec2_public_ip>` (TTL 300)

### To flip TLS on once IAM is unblocked and `terraform apply` succeeds

```bash
# 1. Add the A record at the atmemli.com registrar:
#      app  A  <ec2_public_ip>  TTL 300
# 2. Seed SSM with the TLS settings:
aws ssm put-parameter --region eu-west-1 --type String --overwrite \
  --name /atmemly/ATMEMLY_DOMAIN     --value 'app.atmemli.com'
aws ssm put-parameter --region eu-west-1 --type String --overwrite \
  --name /atmemly/ATMEMLY_ACME_EMAIL --value 'admin@atmemli.com'
aws ssm put-parameter --region eu-west-1 --type String --overwrite \
  --name /atmemly/CORS_ORIGINS       --value 'https://app.atmemli.com'
# 3. Wait for DNS to resolve to the EIP, then redeploy via SSM
#    (inbound :22 is closed):
aws ssm send-command --region eu-west-1 \
  --instance-ids i-09d44904cddfaa638 \
  --document-name AWS-RunShellScript \
  --parameters 'commands=["sudo /opt/atmemly/app/infra/aws/scripts/deploy.sh"]'
# 4. Smoke:
curl -fsSI https://app.atmemli.com/api/healthz
curl -fsSI http://app.atmemli.com/      # expect 308 → HTTPS
```

Registrar credentials for `atmemli.com` are NOT stored in this repo
or in SSM. The operator who adds the `app` A record should obtain them
out-of-band from the project owner and rotate them immediately after.

## HTTPS rollout — DONE on May 03, 2026

`https://app.atmemli.com` is live and serving on the existing EC2 box
`i-09d44904cddfaa638` (EIP `63.34.129.118`, region eu-west-1).

What was done:

1. DNS: customer added `app.atmemli.com  A  63.34.129.118  TTL 300` at
   the HostiGuard cPanel registrar; Google DNS confirmed propagation.
2. SSM seeded with `/atmemly/ATMEMLY_DOMAIN=app.atmemli.com`,
   `/atmemly/ATMEMLY_ACME_EMAIL=admin@atmemli.com`,
   `/atmemly/CORS_ORIGINS=https://app.atmemli.com`.
3. Updated `infra/aws/` tree (incl. `docker-compose.tls.yml`,
   `caddy/Caddyfile.tpl`, patched `scripts/deploy.sh`) was packaged
   locally, uploaded to `s3://atmemly-uploads-f960865d/_deploy/`, and
   pulled onto the EC2 box via an SSM RunShellScript invocation
   (no SSH key was available locally — `atmemly-ec2.pem` is missing).
4. `docker compose -f docker-compose.tls.yml up -d --remove-orphans`
   recreated the stack: api-server (healthy), nginx (internal),
   caddy (publishes :80 + :443).
5. Caddy obtained a Let's Encrypt cert via the `tls-alpn-01`
   challenge in <5s; cert valid `May  3 05:42 2026 UTC` →
   `Aug  1 05:42 2026 UTC`, issuer `C=US, O=Let's Encrypt, CN=E8`.

Post-deploy smoke (from outside AWS, resolving to the EIP):

```
http://app.atmemli.com/        → 308 → https://app.atmemli.com/
https://app.atmemli.com/api/healthz → 200  {"status":"ok"}
https://app.atmemli.com/admin/      → HTTP/2 200
TLS verify_result = 0 (OK)
```

### Patches that landed during rollout

* `infra/aws/scripts/deploy.sh` now supports `SKIP_GIT_PULL=1` and
  no-ops the git step if `${APP_DIR}/.git` is absent. Needed because
  the EC2 box was hydrated from a tarball, not a git checkout.
* `infra/aws/docker-compose.tls.yml` adds the
  `/opt/atmemly/uploads:/app/uploads` bind mount on the api-server
  service. Without it the container crash-looped with `EACCES` on
  `/app/uploads` (uid 10001 cannot write the image's `/app`). The
  HTTP-only `docker-compose.prod.yml` in this repo is missing that
  same mount — the file currently running on the EC2 box has it,
  so they have drifted; recommend backporting the bind mount in a
  follow-up.

### Operational notes for the next deploy

* The EC2 box has **no `.git` at `/opt/atmemly/app`**. Either:
  (a) `git clone` the repo into `/opt/atmemly/app` so the standard
  `git fetch && git reset --hard` path in `deploy.sh` works, or
  (b) keep using the S3-overlay path used here:
  `tar czf - -C <repo> infra/aws | aws s3 cp - s3://atmemly-uploads-f960865d/_deploy/atmemly-infra.tgz`,
  then SSM-run `aws s3 cp ... | tar -xzf - -C /opt/atmemly/app` and
  invoke `SKIP_GIT_PULL=1 deploy.sh`.
* SSH key (`atmemly-ec2.pem`) is not present in this workspace; all
  remote ops were done via `aws ssm send-command`. The IAM user
  `Replit` has `AdministratorAccess`, which covers SSM.
* Caddy persists ACME state in the docker volumes `atmemly_caddy_data`
  and `atmemly_caddy_config`; do not destroy these or you will hit
  Let's Encrypt's per-week issuance limit.

## Bootstrap readiness report (Task #51, May 03, 2026)

End-to-end audit + verification of `i-09d44904cddfaa638` (eu-west-1)
against `infra/aws/terraform/cloud-init.yaml.tpl`. Goal: a fresh
`sudo deploy.sh` from a cold boot succeeds without any manual
`apt install` / `mkdir` / `chown` first, and a `terraform apply` from a
clean state would produce the same working host.

### Gaps found vs. cloud-init (and how each was closed)

| Gap | Fix landed in this repo | Applied to live host |
| --- | --- | --- |
| `corepack prepare pnpm` pinned to a generic v9 major drifted from `package.json#packageManager` (`pnpm@10.26.1`) — deploy containers re-pinned every run; bare-host pnpm was 9.x. Root cause of Task #50. | `cloud-init.yaml.tpl` now pins `pnpm@10.26.1` to match `package.json#packageManager`. Bump in lockstep. | `sudo corepack prepare pnpm@10.26.1 --activate` ran via SSM; `pnpm -v` → `10.26.1`. |
| `atmemly-fetch-env.service` had no `[Install]` section, so `systemctl enable` errored ("not meant to be enabled"). Service still ran because cloud-init `start`s it; but it was not wired to `multi-user.target`. | Added `[Install] WantedBy=multi-user.target` to the unit in `cloud-init.yaml.tpl`; runcmd now both `enable`s and `start`s it. | Live unit file rewritten via SSM (base64 heredoc), `systemctl daemon-reload && systemctl enable` → symlinked into `multi-user.target.wants/`. |
| `amazon-ssm-agent` was present (snap, online) but cloud-init never asserted it. A future base-image swap could drop it and lock us out of the deploy pipeline entirely. | `cloud-init.yaml.tpl` now `snap install amazon-ssm-agent --classic` (idempotent) and `systemctl enable --now snap.amazon-ssm-agent.amazon-ssm-agent.service`. | Live host already had `amazon-ssm-agent` snap `3.3.4121.0` active+enabled — no change required, just codified. |
| Several runcmd steps re-downloaded artifacts on every boot (Docker GPG key, AWS CLI v2, NodeSource setup). Harmless but slow on re-run. | Each install step now guarded with `command -v` / `test -s` so re-running cloud-init on an existing host is a no-op. | n/a — only matters on next reboot / `terraform taint` cycle. |
| `git clone` would noisily fail on every re-run when `/opt/atmemly/app` already exists. | Guarded with `test -d /opt/atmemly/app/.git`. | n/a. |

Everything else from `cloud-init.yaml.tpl` (Docker CE + compose plugin,
AWS CLI v2, `/opt/atmemly` tree, `/opt/atmemly/.pnpm-store` root-owned,
`/opt/atmemly/uploads` owned by uid 10001:10001 mode 0755,
`/etc/atmemly/site.env`, `/usr/local/bin/atmemly-fetch-env`,
`/opt/atmemly/.env` mode 0600, `ubuntu` in the `docker` group) was
already present and matches.

### Live host snapshot — post-bootstrap

```
docker            29.4.2 (build 055a478)
docker compose    v5.1.3
node              v20.20.2
pnpm              10.26.1                  (matches package.json#packageManager)
aws-cli           2.34.41
psql              14.22
jq                1.6
git               2.34.1
amazon-ssm-agent  3.3.4121.0 (snap, classic, active)

systemctl is-enabled docker                                              → enabled
systemctl is-enabled atmemly-fetch-env.service                           → enabled
systemctl is-enabled snap.amazon-ssm-agent.amazon-ssm-agent.service     → enabled

/etc/atmemly                  drwxr-xr-x root:root
/etc/atmemly/site.env         -rw-r--r-- root:root
/opt/atmemly                  drwxr-xr-x ubuntu:ubuntu
/opt/atmemly/app              drwxr-xr-x root:root      (deploy.sh `git reset --hard`s this)
/opt/atmemly/.env             -rw------- root:root      (written by atmemly-fetch-env from SSM)
/opt/atmemly/.pnpm-store      drwxr-xr-x root:root      (shared cache for one-off pnpm containers)
/opt/atmemly/uploads          drwxr-xr-x 10001:10001    (api-server runs as uid 10001)

id ubuntu → groups=… ,999(docker)
```

### Verification deploy

`deploy.sh` was triggered via SSM Run Command (mirrors the GitHub
Actions path) against the now-bootstrapped host:

```
aws ssm send-command --region eu-west-1 \
  --instance-ids i-09d44904cddfaa638 \
  --document-name AWS-RunShellScript \
  --parameters 'commands=["sudo -E SKIP_GIT_PULL=1 /opt/atmemly/app/infra/aws/scripts/deploy.sh"]'

SSM CommandId : 882a94d9-5da5-4a1b-acbb-6b708da67b64
Status        : Success
```

`SKIP_GIT_PULL=1` was used because this clone has no public git remote
on the box (see "Security tradeoffs" above); the source on disk is
exactly what would have been pulled. The full GH Actions `sudo -E SEED=…
deploy.sh` path is otherwise identical and is what runs on every push to
`main`.

End-to-end the script:
1. Re-ran `atmemly-fetch-env` → `/opt/atmemly/.env` (530 bytes, 0600, root).
2. Auto-detected TLS mode from the SSM-derived `ATMEMLY_DOMAIN`.
3. Built `api-server`, `marketplace`, `admin`, `nginx` images (all CACHED — no source change).
4. Extracted SPA bundles into `atmemly_marketplace_static` / `atmemly_admin_static` volumes, with the post-copy `index.html`/`assets/` sanity check passing.
5. `drizzle-kit push` ran in a `node:20-bookworm-slim` one-off container with `pnpm@10.26.1` (now matching the bare host) — schema unchanged.
6. `docker compose up -d` recreated `api-server` + `nginx`, kept `caddy` running.
7. Healthcheck inside the api-server container passed first try; external probes both green.

### Smoke matrix (post-deploy)

| Probe | Result |
| --- | --- |
| `https://app.atmemli.com/`           | 200 HTTP/2 |
| `https://app.atmemli.com/admin/`     | 200 HTTP/2 |
| `https://app.atmemli.com/api/healthz`| 200 HTTP/2 |
| `Alt-Svc` header on https://app.atmemli.com/ | not present (HTTP/3 still disabled per Task #38 fix) |
| `docker ps`                          | `atmemly-api-server-1` healthy, `atmemly-nginx-1` Up, `atmemly-caddy-1` Up |

### Carry-forward (won't be done in this task)

- `infra/aws/iam.tf` attaches `CloudWatchAgentServerPolicy` to the EC2
  role for the alarm in `monitoring.tf`, but the CloudWatch Agent itself
  isn't installed by cloud-init. Today the `atmemly-ec2-disk-used-high`
  alarm has no data source. Worth installing+configuring the agent in a
  follow-up; out of scope here because no incident has yet been traced to
  the missing metrics.
- The bare-host pnpm version is now pinned, but cloud-init's
  `corepack prepare pnpm@10.26.1` still has to be hand-bumped when
  `package.json#packageManager` changes. A pre-deploy CI check that
  greps both files for the same version would prevent silent drift.

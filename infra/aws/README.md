# ATMEMLY — AWS deployment (eu-west-1)

This directory ships a single-box production deployment of the ATMEMLY
monorepo on AWS:

| Layer            | What                                                   |
| ---------------- | ------------------------------------------------------ |
| Compute          | 1× EC2 (`t3.small` default) in `eu-west-1` + Elastic IP|
| Database         | RDS Postgres 16 (`db.t4g.micro`, 20 GB gp3, single-AZ) |
| Object storage   | Private S3 bucket, EC2 instance role has R/W           |
| Secrets          | AWS SSM Parameter Store under `/atmemly/*`             |
| Reverse proxy    | nginx → api-server (`/api`), admin (`/admin`), marketplace (`/`) |
| Container runtime| Docker + docker compose plugin (installed by cloud-init) |
| IaC              | Terraform (this folder)                                |

The mobile Expo app is published separately (EAS / app stores) and is
not part of this deployment.

---

## 0. Prerequisites

* AWS account + IAM user/role with `AdministratorAccess` (or scoped
  permissions for VPC, EC2, RDS, S3, IAM, SSM, KMS).
* AWS CLI v2 configured locally (`aws configure`) with credentials
  for that account.
* Terraform >= 1.5.
* The ATMEMLY repository pushed to a git remote you can `git clone`
  from the EC2 host. Set `git_repo_url` so cloud-init pre-clones it
  to `/opt/atmemly/app`.

```bash
export AWS_REGION=eu-west-1
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
```

## 1. Terraform — provision infrastructure

```bash
cd infra/aws/terraform
terraform init

# Choose ONE of:
#   (a) Let Terraform generate an SSH key (private key written to
#       ./atmemly-ec2.pem, mode 0600)
terraform apply -var "git_repo_url=https://github.com/your-org/atmemly.git"

#   (b) Bring your own SSH public key
terraform apply \
  -var "git_repo_url=https://github.com/your-org/atmemly.git" \
  -var "ssh_public_key=$(cat ~/.ssh/id_ed25519.pub)" \
  -var "ssh_allowed_cidr=$(curl -s ifconfig.me)/32"
```

Outputs:

* `ec2_public_ip` — Elastic IP of the box.
* `rds_endpoint` — RDS hostname (private; reachable only from EC2).
* `s3_bucket` — uploads bucket.
* `ssh_command` — ready-to-paste SSH command.
* `app_url` — `http://<eip>/`.
* `ssm_parameter_prefix` — `/atmemly/`.

Terraform also seeds these Parameter Store entries automatically:

| Name                          | Value                              |
| ----------------------------- | ---------------------------------- |
| `/atmemly/DATABASE_URL`       | `postgres://atmemly:…@<rds>/atmemly` |
| `/atmemly/DB_PASSWORD`        | (random, 32 chars)                 |
| `/atmemly/SESSION_SECRET`     | (random, 64 chars)                 |
| `/atmemly/JWT_SECRET`         | mirror of `SESSION_SECRET`         |
| `/atmemly/NODE_ENV`           | `production`                       |
| `/atmemly/AWS_REGION`         | `eu-west-1`                        |
| `/atmemly/S3_BUCKET`          | uploads bucket name                |

## 2. Add your own secrets to SSM

Add any payment / SSO secrets you want the api-server to see at boot.
They will be picked up automatically by `atmemly-fetch-env` and
written to `/opt/atmemly/.env`:

```bash
aws ssm put-parameter --region eu-west-1 --type SecureString \
  --name /atmemly/STRIPE_SECRET_KEY --value 'sk_live_xxx'
aws ssm put-parameter --region eu-west-1 --type SecureString \
  --name /atmemly/STRIPE_WEBHOOK_SECRET --value 'whsec_xxx'
aws ssm put-parameter --region eu-west-1 --type String \
  --name /atmemly/CORS_ORIGINS --value "https://yourdomain.com"
# …PayTabs / Telr / SSO providers etc.
```

## 3. First deploy

SSH in (or use `aws ssm start-session`) and run the deploy script.
On the very first deploy, pass `SEED=1` so the demo data lands.

```bash
ssh -i infra/aws/terraform/atmemly-ec2.pem ubuntu@<ec2_public_ip>

# If you didn't pass git_repo_url to Terraform, clone manually:
sudo mkdir -p /opt/atmemly && sudo chown ubuntu:ubuntu /opt/atmemly
git clone https://github.com/your-org/atmemly.git /opt/atmemly/app

SEED=1 sudo /opt/atmemly/app/infra/aws/scripts/deploy.sh
```

Subsequent deploys (no destructive seed):

```bash
sudo /opt/atmemly/app/infra/aws/scripts/deploy.sh
```

`deploy.sh` will:

1. `git pull` the latest commit on the current branch.
2. Refresh `/opt/atmemly/.env` from SSM (`atmemly-fetch-env`).
3. `docker compose build` the api-server + nginx images.
4. Build the marketplace + admin static bundles (multi-stage Dockerfiles)
   and copy them into named docker volumes that nginx serves.
5. Run `pnpm --filter @workspace/db run push` against RDS.
6. (Optional) Run `pnpm --filter @workspace/api-server run seed` if `SEED=1`.
7. `docker compose up -d --remove-orphans`.
8. Smoke-check `http://localhost/api/healthz`.

## 4. Smoke verification

```bash
curl -fsS http://<ec2_public_ip>/api/healthz   # → 200
curl -fsS http://<ec2_public_ip>/              # → marketplace HTML
curl -fsS http://<ec2_public_ip>/admin/        # → admin HTML
```

## 5. Attaching a custom domain over HTTPS

The plain-HTTP-on-EIP stack (`docker-compose.prod.yml`) is the default.
A second compose file, `docker-compose.tls.yml`, swaps in a **Caddy**
container in front of the existing nginx:

* Caddy publishes `:80` and `:443` on the host.
* Caddy auto-issues + auto-renews a Let's Encrypt cert for whatever
  hostname you set in `ATMEMLY_DOMAIN`.
* nginx is moved from `ports: 80:80` to `expose: 80` (internal only).
* HTTP→HTTPS is redirected automatically by Caddy.

Port 443 is already open in `security_groups.tf`, so no SG change needed.

### 5a. Worked example — `app.atmemli.com` on the customer's existing registrar

This is the configuration the project is currently sized for (DNS for
`atmemli.com` lives at the customer's registrar; we add **one** new
record for the app subdomain and don't touch anything else):

```bash
# 1. At the registrar (the existing host for atmemli.com), add:
#      Type: A
#      Name: app
#      Value: <terraform output ec2_public_ip>
#      TTL:   300
#    Nothing else at the registrar needs to change. The apex
#    atmemli.com and any other subdomains keep their current targets.

# 2. Push the TLS settings into SSM so deploy.sh picks them up
#    automatically on every redeploy.
aws ssm put-parameter --region eu-west-1 --type String --overwrite \
  --name /atmemly/ATMEMLY_DOMAIN     --value 'app.atmemli.com'
aws ssm put-parameter --region eu-west-1 --type String --overwrite \
  --name /atmemly/ATMEMLY_ACME_EMAIL --value 'admin@atmemli.com'
aws ssm put-parameter --region eu-west-1 --type String --overwrite \
  --name /atmemly/CORS_ORIGINS       --value 'https://app.atmemli.com'

# 3. Wait for DNS to propagate (usually <5 min, occasionally up to TTL):
dig +short app.atmemli.com    # should return the EIP

# 4. Redeploy. deploy.sh sees ATMEMLY_DOMAIN in /opt/atmemly/.env and
#    switches to docker-compose.tls.yml.
ssh -i infra/aws/terraform/atmemly-ec2.pem ubuntu@<ec2_public_ip> \
  "sudo /opt/atmemly/app/infra/aws/scripts/deploy.sh"

# 5. Smoke
curl -fsSI https://app.atmemli.com/                # 200
curl -fsSI https://app.atmemli.com/api/healthz     # 200
curl -fsSI http://app.atmemli.com/                 # 308 → https://...
```

**Don't do this until DNS resolves to the EIP.** Caddy's HTTP-01 ACME
challenge needs `app.atmemli.com → EIP` so Let's Encrypt can reach
`http://app.atmemli.com/.well-known/acme-challenge/...`. If you bring
the TLS stack up first, Caddy will retry every few minutes; just wait
for DNS and watch `docker compose logs caddy`.

### 5b. Letting Terraform manage DNS in Route53 instead

If you want Terraform to own DNS too — either by creating a brand-new
hosted zone for `atmemli.com` (you'd then point the registrar's NS
records at the values in the `route53_name_servers` output) or by
re-using an existing hosted zone — set the relevant variables:

```bash
# Re-use an existing hosted zone (recommended if atmemli.com is already
# in Route53):
terraform apply \
  -var "domain_name=app.atmemli.com" \
  -var "route53_zone_id=Z123EXAMPLE" \
  -var "create_www_record=false"

# Or have Terraform create a new public hosted zone and use its NS
# records at your registrar (this DOES move DNS authority — only do
# this if you want to consolidate DNS in Route53):
terraform apply \
  -var "domain_name=atmemli.com" \
  -var "create_route53_zone=true" \
  -var "create_www_record=true"
terraform output route53_name_servers   # paste these at the registrar

# (The Let's Encrypt contact email is set at runtime via the
#  /atmemly/ATMEMLY_ACME_EMAIL SSM parameter — see §5a step 2.)
```

The `dns.tf` Route53 resources are gated on `var.domain_name != ""`, so
leaving `domain_name` empty (the default) keeps Terraform from touching
DNS at all.

### 5c. Future upgrade path — ALB + ACM (multi-instance)

When the single-box deploy outgrows itself:

1. Drop the Caddy container (revert to `docker-compose.prod.yml`).
2. Provision an ALB in the public subnets, target group → EC2:80.
3. Issue an ACM cert in `eu-west-1` for `app.atmemli.com`.
4. ALB listener 443 → forward to target group with the ACM cert; HTTP
   listener 80 → redirect to HTTPS.
5. Replace the `app.atmemli.com` A record with a Route53 ALIAS to the
   ALB DNS name.

## 6. Migrating an existing dev database into RDS

`deploy.sh` does not import existing data — it starts fresh from the
schema. To copy a development database into RDS later:

```bash
# from a host with access to BOTH dev DB and the EC2 (SSM tunnel works):
pg_dump --no-owner --no-acl --format=custom \
  "postgres://USER:PASS@old-host:5432/atmemly" > atmemly.dump

# upload + restore on EC2:
scp -i atmemly-ec2.pem atmemly.dump ubuntu@<ec2_public_ip>:/tmp/
ssh -i atmemly-ec2.pem ubuntu@<ec2_public_ip>
source /opt/atmemly/.env
pg_restore --clean --if-exists --no-owner --no-acl \
  --dbname "$DATABASE_URL" /tmp/atmemly.dump
```

## 7. Cost estimate (eu-west-1, on-demand, May 2026)

| Resource                              | Monthly (USD) |
| ------------------------------------- | ------------- |
| EC2 `t3.small` (24×30 h)              | ~$17          |
| EBS gp3 30 GB                         | ~$3           |
| Elastic IP (attached)                 | $0            |
| RDS `db.t4g.micro` single-AZ          | ~$13          |
| RDS gp3 20 GB                         | ~$3           |
| RDS automated backups (7-day, ~5 GB)  | ~$1           |
| S3 (10 GB + minor PUT/GET)            | ~$1           |
| Data transfer (10 GB out)             | ~$1           |
| SSM Parameter Store (Standard tier)   | $0            |
| **Total**                             | **~$35-40**   |

Bumping to `t3.medium` adds ~$17/mo. Switching RDS to multi-AZ roughly
doubles the DB cost.

## 8. Troubleshooting

* **Cloud-init still running.** First boot installs Docker + Node +
  AWS CLI; it can take 3-5 min. Watch with
  `tail -f /var/log/cloud-init-output.log`.
* **`atmemly-fetch-env` failed.** The instance role may be missing
  `ssm:GetParametersByPath` for `/atmemly/*`. Re-apply Terraform.
* **api-server crashes on boot with "DATABASE_URL invalid".**
  Confirm `/atmemly/DATABASE_URL` is reachable:
  `aws ssm get-parameter --with-decryption --name /atmemly/DATABASE_URL`.
* **502 from nginx on `/api/*`.** `docker compose logs api-server`.
  Most common cause: env var validation failure (see `src/lib/env.ts`).
* **Static bundles 404 on `/` or `/admin/`.** Re-run `deploy.sh`; the
  build step writes the SPA into the named volumes.
* **Want to wipe and redeploy.** `terraform destroy` will delete the
  RDS instance (`skip_final_snapshot = true`) and the EC2. The S3
  bucket has `force_destroy = false`, so empty it manually first.

## 9. Out of scope for this revision

* ECS/Fargate, EKS, ALB, multi-AZ RDS, autoscaling, CloudFront.
* CI/CD (GitHub Actions). `deploy.sh` is intentionally
  re-runnable so wiring it into CI later is a one-liner.
* Custom domain wiring is implemented (Caddy + Let's Encrypt via
  `docker-compose.tls.yml`, optional Route53 in `dns.tf`); see §5.
* Mobile app distribution.

---

For a refresher on the workspace layout, see the top-level
`README.md`. For per-artifact runtime notes, see the per-Dockerfile
comments under `artifacts/*/Dockerfile`.

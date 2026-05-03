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

## 5. Attaching a custom domain (deferred — documented only)

Today the box is reachable on the Elastic IP only. When you're ready to
point a domain at it, the path of least resistance is **Caddy on the box**
for automatic HTTPS:

```bash
sudo apt-get install -y caddy
# /etc/caddy/Caddyfile
your-domain.com {
    reverse_proxy localhost:80
}
sudo systemctl reload caddy
# Caddy will fetch + renew a Let's Encrypt cert automatically.
```

You'll also need:

* A Route53 hosted zone for `your-domain.com` (or your registrar's DNS).
* An `A` record `your-domain.com → <ec2_public_ip>`.
* Open port 443 on the EC2 SG (already open in `security_groups.tf`).
* Set `CORS_ORIGINS=https://your-domain.com` in SSM and re-deploy.

For an upgrade path with multi-instance load balancing:

1. Drop Caddy.
2. Provision an ALB in the public subnets, target group → EC2:80.
3. Issue an ACM cert in `eu-west-1` for `your-domain.com`.
4. ALB listener 443 → forward to target group with the ACM cert.
5. Route53 ALIAS `your-domain.com → <alb-dns>`.

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
* Custom domain wiring (deferred per task brief; documented above).
* Mobile app distribution.

---

For a refresher on the workspace layout, see the top-level
`README.md`. For per-artifact runtime notes, see the per-Dockerfile
comments under `artifacts/*/Dockerfile`.

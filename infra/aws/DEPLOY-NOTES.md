# ATMEMLY — AWS deploy notes (eu-west-1)

## Status: STILL BLOCKED on IAM permissions — no AWS resources were created

Two attempts now (tasks #28 and #29) have been halted at the same
pre-flight probe. The task brief for #29 said full IAM access had
been granted, but the `Replit` IAM user still has **no policies
attached** and every required API call returns AccessDenied.

Per the task's explicit safety guardrail ("If anything is still
denied, list the missing perm and stop before spending money"),
`terraform apply` was **not** run. No EC2, RDS, S3, SSM, IAM, VPC,
KMS or EIP resources exist from these attempts.

## What we verified (re-run May 03, 2026)

- AWS CLI v2 (`aws-cli/2.34.41`) installed at
  `/home/runner/workspace/.local/bin/aws`.
- Terraform v1.9.8 installed at
  `/home/runner/workspace/.local/bin/terraform`.
- Credentials are valid:
  ```
  aws sts get-caller-identity --region eu-west-1
  → Account: 670687146435
  → Arn:     arn:aws:iam::670687146435:user/Replit
  → UserId:  AIDAZYKARWHBWNZIFIV35
  ```

## Probe results (eu-west-1, May 03, 2026 — all still denied)

| Probe                              | Result        |
| ---------------------------------- | ------------- |
| `ec2 describe-vpcs`                | UnauthorizedOperation — `ec2:DescribeVpcs` denied |
| `rds describe-db-instances`        | AccessDenied — `rds:DescribeDBInstances` denied   |
| `s3 ls` (`ListBuckets`)            | AccessDenied — `s3:ListAllMyBuckets` denied       |
| `ssm describe-parameters`          | AccessDeniedException — `ssm:DescribeParameters` denied |
| `iam get-user`                     | AccessDenied — `iam:GetUser` denied               |
| `iam list-attached-user-policies`  | AccessDenied — cannot self-introspect             |
| `iam list-user-policies`           | AccessDenied — cannot self-introspect             |
| `kms list-keys`                    | AccessDeniedException — `kms:ListKeys` denied     |

The IAM user `Replit` still has no identity-based policy attached
that grants the permissions Terraform needs. Whatever change was
intended on the AWS console was either not saved, was applied to a
different principal, or was attached to a group the `Replit` user is
not a member of.

## What needs to change in the AWS console

In the AWS console (account `670687146435`, IAM → Users → `Replit`
→ Permissions → Add permissions → Attach policies directly), attach
**either**:

- `AdministratorAccess` (simplest — one click), **or**
- The minimum scoped set:
  - `AmazonEC2FullAccess`
  - `AmazonRDSFullAccess`
  - `AmazonS3FullAccess`
  - `AmazonSSMFullAccess`
  - `IAMFullAccess` (Terraform creates an instance profile + role)
  - `AWSKeyManagementServicePowerUser` (for the SSM SecureString CMK)

Then wait ~30 s for IAM to propagate and re-run the probe before
launching the deploy.

## How to resume once permissions are actually granted

From the workspace root, with `AWS_ACCESS_KEY_ID`,
`AWS_SECRET_ACCESS_KEY`, and `AWS_REGION=eu-west-1` set as Replit
secrets (already done):

```bash
export PATH=/home/runner/workspace/.local/bin:$PATH
aws sts get-caller-identity --region eu-west-1
# Sanity probe — these should all succeed now:
aws ec2 describe-vpcs --region eu-west-1 --max-items 1
aws rds describe-db-instances --region eu-west-1 --max-items 1
aws s3 ls
aws ssm describe-parameters --region eu-west-1 --max-results 1
aws iam get-user

cd infra/aws/terraform
terraform init
terraform apply -auto-approve \
  -var "region=eu-west-1" \
  -var "ssh_allowed_cidr=0.0.0.0/0" \
  -var "git_repo_url=<https url to this repo>"

# Wait ~10 min for RDS, then capture outputs
EIP=$(terraform output -raw ec2_public_ip)
RDS=$(terraform output -raw rds_endpoint)

# First deploy (seed once)
ssh -i ./atmemly-ec2.pem ubuntu@${EIP} \
  "SEED=1 sudo /opt/atmemly/app/infra/aws/scripts/deploy.sh"

# Smoke
curl -fsS http://${EIP}/api/healthz
curl -fsS http://${EIP}/
curl -fsS http://${EIP}/admin/

# To tear the whole stack down later:
cd infra/aws/terraform && terraform destroy -auto-approve
# (S3 bucket has force_destroy=false — empty it manually first.)
```

Subsequent deploys: drop `SEED=1`. The script is idempotent.

## Estimated monthly cost (when it does come up)

~$35–40 USD/mo on-demand in eu-west-1 (per `infra/aws/README.md`
section 7): t3.small EC2 + EIP + db.t4g.micro RDS single-AZ + 20 GB
gp3 + minor S3 + SSM + a little data transfer.

## Ops summary

- Elastic IP:                 not allocated (deploy blocked)
- RDS endpoint:               not provisioned
- SSM parameter prefix:       `/atmemly/` (planned)
- IAM user used:              `arn:aws:iam::670687146435:user/Replit`
- AMI ID:                     n/a (chosen at apply time by ec2.tf)
- Smoke checks:               not run

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

# ATMEMLY — AWS deploy notes (eu-west-1)

## Status: BLOCKED on IAM permissions — no AWS resources were created

The deploy was halted at the pre-flight permissions probe (Step 3 of
the task brief). Per the task's safety guardrail, the executor must
not run `terraform apply` when AccessDenied is returned by the probe
— stopping here avoids a partially-built, billable stack.

`terraform apply` was **not** run. No EC2, RDS, S3, SSM, IAM, VPC or
EIP resources exist from this attempt.

## What we verified

- AWS CLI v2 (`aws-cli/2.34.41`) installed at
  `/home/runner/workspace/.local/bin/aws`.
- Terraform v1.9.8 installed at
  `/home/runner/workspace/.local/bin/terraform`.
- Credentials are valid:
  ```
  aws sts get-caller-identity --region eu-west-1
  → Account: 670687146435
  → Arn:     arn:aws:iam::670687146435:user/Replit
  ```

## What failed (pre-flight probe, eu-west-1)

| Probe                          | Result        |
| ------------------------------ | ------------- |
| `ec2 describe-vpcs`            | UnauthorizedOperation — `ec2:DescribeVpcs` denied |
| `rds describe-db-instances`    | AccessDenied — `rds:DescribeDBInstances` denied   |
| `s3 ls`                        | AccessDenied — `s3:ListAllMyBuckets` denied       |
| `ssm describe-parameters`      | AccessDeniedException — `ssm:DescribeParameters` denied |
| `iam get-user`                 | AccessDenied — `iam:GetUser` denied               |
| `iam list-attached-user-policies` | AccessDenied — cannot self-introspect          |

The IAM user `Replit` has no policy attached that grants the
permissions Terraform needs.

## What the IAM user needs

The single-box stack in `infra/aws/terraform/` provisions VPC + EC2 +
RDS + S3 + SSM + IAM (instance role) + EIP + KMS via the AWS
provider. The cleanest fix is to attach the AWS-managed
`AdministratorAccess` policy to the `Replit` IAM user. If that's too
broad, the minimum scoped set is:

- `AmazonEC2FullAccess`
- `AmazonRDSFullAccess`
- `AmazonS3FullAccess`
- `AmazonSSMFullAccess`
- `IAMFullAccess` (Terraform creates an instance profile + role)
- `AWSKeyManagementServicePowerUser` (for the SSM SecureString CMK)

(Replit's existing AWS integration scopes only what its own services
need; running Terraform from this account requires broader rights.)

## How to resume once permissions are granted

From the workspace root, with `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
and `AWS_REGION=eu-west-1` set as Replit secrets (already done):

```bash
export PATH=/home/runner/workspace/.local/bin:$PATH
aws sts get-caller-identity --region eu-west-1   # sanity check

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

```bash
# AWS CLI v2
cd /tmp && curl -fsS https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip -o awscliv2.zip
unzip -q awscliv2.zip
./aws/install -i /home/runner/workspace/.local/aws-cli -b /home/runner/workspace/.local/bin

# Terraform
curl -fsS -o /tmp/tf.zip https://releases.hashicorp.com/terraform/1.9.8/terraform_1.9.8_linux_amd64.zip
(cd /tmp && unzip -o tf.zip)
mv /tmp/terraform /home/runner/workspace/.local/bin/

# unzip itself was installed via `installSystemDependencies({packages:["unzip"]})`.
```

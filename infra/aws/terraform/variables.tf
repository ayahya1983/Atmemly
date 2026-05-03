variable "region" {
  description = "AWS region for the deployment."
  type        = string
  default     = "eu-west-1"
}

variable "environment" {
  description = "Environment tag (prod, staging, dev)."
  type        = string
  default     = "prod"
}

variable "project" {
  description = "Resource name prefix."
  type        = string
  default     = "atmemly"
}

variable "vpc_cidr" {
  type    = string
  default = "10.40.0.0/16"
}

variable "az_count" {
  description = "Number of availability zones (must be >= 2 for RDS subnet group)."
  type        = number
  default     = 2
}

variable "ec2_instance_type" {
  type    = string
  default = "t3.small"
}

variable "ec2_root_volume_gb" {
  type    = number
  default = 30
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "db_allocated_storage_gb" {
  type    = number
  default = 20
}

variable "db_name" {
  type    = string
  default = "atmemly"
}

variable "db_username" {
  type    = string
  default = "atmemly"
}

variable "db_engine_version" {
  type    = string
  default = "16.6"
}

variable "ssh_public_key" {
  description = "OpenSSH public key string. If empty, Terraform generates a keypair and writes the private key to ./atmemly-ec2.pem."
  type        = string
  default     = ""
}

# NOTE: `ssh_allowed_cidr` was removed when inbound :22 was deleted from
# the EC2 security group. Operator shell access is now via AWS SSM
# Session Manager (`aws ssm start-session --target <instance-id>`); see
# infra/aws/DEPLOY-NOTES.md ("Shell access"). The `ssh_public_key`
# variable above is still honoured because it provisions an
# `aws_key_pair` resource that Terraform attaches to the EC2 instance,
# which is useful as a break-glass option if SSM ever fails AND someone
# temporarily re-opens :22 on the SG.

variable "git_repo_url" {
  description = "HTTPS git URL of the ATMEMLY monorepo. Used by cloud-init / deploy.sh to clone the source on the box."
  type        = string
  default     = ""
}

variable "git_branch" {
  type    = string
  default = "main"
}

###############################################################################
# Custom domain / HTTPS
#
# Leave domain_name empty to keep the HTTP-on-Elastic-IP behaviour. Setting
# it switches Terraform to (optionally) create a Route53 zone and an A record,
# and switches the deploy runbook to the TLS compose stack (Caddy + ACME).
###############################################################################

variable "domain_name" {
  description = "Hostname (apex or subdomain) to attach to the EC2 Elastic IP, e.g. app.atmemli.com or atmemli.com. Empty = HTTP-only on the EIP."
  type        = string
  default     = ""
}

variable "route53_zone_id" {
  description = "Existing Route53 hosted zone ID for domain_name. Leave empty to have Terraform create one when create_route53_zone = true, or to skip Route53 entirely (use your registrar's DNS)."
  type        = string
  default     = ""
}

variable "create_route53_zone" {
  description = "If true and route53_zone_id is empty, Terraform creates a new public hosted zone for domain_name. Set false to keep DNS at your existing registrar."
  type        = bool
  default     = false
}

variable "create_www_record" {
  description = "Also create www.<domain_name> as an A record pointing at the EIP."
  type        = bool
  default     = true
}

# NOTE: the Let's Encrypt / Caddy contact email is configured at runtime via
# the /atmemly/ATMEMLY_ACME_EMAIL SSM parameter (consumed by deploy.sh and
# the caddy container in docker-compose.tls.yml), not via Terraform. Keeping
# this comment so future operators don't add a Terraform var that has no
# effect on cert issuance.

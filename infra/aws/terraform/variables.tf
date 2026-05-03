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
  default = "16.4"
}

variable "ssh_public_key" {
  description = "OpenSSH public key string. If empty, Terraform generates a keypair and writes the private key to ./atmemly-ec2.pem."
  type        = string
  default     = ""
}

variable "ssh_allowed_cidr" {
  description = "CIDR block allowed to SSH to the EC2 instance. Restrict this to your IP/32."
  type        = string
  default     = "0.0.0.0/0"
}

variable "git_repo_url" {
  description = "HTTPS git URL of the ATMEMLY monorepo. Used by cloud-init / deploy.sh to clone the source on the box."
  type        = string
  default     = ""
}

variable "git_branch" {
  type    = string
  default = "main"
}

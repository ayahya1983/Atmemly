terraform {
  required_version = ">= 1.5.0"

  # Remote state — see infra/aws/DEPLOY-NOTES.md ("Remote Terraform state").
  # The S3 bucket and DynamoDB lock table are bootstrap-only (created out of
  # band so they exist before `terraform init`). Both live in the same AWS
  # account/region as the workload and are tagged Project=atmemly.
  backend "s3" {
    bucket         = "atmemly-tfstate-670687146435"
    key            = "atmemly/prod/terraform.tfstate"
    region         = "eu-west-1"
    dynamodb_table = "atmemly-tfstate-locks"
    encrypt        = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.5"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project     = "atmemly"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

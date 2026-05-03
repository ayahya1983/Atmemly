resource "aws_db_subnet_group" "main" {
  name       = "${var.project}-db-subnets"
  subnet_ids = aws_subnet.private[*].id
  tags       = { Name = "${var.project}-db-subnets" }
}

resource "random_password" "db" {
  length  = 32
  special = false

  # The realised value lives in /atmemly/DB_PASSWORD (SecureString) and on
  # the running RDS instance. `terraform import random_password.db <value>`
  # captures `result` but not the generation parameters, so any plan would
  # otherwise want to regenerate (which would change the DB password and
  # break the running app). Keep the existing value frozen.
  lifecycle {
    ignore_changes = all
  }
}

resource "aws_ssm_parameter" "db_password" {
  name        = "/${var.project}/DB_PASSWORD"
  description = "RDS Postgres password for ${var.project}"
  type        = "SecureString"
  value       = random_password.db.result

  # SSM does not return SecureString values on read, so plan would always
  # show drift on `value` and bump `version`. The live value is already in
  # SSM (and matches random_password.db.result, which is now frozen above).
  lifecycle {
    ignore_changes = [value, version]
  }
}

resource "aws_db_instance" "main" {
  identifier              = "${var.project}-db"
  engine                  = "postgres"
  engine_version          = var.db_engine_version
  instance_class          = var.db_instance_class
  allocated_storage       = var.db_allocated_storage_gb
  storage_type            = "gp3"
  storage_encrypted       = true
  db_name                 = var.db_name
  username                = var.db_username
  password                = random_password.db.result
  port                    = 5432
  db_subnet_group_name    = aws_db_subnet_group.main.name
  vpc_security_group_ids  = [aws_security_group.rds.id]
  publicly_accessible     = false
  multi_az                = false
  backup_retention_period = 7
  backup_window           = "02:00-03:00"
  maintenance_window      = "sun:03:30-sun:04:30"
  skip_final_snapshot     = true
  deletion_protection     = false
  apply_immediately       = true

  tags = { Name = "${var.project}-db" }

  # `password` is write-only on AWS — never returned on read, so plan always
  # shows it as needing to be set after import. `apply_immediately` is also
  # not surfaced by RDS describe calls. Both are no-ops on subsequent applies
  # (the password matches what's already on the instance via random_password
  # being frozen with ignore_changes=all).
  lifecycle {
    ignore_changes = [password, apply_immediately]
  }
}

locals {
  database_url = "postgres://${var.db_username}:${random_password.db.result}@${aws_db_instance.main.address}:${aws_db_instance.main.port}/${var.db_name}?sslmode=no-verify"
}

resource "aws_ssm_parameter" "database_url" {
  name        = "/${var.project}/DATABASE_URL"
  description = "ATMEMLY DATABASE_URL"
  type        = "SecureString"
  value       = local.database_url

  lifecycle {
    ignore_changes = [value, version]
  }
}

resource "random_password" "session_secret" {
  length  = 64
  special = false

  # Same rationale as random_password.db: the realised value already lives
  # in /atmemly/SESSION_SECRET (and is reused for /atmemly/JWT_SECRET).
  # Regenerating would log every user out and invalidate every JWT.
  lifecycle {
    ignore_changes = all
  }
}

resource "aws_ssm_parameter" "session_secret" {
  name  = "/${var.project}/SESSION_SECRET"
  type  = "SecureString"
  value = random_password.session_secret.result

  lifecycle {
    ignore_changes = [value, version]
  }
}

resource "aws_ssm_parameter" "jwt_secret" {
  name  = "/${var.project}/JWT_SECRET"
  type  = "SecureString"
  value = random_password.session_secret.result

  lifecycle {
    ignore_changes = [value, version]
  }
}

resource "aws_ssm_parameter" "node_env" {
  name  = "/${var.project}/NODE_ENV"
  type  = "String"
  value = "production"
}

resource "aws_ssm_parameter" "s3_bucket" {
  name  = "/${var.project}/S3_BUCKET"
  type  = "String"
  value = aws_s3_bucket.uploads.bucket
}

resource "aws_ssm_parameter" "aws_region" {
  name  = "/${var.project}/AWS_REGION"
  type  = "String"
  value = var.region
}

resource "aws_ssm_parameter" "storage_driver" {
  name  = "/${var.project}/STORAGE_DRIVER"
  type  = "String"
  value = "s3"
}

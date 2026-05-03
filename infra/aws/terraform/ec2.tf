data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd*/ubuntu-jammy-22.04-amd64-server-*"]
  }
}

resource "tls_private_key" "generated" {
  count     = var.ssh_public_key == "" ? 1 : 0
  algorithm = "ED25519"
}

resource "local_file" "generated_key" {
  count           = var.ssh_public_key == "" ? 1 : 0
  filename        = "${path.module}/atmemly-ec2.pem"
  content         = tls_private_key.generated[0].private_key_openssh
  file_permission = "0600"
}

resource "aws_key_pair" "main" {
  key_name   = "${var.project}-key"
  public_key = var.ssh_public_key != "" ? var.ssh_public_key : tls_private_key.generated[0].public_key_openssh

  # AWS does not return public_key on read, so after `terraform import` the
  # state has public_key = "" and any plan would force replacement (which
  # would invalidate SSH access for any existing instance launched with this
  # key). Pinning the key in `var.ssh_public_key` plus this ignore makes the
  # import idempotent: the fingerprint already matches what's in AWS.
  lifecycle {
    ignore_changes = [public_key]
  }
}

locals {
  cloud_init = templatefile("${path.module}/cloud-init.yaml.tpl", {
    project    = var.project
    region     = var.region
    git_repo   = var.git_repo_url
    git_branch = var.git_branch
  })
}

resource "aws_instance" "app" {
  ami                         = data.aws_ami.ubuntu.id
  instance_type               = var.ec2_instance_type
  subnet_id                   = aws_subnet.public[0].id
  vpc_security_group_ids      = [aws_security_group.ec2.id]
  key_name                    = aws_key_pair.main.key_name
  iam_instance_profile        = aws_iam_instance_profile.ec2.name
  associate_public_ip_address = true
  user_data = local.cloud_init
  # NOTE: user_data_replace_on_change defaults to false; we previously set it
  # explicitly but that shows as a phantom diff after import (the attribute is
  # plan-time-only and not stored in state). Leaving it at the default.

  root_block_device {
    volume_size           = var.ec2_root_volume_gb
    volume_type           = "gp3"
    encrypted             = true
    delete_on_termination = true
  }

  tags = { Name = "${var.project}-app" }

  depends_on = [aws_db_instance.main]

  # The Ubuntu data source returns whatever the latest matching AMI is in
  # eu-west-1 today, which is not the AMI the live instance was launched
  # from. Same story for user_data: the cloud-init template has been edited
  # since first boot and would only re-run on instance replacement anyway.
  # Ignore both so `terraform plan` doesn't try to recreate the running box.
  # When you actually want to roll the AMI / cloud-init, do it via a
  # `terraform taint aws_instance.app` + `terraform apply` cycle.
  lifecycle {
    ignore_changes = [ami, user_data, user_data_replace_on_change]
  }
}

resource "aws_eip" "app" {
  instance = aws_instance.app.id
  domain   = "vpc"
  tags     = { Name = "${var.project}-eip" }
}

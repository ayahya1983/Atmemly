output "ec2_public_ip" {
  value       = aws_eip.app.public_ip
  description = "Elastic IP attached to the app instance."
}

output "ec2_public_dns" {
  value       = aws_instance.app.public_dns
  description = "Default EC2 public DNS name (use as ALIAS target if you wire DNS)."
}

output "rds_endpoint" {
  value       = aws_db_instance.main.address
  description = "RDS Postgres endpoint hostname."
}

output "s3_bucket" {
  value       = aws_s3_bucket.uploads.bucket
  description = "S3 bucket for uploads / static assets."
}

output "ssh_command" {
  value = var.ssh_public_key == "" ? "ssh -i ${path.module}/atmemly-ec2.pem ubuntu@${aws_eip.app.public_ip}" : "ssh ubuntu@${aws_eip.app.public_ip}"
  description = "Ready-to-paste SSH command."
}

output "app_url" {
  value       = "http://${aws_eip.app.public_ip}/"
  description = "Public marketplace URL once deploy.sh has run."
}

output "ssm_parameter_prefix" {
  value       = "/${var.project}/"
  description = "All app secrets live under this prefix in SSM Parameter Store."
}

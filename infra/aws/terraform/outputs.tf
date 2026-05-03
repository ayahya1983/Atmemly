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
  value       = var.ssh_public_key == "" ? "ssh -i ${path.module}/atmemly-ec2.pem ubuntu@${aws_eip.app.public_ip}" : "ssh ubuntu@${aws_eip.app.public_ip}"
  description = "Ready-to-paste SSH command."
}

output "app_url" {
  value       = var.domain_name != "" ? "https://${var.domain_name}/" : "http://${aws_eip.app.public_ip}/"
  description = "Public marketplace URL once deploy.sh has run. HTTPS once a domain is attached."
}

output "ssm_parameter_prefix" {
  value       = "/${var.project}/"
  description = "All app secrets live under this prefix in SSM Parameter Store."
}

output "domain_name" {
  value       = var.domain_name
  description = "Hostname (apex or subdomain) attached to the EIP (empty when running HTTP-only on the EIP)."
}

output "route53_zone_id" {
  value       = local.effective_zone_id
  description = "Hosted zone ID used for the A record (empty if Route53 isn't managed by Terraform)."
}

output "route53_name_servers" {
  value       = local.create_zone ? aws_route53_zone.primary[0].name_servers : []
  description = "Nameservers for the Terraform-created hosted zone. Point your registrar at these to activate DNS."
}

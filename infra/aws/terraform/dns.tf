###############################################################################
# Route53 wiring (optional)
#
# Only created when var.domain_name is non-empty. Two modes:
#   1. var.route53_zone_id supplied → re-use that hosted zone.
#   2. var.route53_zone_id empty AND var.create_route53_zone = true →
#      Terraform creates a new public hosted zone for var.domain_name.
#
# In either mode an A record is written for var.domain_name (apex or
# subdomain — both work; `www.` alias is only created when
# var.create_www_record = true and only really makes sense for an apex)
# pointing to the EC2 Elastic IP. After `terraform apply`, update your
# registrar's nameservers to the values in the `route53_name_servers`
# output if Terraform created the zone.
###############################################################################

locals {
  dns_enabled       = var.domain_name != ""
  use_existing_zone = local.dns_enabled && var.route53_zone_id != ""
  create_zone       = local.dns_enabled && var.route53_zone_id == "" && var.create_route53_zone
  effective_zone_id = local.use_existing_zone ? var.route53_zone_id : (local.create_zone ? aws_route53_zone.primary[0].zone_id : "")
}

resource "aws_route53_zone" "primary" {
  count = local.create_zone ? 1 : 0
  name  = var.domain_name
  tags  = { Name = "${var.project}-zone" }
}

resource "aws_route53_record" "apex" {
  count   = local.dns_enabled && local.effective_zone_id != "" ? 1 : 0
  zone_id = local.effective_zone_id
  name    = var.domain_name
  type    = "A"
  ttl     = 300
  records = [aws_eip.app.public_ip]
}

resource "aws_route53_record" "www" {
  count   = local.dns_enabled && local.effective_zone_id != "" && var.create_www_record ? 1 : 0
  zone_id = local.effective_zone_id
  name    = "www.${var.domain_name}"
  type    = "A"
  ttl     = 300
  records = [aws_eip.app.public_ip]
}

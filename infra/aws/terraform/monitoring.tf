###############################################################################
# CloudWatch monitoring + SNS alerting for the single-box ATMEMLY stack.
#
# Alarms wired up here:
#   - EC2 StatusCheckFailed (instance + system reachability)
#   - EC2 root-disk used > 80% (requires CloudWatch Agent on the box; see
#     DEPLOY-NOTES.md "Monitoring" section for the agent install snippet)
#   - RDS FreeStorageSpace < 5 GB
#   - RDS CPUUtilization > 80% for 10 minutes
#   - External HTTP probe of http://<eip>/api/healthz via a Route53 health
#     check (us-east-1 metric, hence the aliased provider below)
#
# All alarms publish to a single SNS topic; a confirmation email is sent to
# var.alert_email on first apply (and on any address change).
###############################################################################

# Route53 health-check metrics are only published in us-east-1, so we need a
# second provider alias just for the metric alarm.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = "atmemly"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

variable "alert_email" {
  description = "Email address subscribed to the alarm SNS topic. Leave empty to create the topic without a subscriber."
  type        = string
  default     = "alaa@machinesensiot.com"
}

variable "alert_phone" {
  description = "Optional E.164 phone number (e.g. +971501234567) to subscribe for SMS alerts. Leave empty to skip."
  type        = string
  default     = ""
}

variable "ec2_disk_used_threshold_percent" {
  type    = number
  default = 80
}

variable "rds_free_storage_threshold_bytes" {
  description = "Trigger when RDS FreeStorageSpace drops below this many bytes (default 5 GB)."
  type        = number
  default     = 5368709120
}

variable "rds_cpu_threshold_percent" {
  type    = number
  default = 80
}

###############################################################################
# SNS topic + subscriptions
###############################################################################

resource "aws_sns_topic" "alerts" {
  name = "${var.project}-alerts"
  tags = { Name = "${var.project}-alerts" }
}

resource "aws_sns_topic_subscription" "email" {
  count     = var.alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

resource "aws_sns_topic_subscription" "sms" {
  count     = var.alert_phone != "" ? 1 : 0
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "sms"
  endpoint  = var.alert_phone
}

# Route53 health-check metrics only publish to us-east-1, and CloudWatch
# alarm actions are region-scoped -- so we need a parallel SNS topic in
# us-east-1 for the api-healthz alarm to notify against. Same email/SMS
# subscribers are wired up here as well.
resource "aws_sns_topic" "alerts_use1" {
  provider = aws.us_east_1
  name     = "${var.project}-alerts"
  tags     = { Name = "${var.project}-alerts" }
}

resource "aws_sns_topic_subscription" "email_use1" {
  provider  = aws.us_east_1
  count     = var.alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.alerts_use1.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

resource "aws_sns_topic_subscription" "sms_use1" {
  provider  = aws.us_east_1
  count     = var.alert_phone != "" ? 1 : 0
  topic_arn = aws_sns_topic.alerts_use1.arn
  protocol  = "sms"
  endpoint  = var.alert_phone
}

###############################################################################
# EC2 alarms
###############################################################################

resource "aws_cloudwatch_metric_alarm" "ec2_status_check" {
  alarm_name          = "${var.project}-ec2-status-check-failed"
  alarm_description   = "EC2 instance or system status check has failed for 2 consecutive minutes."
  namespace           = "AWS/EC2"
  metric_name         = "StatusCheckFailed"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 2
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "breaching"

  dimensions = {
    InstanceId = aws_instance.app.id
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
}

# disk_used_percent is published by the CloudWatch Agent under the "CWAgent"
# namespace. The agent must be installed on the box for this alarm to leave
# INSUFFICIENT_DATA -- see the Monitoring section in DEPLOY-NOTES.md.
resource "aws_cloudwatch_metric_alarm" "ec2_disk_used" {
  alarm_name          = "${var.project}-ec2-disk-used-high"
  alarm_description   = "Root filesystem on the app EC2 is above ${var.ec2_disk_used_threshold_percent}% used."
  namespace           = "CWAgent"
  metric_name         = "disk_used_percent"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  threshold           = var.ec2_disk_used_threshold_percent
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "missing"

  dimensions = {
    InstanceId = aws_instance.app.id
    path       = "/"
    fstype     = "ext4"
    device     = "nvme0n1p1"
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
}

###############################################################################
# RDS alarms
###############################################################################

resource "aws_cloudwatch_metric_alarm" "rds_free_storage" {
  alarm_name          = "${var.project}-rds-free-storage-low"
  alarm_description   = "RDS FreeStorageSpace dropped below 5 GB on ${aws_db_instance.main.identifier}."
  namespace           = "AWS/RDS"
  metric_name         = "FreeStorageSpace"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 1
  threshold           = var.rds_free_storage_threshold_bytes
  comparison_operator = "LessThanThreshold"
  treat_missing_data  = "breaching"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.identifier
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "rds_cpu_high" {
  alarm_name          = "${var.project}-rds-cpu-high"
  alarm_description   = "RDS CPUUtilization sustained above ${var.rds_cpu_threshold_percent}% for 10 minutes."
  namespace           = "AWS/RDS"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  threshold           = var.rds_cpu_threshold_percent
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.identifier
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
}

###############################################################################
# External HTTP probe of /api/healthz
#
# Route53 health checks run from multiple AWS regions and publish the
# HealthCheckStatus metric to CloudWatch in us-east-1. We point the check at
# the Elastic IP (not the hostname) so the alarm keeps working even before
# var.domain_name is set.
###############################################################################

resource "aws_route53_health_check" "api_healthz" {
  ip_address        = aws_eip.app.public_ip
  port              = 80
  type              = "HTTP"
  resource_path     = "/api/healthz"
  failure_threshold = 3
  request_interval  = 30
  measure_latency   = true

  tags = {
    Name = "${var.project}-api-healthz"
  }
}

resource "aws_cloudwatch_metric_alarm" "api_healthz" {
  provider = aws.us_east_1

  alarm_name          = "${var.project}-api-healthz-down"
  alarm_description   = "External HTTP probe of http://${aws_eip.app.public_ip}/api/healthz is failing."
  namespace           = "AWS/Route53"
  metric_name         = "HealthCheckStatus"
  statistic           = "Minimum"
  period              = 60
  evaluation_periods  = 2
  threshold           = 1
  comparison_operator = "LessThanThreshold"
  treat_missing_data  = "breaching"

  dimensions = {
    HealthCheckId = aws_route53_health_check.api_healthz.id
  }

  alarm_actions = [aws_sns_topic.alerts_use1.arn]
  ok_actions    = [aws_sns_topic.alerts_use1.arn]
}

###############################################################################
# Outputs
###############################################################################

output "alerts_sns_topic_arn" {
  value       = aws_sns_topic.alerts.arn
  description = "Primary (eu-west-1) SNS topic receiving EC2/RDS alarm notifications. Subscribe extra emails/phones via the AWS console or `aws sns subscribe`."
}

output "alerts_sns_topic_arn_us_east_1" {
  value       = aws_sns_topic.alerts_use1.arn
  description = "Parallel us-east-1 SNS topic used by the Route53 /api/healthz alarm (Route53 metrics only publish to us-east-1)."
}

output "alerts_email_subscribed" {
  value       = var.alert_email
  description = "Email address subscribed at apply time (must click the AWS confirmation link before alerts start arriving)."
}

output "api_healthz_health_check_id" {
  value       = aws_route53_health_check.api_healthz.id
  description = "Route53 health-check ID probing /api/healthz from outside AWS."
}

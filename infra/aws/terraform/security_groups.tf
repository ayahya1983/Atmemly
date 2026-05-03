resource "aws_security_group" "ec2" {
  name        = "${var.project}-ec2-sg"
  description = "ATMEMLY EC2 host: HTTP/HTTPS from anywhere. No inbound SSH; shell access via AWS SSM Session Manager."
  vpc_id      = aws_vpc.main.id

  # NOTE: inbound :22 is intentionally absent. The EC2 IAM role has
  # AmazonSSMManagedInstanceCore attached, so operators get a shell via
  # `aws ssm start-session --target <instance-id>` without exposing SSH
  # to the internet. See infra/aws/DEPLOY-NOTES.md ("Shell access").

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "All egress"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project}-ec2-sg" }
}

resource "aws_security_group" "rds" {
  name        = "${var.project}-rds-sg"
  description = "ATMEMLY RDS Postgres: 5432 from EC2 SG only."
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Postgres from EC2"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ec2.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project}-rds-sg" }
}

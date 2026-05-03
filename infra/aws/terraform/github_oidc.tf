###############################################################################
# GitHub Actions OIDC -> AWS role used by .github/workflows/deploy-prod.yml
#
# Lets the workflow assume an AWS role without long-lived access keys, then
# call `aws ssm send-command` against the app EC2 instance to run deploy.sh.
###############################################################################

variable "github_owner" {
  description = "GitHub org/user that owns the repository (e.g. 'atmemly'). Leave empty to skip creating the GitHub OIDC role."
  type        = string
  default     = ""
}

variable "github_repo" {
  description = "GitHub repository name (e.g. 'atmemly-monorepo'). Leave empty to skip creating the GitHub OIDC role."
  type        = string
  default     = ""
}

variable "github_deploy_ref" {
  description = "Git ref (branch) allowed to assume the deploy role. Defaults to refs/heads/main."
  type        = string
  default     = "refs/heads/main"
}

locals {
  github_oidc_enabled = var.github_owner != "" && var.github_repo != ""
}

# One OIDC provider per AWS account is enough; Terraform-manages it here.
resource "aws_iam_openid_connect_provider" "github" {
  count           = local.github_oidc_enabled ? 1 : 0
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  # GitHub publishes the thumbprint(s) of its OIDC JWKS; AWS no longer strictly
  # validates this for the github provider but the field is still required.
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

data "aws_iam_policy_document" "github_assume" {
  count = local.github_oidc_enabled ? 1 : 0

  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github[0].arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # Only allow the configured repo + ref (e.g. pushes to main) to assume.
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values = [
        "repo:${var.github_owner}/${var.github_repo}:ref:${var.github_deploy_ref}",
        "repo:${var.github_owner}/${var.github_repo}:environment:prod",
      ]
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  count              = local.github_oidc_enabled ? 1 : 0
  name               = "${var.project}-github-deploy"
  assume_role_policy = data.aws_iam_policy_document.github_assume[0].json
  description        = "Assumed by GitHub Actions to trigger SSM-driven prod deploys."
}

data "aws_iam_policy_document" "github_deploy" {
  count = local.github_oidc_enabled ? 1 : 0

  # Allow running the AWS-RunShellScript document only against the app EC2.
  statement {
    sid     = "SsmSendCommandToAppInstance"
    effect  = "Allow"
    actions = ["ssm:SendCommand"]
    resources = [
      "arn:aws:ec2:${var.region}:*:instance/${aws_instance.app.id}",
      "arn:aws:ssm:${var.region}::document/AWS-RunShellScript",
    ]
  }

  # Allow polling for command status / output.
  statement {
    sid    = "SsmReadCommandStatus"
    effect = "Allow"
    actions = [
      "ssm:GetCommandInvocation",
      "ssm:ListCommandInvocations",
      "ssm:ListCommands",
      "ssm:DescribeInstanceInformation",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "github_deploy" {
  count  = local.github_oidc_enabled ? 1 : 0
  name   = "${var.project}-github-deploy"
  role   = aws_iam_role.github_deploy[0].id
  policy = data.aws_iam_policy_document.github_deploy[0].json
}

output "github_deploy_role_arn" {
  value       = local.github_oidc_enabled ? aws_iam_role.github_deploy[0].arn : ""
  description = "Set this as the AWS_DEPLOY_ROLE_ARN GitHub Actions variable."
}

output "github_deploy_instance_id" {
  value       = aws_instance.app.id
  description = "Set this as the EC2_INSTANCE_ID GitHub Actions variable."
}

#cloud-config
package_update: true
package_upgrade: true
packages:
  - ca-certificates
  - curl
  - gnupg
  - git
  - unzip
  - jq
  - nginx
  - postgresql-client

write_files:
  - path: /etc/atmemly/site.env
    permissions: "0644"
    content: |
      ATMEMLY_PROJECT=${project}
      AWS_REGION=${region}
      ATMEMLY_GIT_REPO=${git_repo}
      ATMEMLY_GIT_BRANCH=${git_branch}

  - path: /usr/local/bin/atmemly-fetch-env
    permissions: "0755"
    content: |
      #!/usr/bin/env bash
      # Pull every /atmemly/* SSM Parameter into /opt/atmemly/.env
      set -euo pipefail
      mkdir -p /opt/atmemly
      umask 077
      tmp="$(mktemp)"
      aws ssm get-parameters-by-path \
        --region "${region}" \
        --path "/${project}" \
        --with-decryption \
        --recursive \
        --query 'Parameters[*].[Name,Value]' \
        --output text |
        while IFS=$'\t' read -r name value; do
          key="$${name##*/}"
          # escape backslashes and double quotes for safe shell sourcing
          esc=$$(printf '%s' "$value" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')
          printf '%s="%s"\n' "$key" "$esc" >> "$tmp"
        done
      mv "$tmp" /opt/atmemly/.env
      chmod 0600 /opt/atmemly/.env

  - path: /etc/systemd/system/atmemly-fetch-env.service
    permissions: "0644"
    content: |
      [Unit]
      Description=Refresh ATMEMLY .env from SSM Parameter Store
      Wants=network-online.target
      After=network-online.target
      [Service]
      Type=oneshot
      ExecStart=/usr/local/bin/atmemly-fetch-env

runcmd:
  # Install Docker CE + compose plugin
  - install -m 0755 -d /etc/apt/keyrings
  - curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  - chmod a+r /etc/apt/keyrings/docker.gpg
  - echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
  - apt-get update -y
  - apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  - usermod -aG docker ubuntu
  - systemctl enable --now docker

  # Install AWS CLI v2
  - curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
  - unzip -q /tmp/awscliv2.zip -d /tmp
  - /tmp/aws/install
  - rm -rf /tmp/aws /tmp/awscliv2.zip

  # Install pnpm + Node 20 via corepack so deploy.sh can run pnpm install if needed
  - curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  - apt-get install -y nodejs
  - corepack enable
  - corepack prepare pnpm@9 --activate

  # Bootstrap project directory
  - mkdir -p /opt/atmemly
  - chown -R ubuntu:ubuntu /opt/atmemly

  # Initial fetch of SSM env (deploy.sh will refresh on every deploy)
  - systemctl daemon-reload
  - systemctl start atmemly-fetch-env.service || true

  # Optional: clone repo if a URL was provided
  - |
    if [ -n "${git_repo}" ]; then
      sudo -u ubuntu git clone --branch "${git_branch}" "${git_repo}" /opt/atmemly/app || true
    fi

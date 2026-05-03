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
          # docker --env-file reads KEY=VALUE literally and does NOT
          # interpret quotes, so write unquoted values. Newlines aren't
          # supported in env-file values; reject them defensively.
          case "$value" in *$'\n'*) echo "ERROR: $key contains a newline" >&2; exit 1 ;; esac
          printf '%s=%s\n' "$key" "$value" >> "$tmp"
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

  # Shared pnpm store. The schema-push and seed one-off containers in
  # deploy.sh bind-mount this directory at /pnpm-store (with
  # npm_config_store_dir=/pnpm-store) so successive `pnpm install` runs
  # reuse the package cache instead of re-downloading every dependency
  # from the registry on every deploy. The node:20-bookworm-slim image
  # runs as root, so root ownership is correct here.
  - mkdir -p /opt/atmemly/.pnpm-store
  - chown -R root:root /opt/atmemly/.pnpm-store
  - chmod 0755 /opt/atmemly/.pnpm-store

  # Uploads dir is bind-mounted into the api-server container at /app/uploads.
  # The container runs as uid 10001, so the host directory must be owned by
  # the same uid (the user does not exist on the host — that's fine).
  - mkdir -p /opt/atmemly/uploads
  - chown -R 10001:10001 /opt/atmemly/uploads
  - chmod 0755 /opt/atmemly/uploads

  # Initial fetch of SSM env (deploy.sh will refresh on every deploy)
  - systemctl daemon-reload
  - systemctl start atmemly-fetch-env.service || true

  # Optional: clone repo if a URL was provided
  - |
    if [ -n "${git_repo}" ]; then
      sudo -u ubuntu git clone --branch "${git_branch}" "${git_repo}" /opt/atmemly/app || true
    fi

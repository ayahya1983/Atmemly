#!/usr/bin/env bash
# Verify the pinned pnpm version is identical in every place that matters
# for a production deploy. Drift here silently broke a prod deploy once
# (Task #50) -- this check exists to catch the next one in CI.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${repo_root}"

pkg_file="package.json"
cloud_init_file="infra/aws/terraform/cloud-init.yaml.tpl"
deploy_file="infra/aws/scripts/deploy.sh"

for f in "${pkg_file}" "${cloud_init_file}" "${deploy_file}"; do
  if [[ ! -f "${f}" ]]; then
    echo "check-pnpm-version: missing required file: ${f}" >&2
    exit 2
  fi
done

# Use `|| true` on each grep so a missing pattern produces an empty
# string rather than tripping `set -e` mid-pipeline. We want the
# friendly diagnostics below to fire, not an opaque pipefail exit.

# 1. package.json#packageManager -> "pnpm@X.Y.Z"
pkg_version="$(
  { grep -Eo '"packageManager"[[:space:]]*:[[:space:]]*"pnpm@[0-9]+\.[0-9]+\.[0-9]+"' "${pkg_file}" || true; } \
    | head -n1 \
    | { grep -Eo 'pnpm@[0-9]+\.[0-9]+\.[0-9]+' || true; } \
    | sed 's/^pnpm@//'
)"

# 2. cloud-init.yaml.tpl -> `corepack prepare pnpm@X.Y.Z --activate`
cloud_init_versions="$(
  { grep -Eo 'pnpm@[0-9]+\.[0-9]+\.[0-9]+' "${cloud_init_file}" || true; } \
    | sed 's/^pnpm@//' \
    | sort -u
)"

# 3. deploy.sh -> any literal `pnpm@X.Y.Z`
deploy_versions="$(
  { grep -Eo 'pnpm@[0-9]+\.[0-9]+\.[0-9]+' "${deploy_file}" || true; } \
    | sed 's/^pnpm@//' \
    | sort -u
)"

fail=0

if [[ -z "${pkg_version}" ]]; then
  echo "check-pnpm-version: could not parse pnpm version from ${pkg_file}#packageManager" >&2
  fail=1
fi

if [[ -z "${cloud_init_versions}" ]]; then
  echo "check-pnpm-version: no pnpm@X.Y.Z literal found in ${cloud_init_file}" >&2
  fail=1
fi

if [[ -z "${deploy_versions}" ]]; then
  echo "check-pnpm-version: no pnpm@X.Y.Z literal found in ${deploy_file}" >&2
  fail=1
fi

check_match() {
  local file="$1" versions="$2"
  while IFS= read -r v; do
    [[ -z "${v}" ]] && continue
    if [[ "${v}" != "${pkg_version}" ]]; then
      echo "check-pnpm-version: ${file} pins pnpm@${v} but ${pkg_file}#packageManager is pnpm@${pkg_version}" >&2
      fail=1
    fi
  done <<< "${versions}"
}

check_match "${cloud_init_file}" "${cloud_init_versions}"
check_match "${deploy_file}"     "${deploy_versions}"

if [[ "${fail}" -ne 0 ]]; then
  cat >&2 <<EOF

pnpm version drift detected.
All three files must pin the SAME pnpm version:
  - ${pkg_file}                ("packageManager": "pnpm@X.Y.Z")
  - ${cloud_init_file}         (corepack prepare pnpm@X.Y.Z --activate)
  - ${deploy_file}             (corepack prepare pnpm@X.Y.Z --activate)
EOF
  exit 1
fi

echo "check-pnpm-version: OK (pnpm@${pkg_version} pinned consistently across package.json, cloud-init, deploy.sh)"

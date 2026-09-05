#!/usr/bin/env bash
# Configure GitHub SSH auth from the GITHUB_SSH_PRIVATE_KEY Cursor secret.
# Idempotent: safe to run on every boot via environment start.
set -euo pipefail

SSH_DIR="${HOME}/.ssh"
KEY_PATH="${SSH_DIR}/id_ed25519"
CONFIG_PATH="${SSH_DIR}/config"
KNOWN_HOSTS_PATH="${SSH_DIR}/known_hosts"

mkdir -p "${SSH_DIR}"
chmod 700 "${SSH_DIR}"

if [[ -z "${GITHUB_SSH_PRIVATE_KEY:-}" ]]; then
  echo "setup-github-ssh: GITHUB_SSH_PRIVATE_KEY is not set."
  echo "Add it as a Runtime Secret in the Cloud Agents dashboard, then restart the agent."
  exit 1
fi

# Accept raw OpenSSH/PEM private keys or base64-encoded key material.
KEY_MATERIAL="${GITHUB_SSH_PRIVATE_KEY}"
if [[ "${KEY_MATERIAL}" != *"BEGIN"* ]]; then
  if decoded="$(printf '%s' "${KEY_MATERIAL}" | base64 -d 2>/dev/null)" && [[ "${decoded}" == *"BEGIN"* ]]; then
    KEY_MATERIAL="${decoded}"
  fi
fi

if [[ "${KEY_MATERIAL}" != *"BEGIN"* ]]; then
  echo "setup-github-ssh: GITHUB_SSH_PRIVATE_KEY does not look like a private key."
  echo "Paste the full private key (including BEGIN/END lines), or a base64 encoding of it."
  exit 1
fi

# Normalize newlines (secrets UIs sometimes flatten them) and write the key.
printf '%s\n' "${KEY_MATERIAL}" | sed 's/\r$//' > "${KEY_PATH}"
chmod 600 "${KEY_PATH}"

# Derive the public key when possible (needed for identity checks).
if [[ ! -f "${KEY_PATH}.pub" ]]; then
  ssh-keygen -y -f "${KEY_PATH}" > "${KEY_PATH}.pub" 2>/dev/null || true
  chmod 644 "${KEY_PATH}.pub" 2>/dev/null || true
fi

# Pin github.com to this identity; avoid leaking other keys.
cat > "${CONFIG_PATH}" <<'EOF'
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519
  IdentitiesOnly yes
  AddKeysToAgent yes
EOF
chmod 600 "${CONFIG_PATH}"

# Ensure GitHub host keys are trusted (idempotent).
touch "${KNOWN_HOSTS_PATH}"
chmod 644 "${KNOWN_HOSTS_PATH}"
if ! ssh-keygen -F github.com -f "${KNOWN_HOSTS_PATH}" >/dev/null 2>&1; then
  ssh-keyscan -t ed25519,rsa github.com >> "${KNOWN_HOSTS_PATH}" 2>/dev/null || true
fi

echo "setup-github-ssh: wrote ${KEY_PATH} and ${CONFIG_PATH}"

# Non-fatal connectivity probe so start still succeeds if GitHub is briefly unreachable.
if ssh -T -o BatchMode=yes -o StrictHostKeyChecking=yes git@github.com 2>&1 | tee /tmp/github-ssh-probe.txt | grep -q "successfully authenticated"; then
  echo "setup-github-ssh: GitHub SSH authentication succeeded."
  exit 0
fi

# GitHub returns exit 1 even on success with the "Hi user!" message.
if grep -qiE "Hi .+! You've successfully authenticated|successfully authenticated" /tmp/github-ssh-probe.txt; then
  echo "setup-github-ssh: GitHub SSH authentication succeeded."
  exit 0
fi

echo "setup-github-ssh: key is installed, but GitHub rejected authentication."
echo "Confirm the matching public key is added at https://github.com/settings/keys"
echo "Probe output:"
cat /tmp/github-ssh-probe.txt || true
exit 1

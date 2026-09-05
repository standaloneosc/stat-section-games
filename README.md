# GitHub SSH for private repos

Cloud Agent environment that authenticates to GitHub over SSH so agents can clone and pull private repositories (`git@github.com:...`).

## How it works

1. You add a private key as the Cursor secret `GITHUB_SSH_PRIVATE_KEY`.
2. You add the matching public key to your GitHub account (or as a deploy key on specific private repos).
3. On every agent boot, `scripts/setup-github-ssh.sh` writes the key to `~/.ssh` and verifies `git@github.com` auth.

The primary workspace checkout still uses Cursor’s GitHub App connection. SSH is for agent-driven clones: private dependencies, submodules, sibling repos, and `git@github.com` remotes.

## One-time setup

### 1. Create an SSH key (if you do not already have one)

```bash
ssh-keygen -t ed25519 -C "cursor-cloud-agent" -f ./cursor-github -N ""
```

### 2. Add the public key to GitHub

- Account-wide: [GitHub → Settings → SSH and GPG keys](https://github.com/settings/keys) → New SSH key → paste `cursor-github.pub`
- Or per-repo: repository Settings → Deploy keys → add `cursor-github.pub` (read-only is enough for clones)

### 3. Add the private key as a Cursor secret

1. Open [Cloud Agents secrets](https://cursor.com/dashboard/cloud-agents)
2. Add secret name: `GITHUB_SSH_PRIVATE_KEY`
3. Value: full contents of the private key file (`cursor-github`), including the `BEGIN` / `END` lines  
   (base64-encoding the file is also supported)
4. Prefer **Runtime Secret** so the key is redacted from transcripts

### 4. Save this environment

After the agent validates setup, click **Save** in the Environment panel so future agents reuse it.

## Local / agent verification

```bash
./scripts/setup-github-ssh.sh
ssh -T git@github.com
# Expect: Hi <username>! You've successfully authenticated...
git ls-remote git@github.com:<org>/<private-repo>.git HEAD
```

## Notes

- Never commit private keys. Keep them only in Cursor secrets.
- For repos the Cursor GitHub App already can access, HTTPS + App token is often enough; use SSH when you specifically need `git@github.com` remotes.
- To expand App-token scope for HTTPS clones of extra repos, use `repositoryDependencies` in `.cursor/environment.json` (`github.com/org/repo` form) and grant the App access to those repos.

# Production deploy pipeline — one-time setup

`.github/workflows/deploy-prod.yml` builds whichever of `tech-tools-api`, `admin-dashboard`, `e-commerce-web-store` actually changed on a push to `main`, pushes the image(s) to GitHub Container Registry, then SSHs into the server over Tailscale to pull and swap them (`server-scripts/deploy-from-registry.sh`). The server never builds anything anymore.

None of this works until the steps below are done once. Nothing here needs repeating after.

## 1. Generate a dedicated deploy key (don't reuse your personal one)

On your own machine, not the server:

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ./techtools-deploy-key -N ""
```

This makes `techtools-deploy-key` (private) and `techtools-deploy-key.pub` (public). Keeping this separate from `~/.ssh/hetzner_nexusai` means it can be revoked later without touching your own access.

Add the **public** key to the server:

```bash
ssh -i ~/.ssh/hetzner_nexusai root@100.92.116.9 "cat >> ~/.ssh/authorized_keys" < ./techtools-deploy-key.pub
```

## 2. Create a Tailscale OAuth client

GitHub's runners aren't on your tailnet — this lets the workflow join it for just the deploy step, without ever exposing SSH publicly.

1. Go to https://login.tailscale.com/admin/settings/oauth
2. Generate an OAuth client, scoped to write access for **Devices**.
3. In the tailnet's **Access Controls**, make sure a `tag:ci` tag exists and is allowed to reach the server's tag/host over SSH (the default ACL usually allows this already — if you've customized ACLs, add a rule permitting `tag:ci` → your server).
4. Copy the generated **Client ID** and **Client Secret** — you'll paste them into GitHub secrets next.

## 3. Add GitHub repository secrets

Repo → Settings → Secrets and variables → Actions → **Secrets** tab → New repository secret, for each of:

| Secret | Value |
|---|---|
| `TS_OAUTH_CLIENT_ID` | From step 2 |
| `TS_OAUTH_CLIENT_SECRET` | From step 2 |
| `HETZNER_TAILSCALE_HOST` | `100.92.116.9` (the server's Tailscale address you already SSH to) |
| `HETZNER_SSH_USER` | `root` |
| `HETZNER_SSH_KEY` | The full contents of `techtools-deploy-key` (the **private** key from step 1) |

`GITHUB_TOKEN` (used to push images to GHCR) is automatic — nothing to add for that.

## 4. Add repository variables (not secrets — these are public values anyway)

Same screen, **Variables** tab. These are optional — the workflow already has sensible defaults baked in (`https://techtoolstore.com/api/v1` etc.) that match what `rebuild.sh` has always used, so you only need to set these if a value differs from that default, or to fill in the Tawk widget IDs if you use live chat:

| Variable | Example |
|---|---|
| `NEXT_PUBLIC_TAWK_SITE_ID` | your Tawk site ID |
| `VITE_TAWK_SITE_ID` | same value |

(`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_MEDIA_URL`, `NEXT_PUBLIC_BASE_PATH`, `VITE_API_URL`, `VITE_MEDIA_URL`, and both `*_TAWK_WIDGET_ID`s all have working defaults already — only add them here if you need to override one.)

## 5. Make the GHCR packages public (one-time, after the first successful run)

The repo is public, but GitHub Container Registry packages default to **private** even then — the server would otherwise need a login token just to pull. Making them public removes that entirely.

After the workflow runs once successfully:

1. Go to your GitHub profile/org → **Packages** tab.
2. You'll see `enterprise-grade-e-commerce-api`, `-admin-dashboard`, `-web-store` (whichever ones already built).
3. For each: package Settings → Change visibility → **Public**.

Repeat this the first time each new package appears (i.e. the first time each of the 3 services builds — likely all on the very first run).

## 6. First deploy

Push anything to `main` and watch the **Actions** tab. Once it's green, confirm on the server:

```bash
docker compose -f infrastructure/docker-compose.prod.yml images
```

You should see `ghcr.io/mucrypt/enterprise-grade-e-commerce-*` image names, not locally-built ones.

---

**After this**: pushing to `main` deploys automatically. `server-scripts/rebuild.sh` and `update.sh` still work as a manual fallback (they build locally on the server, same as before) if you ever need to deploy without CI — e.g. testing an uncommitted change.

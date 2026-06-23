<p align="center">
    <img src="doc/demo/logo.png" width="80px" />
    <h1 align="center">Cloud Mail - Subpath Deployment Fork</h1>
    <p align="center">A fork of <a href="https://github.com/maillab/cloud-mail">maillab/cloud-mail</a> with subpath deployment support</p>
    <p align="center">
        <a href="/README.md">简体中文</a> | English
    </p>
    <p align="center">
        <a href="https://github.com/maillab/cloud-mail/tree/main?tab=MIT-1-ov-file" target="_blank">
            <img src="https://img.shields.io/badge/license-MIT-green" />
        </a>
        <a href="https://github.com/maillab/cloud-mail/releases" target="_blank">
            <img src="https://img.shields.io/github/v/release/maillab/cloud-mail" alt="releases" />
        </a>
    </p>
</p>

## What This Fork Changes

The original Cloud Mail can only be deployed on a **root domain** or **subdomain** (e.g., `mail.yourdomain.com`). This fork adds **subpath deployment** capability, allowing the mail system to run at `yourdomain.com/mail`, sharing the same root domain with your main site without interference.

### Original vs This Fork

| Aspect | Original | This Fork |
|--------|----------|-----------|
| Access URL | `mail.yourdomain.com` | `yourdomain.com/mail` |
| Domain Usage | Occupies a subdomain | Shares root domain with main site |
| DNS Config | Requires subdomain record | No extra DNS records needed |
| Main Site | Subdomain is independent | Isolated via Route rules |
| Use Case | Has spare subdomains available | Limited domain resources |

### Core Change

Introduced a `base_path` environment variable. When configured, the Worker strips this prefix at the entry layer before routing; the frontend uses Vite's base config to automatically prefix all asset references and API requests.

**When `base_path` is not configured, behavior is identical to the original — fully backward compatible.**

## Change Details

**11 files modified** across backend, frontend, and CI/CD.

### Backend (mail-worker) — 4 files

#### `src/index.js` — Entry route prefix stripping

Added `base_path` prefix stripping logic at the Worker entry point.

```diff
+ let basePath = env.base_path || '';
+ if (basePath.endsWith('/')) basePath = basePath.slice(0, -1);
+ if (basePath) {
+     if (url.pathname === basePath) url.pathname = '/';
+     else if (url.pathname.startsWith(basePath + '/')) url.pathname = url.pathname.substring(basePath.length);
+     else return env.assets.fetch(req);
+ }
  // existing /api/ routing unchanged
```

#### `src/service/telegram-service.js` — Telegram URL adaptation

Insert `base_path` when constructing Telegram Web App URLs.

#### `wrangler.toml` / `wrangler-action.toml` / `wrangler-dev.toml` — Config files

Added `base_path` variable declaration to all three Wrangler configs.

### Frontend (mail-vue) — 5 files

#### `.env.release` — Build path config

```diff
- VITE_BASE_URL = '/api'
+ VITE_BASE_URL = '/mail/api'
+ VITE_STATIC_URL = '/mail/'
```

#### `index.html` — Absolute to relative paths

Changed image references from absolute to relative paths.

#### `src/views/login/index.vue` — Dynamic LinuxDo icon path

#### `src/components/tiny-editor/index.vue` — Dynamic TinyMCE asset paths

#### `public/_headers` — Cache rules with prefix

### CI/CD — 1 file

#### `.github/workflows/deploy-cloudflare.yml` — Deploy workflow

Added `BASE_PATH` variable support.

## Deployment

### 1. Environment Variables

| Variable | Value | Description |
|----------|-------|-------------|
| `domain` | `["yourdomain.com"]` | Email domain |
| `admin` | `admin@yourdomain.com` | Admin email |
| `jwt_secret` | `your_secret` | JWT secret |
| `base_path` | `/mail` | **New in this fork** — Subpath prefix |

### 2. Database Bindings

| Type | Variable | Required |
|------|----------|----------|
| D1 Database | `db` | Yes |
| KV Namespace | `kv` | Yes |

### 3. Cloudflare Route

Use **Route** rules instead of Custom Domain:

```
yourdomain.com/mail/* → your Worker
```

### 4. Initialize Database

```
https://yourdomain.com/mail/api/init/your_jwt_secret
```

### 5. Access

Visit `https://yourdomain.com/mail` to use the mail system.

## Design Principles

- **Minimal invasion**: Prefix stripping at entry layer, near-zero internal code changes
- **Fully compatible**: Without `base_path`, behaves identically to original
- **Config-driven**: Control deployment path via environment variable

## Upstream

Forked from [maillab/cloud-mail](https://github.com/maillab/cloud-mail). Thanks to the original author.

## License

[MIT](LICENSE)

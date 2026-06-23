<p align="center">
    <img src="doc/demo/logo.png" width="80px" />
    <h1 align="center">Cloud Mail - 子路径部署改进版</h1>
    <p align="center">基于 <a href="https://github.com/maillab/cloud-mail">maillab/cloud-mail</a> 的 Fork，支持将邮箱系统部署到子路径</p>
    <p align="center">
        <a href="https://github.com/maillab/cloud-mail/tree/main?tab=MIT-1-ov-file" target="_blank">
            <img src="https://img.shields.io/badge/license-MIT-green" />
        </a>
        <a href="https://github.com/maillab/cloud-mail/releases" target="_blank">
            <img src="https://img.shields.io/github/v/release/maillab/cloud-mail" alt="releases" />
        </a>
    </p>
</p>

## 本 Fork 改了什么

原版 Cloud Mail 只能部署在**根域名**或**子域名**（如 `mail.yourdomain.com`）上。本 Fork 新增了**子路径部署**能力，让邮箱系统可以运行在 `yourdomain.com/mail` 这样的路径下，与主站共用同一个域名，互不干扰。

### 原版方案 vs 本 Fork 方案

| 对比项 | 原版方案 | 本 Fork 方案 |
|--------|---------|-------------|
| 访问地址 | `mail.yourdomain.com` | `yourdomain.com/mail` |
| 域名占用 | 独占一个子域名 | 与主站共用根域名 |
| DNS 配置 | 需要添加子域名解析 | 无需额外 DNS 记录 |
| 主站影响 | 子域名独立，不影响主站 | 通过 Route 规则隔离，不影响主站 |
| 适用场景 | 有多余子域名可用 | 域名资源紧张，想共用根域名 |

### 核心改动

引入了一个名为 `base_path` 的环境变量。配置后，Worker 会在入口层自动剥离该前缀，内部路由逻辑完全不变；前端通过 Vite 的 base 配置，让所有资源引用和 API 请求自动带上前缀。

**不配置 `base_path` 时，行为与原版完全一致，完全向后兼容。**

## 改动详情

共修改 **11 个文件**，涉及后端、前端和 CI/CD 三个部分。

### 后端（mail-worker）— 4 个文件

#### `src/index.js` — 入口路由前缀剥离

Worker 入口文件新增 `base_path` 前缀剥离逻辑。请求到达后，先去掉子路径前缀，再交给原有的路由处理。

```diff
+ // 读取 base_path 配置
+ let basePath = env.base_path || '';
+ if (basePath.endsWith('/')) basePath = basePath.slice(0, -1);
+
+ // 匹配则剥离前缀，不匹配则返回静态资源
+ if (basePath) {
+     if (url.pathname === basePath) {
+         url.pathname = '/';
+     } else if (url.pathname.startsWith(basePath + '/')) {
+         url.pathname = url.pathname.substring(basePath.length);
+     } else {
+         return env.assets.fetch(req);
+     }
+ }

  if (url.pathname.startsWith('/api/')) {
      url.pathname = url.pathname.replace('/api', '')
      // ...原有逻辑不变
  }
```

#### `src/service/telegram-service.js` — Telegram 链接适配

构造 Telegram Web App URL 时，在域名和 `/api` 之间插入 `base_path`。

```diff
- const webAppUrl = `${domain}/api/telegram/getEmail/${jwtToken}`
+ const webAppUrl = `${domain}${basePath}/api/telegram/getEmail/${jwtToken}`
```

#### `wrangler.toml` / `wrangler-action.toml` / `wrangler-dev.toml` — 配置文件

三个 Wrangler 配置文件均新增 `base_path` 变量声明。

```diff
  [vars]
  domain = ["yourdomain.com"]
  admin = "admin@yourdomain.com"
  jwt_secret = "your_jwt_secret"
+ base_path = "/mail"
```

### 前端（mail-vue）— 5 个文件

#### `.env.release` — 构建路径配置

调整 Vite 的 base 路径和 API 基础 URL，让打包后的资源引用和接口请求自动带上 `/mail` 前缀。

```diff
- VITE_BASE_URL = '/api'
+ VITE_BASE_URL = '/mail/api'
+ VITE_STATIC_URL = '/mail/'
```

#### `index.html` — 绝对路径改相对路径

HTML 中两处图片引用从绝对路径改为相对路径，避免子路径下 404。

```diff
- <link rel="icon" href="/public/mail.png">
+ <link rel="icon" href="mail.png">

- <img class="loading-image" src="/mail-pwa.png">
+ <img class="loading-image" src="mail-pwa.png">
```

#### `src/views/login/index.vue` — LinuxDo 图标动态路径

登录页 LinuxDo 按钮图标从硬编码绝对路径改为动态拼接。

```diff
- <el-avatar src="/image/linuxdo.webp" />
+ <el-avatar :src="baseUrl + 'image/linuxdo.webp'" />

+ const baseUrl = import.meta.env.BASE_URL;
```

#### `src/components/tiny-editor/index.vue` — TinyMCE 资源动态路径

富文本编辑器的脚本和样式文件改为动态拼接路径。

```diff
- script.src = '/tinymce/tinymce.min.js';
+ script.src = import.meta.env.BASE_URL + 'tinymce/tinymce.min.js';

- content_css: `/tinymce/css/index.css,...`
+ content_css: `${import.meta.env.BASE_URL}tinymce/css/index.css,...`
```

#### `public/_headers` — 缓存规则路径

Cloudflare Pages 缓存规则的路径匹配加上 `/mail` 前缀。

```diff
- /assets/*
+ /mail/assets/*
    Cache-Control: public, max-age=31556952, immutable
```

### CI/CD — 1 个文件

#### `.github/workflows/deploy-cloudflare.yml` — 部署工作流

新增 `BASE_PATH` 变量支持，包括环境变量注入、配置模板替换、数据库初始化 URL 适配。

```diff
  env:
    DOMAIN: ${{ secrets.DOMAIN }}
    ADMIN: ${{ secrets.ADMIN }}
    JWT_SECRET: ${{ secrets.JWT_SECRET }}
+   BASE_PATH: ${{ secrets.BASE_PATH || vars.BASE_PATH }}
```

## 部署方式

### 1. 配置环境变量

在 Cloudflare Workers 的环境变量中添加：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `domain` | `["yourdomain.com"]` | 邮件域名 |
| `admin` | `admin@yourdomain.com` | 管理员邮箱 |
| `jwt_secret` | `你的密钥` | JWT 密钥 |
| `base_path` | `/mail` | **本 Fork 新增** — 子路径前缀 |

### 2. 绑定数据库

| 绑定类型 | 变量名 | 必需 |
|---------|--------|------|
| D1 数据库 | `db` | 是 |
| KV 命名空间 | `kv` | 是 |

### 3. 配置 Cloudflare Route

不要使用 Custom Domain（会拦截整个域名），改为设置 **Route** 规则：

```
yourdomain.com/mail/* → 指向你的 Worker
```

这样只有 `/mail/*` 的请求进入邮箱系统，其他请求正常访问主站。

### 4. 初始化数据库

部署完成后访问：

```
https://yourdomain.com/mail/api/init/你的jwt_secret
```

### 5. 登录使用

访问 `https://yourdomain.com/mail` 即可使用邮箱系统。

## 设计原则

- **最小侵入**：前缀剥离在入口层处理，内部业务代码几乎零改动
- **完全兼容**：不配置 `base_path` 时与原版行为完全一致
- **配置驱动**：通过环境变量控制部署路径，无需修改代码

## 文档

- [改动说明详情](doc/subpath-deploy/changes/index.html) — 完整的代码改动对比
- [后台使用指南](doc/subpath-deploy/guide/index.html) — 13 章节完整使用手册
- [原版部署文档](https://doc.skymail.ink) — 原版 Cloud Mail 官方文档

## 上游项目

本项目 Fork 自 [maillab/cloud-mail](https://github.com/maillab/cloud-mail)，感谢原作者的贡献。

## 许可证

[MIT](LICENSE)

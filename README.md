# Bili Web · 本地轻装版

适配 iPhone Safari 的非官方 B 站界面：顶部搜索、首张大卡、双列推荐、底部导航、下拉刷新、搜索、网页播放、清晰度选择和关注动态。Cloudflare **仅分发静态文件**，所有 B 站 API 与视频请求都由用户设备直接发出。

## iPhone Safari 安装

1. 从 App Store 安装 [Userscripts](https://apps.apple.com/app/userscripts/id1463298887)，打开一次，并在 iPhone 的 Safari 扩展设置中启用它。
2. Safari 打开 [安装页面](https://bili-web.jiojiojackson.workers.dev/)，点击「安装本地脚本」，在 Safari 扩展菜单中打开 Userscripts 并确认安装。也可把 `.user.js` 保存到 Userscripts 脚本目录。
3. 打开 [B 站](https://www.bilibili.com/?bili_lite=on)，允许 Userscripts 访问 B 站。安装时可能还需要临时允许访问本静态分发站。不需要给予所有网站访问权限。
4. 需要登录时，点击头像进入 B 站官方登录，返回后刷新状态。脚本不接管登录页面。

安装方法依据 [Userscripts 官方文档](https://github.com/quoid/userscripts#usage)。本项目匹配 `www.bilibili.com` 与 `m.bilibili.com`，仅在首页和 BV 视频页启用；其他官方功能和登录页面保留原样。脚本使用 `GM.xmlHttpRequest` 作为 Safari 跨域限制下的本地扩展请求后备，并限定 API 目标域名。

## 工作方式

```text
Cloudflare → 用户设备：安装文件、JavaScript、CSS、更新
用户设备 ↔ B 站：官方登录、推荐、搜索、动态、视频
```

浏览器原生 `fetch(credentials: include)` 优先使用官方登录状态，不读取 `document.cookie`，不复制或另行缓存账号 Cookie。跨域请求后备由设备上的 Userscripts 扩展执行，依然直接访问 `api.bilibili.com`。没有公共代理、后端账号中转、数据库或视频转发接口。

全部界面代码、样式和 MD5 签名依赖打包到 `bili-local.user.js` 中。安装后运行界面不需要再次从 Cloudflare 加载代码。元数据更新检查仅下载静态文件。代码使用未压缩构建便于审阅。

推荐缓存、浏览记录、本机稍后再看保存在 B 站域名下的 localStorage。稍后再看不与 B 站账号同步。官方账号登录缓存由 Safari 和 B 站管理，脚本无法延长登录有效期。

Cloudflare 已移除动态 Worker；`wrangler.jsonc` 只有静态资产配置。旧的 `/api/bili` 和 `/media` 不再提供服务，静态分发页会清除旧版 Service Worker 和本项目旧版凭据数据库。

## 恢复官方界面

点击「我的 → 返回官方界面」，或访问 `https://www.bilibili.com/?bili_lite=off`，也可以在扩展中停用脚本。脚本不会自动点赞、关注、修改账号设置或退出官方账号。

## 构建与部署

Node.js 22 或以上版本：

```sh
npm ci
npm run build
npm test
npm run dev
```

Cloudflare Workers 连接本仓库的 `main` 分支；Build command 为 `npm run build`，Deploy command 为 `npx wrangler deploy`，Root directory 为 `/`。无需任何账号环境变量、KV、D1 或 R2。

构建生成安装页、`bili-local.user.js`、更新元数据、CSS 和供手动书签启动的 `bili-local.js`。书签入口依赖浏览器和网站 CSP；iPhone Safari 使用 Userscripts 为主要安装路径。

## 验证与限制

自动检查验证固定的 B 站 API 域名、本地运行来源限制、原生浏览器凭据处理、无后端部署配置和安装文件不包含旧账号中转代码。完整的 iPhone Safari 扩展、登录与触摸手势仍需在实际手机上验证。

本地请求可以避开 Cloudflare 出口 IP 造成的限制，但本地网络、账号、请求频率和 B 站自身的接口变更仍可能触发风控，不能保证永不封控。推荐结果由 B 站生成，刷新可能有重复。网页播放使用 B 站官方播放接口返回的 MP4 地址。播放器可选择返回的清晰度档位，并在切换成功后尽量恢复播放进度；实际档位以接口 `quality` 字段为准。若 B 站将请求的 1080P 降级到 480P，则不会把它误标成 1080P，而是保留原画质并提示原因。部分高画质只提供音视频分离的 DASH 流，当前原生 Safari `<video>` 播放器不支持这些档位，因此不能保证每个视频均可选 1080P。高清可能依赖登录或会员资格；不绕过会员、付费或地域限制。

用户脚本和扩展可以修改获准网站的页面，安装前应审阅并信任代码。Cloudflare 与 GitHub 上的发布权限也意味着能分发未来的脚本更新。

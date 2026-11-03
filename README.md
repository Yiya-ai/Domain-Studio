# Domain Studio · 域名发现与监控工作台

中文 | [English](README.en.md)

将 **Domain-Hunter** 的 Svelte 界面、命名与价格能力，与 **domain-check** 的 Go 查询后端、API 和持久监控整合为一个本地项目。一个程序、一个网页入口，原有两个项目不需要同时运行。

已完成合并后的 Debug 修复，修复清单与最新验证结果见 [DEBUG-FIXES.md](docs/DEBUG-FIXES.md)。更新后请重启服务并刷新页面。

## Windows 直接使用

从仓库 **Releases** 下载 `Domain-Studio-v1.0.0-windows-x64.zip` 并解压。源码仓库不包含 EXE；克隆源码后请按下方构建说明生成。

1. 双击 `start-domain-studio.cmd`，保持服务窗口打开。
2. 双击 `open-domain-studio.url`，或访问 **http://127.0.0.1:8082/**。
3. 右上角选择中文；“后端与监控”页可以切换查询引擎、查询注册信息和管理监控。
4. 在服务窗口按 `Ctrl+C` 停止。

已提供 `bin/domain-studio.exe`，运行它不需要 Node.js、Go 或 Docker。网页已内置在 EXE 中。默认只监听本机，不自动开机启动。8082 不占用原项目的 8080 / 8081 端口。

## 整合后的功能

| 功能 | 使用位置 |
| --- | --- |
| 批量域名查询、跨后缀展开、进度、中止、恢复 | 查询 |
| RDAP、DNS 验证、WHOIS、自动后端补查 | 查询 + 后端与监控 |
| 词根组合、音节、主题词、TLD 技巧、词汇变形 | 生成器 |
| 候选托盘、收藏、历史、筛选、排序、复制 | 查询 / 生成器 / 过期删除 |
| 过期删除域名列表及重新查询 | 过期删除 |
| 首年、续费、转入价格，三年成本，优惠与溢价提示 | 价格 + 查询结果 |
| 社交用户名检查与链接 | 社交 |
| 注册商、注册及到期日期、NS、注册状态 | 后端与监控 → 查询注册信息 |
| 关闭网页后继续监控、Webhook 签名、失败重试 | 后端与监控 → 持续监控 |
| 监控状态刷新、取消、凭据备份与恢复 | 后端与监控 |
| 中文等八种原有界面语言、深浅色、移动端 | 全局；新增功能提供中文和英文，其他语言回退英文 |
| CSV / TSV / Markdown、设置与词集导入导出 | 查询 / 设置 |
| JSON API、CLI、MCP、健康检查、Prometheus | 见下文 |
| 无后端便携 HTML | `frontend/dist/index.html` |

## 查询模式

- **自动（默认）**：先用浏览器查询，结果为未知或错误时通过同源后端补查；未知后缀也可交给后端。
- **浏览器**：保留原 Domain-Hunter 的直接 RDAP 查询、可信度规则和限速。
- **后端**：查询通过本地 Go API，使用其 RDAP / WHOIS / DNS 能力。

保持原有 `available / probably_available / taken / unknown / error` 状态。WHOIS 与低可信来源返回可用时保守标为“可能可注册”；DNS 查询缺失、HTTP 错误或结构异常不会变成“可注册”。最终购买价格和能否注册仍以注册商结算时为准。

切换模式会清空结果缓存，保证新引擎重新查询。原 API 限速保留：一般 API 60 次/分钟/IP，批量接口每次最多 50 个域名；浏览器批量查询保留原有数量上限。后端模式的大批量任务受服务限速影响，前端会按 `Retry-After` 等待。

## 持续监控

启动脚本默认启用监控，每 15 分钟检查一次，单任务有效期默认 90 天，每 IP 每 24 小时最多新建 10 个任务。首次检查只建立真实状态基线，之后“已注册 → 可注册”的变化会发送一次带 HMAC-SHA256 签名的 Webhook。使用的是原 Go 引擎的可注册判断，收到通知后应到注册商确认。

- 数据库在 `data/watches.db`；重启服务后恢复。关闭浏览器不影响监控，但关闭服务、关机或休眠会停止检查。
- 通知地址由你填写；未添加任务时不会发送任何通知。Webhook 保留原有内网地址防护。
- 浏览器只保存你创建/导入的任务凭据。查看单任务和取消任务需要密钥，密钥通过请求头发送。
- “导出监控备份”包含管理密钥；“导入”恢复管理已有服务任务的能力，不会重新创建服务任务。
- 换电脑时需要同时备份/恢复服务数据库和浏览器监控凭据。复制数据库前先停止服务。
- 交付时未配置任何外部通知地址或真实监控任务。

GitHub 社交查询 token 仅保留在当前页面内存；刷新后需重新输入或连接，不会保存到普通设置或备份。监控签名密钥是恢复任务所必需的私有数据，保留在 `data/` 数据库与浏览器对应记录中，并从发布包排除。完整隐私边界见 [SECURITY.md](SECURITY.md)。

## 原项目与数据

上级目录的 `Domain-Hunter` 和 `domain-check` 保持原样，合并版不依赖它们运行。原 domain-check 数据目录没有监控数据库，因此没有需要迁移的服务监控任务。

浏览器存储按网址隔离：8081 的收藏、历史和设置不会自动出现在 8082。原项目的设置/词集可以从原“设置 → 导出”再导入新项目；收藏与历史仍在原网址，不能把“代码已合并”理解成“浏览器数据已自动迁移”。如需完整迁移，使用 `scripts/export-browser-data.js`（操作说明见 `docs/MERGE.md`）。

## 命令行和 API

```powershell
.\bin\domain-studio.exe check google.com --format json
.\bin\domain-studio.exe check example --tlds com,org,dev --format json
.\bin\domain-studio.exe bulk domains.txt --concurrency 3 --format csv
.\bin\domain-studio.exe check example.com --watch --interval 2m
.\bin\domain-studio.exe healthcheck --url http://127.0.0.1:8082/health
```

运行服务后可用：

- `GET /api/v1/check?d=example.com`，可带 `tlds=` 或 `suggest=true`
- `POST /api/v1/bulk`，JSON：`{"domains":["example.com","example.org"]}`
- `GET /api/v1/tlds`
- `POST /api/v1/watch`：`domain` + `webhook_url`
- `GET /api/v1/watch/{id}`、`DELETE /api/v1/watch/{id}`，请求头 `X-Watch-Secret`
- `GET /api/v1/studio`、`/health`、`/metrics`、`/api/v1/crashes`
- `/legacy` 保留原 domain-check 简版查询页面。

Domain-Hunter 的生成器、价格 CLI 和 MCP 一并保留，需要 Node.js 20+：

```powershell
node frontend/dist-cli/domain-hunter.mjs generate combinator --roots brand,app --tlds com,io
node frontend/dist-cli/domain-hunter.mjs prices --tlds com,dev,io
node frontend/dist-cli/mcp-server.mjs
```

MCP 仍提供原 Domain-Hunter 工具；持久监控使用合并版 HTTP API。原 API 详细说明在 `docs/domain-check-upstream.md`。

## 从源码构建

需要 Node.js 20+ 和 Go 1.26.1+，在项目根目录执行：

```powershell
npm.cmd --prefix frontend ci
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd start
```

构建顺序为 Svelte 单文件 → CLI/MCP → 嵌入网页 → Go EXE。构建脚本在这台电脑上可自动使用上级 `.tools` 中已有 Go，也支持 PATH 中的 `go` 或 `GO_BINARY` 环境变量。

测试：`npm run test:e2e` 为原界面回归；`npm run test:integration` 为合并后的服务界面验证；Go 使用 `go test -timeout 120s ./internal/... ./web ./cmd/domain-check`。Playwright 可以用 `PLAYWRIGHT_EXECUTABLE_PATH` 指定现有 Chromium，或在 frontend 下运行 `npx playwright install chromium` 安装匹配版本。

没有联网时只能使用已保存数据、生成器与价格快照；真实注册状态、实时价格和通知需要网络。外部平台、注册局与价格源可能限流或不可用，功能保留不代表第三方数据源永远可用。

## 发布检查

- 使用锁定依赖构建并通过类型、单元、浏览器和 Go 测试。
- 不提交 `data/`、日志、token、浏览器备份、依赖或生成的二进制。
- 审核 Git 暂存内容后运行 `python scripts/package-release.py`，生成源码包、Windows 便携包和 `SHA256SUMS.txt`。
- 核对包内容与校验和后上传到 Releases；发布检查记录见 `docs/RELEASE-AUDIT.md`。

## 来源与许可

- Domain-Hunter，WhiteBite，源码 `40ac90f`，MIT，许可证 `frontend/LICENSE`。
- domain-check，jedarden，源码 `c137e60`，MIT，许可证 `LICENSE`；同时纳入原本地资源监控补丁。
- 合并改动和验证记录见 `docs/MERGE.md`。

# Security & privacy / 安全与隐私

## 中文

请勿在公开 issue 中提交可用 token、Webhook 密钥、个人域名列表或原始日志。若仓库启用了 GitHub 私密漏洞报告，请使用 Security → Report a vulnerability；否则先发不含敏感细节的联系请求。不要为了报告问题公开真实凭据。

- 默认服务只监听 `127.0.0.1:8082`。本项目没有多用户登录体系，不应未经额外访问控制直接暴露到公网。
- GitHub 社交查询 token 仅驻留当前页面内存，刷新后需重新输入/连接；普通设置和浏览器迁移备份不会导出 token。
- 持续监控需要将 Webhook URL 和签名/管理密钥存入本地数据库，浏览器也保存对应管理凭据。它们是恢复任务必需的运行数据，不能提交 Git。单独导出的监控备份也属于私密文件。
- `data/`、数据库、日志、浏览器报告、依赖和打包输出默认被 Git 忽略。查询记录与崩溃日志仍可能包含域名、地址或运行环境；分享前请脱敏。
- 原有注册局、价格与社交平台接口会接收实际查询请求；这不是匿名网络代理。

## English

Never put usable tokens, webhook secrets, personal domain lists or raw logs in public issues. Use GitHub private vulnerability reporting under Security → Report a vulnerability when enabled; otherwise request a private contact without publishing sensitive details.

The service binds to `127.0.0.1:8082` by default and has no multi-user login. Do not expose it publicly without additional access controls. GitHub social-check tokens live only in page memory and must be re-entered after reload; ordinary settings and migration backups exclude them.

Persistent watches require local webhook URLs and signing/management secrets in the database and management credentials in browser storage. These are minimum recovery data and must never be committed. Explicit watch backups are private too. Runtime data, databases, logs, browser reports, dependencies and release output are ignored. Logs can still contain queried domains or environment information; sanitize before sharing. Registry, price and social providers receive the corresponding queries.

# Contributing / 贡献指南

## 中文

提交问题时请提供复现步骤、预期结果、实际结果和版本号。不要上传真实域名收藏、Webhook 地址/密钥、GitHub token、数据库、日志原件或浏览器存储导出；使用脱敏示例。

开发需要 Node.js 20+ 和 Go 1.26.1+：

```sh
npm --prefix frontend ci
npm run typecheck
npm test
npm run build
go test -timeout 120s ./internal/... ./web ./cmd/domain-check
npm run test:e2e
npm run test:integration
```

首次执行浏览器测试前，在 frontend 下运行 `npx playwright install chromium`。修改查询逻辑时保留保守状态判断与注册局限速；修改交互时补充 Playwright 回归。使用 `gofmt` 格式化 Go 文件。请在 PR 中说明问题、行为变化与验证结果，保留原作者和第三方许可。

## English

Include reproduction steps, expected/actual behavior and the version in an issue. Use sanitized examples: never attach real domain lists, webhook URLs/secrets, GitHub tokens, databases, raw logs or browser storage exports.

Use Node.js 20+ and Go 1.26.1+, then run the commands above. Install Chromium from `frontend/` using `npx playwright install chromium` before browser tests. Preserve conservative availability classifications and registry rate limits. Add regression tests for changed logic and UI; format Go with `gofmt`. Explain the problem, behavior change and validation in PRs, and retain upstream attribution and third-party licenses.

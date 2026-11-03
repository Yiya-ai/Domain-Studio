# Release verification / 发布检查

Version: 1.0.0. Local verification date: 2026-11-03.

## Verification / 验证

| Check / 检查 | Result / 结果 |
| --- | --- |
| Svelte / TypeScript | 0 errors, 0 warnings |
| Frontend unit tests / 前端单元测试 | 4,483 passed across 38 files |
| Browser regression / 浏览器回归 | 139 passed |
| Integrated server UI / 整合界面 | 6 passed |
| Go packages / Go 后端 | All tested internal packages passed |
| Production build / 正式构建 | Embedded Go executable, portable HTML, Node CLI and MCP built |

Browser verification used an explicitly selected local Chromium executable. Live external services are not guaranteed by these automated checks. GitHub Actions separately runs the configured Linux checks after push; its result is shown on GitHub.

浏览器验证使用明确指定的本机 Chromium。自动化检查不保证第三方实时服务始终可用。推送后 GitHub Actions 会单独执行 Linux 检查，结果以 GitHub 显示为准。

## Privacy and packaging / 隐私与打包

- Staged source was checked for private runtime filenames, token-shaped credentials and local user paths. No matching private content was identified. This focused scan is not a guarantee against every possible secret format.
- Runtime databases, logs, browser backups, dependencies, build output, test reports and local release staging are ignored. Runtime archives use an explicit file allowlist; dependencies contribute license notices only.
- GitHub tokens are kept in memory for the current browser session. Settings storage and exports omit them, and loading old settings removes a previously saved token. Users reconnect after reload.
- Authenticated watch recovery still needs local watch secrets. These remain private runtime state, are excluded from ordinary migration/settings exports, and must be protected when explicitly exporting watch backups.
- MIT attribution for both upstream projects is preserved. Font, dictionary and dependency notices accompany the portable package.

- 暂存源码已检查私有运行文件名、令牌格式和本机用户路径，未识别出匹配的私有内容；针对性扫描不等于覆盖所有可能的密钥格式。
- 数据库、日志、浏览器备份、依赖、构建输出、测试报告和打包临时目录均已忽略。便携包使用明确的文件清单，仅收录依赖许可证说明。
- GitHub 令牌仅存在于当前浏览器会话内存中，不写入设置或普通导出；读取旧设置时清除曾保存的令牌。刷新后需重新连接。
- 带认证的监控恢复仍需要本地监控密钥。这些数据属于私有运行状态，不进入普通迁移或设置导出；显式导出的监控备份仍应妥善保管。
- 保留两个原项目的 MIT 署名，并在便携包中附带字体、词库和依赖许可说明。

## Reproduce / 复现

Follow the README build and verification commands. Stage reviewed source, run `git diff --cached --check`, then run `python scripts/package-release.py`. It verifies ZIP integrity and excluded paths and writes `SHA256SUMS.txt` beside the two archives in the ignored `artifacts/` directory. Review those artifacts before publishing.

按 README 构建并验证，暂存已审核源码后执行 `git diff --cached --check` 和 `python scripts/package-release.py`。脚本验证 ZIP 完整性和排除路径，在被忽略的 `artifacts/` 中生成两个压缩包及 `SHA256SUMS.txt`，发布前需检查产物。

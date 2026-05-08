Status: open
Category: security

## What to build

将 `config.json` 中的 API Key 从明文存储改为操作系统级安全存储（keychain / keystore / safeStorage），防止用户 API Key 在本地以明文形式暴露。

## Acceptance criteria

- [ ] Sidecar 写入配置时，将所有 `apiKey` 字段提取并加密存入 OS keychain（或 Tauri safeStorage），`config.json` 中仅保留占位符或空字符串
- [ ] Sidecar 读取配置时，自动从 keychain 解密并回填 apiKey 字段
- [ ] 前端 SettingsPage 保持现有 UI 不变（用户无感知）
- [ ] 迁移：首次启动时检测到明文 apiKey，自动迁移至 keychain 并清空 config.json 中的明文
- [ ] Windows / macOS / Linux 三平台兼容（Tauri v2 safeStorage 或 keytar）
- [ ] 关闭本 issue 后删除 `server/src/routes/settings.ts` 中的 TODO 注释

## Blocked by

- [05-settings-multi-provider](../05-settings-multi-provider.md) — 必须先有多提供商配置系统

## Comments

> *Created as follow-up to code review of #05. Critical issue: API keys currently stored in plaintext in `config.json`.*

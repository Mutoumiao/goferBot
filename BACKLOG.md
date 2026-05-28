# 待办事项

> 自动生成于 2026-05-22，最后更新于 2026-05-29

## 进行中

### E2E 测试

1. **q-16-e2e-infra-migration** — E2E 测试基础设施重构（删除 Tauri，建立真实 API Web E2E）
   - 已有提交：infra 测试、globalSetup/globalTeardown、fixtures（auth/api-client/database）
2. **q-17-e2e-auth-kb-specs** — E2E 认证流程与知识库生命周期测试
   - 阻塞于：q-16
   - 已有提交：AuthPage POM、01-auth-flow.spec.ts、02-kb-lifecycle.spec.ts
3. **q-18-e2e-chat-session-specs** — E2E 聊天 SSE 与会话管理测试
   - 阻塞于：q-16
   - 已有提交：03-chat-with-rag.spec.ts、04-session-management.spec.ts
4. **q-19-e2e-settings-journey** — E2E 设置持久化与跨模块用户旅程测试
   - 阻塞于：q-16, q-17
   - 已有提交：05-settings-persist.spec.ts、06-onboarding-journey.spec.ts

## 待启动

_暂无_

## 备注

- RAG SDK 系列 issue（d-11 ~ d-15）已全部关闭
- RAG Server 集成 issue（d-20 / b-10 / b-11 / b-08 / b-09 / f-16 / q-21）已于 2026-05-29 完成开发，55 个测试全部通过
- q-21 E2E 测试骨架已创建，等待 Docker 基础设施就绪后运行验证

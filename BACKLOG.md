# 待办事项

> 自动生成于 2026-05-22，最后更新于 2026-05-30

## 进行中

### E2E 测试

1. **q-17-e2e-auth-kb-specs** — E2E 认证流程与知识库生命周期测试
   - 状态：open
   - 阻塞已解除（q-16 已关闭）
   - 已有提交：AuthPage POM、auth.spec.ts（mock）、knowledge-base.spec.ts（mock）
   - 缺口：AC-06、AC-08、AC-12、AC-15、AC-16（5 项 pending）
   - 技术债务：当前测试使用 mock API，与 spec 要求的真实后端 API 冲突

## 待启动

_暂无_

## 备注

- RAG SDK 系列 issue（d-11 ~ d-15）已全部关闭
- RAG Server 集成 issue（d-20 / b-10 / b-11 / b-08 / b-09 / f-16 / q-21 / q-22）已于 2026-05-29 完成开发
- q-21 E2E 测试骨架已完成，真实链路验证由 q-22 覆盖
- q-22 RAG 真实集成测试已完成（AC-01~AC-07 全部 passed），基础设施不可用时优雅跳过

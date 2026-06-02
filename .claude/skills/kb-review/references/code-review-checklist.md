# 代码审查检查清单

> 被 `kb-review` skill 引用。按审查类型按需读取。

---

## 契约对齐

- [ ] 代码实现是否覆盖 issue 中的所有验收标准？
- [ ] 前端实现是否对齐 behavior-spec 中的交互状态（loading/empty/error/success/partial）？
- [ ] 后端 API 是否对齐 api-spec 中的端点、DTO、错误码？
- [ ] 数据模型是否对齐 spec 中的类型定义？

## 代码质量

- [ ] **简洁优先**：是否用最小代码量解决问题？有无过度设计？
- [ ] **精准修改**：是否只修改了必要的文件？有无无关改动？
- [ ] **错误处理**：是否为不可能的情况添加了不必要的错误处理？（项目规范：不为不可能的情况加错误处理）
- [ ] **类型安全**：TypeScript 类型是否准确？有无 `any` 滥用？
- [ ] **命名**：变量/函数/类名是否清晰表达意图？

## 前端专项

- [ ] Vue 组件是否遵循组合式 API 规范？
- [ ] Pinia Store 是否按功能模块拆分？
- [ ] UI 组件是否使用 shadcn-vue 标准组件？
- [ ] 颜色是否使用 Pencil tokens（`bg-surface-1`, `text-text-primary`）？
- [ ] Class 管理是否使用 `cn()` + `class-variance-authority`？
- [ ] 图标是否使用 `lucide-vue-next`？
- [ ] 响应式布局是否考虑移动端？

## 后端专项

- [ ] NestJS 模块/控制器/服务分层是否清晰？
- [ ] API 端点是否遵循 RESTful 规范？
- [ ] DTO 是否使用 `nestjs-zod` 进行验证？
- [ ] 错误响应是否统一格式 `{ error: string }`，不暴露内部信息？
- [ ] 认证中间件是否正确注入 user/session？
- [ ] 数据库操作是否使用 Prisma 事务（需要时）？

## 测试（TDD 合规检查）

- [ ] **新增功能是否有对应 `.spec.ts` 测试文件？**
- [ ] **测试是否覆盖正常路径和错误路径？**
- [ ] **测试是否使用真实数据库（项目规范：集成测试必须 hit 真实数据库，不 mock）？**
- [ ] **测试是否在实现代码之前编写？**（检查 git log 或询问开发者）
- [ ] **测试是否可运行且通过？**（要求提供 `npx vitest run` 输出）

**测试红线**：
- 无 `.spec.ts` 文件 → 🔴 Critical
- 测试只有 happy path → 🟠 Major
- 测试在实现之后补写 → 🟠 Major（首次警告，重复违规升级 Critical）

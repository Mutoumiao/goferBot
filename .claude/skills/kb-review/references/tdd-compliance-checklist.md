# TDD 合规检查清单

> 被 `kb-review` skill 引用。TDD 审查时按需读取。

---

## 测试存在性

- [ ] 新增功能是否有对应 `.spec.ts` 测试文件？
- [ ] 测试文件是否放在 `tests/{layer}/` 下？
- [ ] 测试用例名是否以 `AC-XX:` 开头？

## 测试覆盖度

- [ ] 是否覆盖正常路径和错误路径？
- [ ] 是否覆盖 behavior-spec 中的所有交互状态（loading/empty/error/success/partial）？
- [ ] 是否覆盖 api-spec 中的所有错误码场景？
- [ ] 边界条件是否测试？

## 测试先行

- [ ] 测试是否在实现代码之前编写？（抽查 git log）
- [ ] 每个 plan 任务是否以"编写失败测试"开始？

## 测试可运行

- [ ] 测试是否可运行且通过？（`npx vitest run`）
- [ ] 是否使用真实数据库（集成测试不 mock）？

**测试红线**：
- 无 `.spec.ts` 文件 → 🔴 Critical
- 测试只有 happy path → 🟠 Major
- 测试在实现之后补写 → 🟠 Major（首次警告，重复违规升级 Critical）

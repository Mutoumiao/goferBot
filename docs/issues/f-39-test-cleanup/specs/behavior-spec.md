# 行为规格：测试迁移与旧代码清理

> 状态：draft | 关联 issue：f-39

---

## 1. 测试框架迁移

| Vue Test Utils | React Testing Library |
|----------------|----------------------|
| `mount(Component)` | `render(<Component />)` |
| `wrapper.find('.class')` | `screen.getByRole()` / `screen.getByTestId()` |
| `wrapper.vm.method()` | `fireEvent.click()` / `userEvent.click()` |
| `wrapper.emitted()` | `expect(mockFn).toHaveBeenCalled()` |

## 2. alova 单元测试 mock 模式

```typescript
vi.mock('alova/client', () => ({
  useRequest: vi.fn(),
  useWatcher: vi.fn(),
  useFetcher: vi.fn(),
  usePagination: vi.fn(),
  useSSE: vi.fn(),
}))

// 每个测试控制返回值
vi.mocked(useRequest).mockReturnValue({
  data: undefined,
  loading: true,
  error: undefined,
  send: vi.fn(),
} as any)
```

## 3. 测试映射

| AC | 测试文件 |
|----|----------|
| AC-01 | `tests/unit/web/**/*.spec.tsx`（迁移后） |
| AC-02 | `tests/unit/web/alova-hooks-p0.spec.tsx` |
| AC-03 | `tests/unit/web/alova-hooks-p1.spec.tsx` |
| AC-04 | `tests/unit/web/alova-hooks-p2.spec.tsx` |
| AC-05 | `tests/e2e/specs/*.spec.ts`（选择器更新） |
| AC-06 | `tests/e2e/flows/auth-kb-chat.spec.ts` |
| AC-09 | bash 验证：`test ! -d packages/webui` |

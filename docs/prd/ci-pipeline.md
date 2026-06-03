# CI/CD 流水线设计文档

> 版本：v1.0 | 日期：2026-06-03 | 状态：待实施
>
> 本文档定义 GoferBot 项目的 CI/CD 流水线需求、架构、分阶段实施计划。

---

## 一、背景与目标

### 1.1 为什么需要 CI/CD

| 问题 | 当前状态 | CI 后 |
|------|----------|-------|
| 代码质量检查依赖开发者记忆 | 每次提交前手动运行 `pnpm type-check` | 自动运行，失败即阻断 |
| 新代码可能破坏已有功能 | 依赖 code review 时发现 | 每次 PR 自动跑全量测试 |
| "在我机器上能跑" | 环境差异导致问题隐藏 | GitHub Actions 统一环境 |
| 多人协作时冲突发现滞后 | 合并后才发现冲突 | PR 阶段即自动检测 |
| 部署前缺少自动化验证 | 手动检查清单 | CI 绿 = 可部署 |

### 1.2 目标

- **Quality Gate**：每次 Push/PR 自动运行类型检查 + 单元测试，30 秒内出结果
- **Integration Gate**：每次 PR 自动运行集成测试（含 pgvector），2 分钟内出结果
- **E2E Gate**：合并到 main 时运行 E2E 全链路测试，5 分钟内出结果
- **Deploy Readiness**：CI 全绿 = 部署就绪，无需人工检查

### 1.3 范围外

- CD（持续部署）：本阶段只做 CI，部署逻辑后续补充
- 性能测试：CI 不做 load/stress testing
- 安全扫描：后续通过独立 workflow 或 Dependabot 补充

---

## 二、架构设计

### 2.1 Workflow 总览

```
GitHub Actions
├── ci-quality.yml      (每次 push + PR)
│   ├── type-check      (pnpm type-check)
│   ├── unit-test       (npx vitest run tests/unit)
│   └── lint            (可选: ESLint)
│
├── ci-integration.yml  (PR 到 main 时)
│   └── integration-test
│       ├── 启动 PG (pgvector/pgvector:pg16)
│       ├── 启动 Redis
│       ├── 启动 MinIO
│       ├── prisma migrate deploy
│       └── npx vitest run tests/integration
│
└── ci-e2e.yml          (合并到 main 后)
    ├── 启动 Docker Compose 全栈
    ├── pnpm dev (前后端)
    └── pnpm test:e2e
```

### 2.2 触发策略

| 事件 | ci-quality | ci-integration | ci-e2e |
|------|-----------|----------------|--------|
| Push 到任意分支 | ✅ 触发 | ❌ | ❌ |
| PR 到 main | ✅ 触发 | ✅ 触发 | ❌ |
| 合并到 main | ✅ 触发 | ✅ 触发 | ✅ 触发 |
| 手动触发 (workflow_dispatch) | ✅ | ✅ | ✅ |

> 设计原则：
> - **快速反馈**：Push 即跑 quality（30s），不阻塞开发流
> - **PR 保护**：PR 阶段跑 integration（2min），发现问题再合并
> - **合并后验证**：E2E 耗时较长（5min），放在合并后运行，失败通知团队

### 2.3 矩阵策略

```yaml
# 多 Node 版本覆盖（可选，Phase 2）
strategy:
  matrix:
    node-version: [20, 22]
    # 暂不做 OS 矩阵（项目含原生模块，Linux 一条线）
```

---

## 三、分阶段实施

### Phase 1：Quality Gate（工作量：小，~1 小时）

**文件**：`.github/workflows/ci-quality.yml`

**内容**：
- 安装 pnpm + 依赖
- 运行 `pnpm type-check`
- 运行 `npx vitest run tests/unit`

**不依赖 Docker**，是最轻量的检查。

```yaml
name: CI Quality

on:
  push:
    branches: [master, main]
  pull_request:
    branches: [master, main]

jobs:
  type-check:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm type-check

  unit-test:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: npx vitest run tests/unit
```

**验收标准**：
- [ ] PR 时自动运行，失败阻断合并
- [ ] 运行时间 ≤ 2 分钟
- [ ] 结果在 PR 页面可见

---

### Phase 2：Integration Gate（工作量：中，~2 小时）

**文件**：`.github/workflows/ci-integration.yml`

**内容**：
- 使用 GitHub Actions Services 启动 pgvector + Redis + MinIO
- 运行 Prisma 迁移
- 运行集成测试

```yaml
name: CI Integration

on:
  pull_request:
    branches: [master, main]
  push:
    branches: [master, main]
  workflow_dispatch:  # 手动触发

jobs:
  integration-test:
    runs-on: ubuntu-latest
    timeout-minutes: 10

    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_USER: gofer
          POSTGRES_PASSWORD: gofer_dev_pass
          POSTGRES_DB: goferbot_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      minio:
        image: minio/minio:RELEASE.2025-01-20T14-49-07Z
        env:
          MINIO_ROOT_USER: minioadmin
          MINIO_ROOT_PASSWORD: minioadmin
        ports:
          - 9000:9000
        options: >-
          --health-cmd "curl -f http://localhost:9000/minio/health/live"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        command: server /data

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      # 生成 Prisma Client
      - run: cd packages/server && npx prisma generate

      # 数据库迁移
      - run: cd packages/server && npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://gofer:gofer_dev_pass@localhost:5432/goferbot_test

      # 运行集成测试
      - run: npx vitest run tests/integration
        env:
          DATABASE_URL: postgresql://gofer:gofer_dev_pass@localhost:5432/goferbot_test
          REDIS_HOST: localhost
          REDIS_PORT: 6379
          MINIO_ENDPOINT: localhost
          MINIO_PORT: 9000
```

**注意事项**：
- `DATABASE_URL` 需要在 CI 环境变量中注入（或使用 GitHub Secrets）
- pgvector 扩展在 `pgvector/pgvector:pg16` 镜像中已预装，无需额外 `CREATE EXTENSION`
- `checkInfrastructure()` 在 GitHub Actions 环境中会通过检测，测试正常执行

**验收标准**：
- [ ] PR 时自动运行，失败阻断合并
- [ ] 运行时间 ≤ 3 分钟
- [ ] 纯集成测试全部通过（`auth.spec.ts` 等，仅依赖 PostgreSQL）
- [ ] 真实模式测试在基础设施可用时通过，不可用时优雅跳过（`auth-kb-document.spec.ts`、`rag-real.spec.ts`、`rag-e2e.spec.ts`）

---

### Phase 3：E2E Gate（工作量：中，~3 小时）

**文件**：`.github/workflows/ci-e2e.yml`

**内容**：
- 启动完整 Docker Compose 环境
- 启动前端 dev server
- 运行 Playwright E2E 测试

```yaml
name: CI E2E

on:
  push:
    branches: [master, main]
  workflow_dispatch:

jobs:
  e2e-test:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      # 启动 Docker 基础设施
      - run: docker compose -f docker-compose.dev.yml up -d
      - run: |
          echo "等待 PostgreSQL 就绪..."
          until docker compose -f docker-compose.dev.yml exec -T postgres pg_isready -U gofer; do sleep 2; done

      # 数据库迁移
      - run: cd packages/server && npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://gofer:gofer_dev_pass@localhost:5432/goferbot

      # 安装 Playwright 浏览器
      - run: npx playwright install chromium --with-deps

      # 启动后端
      - run: pnpm dev:server &
        env:
          DATABASE_URL: postgresql://gofer:gofer_dev_pass@localhost:5432/goferbot

      # 等待后端就绪
      - run: |
          echo "等待后端就绪..."
          for i in $(seq 1 30); do
            if curl -s http://localhost:3000/api/health; then
              echo "后端就绪"
              break
            fi
            sleep 2
          done

      # 运行 E2E 测试
      - run: pnpm test:e2e

      # 上传失败截图
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: e2e-screenshots
          path: tests/e2e/screenshots/

      # 清理
      - run: docker compose -f docker-compose.dev.yml down -v
        if: always()
```

**注意事项**：
- `ubuntu-latest` 已预装 Docker，`docker compose` 可直接使用
- E2E 测试中已有 Mock API 测试（`*-ui.spec.ts`）和真实 API 测试，CI 中均可运行
- Playwright 浏览器需 `--with-deps` 安装系统依赖
- 失败时上传截图 artifact 方便调试

**验收标准**：
- [ ] 合并到 main 后自动运行
- [ ] 运行时间 ≤ 8 分钟
- [ ] E2E 测试全部通过
- [ ] 失败截图自动上传

---

### Phase 4：增强（后续可选）

| 增强项 | 说明 | 工作量 |
|--------|------|--------|
| **代码覆盖率报告** | `vitest --coverage` + 上传到 Codecov/Coveralls | 小 |
| **PR 评论** | 测试结果/覆盖率作为 PR 评论 | 中 |
| **Dependabot** | 自动检测依赖更新并创建 PR | 小 |
| **矩阵构建** | Node 20/22 + PostgreSQL 15/16 组合测试 | 中 |
| **Release Automation** | 打 tag 自动构建 Docker 镜像并推送 | 中 |
| **Slack/Discord 通知** | 构建失败/成功通知到频道 | 小 |

---

## 四、环境变量管理

### 4.1 GitHub Secrets 清单

| Secret | 用途 | 环境 |
|--------|------|------|
| `DATABASE_URL` | PostgreSQL 连接串 | CI |
| `EMBEDDING_API_KEY` | OpenAI API Key（可选，集成测试用 mock） | CI |
| `JWT_SECRET` | JWT 签名密钥（测试用，非生产） | CI |

### 4.2 测试用环境变量

```
# .env.ci（CI 专用，仓库内存储，不含敏感信息）
DATABASE_URL=postgresql://gofer:gofer_dev_pass@localhost:5432/goferbot_test
REDIS_HOST=localhost
REDIS_PORT=6379
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
EMBEDDING_BASE_URL=http://localhost:9999
EMBEDDING_API_KEY=ci-test-key
JWT_SECRET=ci-test-jwt-secret-not-for-production
```

> 集成测试中 Embedding API 使用 `nock` mock；E2E 测试中聊天 SSE 也使用 mock。因此 CI 环境不需要真实的外部 API Key。

---

## 五、失败处理与通知

### 5.1 失败分类

| 失败类型 | 处理方式 |
|----------|----------|
| 类型错误 | 阻断合并，PR 页面显示错误详情 |
| 单元测试失败 | 阻断合并，显示失败用例 |
| 集成测试失败 | 阻断合并，显示失败用例和日志 |
| E2E 测试失败 | 通知团队，上传截图 artifact |
| 基础设施超时 | 自动重试 1 次，仍失败则通知 |

### 5.2 通知渠道（Phase 4）

```
ci-e2e 失败
  ├── Slack #goferbot-ci → 通知团队
  ├── GitHub Issue → 自动创建 bug issue
  └── Email → 通知最近提交者
```

---

## 六、项目结构

实施 CI 后的仓库文件结构：

```
.github/
└── workflows/
    ├── ci-quality.yml       # Phase 1: 类型检查 + 单元测试
    ├── ci-integration.yml   # Phase 2: 集成测试（pgvector）
    └── ci-e2e.yml           # Phase 3: E2E 测试（Playwright）

.env.ci                       # Phase 2: CI 专用环境变量（非敏感）
```

---

## 七、验收标准汇总

### Phase 1 验收

- [ ] `pnpm type-check` 在 CI 中运行通过
- [ ] 单元测试（125 个）在 CI 中全部通过
- [ ] 运行时间 ≤ 2 分钟
- [ ] PR 页面可见运行结果

### Phase 2 验收

- [ ] pgvector + Redis + MinIO 服务正常启动
- [ ] Prisma 迁移成功执行
- [ ] 纯集成测试全部通过（非跳过）
- [ ] 真实模式测试在基础设施可用时通过，不可用时优雅跳过
- [ ] 运行时间 ≤ 3 分钟

### Phase 3 验收

- [ ] 完整 Docker Compose 环境启动
- [ ] 前后端 dev server 启动成功
- [ ] Playwright E2E 测试全部通过
- [ ] 失败截图自动上传
- [ ] 运行时间 ≤ 8 分钟

---

## 八、风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| GitHub Actions runner 性能不足 | 低 | 中 | 使用 `ubuntu-latest`（2-core, 7GB RAM），足够本项目规模 |
| pgvector 镜像版本不兼容 | 低 | 高 | 锁定 `pgvector/pgvector:pg16` 版本 |
| E2E 测试不稳定（flaky） | 中 | 中 | 重试机制 + 失败截图 + 独立分析 |
| 环境变量泄露 | 低 | 高 | 敏感变量使用 GitHub Secrets，非敏感变量存 `.env.ci` |
| CI 运行费用 | 低 | 低 | GitHub Actions 免费额度 2000 分钟/月（公开仓库无限制），足够使用 |

---

*本文档由架构师生成于 2026-06-03。Phase 1 可立即实施（~1 小时），Phase 2-3 待 Phase 1 稳定后推进。*

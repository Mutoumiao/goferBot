Status: needs-triage

## What to build

实现知识库的 CRUD 管理和文件导入功能。用户可以创建知识库（物理目录）、导入文件、浏览文件层级、搜索文件名、删除和恢复知识库。

端到端行为：用户点击左侧文件夹图标 → 打开知识库管理页（单例标签）→ 左侧显示一级知识库列表（图标+名称），点击"新建"输入名称后创建物理目录 `docs/<名称>/` → 右侧显示资源管理器视图（当前知识库的文件和文件夹）→ 顶部工具栏有面包屑导航、搜索框、排序下拉（名称/日期）、添加文件按钮 → 用户点击"添加文件"→ Rust 打开系统文件对话框 → Rust 读取选中文件 → Rust HTTP POST 到 sidecar → sidecar 保存到当前知识库目录 → 前端刷新文件列表 → 双击文件夹进入子目录，面包屑更新 → 在搜索框输入文件名 → 显示跨目录扁平搜索结果 → 双击结果中的文件夹进入对应目录 → 面包屑支持回退/前进（含搜索状态）→ 用户删除知识库 → 物理移动到 `.trash/<名称>-<timestamp>/` → 用户可恢复，若同名冲突则重命名为"<名称>-副本"。

## Acceptance criteria

- [ ] SQLite Schema：`knowledge_bases` 表（`id`, `name`, `path`, `created_at`）
- [ ] Sidecar 知识库 CRUD API：`GET /knowledge-bases`, `POST /knowledge-bases`, `DELETE /knowledge-bases/:id`
- [ ] Sidecar 文件列表 API：`GET /knowledge-bases/:id/files?path=...`（返回当前目录层级）
- [ ] 前端知识库管理页：左侧知识库列表 + 右侧资源管理器视图
- [ ] 新建知识库：输入名称，创建物理目录，SQLite 插入记录
- [ ] 文件导入链路：前端调用 Rust IPC → Rust 打开对话框 + 读取文件 → Rust HTTP POST 到 sidecar → sidecar 保存到目标路径
- [ ] 资源管理器：双击文件夹进入子目录，面包屑导航
- [ ] 文件名搜索：跨目录扁平结果，双击文件夹进入对应目录
- [ ] 面包屑回退/前进：维护导航历史栈（浏览状态 + 搜索状态）
- [ ] 知识库删除：物理移动至 `.trash/<名称>-<timestamp>/`
- [ ] 知识库恢复：移回原位，同名冲突重命名为"<名称>-副本"
- [ ] 第一版不实现 30 天自动清理

## Blocked by

- [01-sidecar-startup](../01-sidecar-startup.md) — 必须先完成 sidecar 启动与前端就绪机制

## Comments

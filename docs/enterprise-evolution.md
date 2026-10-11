# 企业多仓库演进引擎：已实现能力、证据与边界

本能力延续 `docs/enterprise-workspaces.md`，支持 backV8 一类拥有数十个独立仓库的真实企业业务系统。业务源代码保持只读；所有派生数据存放在 Asset Workbench 自己的受管目录中。

## 可执行链路

1. **仓库发现**：搜索工作区目录中的真实 Git 根仓库，顶层目录即使自身带有 `.git` 也会继续发现内部独立子仓库。跳过软链和构建缓存。
2. **冻结 Git 版本**：选择本地 HEAD 或已存在的 origin 跟踪引用；内容寻址的 WorkspaceVersion 固定每个仓库的 commit 与 tree，重复执行具备幂等性。
3. **可选本地 Git Mirror**：仅从被授权的本地 checkout 建立裸镜像（`git clone --mirror --local --no-hardlinks`），后续只从相同本地路径刷新。**不联网抓取远程 origin，不写原始仓库**。每个失败仓库保留 blocked 和原因。
4. **Raw/Manifest**：按 Snapshot 指定的 Git blob OID 读取文件内容，并存入受管、SHA-256 校验的去重 Raw Blob 仓库；Manifest 记录各仓库的路径、mode、OID、大小、摘要和导入状态。限额或未获得文件内容时标为 **partial**，不得声称已完整导入。默认总 Raw 物化上限 16MiB、文件数上限 50,000，防止一次性导入未知体量的企业生产仓库。
5. **确定性 Maven 关系图**：从归档 POM 的 groupId/artifactId 和声明式 dependencies/modules 提取模块与内部依赖边，来源仍可回溯到 WorkspaceVersion。此图仅为 Maven 声明关系，不虚称已经实现 Java 方法调用图、运行时业务调用链或全量 CodeGraph。
6. **演进证据**：每条问题必须绑定真实存在于 Snapshot 对应 commit 的代码文件；推进流程为 observed → proposed → experimented → verified → promoted（任何非终态可 rejected），只有已验证的项目问题可以提名 Framework 候选；晋升保留每一步文字证据。**该晋升是提案状态而非自动合并中央 Framework 代码**。

## 真实机器的只读测试

2026-10-11 对本地 backV8 完成：36 个独立仓库发现；由本地 HEAD 冻结统一 Snapshot；36/36 Git 提交与 tree 对象校验通过。使用的快照 ID 为 `ws-943fc5e5cf0905455a50b251`。这不是全量 Mirror/Raw/CodeGraph 真机验收，也不代表远端最新版本。

自动化临时仓库 E2E 验证：本地 Mirror、同 OID Raw 去重、Manifest 校验、Maven 依赖图、问题引用提交、状态转换、未经验证拒绝晋升与原始源目录零额外写入。GitHub CI 是后续正式合并门禁。

## 企业生产前剩余门禁

- 真实 36 仓库完成 Mirror/Raw 全量、断点续传、容量评估、LFS 与 submodule 的专门处理；当前 Blob 配额可能导致 partial。
- 跨仓 Java 方法调用图、SQL 血缘、跨服务业务入口与知识关联的严格来源证明。
- 大规模性能、并发任务隔离、角色访问权限/RBAC、生产密钥管理与私有代码数据治理。
- 长时间运行、取消/重试/恢复、Git Remote 凭据策略，以及多租户服务器部署。
- Framework 能力候选的跨项目验证、签名发布、依赖兼容与自动回滚；当前仅记录审批证据，不擅自升级其它项目。

所有未满足项目维持 PARTIAL/BLOCKED，不制造生产 READY 假象。

# 企业多仓库 Workspace：已实现边界和后续阶段

## 场景与原则

支持 backV8 一类具有几十至数百个独立 Git 仓库的 Java/多语言生产工作区。业务目录作为只读来源，中央 UI 显示仓库状态，独立 Instance 的 API 绑定一个业务工作区。本阶段**不是**全量生产级 Git Mirror 或 CodeGraph。

## 当前已实现

- 只遍历目录（默认最多五层、500 仓库）；识别独立根仓库、worktree/submodule 的 `.git` 文件，跳过软链接、构建缓存。不会将一个仓库内部的普通子文件夹算作另一个仓库。
- 读取 HEAD、origin main/master 本地跟踪引用、分支、脏状态和 Remote 展示信息，不运行 fetch、pull、checkout、reset、commit 等修改来源的操作。
- 选择 HEAD 或本地 origin 跟踪提交，冻结每个仓库的精确 commit 与 tree 为一个内容寻址 WorkspaceVersion。脏工作区修改明确被排除；跟踪引用不保证与远端最新一致。
- Snapshot 元数据写在中央 `.asset-workbench-data/enterprise-workspaces/<workspace-hash>/snapshots/`；不在业务目录写入镜像、索引或 Snapshot。快照不可覆盖，同一组提交生成相同 ID。
- 对比两次快照：未变化仓库跳过文件 diff；变化仓库用只读 Git diff，返回文件路径（每仓最多展示 300 个）；旧 Git 对象已失效时返回明确的不可用状态。带校验结果的基础验证。
- 中文 UI 提供仓库发现、冻结 HEAD、冻结本地跟踪引用、查看快照、对比、验证操作。与现有单项目资产浏览并行，不破坏传统流程。

## 真实性边界

- 当前未实现联网管理的 Mirror / fetch，未实现 Raw Blob 受管物化与全量 Manifest，不应声称已完成正式生产导入。
- 尚未实现 Maven 多模块语义、跨仓 Call Graph/CodeGraph、知识级问题发现与 Framework Capability 晋升。下一步以冻结的 Snapshot 为事实输入进行增量构图与来源追溯。
- Git LFS 大文件、submodule 的递归来源及浅克隆缺失对象需要单独诊断和生产级证据管理。
- 当前快照存在于 **中央本地受管存储**，不是实例目录。集中服务部署、分布式租户授权、数据库事务、RBAC 与凭据隔离尚未通过企业生产验收，不对外提供多租户安全承诺。
- CI 创建临时三个 Git 仓库验证确定性的发现、幂等快照、脏文件排除、单仓增量比较和源码零写入。真实 backV8 需要在授权的本机环境验收。

## 后续演进（目标而非已交付）

1. 在只读工作目录之外，创建受管 Mirror 并使用显式 Remote 凭据策略、允许的 fetch 列表、超时、失败重试、失效对象恢复。
2. 记录 Snapshot -> Git 对象 -> Raw -> 文件 Manifest 的校验链，实现跨仓库数据来源与权限。
3. Java/Maven 模块级和 API 级确定性分析，随后补充语义知识关联、跨仓关系、增量 CodeGraph。
4. 演进资产：Issue -> Evidence -> Proposal -> Experiment -> Decision -> Candidate Capability，保持项目级和 Framework 级晋升边界独立。
5. 形成生产前验收门禁：35+ 仓库全量导入、跨仓权限隔离、海量文件性能、失败续跑、回滚、真实 UI 操作、长期运行。

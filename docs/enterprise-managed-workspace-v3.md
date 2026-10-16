# 企业多仓库工作区 V3：根目录受管模式

## 最终规则

**一个企业 Workspace + 一个根目录受管资产区 + 多个独立 Git 仓库 + 用户级 Provider Hook + 中央 Framework 共享能力。**

以 backV8 为例：

```text
backV8/
  .git/                         # 如果根目录原本是 Git 仓库，保留
  .asset-workbench-data/        # 经用户同意后创建，只允许 V3 管理
    enterprise/                 # 统一 Git Snapshot、Mirrors、Raw、Maven/Java/SQL 分析与实验
      snapshots/
      mirrors/
      raw/
      derived/
      managed-migration.json    # 复制旧资产后的校验记录，旧副本不删除
    capture/sessions/           # Provider 官方 Hook 事件和幂等记录
    conversations/transcripts/  # 已结束会话的 Markdown
    knowledge/notes/            # 按仓库/模块归属的知识与决策
  phantom-payment/.git/         # 企业已有仓库，V3 禁止自动修改
  phantom-operation/.git/       # 企业已有仓库，V3 禁止自动修改
  ...                           # 其余企业 Git 仓库不写工作台配置
```

Framework 主程序、用户级 Provider Hook 和全局部署配置仍位于 **backV8 外部**。

## 三种模式

- **完全只读**：中央 Framework 登记企业工作区；所有分析资产仍在中央受管目录。禁止在 backV8 建目录。
- **企业受管**：需要用户勾选授权。只在 backV8 根目录创建 `.asset-workbench-data`，保留全部子 Git 仓库原样。只向根 Git 的 **本地** `.git/info/exclude` 追加 `/.asset-workbench-data/`；如果根不是 Git 仓库，不写 exclude。不会修改根 `.gitignore`，也不会修改任何子仓库的 ignore、Hooks 或源码。
- **普通独立工作台**：继续使用既有 Instance 创建、启动、升级与独立数据机制；不强迫旧 Instance 改为企业受管模式。

注意：忽略规则影响 Git 状态，不是保密或访问控制策略。V3 文件树扫描/监听/AI 上下文仍独立排除 `.asset-workbench-data`。

## 从完全只读升级为企业受管

1. 中央 V3 「独立工作台」选择 **企业受管模式**，输入 backV8 根目录，并阅读授权说明。
2. 勾选只允许写根 `.asset-workbench-data`、不触碰子仓库的选项，点击启用。
3. 先登记 Workspace ID，再把原先中央 `enterprise-workspaces/<root-hash>` 数据复制到根目录 `.asset-workbench-data/enterprise` 的临时目录。
4. 逐文件核对 SHA-256，完成后原子切换新目录；旧中央数据继续保留，用于恢复，绝不自动删除。
5. 仅当校验通过后才将登记的 `sourcePolicy` 改为 `managed`。新目录有冲突、符号链接或超出迁移预算时 **BLOCKED**，不会以覆盖方式冒险合并。
6. 已有旧 Instance 内的 `.asset-workbench-data` 会被保留；如包含聊天/Agent 资产不会覆盖。身份来源不明的中央旧聊天不会自动混入 backV8，必须另行确权。
7. 对业务源代码无需任何 Git commit。不要手工移动数据目录或合并旧缓存。

## Provider 归属与采集

Provider Manager 采用 **用户级 Hooks** 和 `scripts/capture-enterprise-provider-event.ts` 本地命令采集。由用户在工作台明确授权后才在用户 HOME 中为 Codex/CodeBuddy/Trae 配置相应 Hook，并配置用户级 OpenCode 插件；保留原有用户设置、阻止覆盖冲突配置。未安装 Hook、未认证、未观察到真实事件时显示未验证。

事件必须具有真实 `providerSessionId` 与工作目录。CLI 优先从 Provider 事件、当前进程 cwd 获取来源，仅在来源位于已登记的 **managed** 根目录之内时允许采集。使用真实 Git 根目录和最近 Maven `pom.xml` 将其归入特定仓库/模块；第一次创建会话时绑定 `workspaceId`、仓库、cwd，后续跨仓库或跨工作区事件直接拒绝，不能错绑。

会话事件存于根受管目录 `capture/sessions`，结束时生成 `conversations/transcripts` Markdown。事件按官方事件/消息身份去重，保存原始来源元数据但对敏感字段进行键名过滤（不能替代人工审查敏感正文）。历史 Codex JSONL 必须在 `~/.codex/sessions` 中且包含可信 `session_meta.cwd`；CodeBuddy 官方历史仅在匹配到一个真正已绑定 cwd 的当前会话时补齐。没有官方 E2E 证据时**绝不报告所有 Provider 已全面 PASS**。

**当前已实现的内容不等于官方 Provider 版本都已验证。** 用户级 Hook 是否被当前安装版本加载，需在本机分别跑真实新建会话 → 提问 → 工具使用 → SessionEnd → 读取归档的 E2E，并核对来源。ChatGPT、CodeArts、WorkBuddy 无确认的通用用户级 Hook 机制时保留 import-only/授权阻塞状态。

可手工导入官方 Codex 历史：

```bash
node --experimental-strip-types scripts/import-enterprise-history.ts codex /home/you/.codex/sessions/2026/10/rollout.jsonl
```

只能写入元数据所归属的受管工作区，不能任意指定业务目标。

## 验收与安全

```bash
npm run test:enterprise-managed
npm run check
```

自动化建立根 Git + 两个嵌套 Git 仓库，验证只读模式零写入、旧资产校验迁移/重复迁移、根本地 exclude、跨仓 Session 固定、Provider Hook 去重/用户级配置保留、Codex 历史、知识创建、Git 状态不变和 `.asset-workbench-data` 隐藏扫描。

还必须在真实 backV8 本机补做：36 仓库完整盘点、Provider 官方 Hook 事件、Maven/Java/SQL 分析、聊天归属、并发/长时间压测、Git 工作区 clean、敏感数据合规审查。若 Desktop Commander 离线，不得声称已完成这些真实验收。

## 迁移后在工作台查看旧资产

企业受管工作区面板包含「历史聊天、设计与知识迁移」。能在旧版 V3 `04-conversations`、`02-design` 等区域找到匹配 `schemaVersion:1`、受支持 ID 与内容文件的资产时，只读复制到
`.asset-workbench-data/knowledge/legacy-managed` 并生成 SHA-256 清单。新页面只展示内容和 SHA 校验成功的项目；旧目录始终保留。

「高级：旧资产迁移校验与回滚」可检查中央旧分析数据是否完整复制、有无新增会话与知识；受管期间有新数据时会拒绝自动回滚，不会制造资产丢失。没有明确原工作区归属的旧 Provider 会话仍需人工确权，不能被简单按目录名归入企业项目。

## 真实 Provider 验收判定

1. 已安装用户级配置不等于真实事件采集成功。
2. 正式验证必须使用实际 Provider 的官方新会话，记录其 `SessionStart/UserPromptSubmit/Stop/SessionEnd` 或对应事件，核对真实 Provider Session ID 与 Hook 进程 cwd。
3. 只有解析并写入的事件有实际项目归属证据时，才认为采集生效。断开、历史缺失或没有官方结束事件仍需报告 PARTIAL/BLOCKED。
4. OpenCode 插件和 Trae 的官方 Hooks 事件/配置可能随产品版本改变，需在目标安装上进一步验收；CI 模拟事件不是生产认证。
5. 安装于 HOME 的用户级 Hooks 可能影响使用者其他项目，因此安装入口强制确认、保留原设置和首次备份；没有配置时使用官方历史导入，不能静默动用用户全局配置。

## 已知产品边界

- 企业工作区统一入口目前在中央 V3「项目工作台 → 企业多仓库」中，Provider、会话、知识与分析共享选择的 Workspace ID；**不是**把旧单仓 Instance 直接变成 36 个独立实例。
- 迁移范围是具备确定工作区身份的中央企业分析资产。旧的来源不明聊天、跨项目 Provider 历史必须通过来源确权后才可迁移，不能按文件名盲目导入。
- 提供统一路径与资产模型，不表示 Provider 都能离线自动安装认证。未经用户明确授权，不能修改用户 HOME Provider 配置。

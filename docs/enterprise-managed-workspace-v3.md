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


## 跨仓库会话与历史归档语义（多模块企业工程）

- 一个真实 Provider Session ID 可以从 `phantom-payment` 切换至 `phantom-operation`，只要两次真实 cwd 都位于**同一个**受管根工作区。会话仍保留最初的主要仓库和模块，同时独立记录 `repositories`、`modules`、最后工作目录和跨目录切换次数；每条事件保留当次实际仓库/模块。筛选与详情覆盖所有访问过的仓库，而不是遗漏后续事件。
- 不允许把另一个 Workspace ID 的事件拼进同一个会话；会话身份仍由 `Workspace ID + Provider + 官方 Session ID` 确定。Hook 进程 cwd 与报告 cwd 不一致时拒绝采集，并始终重新检查根 Git 不得追踪 `.asset-workbench-data`，防止授权后被 `git add -f` 的目录遭到写入。
- **用户主动导入历史 Codex JSONL** 时，先验证所有行可解析、`session_meta.cwd` 归属正确，再导入消息，最后以 `HistoryImportComplete` 专用事件关闭归档并生成 Markdown。它**不是**官方实时 `SessionEnd`。重复导入是幂等的，不会重复追加消息和另生成聊天。
- **实时官方 Hook 的 SessionEnd** 流程不启用上述历史导入自动关闭，以免尚未处理原生结束事件就提前封存会话。
- Provider 状态将「已导入历史会话」与「已记录实时 Hook 的 SessionEnd」分别展示；导入历史不能冒充用户级 Hook E2E 成功。代码模拟测试也不等于真实 Provider 进程亲测。

## 用户级 Provider Hook 安全卸载（PR #50）

在「项目工作台 → 企业多仓库 → Provider、聊天和知识资产」中，可以明确授权安装或**卸载 V3 用户级采集 Hook**。卸载前会提示：全局用户 HOME 配置影响当前用户的**全部**受管工作区，其它工作区随后不会再自动产生新事件。

- Codex、CodeBuddy、Trae：逐项精确匹配当初 V3 安装的 Hook（命令、事件类型与匹配器），只删除属于 V3 的条目，用户原有 Hook、主题、配置和备份保留。
- OpenCode：仅当插件字节内容**完整匹配**已知 V3 生成的新版或旧版插件模板时删除；用户修改过的同名插件一律 BLOCKED，不做覆盖式恢复。
- 无 Hook 时报告 NOT_INSTALLED，重复卸载幂等。格式错误、符号链接或用户编辑过的 Hook 返回 BLOCKED；不会为了完成卸载而修改业务子仓库。
- 移除 Hook 不删除已捕获的聊天记录、Agent 事件、知识、版本快照或其它工作台资产；之后仍可重新授权安装。
- CLI/API 接口 `POST /api/enterprise/provider/hooks/remove` 必须附已登记受管工作区 ID 及 `REMOVE_USER_LEVEL_PROVIDER_HOOKS` 明确确认令牌。不得从业务 Instance 直接修改别的工作区。
- CI 合成测试验证自定义 CodeBuddy Stop Hook 保留、用户修改过的 V3 Hook 拒绝误删、OpenCode 用户修改拒绝删除、历史会话不被删除、重复卸载及重装。

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

## 生产环境后续安全收口（PR #46）

- **根 Git 已跟踪路径保护**：Git ignore 只影响未跟踪文件。如果企业根 Git 已将 `.asset-workbench-data` 加入版本管理，开启受管模式会拒绝写入，而不是依赖本地 exclude 掩盖已跟踪文件。受管运行会在 Git index 发生变化后重新检查。
- **迁移归属回执**：已经存在的 `.asset-workbench-data/enterprise` 必须带有和工作区 ID、真实根目录、中央源目录与快照文件哈希一致的迁移回执，否则不接管未知数据。迁移失败保留中央副本及现有目录供核对。
- **OpenCode 异步采集**：用户级 OpenCode 插件改为每个工作区使用一个长期运行的 JSONL Hook 桥接进程，避免此前的每条事件 `spawnSync` 导致编辑器阻塞；达到管道背压或事件超过单条容量限制时，不继续无限排队，后续事件会写入采集丢失提醒，不能宣称全量完整。已安装且和旧版官方模板完全一致的插件可备份并自动升级；被用户修改的插件不覆盖。
- 本轮 E2E 验证了 Git 跟踪保护、伪造迁移回执拒绝、未知受管目录拒绝、OpenCode JSONL 多事件流和新用户级插件的 JavaScript 语法。

本机 Provider 官方版本和真实 backV8 工作目录仍需授权机器在线后进行集成验收；模拟事件不会冒充真实供应商身份验证。

## GitHub CI 增补：从实际工作目录执行 Provider 命令

`npm run test:enterprise-provider-cli` 会在临时目录中建立模拟 backV8 根仓库、
`phantom-payment/payment-service` 和 `phantom-operation` 两个独立 Git 仓库，
并**通过实际子进程调用** `scripts/capture-enterprise-provider-event.ts`，
而不只是单元测试 `appendEnterpriseProviderEvent`。

该集成测试覆盖同一 Codex 会话跨两仓库活动、重复事件去重、伪造 cwd 与外部工作区的拒绝、
SessionEnd 后 Markdown 存档、OpenCode 的 `--stream` JSONL 采集、
Maven 最近模块归属和子仓库 Git 状态未修改。另验证受管目录中的
**悬空符号链接**（路径存在但目标不存在）不会绕过 V3 存储边界。

测试使用明确标记为 **synthetic CI fixture** 的模拟 Provider 事件；
它证明本地 Hook CLI 与资产存储链路可执行，但**不代表各个官方 Provider 版本已在真实 backV8 上通过 E2E**。
用户级 Hook 安装、认证和真实会话需要在有权限的机器上验证。

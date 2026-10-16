# 企业多仓库只读接入、语义分析与受控重构

## 目的

适用于 backV8 等数十到数百个独立 Git 仓库的已有企业业务系统。区分 **创建新独立工作台**（可能写 Instance Manifest、Provider Hook）和 **接入现有企业项目（只读）**（只在中央 Framework 保存登记、索引和分析结果）。

公司业务源目录不创建 Instance、Provider、聊天、分析缓存或构建输出；独立分析产物存放在中央 `.asset-workbench-data/enterprise-workspaces/<canonical-root-hash>/`。没有切换中央可变全局项目根目录，使用服务端登记的 `enterprise-<hash>` 标识路由每个请求。禁止业务实例通过 workspaceId 读取其他实例。

## 使用流程

1. 中央 Framework 的「独立工作台管理」输入现有企业项目目录，点击 **只读接入此企业业务目录**。例如 `/home/ainfinit/Documents/ProjectNoChinese/backV8`。不要使用会初始化业务目录的「一键创建独立工作台」按钮接入生产目录。
2. 转至「项目工作台 → 企业多仓库」，选中已登记的工作区。可以只读发现 Git 仓库、冻结各仓库 HEAD/本地跟踪引用，并获取内容寻址的 WorkspaceVersion。未联网 fetch，跟踪引用不保证最新。
3. 选定版本后，按需建立本地受管 Git Mirror、归档 Git Raw，并核对 Manifest 的 verified/partial 与缺失项。默认 Raw 总预算为 16 MiB；超限时只产生 partial，不应默认为全量完成。
4. 运行 Maven 声明依赖分析、JDK Java 符号调用分析、MyBatis SQL 血缘分析。所有边都回溯到快照、仓库、路径与源码位置（如适用）。
5. 在「问题与 Framework 演进」把具体文件与 Git SHA 绑定到优化案例。验证通过的改进仅形成 Framework 候选，还不会自动修改任何其他项目。

## Java 跨仓静态调用分析

引擎：JDK 17+ 的 `JavaCompiler` + `JavacTask.parse/analyze` + `Trees.getElement`。对 **已经归档的不可变 Git Raw** 在 Framework 私有暂存区恢复 Java 文件，禁用注解处理器（`-proc:none`），仅解析和类型归属，不执行企业源码。

方法的符号 ID 包含声明类型、方法名及参数类型，可区分方法同名、重载；跨仓调用仅在目标定义唯一且归属成功时建立证据边。无法符号解析、依赖缺失、源码超限、多版本同名冲突会计入 unresolved/diagnostics 并导致 partial/blocked。

**真实边界**：未完整提供企业 Maven 编译类路径、生成源码、注解处理、Spring AOP/反射、RPC/HTTP、重载目标和运行态调用时，不可声称有完整的生产调用链。跨服务链路还需要运行时 Trace/OpenTelemetry 和业务 RPC/接口映射作为补充证据。

## MyBatis 动态 SQL 血缘

引擎：Python SQLGlot（固定版本及包 SHA-256）+ 无外部实体网络解析的 XML ElementTree，分析 Mapper select/insert/update/delete、`<include>`、`<if>`、`<choose>`、`<where>`、`<set>`、`<trim>`、`<foreach>` 的有界符号分支。分支条件保留为证据，不执行 OGNL、不传递生产数据库凭据。

SQLGlot 解析 MySQL 方言 SQL AST，提取声明读写表和引用列。动态 `${identifier}`、未知 OGNL 分支、变长 foreach、循环 include、超过分支上限、解析失败等必须展示 PARTIAL。要证明具体运行时生成了哪条 SQL，应在测试环境记录 **MyBatis BoundSql + 参数样本** 后重新分析；只凭静态 Mapper 无法还原无限参数输入和完整动态血缘。

### 安装本机解析引擎

在中央 Framework 仓库（不是 backV8）运行：

```bash
bash scripts/setup-semantic-engine.sh
```

这会在中央私有数据目录建 Python venv 并按 SHA 校验安装 SQLGlot，且检查 Java。CI 使用同版本 Java21/Python 3.12 和固定依赖自动验证。未安装时点击「检查 Java / SQL / 本地 AI / 测试环境」查看阻塞，不伪装成功。

## AI 自动重构与验证

当前的安全执行合同：选择一个已归档的 Java 文件 → 请求 **仅本地 loopback 的 Ollama** 生成 JSON 单处精确替换候选 → 结构、大小、原文唯一性与 SHA 验证 → 保存候选到独立受管路径 → 用 **已缓存的 Docker Maven/JDK 镜像**，在 `--network none`、只读容器文件系统、无额外能力、内存/CPU/PID 限制下分别执行基线和候选的 `mvn --offline test`。

两轮测试都通过，才报告 `verified`（**仅表示该离线测试矩阵通过**，不保证逻辑等价、运行时性能改善或生产验收）。基线失败/缓存不足/模型未安装/Docker 不可用/Raw partial 时报告 `blocked`，候选失败报告 `rejected`。候选绝不自动回写公司源代码、不自动提交 PR，不上传代码到外部云模型。

要达到企业级自动重构投产，必须进一步配置授权模型、完整可复现 Maven 私有依赖缓存、静态契约检查、业务集成/回归测试、SQL 数据验证、性能基线、隔离沙箱审计、维护窗口、审批和可回滚的变更提交。AI 不能绕过这些前置门禁。

## 自动化验收与当前限制

`npm run test:enterprise-semantic` 使用两个临时 Git 仓库验证符号跨仓调用、MyBatis 条件分支、SQL 读写关系、业务目录零额外写入和非法工作区 ID 拒绝。GitHub CI 使用完整的 `npm run check`。该合成测试不等同于真实 backV8 全量语义与端到端生产验收。

如本机 Desktop Commander 离线，无法在此轮运行真实 backV8 的全量 Mirror/Raw/Maven/Java/SQL/AI 验收；需在恢复授权连接之后再获取实际覆盖率与阻塞证据。

## 发布门禁（不可省略）

- 必须报告：仓库总数、确权快照、Raw 覆盖率、Java 符号解析率、未解析调用和 Java 编译诊断、SQL 分支覆盖率、未解析动态参数、静态/运行态证据差异。
- 必须报告：AI 候选原代码 SHA、模型版本、提议差异、基线/候选测试证据、失败/阻塞原因；无业务测试无法宣称行为保持不变。
- 不把多仓库扫描、API 返回 HTTP200、一个 CI 绿色等同于业务系统全链路 READY。

# 婚礼管理应用

自用的轻量婚礼应用，包含三个界面：

- **管理后台**（PC）：`/admin` —— 管宾客、发请柬、看回执、看统计、导出
- **请柬页**（手机）：`/invite/:token` —— 宾客查看请柬、填写回执
- **自助签到页**（手机）：`/checkin` —— 现场扫码自助签到

> 需求、技术方案、审查与逐项验收见 [文档索引](docs/README.md)。

## 技术栈

TypeScript + Node 24 · Hono · SQLite（better-sqlite3 / WAL）· Drizzle ORM · React 19 + Vite 8 · Ant Design 6 · Tailwind CSS · Docker + Caddy

## 功能

**宾客端（手机）**
- **请柬页** `/invite/:token`：国风封面（打开动效）、个人化问候、倒计时、婚礼信息与一键导航、流程、相册、回执表单、联系与分享
- **通用请柬** `/invite`：宾客互转的通用链接，填写回执时自行输入姓名
- **自助签到** `/checkin`：扫码只填姓名，提交后进入后台待审核

**管理后台（PC）**
- **仪表盘**：关键指标卡 + 回执/礼金/分组图表
- **宾客管理**：增删改查、Excel 导入导出、搜索筛选、专属链接复制、二维码、海报、批量海报 ZIP、宾客详情
- **回执管理**：列表 + 统计 + 代填修改
- **现场审核**：待审核列表（自动刷新）、补录礼金（金额必填可为 0）、确认/驳回、手动补录、现场入口总码
- **签到记录**：列表与筛选
- **礼金管理**：流水 +（仅管理员）总额与方式分布 + 增删改
- **导出**：宾客 / 回执 / 签到 / 礼金 分别导出 Excel
- **两个账号**：`admin`（全部权限）与 `staff`（仅现场，看不到礼金总额与统计）

> 婚礼信息写在 `shared/wedding.ts`；图片等素材目前是 `public/assets/` 下的 **demo 占位（SVG）**，替换为真实素材即可。

## 本地开发

```bash
# 1. 安装依赖
pnpm install

# 2. 准备环境变量
copy .env.example .env   # Windows
# cp .env.example .env   # macOS / Linux

# 3. 初始化数据库（生成迁移 → 执行迁移 → 写入两个账号与 demo 宾客）
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# 4. 启动（并行起后端 3000 与前端 5173）
pnpm dev
```

- 前端：http://localhost:5173
- 后端：http://localhost:3000
- 默认账号：`admin` / `admin123`（管理员），`staff` / `staff123`（工作人员）

> 修改 `.env` 后，开发环境会自动读取；种子账号在数据库为空时才会创建。

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 并行启动前后端 |
| `pnpm build` | 构建前端到 `web/dist` |
| `pnpm start` | 生产模式启动（需先 `pnpm build`） |
| `pnpm typecheck` | 类型检查 |
| `pnpm db:generate` | 依据 schema 生成迁移 |
| `pnpm db:migrate` | 执行迁移 |
| `pnpm db:seed` | 写入账号与 demo 数据 |

## 目录结构

```
server/    Hono 后端（路由、鉴权、数据库）
web/       React 前端（admin / invite / checkin）
shared/    前后端共享类型与婚礼配置
public/    静态资源（海报底图、图片，demo 占位）
data/      SQLite 数据文件（git 忽略）
docs/      产品 / 技术 / 评审 / 问题整改（含验收截图）
```

## 部署（腾讯云 · 中国香港）

```bash
# 服务器上
cp .env.example .env
# 编辑 .env：填写域名、JWT_SECRET、两个账号密码、PUBLIC_BASE_URL
docker compose up -d --build
```

Caddy 会自动签发 HTTPS 证书。详见 [技术设计](docs/技术/技术设计.md) 第 8.5 节。

## 说明

- 婚礼信息写死在 `shared/wedding.ts`，图片等素材先用 demo 占位，后续替换。
- 后台两个账号：管理员（全部权限）与工作人员（仅现场，看不到礼金总额与统计）。

# 婚礼管理应用

自用的单场婚礼应用：管理宾客和邀请、收集回执、核对到场、登记礼金及导出记录。一期功能开发与本地自动化验收已完成，实体手机、微信和正式部署环境仍需验收。

[文档入口](docs/README.md) · [当前业务范围](docs/产品/需求文档.md) · [测试报告](docs/测试/一期测试报告.md)

## 页面与权限

| 入口             | 用途                                         |
| ---------------- | -------------------------------------------- |
| `/admin`         | 管理后台；工作人员默认进入现场审核           |
| `/invite/:token` | 专属请柬与回执                               |
| `/invite`        | 可转发的通用请柬；回执由本浏览器私有凭证编辑 |
| `/checkin`       | 自助提交姓名，等待现场核对                   |

管理员维护档案、完整回执、统计、导出及账目更正。工作人员可现场核对、确认签到、补登记礼金及纠正人数、单笔礼金和档案关联，也可撤销、作废并恢复现场记录；不能读取完整回执、祝福留言、统计与礼金汇总。权限由服务端保证。

姓名不是唯一身份；预计人数与实到独立，实到包含儿童；礼金自愿，不登记不生成零元礼金记录。归档、驳回、撤销、作废与恢复保留数据和操作记录，不提供永久删除入口。

## 本地启动

要求 Node >=24、pnpm。首次开发环境初始化：

```sh
pnpm install
pnpm lint:setup
cp .env.example .env
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Windows 可用 `copy .env.example .env`。已有 `.env` 时不要覆盖；`db:seed` 会写入示例宾客，仅用于开发准备。默认本地账号为 `admin / admin123`、`staff / staff123`，实际以环境配置与已存账号为准；修改环境变量不会更新数据库中的既有密码。

前端 `http://localhost:5173`，后端 `http://localhost:3000`。婚礼信息与素材路径由 `shared/wedding.ts` 管理，后台没有婚礼配置或照片上传界面。

手机/微信本地预览（macOS / Linux，已安装 nvm 和 Node 24）：

```sh
pnpm preview:local
```

自动执行 `nvm use 24`，启动前后端并输出请柬、签到二维码及后台地址。手机与电脑连接同一 Wi-Fi 即可扫码；无需修改 `.env`，端口占用时自动选择空闲端口，按 Ctrl+C 一起停止。使用当前开发数据库，不自动清空或插入示例数据。

## 检查与测试

```sh
pnpm check
pnpm test:e2e:setup
pnpm --dir tooling/e2e exec playwright install chromium
pnpm test:e2e
```

本机已有 Chrome 时可用 `E2E_BROWSER_CHANNEL=chrome pnpm test:e2e`。业务测试与浏览器验收使用独立临时库；浏览器结果写入被git忽略的 `test-results/`。

完整命令、独立验收环境及Vite缓存说明见[本地开发与验收](docs/技术/本地开发与验收.md)，分层和检查要求见[代码质量规范](docs/技术/代码质量规范.md)。

## 工程与部署

日常更新可双击根目录 `build-release.cmd`（本地构建后网页上传）或 `publish-release.cmd`（配置 SSH 后自动更新）。完整操作、备份与失败恢复见[手动发布与更新](docs/技术/手动发布与更新.md)，入口只用于已有部署。

TypeScript 7、Node 24、Hono、SQLite/WAL、Drizzle、React 19、Vite 8、Ant Design 6。后端统一提供API，生产模式同时托管 `web/dist`；Docker Compose包含应用与Caddy，数据挂载到 `data/`。

```text
server/    API、认证、业务事务、数据库迁移、文件输出
web/       后台、请柬、自助签到
shared/    DTO、校验边界、数值解析、婚礼与物料配置
public/    网站静态资源，含已授权的婚纱照展示副本
tests/     业务回归与浏览器验收
tooling/   隔离的ESLint/Prettier及Playwright依赖
docs/      当前说明、测试记录、历史归档
```

部署前阅读[技术设计](docs/技术/技术设计.md)及[上线前待办](docs/技术/上线前待办.md)。服务启动会执行迁移，**不会自动创建账号**；当前种子脚本还会插入示例宾客，不能视为仅账号的生产初始化方案。正式域名、账号初始化、备份恢复与真机验收需在上线前落实。

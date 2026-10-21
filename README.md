# 帧港 FrameHarbor

**把今晚，留给大银幕。**

基于 FilmSys 电影售票业务重新设计的完整前后端项目。用户端与运营台共用 Vue 3 界面，Express 提供真实持久化 API，SQLite 保存用户、座位库存、订单及审计记录。

## 演示内容

| 用户端                                  | 运营台                                       |
| --------------------------------------- | -------------------------------------------- |
| 深色影院首页、原创概念海报、响应式布局  | 营收、有效出票、未来 7 天上座率、近 7 天图表 |
| 片名/导演检索、类型/上映状态/排序筛选   | 影片新增、编辑、精选及归档                   |
| 影片详情、分日场次、影院与影厅资料      | 影院/影厅新增、编辑及布局保护                |
| 交互座位图、连座推荐、每 12 秒刷新      | 排片创建、时长计算、20 分钟清场冲突检查      |
| 每单 1–4 座、8 分钟锁座、超时释放       | 取消场次并同步关闭/退款订单                  |
| 服务端计价、FIRSTFRAME 优惠码、演示支付 | 订单检索、状态筛选、取票码核销               |
| 票根、倒计时、取消、开场前 45 分钟退票  | 影评通过/驳回、公开评分同步                  |
| 想看清单、观影偏好、带理由的推荐、影评  | 所有运营写入的事务审计日志                   |

影片与影院资料均为虚构；精选指数标注为编辑指数，用户评分来自审核通过的影评。支付按钮明确显示「演示支付」，不涉及真实转账。

## 技术与目录

Node >=24.10.0、Vue 3.5、Vue Router 4、TypeScript 5.9、Vite 7、Express 5、Zod 4，数据库使用 `node:sqlite`，无需 MySQL 服务或原生扩展编译。单实例部署，金额整数分，时间戳 UTC 毫秒，业务展示时区为 `Asia/Shanghai`。

```text
FrameHarbor/
├─ shared/                 # 前后端 DTO、业务常量、输入验证
├─ server/schema.sql       # 12 张持久化表、外键、索引和约束
├─ server/src/             # 认证、目录、社区、票务、运营模块
├─ web/src/                # Vue 页面、组件、样式、状态及 API 客户端
├─ web/public/art/         # 8 张原创海报 + 1 张首页场景 SVG
├─ tools/static-audit.mjs  # 只读取源码的静态检查器
├─ docs/                   # 设计、接口、审查与运行验收文档
└─ .env.example            # 本地配置模板
```

## 快速启动


在 PowerShell 中：

```powershell
Set-Location -LiteralPath 'D:\个人项目\FrameHarbor'
npm ci
Copy-Item -LiteralPath '.env.example' -Destination '.env'
```

编辑 `.env`，为 `ADMIN_PASSWORD` 填入至少 12 位密码。首次启动按 `ADMIN_EMAIL` 创建管理员；不配置密码时跳过管理员创建，普通用户可以自行注册。已有管理员不会被环境变量覆盖。

```powershell
npm run dev
```

用户入口：<http://127.0.0.1:5173>；运营台：<http://127.0.0.1:5173/admin>；API：<http://127.0.0.1:8787/api>。使用 `127.0.0.1` 与配置中的 APP_ORIGIN 保持一致。

首次应用启动会创建 `data/frameharbor.sqlite`，并在空影片库中生成 8 部虚构影片、3 家影院、6 个影厅及未来 7 天排片。首次启动跨过当天最后售票时间时，后续日期仍有场次。种子只初始化一次，后续排片在运营台维护；设置 `SEED_DEMO=false` 可从空目录开始。演示数据不创建固定普通用户，需自行注册。

## 配置

| 变量                                      | 默认 / 作用                                      |
| ----------------------------------------- | ------------------------------------------------ |
| HOST / PORT                               | `127.0.0.1` / `8787`                             |
| APP_ORIGIN                                | 开发默认 `http://127.0.0.1:5173`；写接口校验来源 |
| DB_PATH                                   | `./data/frameharbor.sqlite`，相对于项目工作目录  |
| ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME | 首次创建管理员；密码至少 12 位                   |
| DEMO_PAYMENTS                             | 开发默认开启；生产仅显式 `true` 开启             |
| SEED_DEMO                                 | 默认 `true`；空影片库初始化演示资料              |
| NODE_ENV                                  | `development` 或 `production`                    |

开发服务器代理 `/api`，无需 CORS。Node 直接执行只含可剥离类型语法的 `.ts`。服务端通过 `import.meta.url` 定位 SQL 和前端产物，启动命令在项目根目录执行。

单机生产演示先执行 `npm run build`，再配置 `NODE_ENV=production`、HTTPS `APP_ORIGIN` 和 `TRUST_PROXY`，使用 `npm start`。通过 HTTPS 反向代理指向 API，服务器同时托管 `dist/web` 与 SPA 回退。生产 Cookie 启用 Secure 与 `__Host-` 前缀；应用默认只监听回环地址。真实收费上线另需支付渠道、回调验签、外部账务和运行验收。

`TRUST_PROXY` 开发默认留空，不信任转发头；本机 HTTPS 反代设为 `loopback`。远端反代填写其准确 IP/CIDR，多项逗号分隔；仅信任受控代理，确保应用端口不对外直通。限流据此识别真实客户端地址。本机单层 Nginx 的 location 配置示例：

```nginx
location / {
    proxy_pass http://127.0.0.1:8787;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```
项目作者：Changqing Zhou · zcq@njfu.edu.cn
上游 FilmSys 采用 GPL-3.0，本项目保留该许可证及来源说明。原项目目录保持原样。

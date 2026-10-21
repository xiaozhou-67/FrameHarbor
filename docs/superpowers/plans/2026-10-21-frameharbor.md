# FrameHarbor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. 用户已授权设计后直接编写；本项目仅静态检查，覆盖技能默认的运行测试及审批流程。

**Goal:** 交付独立、完整的帧港电影购票和运营项目。

**Architecture:** Vue 3 SPA 与 Express 5 同源 API；shared 定义 DTO，server 拆分数据库/权限/目录/票务/管理模块。SQLite 事务和唯一座位键保证单实例库存一致性。

**Tech Stack:** Node >=24.10.0、TypeScript 5.9、Vue 3.5、Vue Router 4、Vite 7、Express 5、Zod 4、内置 node:sqlite。

**Spec:** ../specs/2026-10-21-frameharbor-design.md

## Global Constraints

- 输出到 D:/个人项目/FrameHarbor，保留 FilmSys 原样。
- 只静态检查；不启动项目、不执行测试、不构建、不创建数据库。
- 金额整数分；时间 UTC epoch 毫秒，展示 Asia/Shanghai；每单 1–4 座；保留 8 分钟；退票提前 45 分钟；停售提前 15 分钟；清场 20 分钟。
- 演示支付显式标注；管理员无固定默认密码；原创本地海报、虚构演示数据。

## Review Focus

- 同座并发/重复点击：唯一占用 + 事务 + 幂等状态迁移。
- 跨用户 ID 和伪造身份：只从服务端会话取 userId，所有后台路由统一 requireAdmin。
- 过期锁座及优惠占用：所有票务入口先清理，取消和退款成对释放。
- 跨日排片和夏令/时区偏差：毫秒时间比较，明确 +08:00 的本地日期输入。
- 详情路由快速切换及网络失败：数据载入清空、按请求序号丢弃过时结果、错误可重试。

### Task 1: 模型、持久化与共享契约

**Files:** shared/domain.ts; server/schema.sql; server/src/{config,db,seed,errors}.ts。
**Interfaces:** db.get<T>/all<T>/run/transaction；Movie/Cinema/Hall/Show/Order DTO；ApiResponse<T>。

- [x] 定义 schema 约束、索引、金额与状态机。
- [x] 写共享 DTO、数据库适配和空库演示初始化。
- [x] 静态审阅外键、唯一键、初始化幂等和类型一致性。

### Task 2: 身份、目录和社区

**Files:** server/src/{auth,catalog,community}.ts; shared/validation.ts。
**Interfaces:** /api/auth、/api/movies、/api/cinemas、/api/me、/api/reviews。

- [x] 完成注册登录退出/会话/CSRF/限流。
- [x] 完成目录筛选、影院、偏好推荐、想看和待审评论。
- [x] 静态审阅权限、参数绑定、公开评分口径。

### Task 3: 票务与运营

**Files:** server/src/{ticketing,admin,app,index}.ts。
**Interfaces:** /api/shows/:id/seats；/api/orders；/api/admin/*。

- [x] 实现锁座、过期、支付、优惠、取消、退款和核销。
- [x] 实现影片、影院、影厅、排片、统计、评论、日志后台 API。
- [x] 静态审阅并发、事务、补偿、排片冲突与路由组合。

### Task 4: 用户界面

**Files:** web/src/{App,router,api,state,format}.ts/vue；components/_；views/_；styles/_；web/public/art/_。
**Interfaces:** 所有请求经 api<T>；auth.user/csrfToken；反馈 toast 与表单 pending；共用 DTO。

- [x] 创建响应式框架、SVG 海报、影片/影院/个人页面。
- [x] 完成登录、评论、选座、订单倒计时、支付确认和退票。
- [x] 核对链接、空态、错误态、可访问性及异步请求归属。

### Task 5: 后台界面与交付

**Files:** web/src/views/admin/*；README.md；docs/{API,ACCEPTANCE,STATIC_REVIEW,ORIGIN}.md；tools/static-audit.mjs。

- [x] 完成后台各页实际表单、筛选与操作，避免空壳按钮。
- [x] 安装依赖并禁用生命周期脚本；执行类型、lint 和源码静态检查。
- [x] 修复静态发现，最终独立审查并保存证据。
- [x] 写配置/启动/验收文档并通知用户审查；不执行运行验收。

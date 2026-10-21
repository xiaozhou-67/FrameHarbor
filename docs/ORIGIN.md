# 来源、改动与许可

- FrameHarbor 项目作者：Changqing Zhou，邮箱 zcq@njfu.edu.cn。

- 业务基底：本机 `D:/个人项目/FilmSys`，上游地址 https://github.com/J1ong/FilmSys ，作者署名沿用其 README 中的 J1ong。
- 参考快照：本机 Git HEAD `795ffb0`，提交说明「高亮显示搜索关键字，优化搜索接口」。
- FrameHarbor 为新目录中的重构项目。保留影片、影院、影厅、排片、选座、订单、想看、评论与管理等业务概念；前后端源码、DTO、数据库与界面重新编写。
- 项目沿用 GPL-3.0-only；根目录 LICENSE 是原项目许可证的原文副本，网页的 `/license.txt` 公开同一全文。
- 新增限时锁座、参数校验、服务端计价、优惠码、订单退款、会话安全、权限、排片冲突、核销、审计、偏好推荐及统一响应式界面。
- 未复制原项目的 MySQL 数据、用户头像、密码或电影图片。演示影片、演员、影院与剧情均为本项目虚构内容；`web/public/art/*.svg` 是随本项目编写的概念海报与场景图。
- 新增或分发修改版本时保留本文件与许可证，以便审查者识别改动及来源。

技术决策参考官方文档：

- https://nodejs.org/docs/latest-v24.x/api/sqlite.html — `DatabaseSync`、参数绑定与内置 SQLite。
- https://nodejs.org/docs/latest-v24.x/api/typescript.html — Node 原生 TypeScript 类型剥离；不使用 enum、参数属性及别名路径。
- https://vite.dev/guide/ — Vue 构建与开发代理。
- https://expressjs.com/en/5x/api/ — Express 5 路由与错误处理中间件。

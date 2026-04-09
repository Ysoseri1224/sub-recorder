# Sub Recorder

[![Docker Image](https://img.shields.io/docker/v/Ysoseri1224/sub-recorder?label=Docker&sort=semver&logo=docker)](https://hub.docker.com/r/Ysoseri1224/sub-recorder)
[![Image Size](https://img.shields.io/docker/image-size/Ysoseri1224/sub-recorder/latest?label=Image%20Size&logo=docker)](https://hub.docker.com/r/Ysoseri1224/sub-recorder)
[![GitHub License](https://img.shields.io/github/license/Ysoseri1224/sub-recorder?label=License)](LICENSE)
[![Rust](https://img.shields.io/badge/Rust-Actix--web-orange?logo=rust)](backend/)
[![Next.js](https://img.shields.io/badge/Next.js%2015-React%2019-black?logo=next.js)](frontend/)

个人订阅管理工具 — 记录和追踪各类订阅服务的费用支出。

> 多币种 · 自动汇率 · 账单周期 · 场景分组 · 分类筛选 · 多渠道通知

👉 **在线演示**：<https://sub-recorder.onrender.com/>

<!-- 在此放置截图
![screenshot](docs/screenshot.png)
-->

## 功能特性

- **订阅管理** — 添加 / 编辑 / 暂停 / 恢复，支持图标上传和批量导入
- **数据导入导出** — 一键导出全部数据为 JSON，支持从备份文件恢复
- **费用追踪** — 多币种、自动汇率换算、账单周期管理、历史账单记录
- **场景分组** — 将订阅按场景归组，独立统计费用
- **分类筛选** — 自定义分类与颜色标记，快速过滤
- **日历视图** — 按日期查看即将到期的账单
- **多渠道通知** — SMTP 邮件 / OneBot (QQ) / Telegram / 自定义 Webhook
- **用户认证** — 登录鉴权、密码重置，亦可禁用鉴权
- **轻量部署** — 单进程单端口，Alpine + Rust 二进制 + 静态前端，镜像极小

## 部署

### 快速部署

#### Render

点击下方按钮，使用 [Render](https://render.com/) 一键部署：

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/shenghuo2/sub-recorder)

> **注意**：Render 免费计划无持久化存储，每次重启容器数据就会丢失。免费实例在无请求时会自动休眠。
>
> *Free instances spin down after periods of inactivity. They do not support SSH access, scaling, one-off jobs, or persistent disks. Select any paid instance type to enable these features.*

### Docker

镜像名 `Ysoseri1224/sub-recorder:latest`

#### Docker Compose（推荐）

```yaml
# docker-compose.yml
services:
  sub-recorder:
    image: Ysoseri1224/sub-recorder:latest
    container_name: sub-recorder
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      - DATABASE_PATH=/app/data/subscriptions.db
```

```bash
docker compose up -d
```

访问 `http://localhost:3000`，首次启动会自动创建 admin 用户并生成随机密码：

```bash
docker logs sub-recorder 2>&1 | grep "密码:"
```

#### Docker Run

```bash
mkdir -p ./data

docker run -d \
  --name sub-recorder \
  --restart unless-stopped \
  -p 3000:3000 \
  -v ./data:/app/data \
  -e DATABASE_PATH=/app/data/subscriptions.db \
  Ysoseri1224/sub-recorder:latest
```

#### 从源码构建

```bash
git clone https://github.com/Ysoseri1224/sub-recorder.git
cd sub-recorder
docker compose -f docker/docker-compose.yml up -d --build
```

## 配置

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DATABASE_PATH` | `/app/data/subscriptions.db` | SQLite 数据库路径 |
| `PORT` | `3000` | 监听端口 |
| `STATIC_DIR` | `/app/static` | 前端静态文件目录 |
| `DISABLE_AUTH` | — | 设为 `true` 或 `1` 禁用鉴权 |
| `INIT_USERNAME` | `admin` | 首次启动时创建的用户名 |
| `INIT_PASSWORD` | *随机生成* | 首次启动时创建的密码 |
| `DEMO_MODE` | — | 设为 `true` 或 `1` 在登录页展示演示账号密码 |

### 用户管理

```bash
# 查看初始密码
docker logs sub-recorder 2>&1 | grep "密码:"

# 重置密码（立即生效，无需重启）
docker exec sub-recorder /app/backend --reset-password
```

登录后也可在「设置」页面修改用户名和密码。

### 数据持久化

数据库存储在容器内 `/app/data/`，通过 volume 映射到宿主机。备份只需复制 `./data/subscriptions.db`。

容器以非 root 用户（UID 1000）运行，如遇权限问题：

```bash
sudo chown -R 1000:1000 ./data
```

## 修改日志

本仓库基于 [shenghuo2/sub-recorder](https://github.com/shenghuo2/sub-recorder) Fork，在原项目基础上进行了以下改动：

### 国际化（i18n）

- 新增语言切换功能，支持**中文 / English** 双语，切换后全局即时生效
- 语言切换入口位于「设置」页面（`LanguageSwitcher` 组件）
- 所有界面文案均通过 `i18n.ts` 翻译系统管理，`t(key, fallback)` 支持 fallback 回退，保证用户自建分类在缺少翻译时仍显示原名
- 翻译覆盖范围：
  - 主页标题、订阅计数、均费、本月支出等统计副标题
  - 账单周期选项（每天 / 每周 / 每月……）
  - 预设分类名称（保险、云存储、流媒体、VPN/代理……共 30+ 项）
  - 日历星期与月份标签
  - 货币选择列表（27 种货币本地化名称）
  - 场景管理、分类管理、设置页全部文案

### Bug 修复

- **修复后端 SQL 歧义列名错误**：`get_stats` 函数的 JOIN 查询中 `name` 列未加表别名，导致 `ambiguous column name: name` 运行时报错；通过引入 `SUB_COLUMNS_PREFIXED` 常量（所有列加 `s.` 前缀）修复

### UI / 交互改进

- **移除"账单周期格式"设置项**：原有独立的 Chinese/English 周期标签切换选项已整合进语言设置，随界面语言自动切换，减少冗余配置
- **Statistics 分类图表翻译**：By Category 饼图与列表中的分类名现在随语言设置同步翻译
- **场景空状态文案优化**：首次使用时的提示按钮文案从完整描述句改为简短操作词，避免溢出截断
- **归属信息更新**：Settings 页和登录页底部版权信息更新为本仓库地址

## 开发

本地开发、项目结构、技术栈、API 等详见 [DEVELOPMENT.md](DEVELOPMENT.md)。

## Roadmap

- [ ] 重新设计应用 Logo（近期先支持自定义上传 Logo）
- [ ] Android 客户端 — 基于 Material Design 3 & Monet 动态取色，内置本地数据库，支持与服务端双向同步
- [ ] 后端同步 API — 为多端协同提供增量同步能力

## Contributing

欢迎提交 Issue 和 Pull Request！

## License

[AGPL-3.0](LICENSE)

Copyright © 2025 [shenghuo2](https://github.com/shenghuo2) · [sub-recorder](https://github.com/shenghuo2/sub-recorder)

Fork maintained by [Ysoseri1224](https://github.com/Ysoseri1224) · [sub-recorder](https://github.com/Ysoseri1224/sub-recorder)

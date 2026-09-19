# Verse Console

> Verse LLM 网关的多租户管理控制台。

[![Vue](https://img.shields.io/badge/Vue-3.5-42B883?logo=vuedotjs&logoColor=white)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![Status](https://img.shields.io/badge/status-active%20development-blue)](#项目状态)

Verse Console 为团队提供模型服务、API Key、成员权限、调用审计和用量成本的一站式管理体验。它与 [Verse Gateway](https://github.com/Yonagi04/Verse) 配套使用，面向日常管理与运营，而业务应用通过 OpenAI 兼容接口直接访问网关。

## 主要功能

- **运营仪表盘**：查看当前租户的模型数量、今日 Token、调用次数及 24 小时/7 天趋势。
- **模型服务目录**：注册和维护上游模型，配置标签、价格、峰谷时段，并支持筛选、对比和详情查看。
- **API Key 管理**：创建、编辑、查询和撤销租户内的访问凭证。
- **用量与成本分析**：按时间、用户、API Key、服务和模型筛选，查看趋势与构成并导出报表。
- **调用审计**：检索请求记录，通过详情抽屉查看状态、耗时、Token 与请求/响应信息。
- **多租户协作**：创建与切换租户，管理品牌信息、邀请、加入申请、成员和角色。
- **账户与通知**：实时站内通知、个人资料、隐私设置、设备管理、登录历史及账户注销。

## 快速开始

### 环境要求

- Node.js 20+
- npm 10+
- 已启动的 [Verse Gateway](https://github.com/Yonagi04/Verse)，默认地址为 `http://localhost:8080`

### 安装与启动

```bash
git clone git@github.com:Yonagi04/Verse-FE.git
cd Verse-FE
npm install
npm run dev
```

打开 `http://localhost:3000`。开发服务器会将 `/api/v1` 和 `/ws` 转发到 `http://localhost:8080`。

### 生产构建

```bash
npm run build
npm run preview
```

构建产物输出到 `dist/`。使用 HTML5 History 路由部署时，需要让 Web 服务器将未知前端路由回退到 `index.html`，并将 `/api/v1`、`/ws` 转发至后端。

## 技术栈

Vue 3.5 · TypeScript 5.6 · Vite 6 · Ant Design Vue 4 · Pinia · Vue Router · Axios · ECharts · STOMP/WebSocket · SCSS

## 目录结构

```text
src/
├── api/          # Axios 实例与领域 API
├── assets/       # 全局样式与设计变量
├── components/   # 通用组件
├── composables/  # WebSocket 等组合式逻辑
├── hooks/        # 权限、账户操作等页面逻辑
├── layouts/      # 应用框架、导航与通知入口
├── router/       # 路由与登录/租户初始化守卫
├── stores/       # 用户、租户、权限、主题与设置
├── types/        # API 与领域类型
├── utils/        # 认证、时间、金额与租户恢复工具
└── views/        # 仪表盘、租户、模型、密钥、用量、审计等页面
```

## 项目约定

- 使用 Vue Composition API 与 `<script setup lang="ts">`。
- 页面通过 `src/api/` 访问后端，不直接创建 Axios 请求。
- API 成功响应由统一拦截器解包，错误提示与 `401` 处理集中完成。
- 登录令牌存放在 `localStorage`，请求自动附加 `Authorization: Bearer ...`。
- 样式优先使用 SCSS 设计变量，组件交互遵循 Ant Design Vue 约定。

## 项目状态

Verse Console 处于积极开发阶段，主要管理闭环已经可用。当前尚未配置自动化测试、Lint 和 Formatter，生产上线前建议补充质量门禁、错误监控和浏览器兼容性验证。

## 相关项目

- [Verse Gateway](https://github.com/Yonagi04/Verse) — Spring Boot LLM 网关与管理 API

> 本仓库当前未声明开源许可证。在许可证补充前，代码默认保留全部权利。

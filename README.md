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
- **Playground 工作台**：单模型对话与多模型并排对比，支持流式回答、参数配置、重试、分叉、个人预设及会话与调用代码导出。
- **API Key 管理**：创建、编辑、查询和撤销租户内的访问凭证。
- **用量与成本分析**：按时间、用户、API Key、服务和模型筛选，查看趋势与构成并导出报表。
- **调用审计**：检索请求记录，通过详情抽屉查看状态、耗时、Token 与请求/响应信息。
- **多租户协作**：搜索、筛选、收藏和切换租户，查看租户概览、公告与活动记录，管理品牌信息、邀请、加入申请、成员和角色。
- **账户与通知**：统一的登录、注册与找回密码页面；个人中心提供资料与公开预览、隐私设置、设备管理、登录历史、外部账号管理及账户注销，支持实时站内通知。
- **外部账号认证**：支持 GitHub、GitLab、Google 登录，以及已有账号关联、新账号注册、绑定与解绑；可用平台由后端配置决定。
- **主题外观**：支持浅色、深色与自动跟随系统，覆盖认证页面、控制台、图表和弹窗，并保存浏览器偏好。

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

### 接口配置

`.env.development` 和 `.env.production` 默认均使用 `VITE_API_BASE_URL=/api/v1`。本地后端地址在 `vite.config.ts` 的 `server.proxy` 中配置；如需修改开发代理地址，请同时调整 `/api/v1` 与 `/ws` 的目标。

外部账号登录需要后端配置对应平台的 OAuth 凭据与回调地址。前端根据后端返回的平台状态展示入口，未启用的平台不显示，暂不可用的平台禁用登录按钮。

### 开发验证

```bash
# 类型检查
npx vue-tsc --noEmit

# 单元测试
npm test

# 类型检查与生产构建
npm run build
```

### 生产构建

```bash
npm run build
npm run preview
```

构建产物输出到 `dist/`。使用 HTML5 History 路由部署时，需要让 Web 服务器将未知前端路由回退到 `index.html`（包括外部认证流程页面），并将 `/api/v1`、`/ws` 转发至后端。Playground 的流式接口使用 SSE，代理应支持流式响应并避免缓冲输出。

## 使用说明

### Playground

在当前租户的设置中开启 Playground，并确保租户有可用的文本聊天模型，即可从侧边栏进入工作台。调用产生的 Token 用量计入当前租户消耗。

- 新建对话默认使用单模型，最多支持三栏并排对比，也可选择同一模型对比不同参数。
- 支持系统提示词、Temperature、Top P 与最大输出 Token，可同步各栏或独立配置；可用参数与范围取决于模型能力配置，修改应用于下一轮。
- 支持停止单栏或全部生成、失败重试、重新生成与会话分叉，回答以 Markdown 和代码高亮呈现。
- 会话支持搜索、重命名、删除；个人预设支持保存、复用与版本恢复，历史一期会话仍可打开并继续聊天。
- 请求详情可查看 Token、首内容耗时、总耗时、费用与计量依据；支持导出 cURL、Python、JavaScript 调用代码，以及 Markdown、JSON 会话记录。导出的调用代码需使用具有模型权限的 API Key。

### 租户与个人中心

租户列表支持按名称或 ID 搜索、排序与收藏筛选。点击租户名称可查看概览，查看其他租户详情不会自动切换当前租户；通过“切换并进入”更新工作上下文后继续管理。

个人中心提供资料编辑、公开资料预览和安全管理，可绑定或解绑 GitHub、GitLab、Google 账号。绑定与解绑需要密码验证，外部授权完成后按流程确认关联。

### 外观切换

在侧边栏底部用户菜单的“外观”中选择浅色、深色或自动模式。默认跟随系统，偏好保存在当前浏览器的 `localStorage`，并在同源标签页之间同步。

## 技术栈

Vue 3.5 · TypeScript 5.6 · Vite 6 · Ant Design Vue 4 · Pinia · Vue Router · Axios · ECharts · STOMP/WebSocket · SSE · Marked / DOMPurify / Highlight.js · SCSS · Vitest

## 目录结构

```text
src/
├── api/          # Axios 实例与领域 API
├── assets/       # 全局样式与设计变量
├── components/   # 通用组件与认证页面组件
├── composables/  # WebSocket 等组合式逻辑
├── hooks/        # 权限、账户操作、外部认证、Playground 与图表主题逻辑
├── layouts/      # 应用框架、导航与通知入口
├── router/       # 路由与登录/租户初始化守卫
├── stores/       # 用户、租户、权限、主题、设置与 Playground 状态
├── types/        # API 与领域类型
├── utils/        # 认证、时间、金额与租户恢复工具
└── views/        # 仪表盘、租户、模型、密钥、用量、审计、Playground 与认证等页面

tests/            # 主题、外部认证流程与租户身份隔离的单元测试
```

## 项目约定

- 使用 Vue Composition API 与 `<script setup lang="ts">`。
- 页面通过 `src/api/` 访问后端；常规请求使用统一 Axios 实例，Playground 流式请求通过 API 模块中的原生 Fetch 读取 SSE。
- 常规 API 成功响应由统一拦截器解包，错误提示与 `401` 处理集中完成；流式 API 在各自模块中解析事件并处理认证错误。
- 登录令牌存放在 `localStorage`，请求自动附加 `Authorization: Bearer ...`。
- 样式优先使用 SCSS 设计变量与主题 CSS 变量，Ant Design 主题和图表颜色随外观同步，组件交互遵循 Ant Design Vue 约定。

## 项目状态

Verse Console 处于积极开发阶段，主要管理闭环已经可用。已接入 Vitest，当前单元测试覆盖主题切换、外部认证流程和租户身份隔离；尚未配置 Lint、Formatter 与端到端测试，生产上线前建议继续完善质量门禁、错误监控和浏览器兼容性验证。

## 相关项目

- [Verse Gateway](https://github.com/Yonagi04/Verse) — Spring Boot LLM 网关与管理 API

> 本仓库当前未声明开源许可证。在许可证补充前，代码默认保留全部权利。

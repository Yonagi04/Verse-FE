# Verse Frontend

Verse 管理控制台前端，为用户和租户提供统一的 LLM 网关可视化管理界面。

后端项目位于 [Verse](https://github.com/yonagi04/verse)。

## 功能

- 用户注册与登录
- 密码重置（手机验证码流程）
- 多租户管理（创建、查看、切换租户）
- 用户个人信息管理
- 基于角色的权限控制（超级管理员 / 管理员 / 成员）

## 技术栈

- **框架:** Vue 3.5（Composition API + `<script setup>`）
- **语言:** TypeScript
- **构建工具:** Vite 6
- **UI 组件库:** Ant Design Vue 4
- **路由:** Vue Router 4
- **状态管理:** Pinia 2
- **HTTP 客户端:** Axios
- **样式:** SCSS

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器（默认 http://localhost:3000）
npm run dev

# 类型检查
npx vue-tsc --noEmit

# 生产构建
npm run build
```

开发环境下，Vite 会自动将 `/api` 请求代理到后端 `http://localhost:8080`，无需额外配置 CORS。

## 项目结构

```
src/
├── api/                # API 请求层（axios 实例 + 接口函数）
├── assets/styles/      # 全局样式与设计变量
├── hooks/              # 组合式函数（权限检查等）
├── layouts/            # 布局组件（侧边栏 + 头部 + 内容区）
├── router/             # 路由配置与导航守卫
├── stores/             # Pinia 状态管理
├── types/              # TypeScript 类型定义
├── utils/              # 工具函数（认证、常量）
└── views/              # 页面组件
    ├── login/          # 登录
    ├── register/       # 注册
    ├── dashboard/      # 仪表盘
    ├── user/           # 用户信息
    ├── tenant/         # 租户管理
    └── reset-password/ # 密码重置
```

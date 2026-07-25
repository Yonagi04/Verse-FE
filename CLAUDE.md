# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run

```bash
# Install dependencies
npm install

# Dev server (hot reload on port 3000)
npm run dev

# Type-check
npx vue-tsc --noEmit

# Production build
npm run build
```

## Project Overview

**Verse Frontend** — Management UI for the Verse LLM Gateway. Vue 3 + TypeScript + Vite + Ant Design Vue 4.

The backend is a Spring Boot app at `D:\Code\Verse` running on port 8080. In dev, Vite proxies `/api` to `http://localhost:8080`.

## Tech Stack

- **Framework:** Vue 3.5 with Composition API + `<script setup lang="ts">` exclusively
- **Router:** vue-router 4 with `createWebHistory()` (HTML5 history mode)
- **State:** Pinia 2.3 (5 domain-specific stores)
- **HTTP:** axios 1.7 with centralized interceptors
- **UI:** ant-design-vue 4 (global install), `@ant-design/icons-vue` for icons
- **Styles:** SCSS with auto-injected design tokens from `variables.scss`
- **No:** tests, linters, or formatters are currently configured

## Package Architecture

```
src/
├── main.ts                 # createApp, createPinia, VueRouter, Antd
├── App.vue                 # Root: wraps auth pages in <AppLayout>, public pages standalone
├── api/
│   ├── request.ts          # Axios instance + request/response interceptors
│   ├── user.ts             # User/auth API functions
│   └── tenant.ts           # Tenant API functions
├── assets/styles/
│   ├── variables.scss      # Design tokens (colors, layout, radii, fonts, shadows)
│   └── global.scss         # CSS reset + scrollbar styles
├── hooks/
│   └── usePermission.ts    # Composable for permission checks
├── layouts/
│   ├── AppLayout.vue       # Sider (collapsible 240/80px) + Header (64px) + Content
│   ├── SideMenu.vue        # Hardcoded menu items, some are placeholders
│   └── UserDropdown.vue    # Avatar + dropdown (Profile, Logout)
├── router/
│   └── index.ts            # Routes + beforeEach guard (auth checks)
├── stores/
│   ├── user.ts             # Auth state (token, user, isLoggedIn)
│   ├── tenant.ts           # Tenant list + current tenant
│   ├── permission.ts       # Role → permissions mapping
│   ├── theme.ts            # Sidebar collapsed state
│   └── settings.ts         # Locale/timezone (hardcoded zh-CN)
├── types/
│   ├── api.ts              # Result<T> generic response envelope
│   ├── user.ts             # User DTOs + TenantInfo/Role/TenantType
│   └── tenant.ts           # Tenant DTOs
├── utils/
│   ├── auth.ts             # localStorage token/user helpers
│   └── constants.ts        # Permission atoms + role-permission maps
└── views/
    ├── login/LoginPage.vue
    ├── register/RegisterPage.vue
    ├── dashboard/DashboardPage.vue
    ├── user/UserProfile.vue
    ├── tenant/{TenantList,TenantCreate}.vue
    └── reset-password/{SendCode,VerifyCode,ResetPassword}.vue
```

## Routing & Auth Flow

**Routes:** 5 public (login, register, 3-step reset-password) + 4 protected (dashboard, profile, tenants, tenant-create). Root `/` and catch-all redirect to `/dashboard`.

**Navigation guard** checks `requiresAuth` meta field:
- Public pages (`requiresAuth: false`): allows access; redirects `/login` → `/dashboard` if already logged in
- Protected pages: redirects to `/login` if not logged in (`userStore.isLoggedIn` based on token presence)

**App.vue** wraps protected pages in `<AppLayout>` (sidebar + header). Public pages render standalone. Detection uses a hardcoded public path list matched against `route.path`.

**Auth tokens** are stored as `verse_token` in localStorage. The axios request interceptor attaches `Authorization: Bearer ${token}`. On 401 responses, auth is cleared and the user redirected to `/login`.

## API Conventions

- **Base URL:** `/api/v1` (set in `.env.development` / `.env.production`)
- **Response envelope:** `Result<T> = { code: string, message: string | null, data: T, requestId: string | null }`
- **Success code:** `"0"` — the response interceptor unwraps `data` and returns it directly
- **Error handling:** Centralized in the response interceptor — calls `message.error()` and throws. Page-level catch blocks are always empty with the comment `// handled by interceptor`.
- **401 handling:** Clears auth + `window.location.href = '/login'` (hard redirect, not router push)
- API modules export plain functions (e.g., `login(params)`, `listTenants()`), pages never call axios directly

## Store Responsibilities

| Store | Key State | Purpose |
|-------|-----------|---------|
| `user` | token, user, isLoggedIn | Auth lifecycle (login, fetchProfile, signOut) |
| `tenant` | tenants[], currentTenant | Tenant CRUD + switching |
| `permission` | role, authorities[] | Maps role → permission list, exposes `hasPermission` |
| `theme` | sidebarCollapsed | Sidebar toggle |
| `settings` | locale, timezone | Hardcoded defaults (TODO: persist) |

## Styling Conventions

- SCSS auto-injects `variables.scss` via Vite's `additionalData` — all SCSS files have access to `$color-*`, `$font-*`, `$radius-*`, `$shadow-*`, `$sidebar-width`, `$header-height`, etc.
- Pages use scoped SCSS with design tokens, not hardcoded values
- Ant Design components styled via props where possible; custom CSS only in `<style lang="scss" scoped>`
- Design system: primary `#1677ff`, bg `#ffffff`/`#fafafa`, text `#1f2328`/`#667085`, font "Inter, PingFang SC, Microsoft YaHei"

## Key Patterns

- **Reactive state:** `ref()` for primitives, `reactive()` for form objects
- **Loading state:** `const loading = ref(false)`, set in try/finally
- **Form validation:** Ant Design `a-form-item` `:rules` prop, `@finish` for submit
- **Navigation between pages:** Use `<router-link custom v-slot="{ href, navigate }">` with `<a-button>` for link-styled navigation buttons. Never use `@click="router.push(...)"` on buttons.
- **SideMenu placeholders:** `/llm-services`, `/api-keys`, `/token-usage`, `/logs` are hardcoded menu items with no corresponding routes — clicking them intentionally does nothing
- **Reset password flow** passes state via query params: `send-code` → `verify-code?phone=` → `reset?phone=&token=`

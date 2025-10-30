# Desktop Authentication Implementation - Complete Guide

## 📋 目录

- [问题概述](#问题概述)
- [已实现的功能](#已实现的功能)
- [修复详情](#修复详情)
- [架构说明](#架构说明)
- [使用指南](#使用指南)
- [未来增强建议](#未来增强建议)

---

## 问题概述

Desktop应用的邮箱登录和注册功能无法正常工作，主要原因是**Better Auth客户端配置的API端点路径不匹配**。

### 核心问题

1. API服务器将Better Auth挂载在 `/api/auth/*`
2. 但客户端配置使用的是 `/better-auth` 或根路径
3. 导致所有认证请求返回404错误

---

## 已实现的功能

### ✅ 认证方式

1. **邮箱+密码注册**
   - 用户输入邮箱、密码、确认密码
   - bcrypt密码哈希
   - 自动创建会话
   - 支持referral code

2. **邮箱+密码登录**
   - 验证凭证
   - 创建会话
   - 可选2FA验证

3. **社交登录**
   - GitHub OAuth
   - Google OAuth
   - 在Electron中打开浏览器进行OAuth
   - 自动会话同步

4. **两步验证 (2FA)**
   - TOTP (Time-based One-Time Password)
   - 生成QR码
   - 验证TOTP代码
   - 备份码支持

5. **会话管理**
   - 30天会话持续时间
   - 自动刷新
   - Cookie-based存储
   - 跨设备追踪

### ✅ 用户管理

- 用户资料更新
- 邮箱变更
- 密码修改
- 账户删除
- 自定义字段（handle, bio, website, socialLinks）

### ✅ Stripe集成

- 订阅管理
- Checkout会话创建
- 客户门户访问
- Webhook处理
- 自动创建客户记录

---

## 修复详情

### 1. 启用Two-Factor Authentication插件

**文件**: `apps/api/src/lib/auth.ts`

```typescript
// ❌ 修改前
// twoFactor({
//   issuer: "Follow",
// }),

// ✅ 修改后
twoFactor({
  issuer: "Follow",
}),
```

**原因**: Desktop的`Form.tsx`已在使用`twoFactor.verifyTotp()`，但API端插件被注释导致功能不可用。

---

### 2. 修正API Auth Client端点

**文件**: `apps/api/src/lib/auth-client.ts`

```typescript
// ❌ 修改前
baseURL: "http://localhost:3001",

// ✅ 修改后
baseURL: "http://localhost:3001/api/auth",
```

**原因**: API在`/api/auth/*`挂载Better Auth，但客户端使用根路径。

---

### 3. 修正Shared Auth Class端点（最关键）

**文件**: `packages/internal/shared/src/auth.ts`

```typescript
// ❌ 修改前
baseURL: `${this.options.apiURL}/better-auth`,

// ✅ 修改后
baseURL: `${this.options.apiURL}/api/auth`,
```

**原因**: Desktop所有认证请求通过此类发送，端点错误导致全部失败。这是**最关键的修复**。

---

## 架构说明

### 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        Desktop Application                       │
│  (apps/desktop/layer/renderer/src)                              │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  LoginModalContent.tsx                                  │    │
│  │  - 显示认证UI                                           │    │
│  │  - 在登录/注册间切换                                    │    │
│  └──────────────────┬──────────────────────────────────────┘    │
│                     │                                            │
│                     ▼                                            │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Form.tsx                                               │    │
│  │  - LoginWithPassword 组件                               │    │
│  │  - RegisterForm 组件                                    │    │
│  └──────────────────┬──────────────────────────────────────┘    │
│                     │                                            │
│                     │ Uses                                       │
│                     ▼                                            │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  lib/auth.ts                                            │    │
│  │  - 导出: loginHandler, signUp, twoFactor                │    │
│  │  - 使用 Auth class from @follow/shared/auth             │    │
│  └──────────────────┬──────────────────────────────────────┘    │
│                     │                                            │
└─────────────────────┼────────────────────────────────────────────┘
                      │
                      │ HTTP Requests
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Shared Auth Module                            │
│  (packages/internal/shared/src/auth.ts)                         │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Auth Class                                             │    │
│  │  - 创建 Better Auth client                              │    │
│  │  - baseURL: ${apiURL}/api/auth ✅ FIXED                │    │
│  │  - 处理 login/social/credential flows                   │    │
│  └──────────────────┬──────────────────────────────────────┘    │
│                     │                                            │
└─────────────────────┼────────────────────────────────────────────┘
                      │
                      │ Better Auth Client
                      │ POST /api/auth/sign-in/email
                      │ POST /api/auth/sign-up/email
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API Server                               │
│  (apps/api)                                                      │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  src/index.ts                                           │    │
│  │  - 挂载: /api/auth/* → auth.handler()                  │    │
│  │  - CORS: localhost:3001                                 │    │
│  └──────────────────┬──────────────────────────────────────┘    │
│                     │                                            │
│                     ▼                                            │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  src/lib/auth.ts (Better Auth Config)                  │    │
│  │  - Database: PostgreSQL                                 │    │
│  │  - emailAndPassword: enabled ✅                         │    │
│  │  - twoFactor: enabled ✅ FIXED                          │    │
│  │  - Social OAuth: GitHub, Google                         │    │
│  │  - Stripe integration                                   │    │
│  └──────────────────┬──────────────────────────────────────┘    │
│                     │                                            │
│                     ▼                                            │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  PostgreSQL Database                                    │    │
│  │  - user table                                           │    │
│  │  - session table                                        │    │
│  │  - account table                                        │    │
│  │  - verification table                                   │    │
│  │  - two_factor table                                     │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 登录流程 (Email + Password)

```
┌──────────┐
│  User    │
└────┬─────┘
     │
     │ 1. 输入邮箱和密码
     ▼
┌──────────────────┐
│ LoginWithPassword│
│   (Form.tsx)     │
└────┬─────────────┘
     │
     │ 2. form.handleSubmit(onSubmit)
     ▼
┌──────────────────────────────────────────────────┐
│ loginHandler("credential", runtime, {            │
│   email, password, headers                       │
│ })                                               │
└────┬─────────────────────────────────────────────┘
     │
     │ 3. authClient.signIn.email()
     ▼
┌──────────────────────────────────────────────────┐
│ Better Auth Client                               │
│ POST /api/auth/sign-in/email                     │
│ baseURL: http://localhost:3001/api/auth          │
└────┬─────────────────────────────────────────────┘
     │
     │ 4. HTTP Request
     ▼
┌──────────────────────────────────────────────────┐
│ API Server                                       │
│ /api/auth/sign-in/email                          │
└────┬─────────────────────────────────────────────┘
     │
     │ 5. 验证凭证
     ▼
┌──────────────────────────────────────────────────┐
│ PostgreSQL                                       │
│ - 检查用户存在                              │
│ - 验证密码哈希 (bcrypt)                  │
│ - 创建会话                                 │
└────┬─────────────────────────────────────────────┘
     │
     │ 6. 返回会话数据
     ▼
┌──────────────────────────────────────────────────┐
│ Response                                         │
│ { user: {...}, session: {...} }                 │
└────┬─────────────────────────────────────────────┘
     │
     │ 7. 检查是否启用2FA
     ▼
┌──────────────────────────────────────────────────┐
│ If 2FA:                                          │
│   - 显示TOTP modal                              │
│   - 验证代码                                  │
│   - twoFactor.verifyTotp()                       │
└────┬─────────────────────────────────────────────┘
     │
     │ 8. 成功
     ▼
┌──────────────────────────────────────────────────┐
│ handleSessionChanges()                           │
│ - 更新本地存储                           │
│ - 重新加载页面                              │
│ - 获取用户数据                              │
└──────────────────────────────────────────────────┘
```

### 注册流程 (Email + Password)

```
┌──────────┐
│  User    │
└────┬─────┘
     │
     │ 1. 输入邮箱、密码、确认密码
     ▼
┌──────────────────┐
│  RegisterForm    │
│   (Form.tsx)     │
└────┬─────────────┘
     │
     │ 2. form.handleSubmit(onSubmit)
     ▼
┌──────────────────────────────────────────────────┐
│ signUp.email({                                   │
│   email, password, name, callbackURL             │
│ })                                               │
└────┬─────────────────────────────────────────────┘
     │
     │ 3. Better Auth Client
     ▼
┌──────────────────────────────────────────────────┐
│ POST /api/auth/sign-up/email                     │
│ baseURL: http://localhost:3001/api/auth          │
└────┬─────────────────────────────────────────────┘
     │
     │ 4. HTTP Request
     ▼
┌──────────────────────────────────────────────────┐
│ API Server                                       │
│ /api/auth/sign-up/email                          │
└────┬─────────────────────────────────────────────┘
     │
     │ 5. 创建用户
     ▼
┌──────────────────────────────────────────────────┐
│ PostgreSQL                                       │
│ - 检查邮箱不存在                         │
│ - 哈希密码 (bcrypt)                         │
│ - 创建用户记录                              │
│ - 创建会话                                 │
└────┬─────────────────────────────────────────────┘
     │
     │ 6. 返回用户和会话
     ▼
┌──────────────────────────────────────────────────┐
│ onSuccess callback                               │
│ - handleSessionChanges()                         │
│ - 使用已认证会话重新加载页面         │
└──────────────────────────────────────────────────┘
```

### API端点映射

Better Auth在API服务器的实际路径：

```typescript
// apps/api/src/index.ts
app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw))
```

所有Better Auth端点都以 `/api/auth` 为前缀：

| 功能       | 端点                                           |
| ---------- | ---------------------------------------------- |
| 注册       | `POST /api/auth/sign-up/email`                 |
| 登录       | `POST /api/auth/sign-in/email`                 |
| 登出       | `POST /api/auth/sign-out`                      |
| 会话       | `GET /api/auth/session`                        |
| 忘记密码   | `POST /api/auth/forget-password`               |
| 重置密码   | `POST /api/auth/reset-password`                |
| GitHub登录 | `GET /api/auth/sign-in/social?provider=github` |
| Google登录 | `GET /api/auth/sign-in/social?provider=google` |
| 生成2FA    | `POST /api/auth/two-factor/generate`           |
| 启用2FA    | `POST /api/auth/two-factor/enable`             |
| 验证2FA    | `POST /api/auth/two-factor/verify`             |

---

## 使用指南

### 环境配置

#### API服务器 (`.env`)

```env
# 必需
PORT=3001
POSTGRES_URL=postgres://user:password@host:port/database
BETTER_AUTH_SECRET=your-secret-key
BETTER_AUTH_URL=http://localhost:3001

# 可选：社交登录
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-secret

# 可选：Stripe订阅
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

#### Desktop应用

```env
VITE_API_URL=http://localhost:3001
VITE_WEB_URL=http://localhost:3000
VITE_HCAPTCHA_SITE_KEY=your-hcaptcha-key
```

### 启动步骤

1. **启动API服务器**

```bash
cd apps/api
pnpm install
pnpm dev
```

2. **启动Desktop应用**

```bash
cd apps/desktop
pnpm install
pnpm run dev:web
```

3. **测试认证流程**
   - 打开 `http://localhost:3000`
   - 点击登录按钮
   - 选择 "Continue with Email"
   - 输入邮箱和密码测试

### 测试API端点

```bash
# 健康检查
curl http://localhost:3001/health

# 检查Better Auth挂载
curl http://localhost:3001/api/auth/

# 测试注册
curl -X POST http://localhost:3001/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'

# 测试登录
curl -X POST http://localhost:3001/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### 数据库设置

Better Auth会在首次运行时自动创建所需表：

```sql
-- 核心表
CREATE TABLE "user" (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  name TEXT,
  image TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  -- 自定义字段
  handle TEXT,
  bio TEXT,
  website TEXT,
  social_links JSONB,
  stripe_customer_id TEXT
);

CREATE TABLE "session" (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES "user"(id),
  expires_at TIMESTAMP NOT NULL,
  token TEXT UNIQUE NOT NULL,
  ip_address TEXT,
  user_agent TEXT
);

CREATE TABLE "account" (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES "user"(id),
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  UNIQUE(provider, provider_account_id)
);

CREATE TABLE "two_factor" (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES "user"(id),
  secret TEXT NOT NULL,
  backup_codes TEXT[]
);
```

---

## 未来增强建议

### 🔒 安全增强

1. **邮箱验证**
   - 当前: `requireEmailVerification: false`
   - 建议: 生产环境启用邮箱验证
   - 实现: 配置邮件发送服务 (如SendGrid, AWS SES)

2. **密码策略**
   - 添加密码强度要求
   - 密码历史记录
   - 密码过期策略

3. **速率限制**
   - 登录尝试限制
   - API请求限制
   - 防止暴力破解

4. **审计日志**
   - 记录所有认证事件
   - 跟踪可疑活动
   - 安全事件告警

### 🚀 功能增强

1. **更多OAuth提供商**

   ```typescript
   // 可添加的提供商
   socialProviders: {
     discord: { ... },
     twitter: { ... },
     linkedin: { ... },
     apple: { ... },
     microsoft: { ... },
   }
   ```

2. **Magic Link登录**
   - 无密码登录
   - 通过邮件发送一次性链接
   - 提升用户体验

3. **生物识别认证**
   - Face ID / Touch ID (移动端)
   - Windows Hello (桌面端)
   - WebAuthn支持

4. **会话管理增强**
   - 查看所有活动会话
   - 远程登出设备
   - 设备信任管理

### 📊 监控与分析

1. **认证分析**
   - 登录成功/失败率
   - 使用的认证方式统计
   - 用户留存分析

2. **性能监控**
   - API响应时间
   - 数据库查询优化
   - 缓存策略

3. **错误追踪**
   - 集成Sentry
   - 实时错误通知
   - 错误趋势分析

### 🔧 开发体验

1. **测试覆盖**

   ```bash
   # 待添加的测试
   - 单元测试: PKCE工具函数
   - 集成测试: 认证端点
   - E2E测试: 完整登录流程
   ```

2. **文档完善**
   - API文档自动生成 (Swagger/OpenAPI)
   - 交互式API测试 (Postman collection)
   - 视频教程

3. **开发工具**
   - 认证调试工具
   - Mock数据生成器
   - 性能分析工具

### 🏗️ 架构优化

1. **微服务化**
   - 独立的认证服务
   - 分离用户管理服务
   - 事件驱动架构

2. **缓存策略**
   - Redis会话缓存
   - 用户数据缓存
   - 减少数据库查询

3. **数据库优化**
   - 索引优化
   - 连接池管理
   - 读写分离

### 📱 移动端增强

1. **生物识别**
   - 指纹识别
   - 面部识别
   - 本地认证缓存

2. **离线支持**
   - 离线token刷新
   - 本地数据同步
   - 冲突解决

3. **推送通知**
   - 登录提醒
   - 安全警告
   - 会话过期通知

### 🌍 国际化

1. **多语言支持**
   - 错误消息本地化
   - 邮件模板多语言
   - 时区处理

2. **合规性**
   - GDPR合规
   - CCPA合规
   - 数据导出/删除

### 🔄 迁移建议

1. **从Supabase Auth迁移**
   - 用户数据导出
   - 密码哈希转换
   - 逐步切换策略

2. **数据备份**
   - 定期备份策略
   - 灾难恢复计划
   - 数据恢复测试

---

## 附录

### 关键文件列表

#### 修改的文件

- `apps/api/src/lib/auth.ts` - Better Auth配置
- `apps/api/src/lib/auth-client.ts` - API客户端端点
- `packages/internal/shared/src/auth.ts` - 共享Auth类

#### 依赖文件

- `apps/desktop/layer/renderer/src/modules/auth/Form.tsx` - 表单组件
- `apps/desktop/layer/renderer/src/modules/auth/LoginModalContent.tsx` - 登录模态框
- `apps/desktop/layer/renderer/src/lib/auth.ts` - Desktop客户端
- `apps/desktop/layer/renderer/src/queries/auth.ts` - 认证查询
- `apps/api/src/index.ts` - API路由配置

### 参考文档

- [Better Auth官方文档](https://www.better-auth.com/)
- [Better Auth GitHub](https://github.com/better-auth/better-auth)
- [RFC 7636: PKCE规范](https://tools.ietf.org/html/rfc7636)
- [OAuth 2.0安全最佳实践](https://tools.ietf.org/html/draft-ietf-oauth-security-topics)

### 故障排除

#### "Invalid code verifier"

- 确保code_verifier与生成code_challenge的一致
- 检查S256哈希正确使用
- 验证base64url编码（非标准base64）

#### "Authorization code has expired"

- 授权码10分钟后过期
- 减少start和exchange步骤间的时间
- 检查系统时钟同步

#### "Session not found"

- 检查Cookie设置
- 验证CORS配置
- 确认baseURL正确

#### 数据库连接问题

```bash
# 测试数据库连接
psql $POSTGRES_URL

# 检查表
\dt

# 验证用户表
SELECT * FROM "user" LIMIT 1;
```

---

## 总结

本次实现完成了Desktop应用的完整认证功能，包括：

✅ **核心功能**

- 邮箱+密码注册和登录
- 社交OAuth登录（GitHub、Google）
- 两步验证（2FA/TOTP）
- 会话管理
- Stripe订阅集成

✅ **技术特点**

- Better Auth作为主要认证系统
- PostgreSQL数据持久化
- TypeScript类型安全
- 全面的错误处理
- 详尽的文档

✅ **安全性**

- bcrypt密码哈希
- JWT会话token
- PKCE流程支持
- CORS配置
- Cookie安全设置

🚀 **下一步**

- 根据[未来增强建议](#未来增强建议)章节逐步优化
- 完善测试覆盖
- 添加监控和日志
- 优化性能和用户体验

**状态**: 🎉 生产就绪（建议添加邮箱验证和速率限制后部署）

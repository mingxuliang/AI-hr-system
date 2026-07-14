# AI-HR 智能招聘系统

内部招聘管理系统。本文档仅供二次开发与本地部署参考。

## 技术栈

- 前端：React、Vite、TypeScript、Ant Design
- 后端：FastAPI、SQLAlchemy、Alembic
- 数据库：PostgreSQL 15
- AI：OpenAI SDK 兼容接口（默认 DashScope）

## 环境要求

- Node.js 20+
- Python 3.11+
- Docker（用于 PostgreSQL）或本地 PostgreSQL 15+

## 快速启动

### 1. 环境变量

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

生产环境请修改：

- `SECRET_KEY`
- `INITIAL_ADMIN_PASSWORD`
- 数据库密码
- `CORS_ORIGINS`（仅填写实际域名）
- `APP_ENV=production`
- 保持 `ENABLE_API_DOCS=false`

### 2. 启动数据库

```bash
docker compose up -d postgres
```

### 3. 启动后端

```bash
cd backend
python -m venv venv
# Windows: .\venv\Scripts\activate
# macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

需要本地查看 Swagger 时，在 `backend/.env` 设置 `ENABLE_API_DOCS=true` 后重启。

### 4. 启动前端

```bash
cd frontend
npm install
npm run dev
```

默认地址：<http://localhost:5173>

## 目录结构

```text
.
├── backend/                 # FastAPI 后端、模型、服务、迁移
├── frontend/                # React 前端
├── docker-compose.yml       # 开发数据库
├── docker-compose.prod.yml  # 生产编排
└── Makefile                 # 常用命令
```

## 常用命令

```bash
make db              # 启动 PostgreSQL
make dev-backend     # 启动后端
make dev-frontend    # 启动前端
make test-backend    # 后端测试
make build-frontend  # 前端构建
make docker-prod     # 生产 Compose
```

## 主要模块

| 模块 | 说明 |
|------|------|
| 岗位管理 | 岗位创建、发布、JD 生成 |
| 简历管理 | 上传、解析、匹配评分、状态流转 |
| 面试管理 | 多轮面试、评分、录音分析 |
| 在线笔试 | 算法/选择/简答、公开答题链接 |
| Offer | 模板、发送、确认 |
| 工作流 | 可视化编排 |
| 系统设置 | 模型、邮件、提示词、用户 |

## 生产部署

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

建议：后端不直接暴露公网，通过 Nginx 反代；关闭 API 文档；使用 HTTPS。

## 许可证

见 `LICENSE`。

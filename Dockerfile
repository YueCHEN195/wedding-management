FROM node:24-bookworm

WORKDIR /app

# SVG artwork needs a redistributable CJK font on Linux; do not rely on macOS fonts.
RUN apt-get update && apt-get install -y --no-install-recommends fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

# 启用 pnpm
RUN corepack enable

# 先装依赖（利用镜像层缓存）
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# 复制源码并构建前端
COPY . .
RUN pnpm build

ENV NODE_ENV=production
EXPOSE 3000

# 启动时自动迁移 + 启动服务
CMD ["pnpm", "start"]

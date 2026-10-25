FROM node:24-bookworm

WORKDIR /app

ARG DEBIAN_MIRROR=https://deb.debian.org

# SVG artwork needs a redistributable CJK font on Linux; do not rely on macOS fonts.
# Allow local release builds to use a reachable Debian mirror; keep signed package verification.
RUN sed -i "s|http://deb.debian.org|${DEBIAN_MIRROR}|g; s|https://deb.debian.org|${DEBIAN_MIRROR}|g" \
        /etc/apt/sources.list.d/debian.sources \
    && printf 'Acquire::Retries "3";\nAcquire::http::Timeout "30";\nAcquire::https::Timeout "30";\n' \
        > /etc/apt/apt.conf.d/80-build-network \
    && apt-get update && apt-get install -y --no-install-recommends fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

# 启用 pnpm
RUN corepack enable

# 先装依赖（利用镜像层缓存）
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# 复制源码并构建前端
COPY . .
RUN pnpm build

ENV NODE_ENV=production
EXPOSE 3000

# 启动时自动迁移 + 启动服务
CMD ["pnpm", "start"]

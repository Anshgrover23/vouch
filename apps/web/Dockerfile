FROM node:22-slim
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* turbo.json ./
COPY apps ./apps
COPY packages ./packages
RUN pnpm install --frozen-lockfile || pnpm install
RUN pnpm --filter @proofsheet/web build
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
CMD ["pnpm", "--filter", "@proofsheet/web", "start"]

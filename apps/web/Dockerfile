FROM node:22-alpine

ARG VITE_API_BASE_URL=http://localhost:8787

RUN corepack enable

WORKDIR /app

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

COPY apps/web apps/web
COPY packages/shared packages/shared

RUN pnpm --filter @chaingrep/web build

EXPOSE 4173

CMD ["pnpm", "--filter", "@chaingrep/web", "start"]

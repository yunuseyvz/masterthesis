# Build stage uses the full image so node-pty can compile.
FROM node:24 AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci
COPY . .
RUN npm run build

# Dependencies of the shared Next.js project, installed once so `npm run dev` works in the participant's shell.
FROM node:24 AS shopfront
WORKDIR /opt/shopfront
COPY server/corpus/_base/shopfront/package.json ./
RUN npm install --no-audit --no-fund && chmod -R a+rX /opt/shopfront

FROM node:24-slim
WORKDIR /app
COPY --from=build /app /app
COPY --from=shopfront /opt/shopfront/node_modules /opt/shopfront/node_modules
# The server runs as root only so it can start the participant's shell as an unprivileged user.
# Everything under /app (code, corpus with ground truth) is unreadable to that user.
RUN groupadd --gid 61234 sandbox \
 && useradd --uid 61234 --gid 61234 --no-create-home --shell /usr/sbin/nologin sandbox \
 && chmod -R go-rwx /app
ENV NODE_ENV=production SANDBOX_UID=61234 SANDBOX_GID=61234 EXPORT_DIR=/exports LISTEN_SOCKET=/run/study/app.sock
CMD ["npx", "tsx", "server/src/main.ts"]

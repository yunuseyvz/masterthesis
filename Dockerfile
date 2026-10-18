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

FROM node:24-slim
WORKDIR /app
COPY --from=build /app /app
# The server runs as root only so it can start the participant's shell as an unprivileged user.
# Everything under /app (code, corpus with ground truth) is unreadable to that user.
RUN groupadd --gid 61234 sandbox \
 && useradd --uid 61234 --gid 61234 --no-create-home --shell /usr/sbin/nologin sandbox \
 && chmod -R go-rwx /app
ENV NODE_ENV=production SANDBOX_UID=61234 SANDBOX_GID=61234 EXPORT_DIR=/exports LISTEN_SOCKET=/run/study/app.sock
CMD ["npx", "tsx", "server/src/main.ts"]

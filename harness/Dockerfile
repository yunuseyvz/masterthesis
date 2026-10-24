# The study harness. Build from the repository root: docker build -f harness/Dockerfile .
# opencode's web app in study mode (harness/agent-ui): upstream opencode at a pinned version plus the study module.
# Its own stage, so the large upstream install is cached until agent-ui/ changes.
FROM node:24 AS agent-ui
WORKDIR /build
COPY harness/agent-ui/build.sh agent-ui/
# Clone and install upstream first (cached), the study files come after.
RUN mkdir -p agent-ui/study && touch agent-ui/opencode.patch \
 && git clone -q --depth 1 --branch v2.1.3 https://github.com/anomalyco/opencode.git agent-ui/.cache/opencode-v2.1.3 \
 && cd agent-ui/.cache/opencode-v2.1.3 && npx -y bun@1.4.4 install --ignore-scripts
COPY harness/agent-ui/study agent-ui/study
COPY harness/agent-ui/opencode.patch agent-ui/opencode.patch
RUN agent-ui/build.sh

# Build stage: install the workspaces (the capture tool's too, as npm ci needs every workspace), then the harness.
FROM node:24 AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY shared/package.json shared/
COPY harness/server/package.json harness/server/
COPY capture/package.json capture/
RUN npm ci
COPY shared shared
COPY harness/server harness/server
# What the harness replays: the trials and the captures they use.
COPY harness/trials harness/trials
COPY captures captures
# opencode v2 ships as one self-contained binary; keep it outside /app (which the sandbox user cannot read)
RUN cp node_modules/@opencode/cli/bin/opencode.exe /opencode && rm -rf node_modules/@opencode

# Dependencies of the shared Next.js project, installed once so `npm run dev` works in the participant's terminal.
FROM node:24 AS shopfront
WORKDIR /opt/shopfront
COPY capture/seeds/shopfront/package.json ./
RUN npm install --no-audit --no-fund && chmod -R a+rX /opt/shopfront

FROM node:24-slim
# git: the trial projects are git repositories, so opencode shows the agent's work as changes.
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app /app
COPY --from=agent-ui /build/agent-ui/dist /app/harness/agent-ui/dist
COPY --from=build /opencode /usr/local/bin/opencode
COPY --from=shopfront /opt/shopfront/node_modules /opt/shopfront/node_modules
# The server runs as root only so it can start opencode as an unprivileged user. Everything under /app
# (code, corpus with ground truth) is unreadable to that user; it only owns the trial projects and its own home.
RUN groupadd --gid 61234 sandbox \
 && useradd --uid 61234 --gid 61234 --no-create-home --shell /usr/sbin/nologin sandbox \
 && chmod -R go-rwx /app \
 && chmod 755 /usr/local/bin/opencode \
 && mkdir -p /exports /work /agent-home && chmod 700 /exports \
 && chown sandbox:sandbox /work /agent-home && chmod 755 /work && chmod 700 /agent-home
# The study page and opencode share one origin: the server hosts opencode's web app and forwards its API.
ENV NODE_ENV=production SANDBOX_UID=61234 SANDBOX_GID=61234 EXPORT_DIR=/exports LISTEN_SOCKET=/run/study/app.sock \
    OPENCODE_BIN=/usr/local/bin/opencode WORK_ROOT=/work AGENT_HOME=/agent-home
CMD ["npx", "tsx", "harness/server/src/main.ts"]

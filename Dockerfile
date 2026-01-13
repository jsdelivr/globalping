FROM node:24-bookworm-slim AS builder
RUN apt-get update -y && apt-get install util-linux curl git python3 make g++ -y

ENV NODE_ENV=production

COPY package.json package-lock.json /app/
WORKDIR /app
RUN npm ci --include=dev
COPY . /app
RUN npm run build

FROM node:24-bookworm-slim
RUN apt-get update -y && apt-get install tini util-linux curl python3 make g++ -y

ENV ELASTIC_APM_CONFIG_FILE=elastic-apm-node.cjs
ENV NODE_ENV=production

COPY package.json package-lock.json /app/
WORKDIR /app
RUN npm ci
COPY . /app
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/data /app/data

ENV PORT=80
EXPOSE 80
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD [ "node", "--report-on-signal", "--max_old_space_size=1600", "--max-semi-space-size=128", "--experimental-loader", "elastic-apm-node/loader.mjs", "-r", "elastic-apm-node/start.js", "dist/src/index.js" ]

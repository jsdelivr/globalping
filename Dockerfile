FROM node:16-bullseye-slim
RUN apt-get update -y && apt-get install tini util-linux curl -y

ENV NODE_ENV production

COPY . /app
WORKDIR /app
RUN npm ci --include=dev
RUN npm run build || npm run blacklist

EXPOSE 3000
ENTRYPOINT ["/usr/bin/tini", "--"]

ENV NODE_ENV development
ENV FAKE_PROBE_IP 1

CMD ["sh", "-c", "exec node -r newrelic dist/index.js"]

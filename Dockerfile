FROM node:24-bookworm-slim AS builder
RUN apt-get update -y && apt-get install util-linux curl git -y

ENV NODE_ENV=production

COPY package.json package-lock.json /app/
WORKDIR /app
RUN npm ci --include=dev
COPY . /app
RUN npm run build

FROM node:24-bookworm-slim
RUN apt-get update -y && apt-get install tini util-linux curl -y

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
CMD [ "npm", "start" ]

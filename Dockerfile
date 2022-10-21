FROM node:16-bullseye-slim
RUN apt-get update -y && apt-get install tini util-linux curl -y

ENV NODE_ENV production

COPY . /app
WORKDIR /app
RUN npm ci --include=dev
RUN npm run build

EXPOSE 8080
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD [ "node", "dist/index.js" ]

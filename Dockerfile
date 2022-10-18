FROM node:16-bullseye-slim
RUN apt-get update -y && apt-get install tini util-linux -y

ENV NODE_ENV production

COPY . /app
WORKDIR /app
RUN npm ci --only=production

EXPOSE 8080
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD [ "node", "dist/index.js" ]

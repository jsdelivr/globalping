FROM node:16-bullseye-slim
RUN apt-get update -y && apt-get install tini util-linux curl -y

ENV NODE_ENV production

COPY . /app
WORKDIR /app
RUN npm ci --include=dev
RUN npm run build

ENV PORT=80
EXPOSE 80
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD [ "npm", "start" ]

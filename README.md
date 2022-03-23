# GlobalPing API

// TODO: description

## Development

In order to run the GlobalPing API locally you will need Node.js 16 
and Redis with [RedisJSON](https://oss.redis.com/redisjson/) module.

API uses 3000 port by default. This can be overridden by `PORT` environment variable.

`FAKE_PROBE_IP=1` environment variable can be used to make debug easier. In that case every Probe 
that connects to the API will get an IP address from the list of predefined "real" addresses.

1. clone repository
2. `docker-compose up -d` - run redis
3. `npm install && npm run init:hooks && npm run build`
4. `npm run dev`

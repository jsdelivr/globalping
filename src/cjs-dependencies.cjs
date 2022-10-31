// The reason for such a weird import is that @newrelic/koa package (a part of newrelic package) can't handle import:
// > "Custom instrumentation for koa failed. Please report this to the maintainers of the custom instrumentation."
// with CommonJS require it works fine.
const Koa = require('koa');

module.exports.Koa = Koa;

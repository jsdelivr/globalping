/* eslint-disable no-unused-vars */
// The reason for `require('koa')` is that '@newrelic/koa' package (a part of 'newrelic' package) can't handle ES import. Error message:
// > "Custom instrumentation for koa failed. Please report this to the maintainers of the custom instrumentation."
// with CommonJS require and further import it works fine.
const Koa = require('koa');

// Also we need to `requre` winston so it is successfully updated by newrelic, in case of import winson is not patched and not sending logs.
// @ts-ignore
const winston = require('winston');

module.exports.Koa = Koa;

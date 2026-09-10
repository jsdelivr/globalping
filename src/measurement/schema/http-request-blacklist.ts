import { readFileSync } from 'node:fs';
import _ from 'lodash';
import type { CustomHelpers, ErrorReport } from 'joi';
import { fromProjectRoot } from '../../lib/paths.js';
import type { HttpRequest } from '../types.js';

type HttpRequestBlacklistRule = (request: HttpRequest) => boolean;

const pathBlacklistPath = fromProjectRoot('data', 'HTTP_REQUEST_BLACKLIST_PATHS.txt');
const blacklistedPaths = readFileSync(pathBlacklistPath, 'utf8')
	.split(/\r?\n/)
	.map(value => value.trim())
	.filter(Boolean)
	.map(value => _.escapeRegExp(value));

if (blacklistedPaths.length === 0) {
	throw new Error('HTTP request blacklist is empty');
}

const blacklistedPathRegExp = new RegExp(`(?:^|/)(?:${blacklistedPaths.join('|')})/?$`);

const requestBlacklistRules: HttpRequestBlacklistRule[] = [
	request => blacklistedPathRegExp.test(request.path),
];

export const joiValidateHttpRequest = (value: HttpRequest, helpers: CustomHelpers): HttpRequest | ErrorReport => {
	if (requestBlacklistRules.some(rule => rule(value))) {
		return helpers.error('http.request.blacklisted');
	}

	return value;
};

import _ from 'lodash';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import SwaggerParser from '@apidevtools/swagger-parser';
import * as openApiCore from '@redocly/openapi-core';
import betterAjvErrors from 'better-ajv-errors';

export default async ({ specPath, ajvBodyOptions = {}, ajvHeadersOptions = {} }) => {
	let bundled = await openApiCore.bundle({
		ref: specPath,
		config: await openApiCore.createConfig({}),
	});

	let refs = await SwaggerParser.resolve(bundled.bundle.parsed);
	let spec = refs.get(refs.paths()[0]);
	let specPaths = Object.keys(spec.paths).map((path) => {
		return {
			path,
			pattern: new RegExp(`^${path.replace(/\{[^/}]+}/g, '([^/]+)')}$`),
			pathSpec: spec.paths[path],
		};
	});

	let ajvBody = new Ajv({ strictSchema: false, strictTypes: true, ...ajvBodyOptions });
	let ajvHeaders = new Ajv({ strictSchema: false, strictTypes: true, coerceTypes: true, ...ajvHeadersOptions });
	let $refs = new Set();

	addFormats(ajvBody);
	addFormats(ajvHeaders);

	let collectRefs = (value) => {
		if (typeof value !== 'object') {
			return;
		}

		_.forEach(value, (value, key) => {
			if (key === '$ref' && !$refs.has(value)) {
				ajvBody.addSchema(refs.get(value), value, false, false);
				ajvHeaders.addSchema(refs.get(value), value, false, false);
				$refs.add(value);
			}

			collectRefs(value);
		});
	};

	let dereference = (value, ...keys) => {
		return keys.reduce((acc, key) => {
			return acc[key]?.$ref ? refs.get(acc[key].$ref) : acc[key];
		}, value);
	};

	let getValidator = (ajv, spec) => {
		if (!spec._validator) {
			spec._validator = ajv.compile(spec);
		}

		return spec._validator;
	};

	return (chai) => {
		collectRefs(spec);

		chai.Assertion.addMethod('matchApiSchema', function () {
			let response = this._obj;
			let reqPath = new URL(response.req.path, 'http://localhost').pathname;
			let reqMethod = response.req.method.toLowerCase();

			let paths = specPaths.map((path) => {
				return {
					...path,
					matchLength: path.pattern.exec(reqPath)?.length,
				};
			});

			let bestMatch = Math.max(...paths.map(path => path.matchLength || 1));
			paths = paths.filter(path => path.matchLength === bestMatch);

			new chai.Assertion(
				paths,
				`expected to match exactly 1 path in the spec file, matched: ${paths.map(p => p.path).join(', ')}`,
			).to.have.lengthOf(1);

			new chai.Assertion(
				paths[0].pathSpec,
				`expected the path to support a ${reqMethod.toUpperCase()} method`,
			).to.have.property(reqMethod);

			new chai.Assertion(
				dereference(paths[0].pathSpec, reqMethod),
				`expected the operation to have the responses definition`,
			).to.have.property('responses');

			new chai.Assertion(
				dereference(paths[0].pathSpec, reqMethod, 'responses'),
				`expected the response definition to include the status code ${response.statusCode}`,
			).to.have.property(response.statusCode);

			new chai.Assertion(
				dereference(paths[0].pathSpec, reqMethod, 'responses', response.statusCode),
				`expected the response definition to include the content definition`,
			).to.have.property('content');

			new chai.Assertion(
				dereference(paths[0].pathSpec, reqMethod, 'responses', response.statusCode, 'content'),
				`expected the content definition to include the content-type ${response.type}`,
			).to.have.property(response.type);

			let responseSpec = dereference(paths[0].pathSpec, reqMethod, 'responses', response.statusCode);
			let responseBodySpec = dereference(responseSpec, 'content', response.type, 'schema');
			let responseHeadersSpec = dereference(responseSpec, 'headers');
			let bodyValidator = getValidator(ajvBody, responseBodySpec);

			if (!bodyValidator(response.body)) {
				let errors = _.uniqBy(bodyValidator.errors, e => `${e.schemaPath}$${e.message}`);
				let betterErrors = betterAjvErrors(responseBodySpec, response.body, errors, { format: 'js' });
				console.error(betterAjvErrors(responseBodySpec, response.body, errors));

				throw new chai.AssertionError(betterErrors.map(e => e.error).join(', '));
			}

			if (!responseHeadersSpec) {
				return;
			}

			Object.keys(responseHeadersSpec).forEach((header) => {
				let responseHeaderSpec = dereference(responseHeadersSpec, header, 'schema');

				if (!responseHeaderSpec) {
					return;
				}

				const headerOptional = dereference(responseHeadersSpec, header, 'required') !== true;

				if (!response.headers[header.toLowerCase()] && headerOptional) {
					return;
				}

				new chai.Assertion(response.headers, `expected the response to have a header ${header}`).to.have.property(header.toLowerCase());

				let responseHeaderValue = response.headers[header.toLowerCase()];
				let headerValidator = getValidator(ajvHeaders, responseHeaderSpec);

				if (!headerValidator(responseHeaderValue)) {
					let errors = _.uniqBy(headerValidator.errors, e => `${e.schemaPath}$${e.message}`);
					let betterErrors = betterAjvErrors(responseHeaderSpec, responseHeaderValue, errors, { format: 'js' });
					console.error(betterAjvErrors(responseHeaderSpec, responseHeaderValue, errors));

					throw new chai.AssertionError(betterErrors.map(e => `${header}${e.error}`).join(', '));
				}
			});
		});
	};
};

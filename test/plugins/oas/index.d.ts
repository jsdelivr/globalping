declare global {
	namespace Chai {
		interface Assertion {
			matchApiSchema (): Assertion;
		}
	}
}

interface OasOptions {
	specPath: string,
}

declare function chaiOas (options: OasOptions): typeof chaiOasPlugin;
declare function chaiOasPlugin (chai: any, utils: any): void;

export = chaiOas;

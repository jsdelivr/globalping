declare global {
	namespace Chai {
		interface Assertion {
			matchApiSchema (): Assertion;
		}
	}
}

interface OasOptions {
	specPath: string;
}

declare function chaiOas (options: OasOptions): typeof chaiOasPlugin;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare function chaiOasPlugin (chai: any, utils: any): void;

export default chaiOas;

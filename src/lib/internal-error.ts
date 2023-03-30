export class InternalError extends Error {
	expose?: boolean;

	constructor (message: string, isExposed: boolean) {
		super(message);

		this.expose = isExposed;
	}
}

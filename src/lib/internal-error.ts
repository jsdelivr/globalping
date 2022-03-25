export class InternalError extends Error {
	public: boolean;

	constructor(message: string, isPublic: boolean) {
		super(message);
		this.public = isPublic;
	}
}

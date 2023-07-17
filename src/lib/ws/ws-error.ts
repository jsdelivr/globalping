type Data = {
	ipAddress: string;
};

export class WsError extends Error {
	data: Data;
	constructor (message: string, data: Data) {
		super(message);
		this.data = data;
	}
}

export default WsError;

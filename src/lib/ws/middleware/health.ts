import type { ServerSocket } from '../server.js';
import getTermListener from '../../term-listener.js';

export const health = (_socket: ServerSocket, next: (error?: Error) => void) => {
	if (getTermListener().getIsTerminating()) {
		return next(new Error('The server is terminating.'));
	}

	next();
};

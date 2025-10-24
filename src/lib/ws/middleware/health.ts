import type { ServerSocket } from '../server.js';
import termListener from '../../term-listener.js';

export const health = (_socket: ServerSocket, next: (error?: Error) => void) => {
	if (termListener.getIsTerminating()) {
		return next(new Error('The server is terminating.'));
	}

	next();
};

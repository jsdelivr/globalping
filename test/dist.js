import assert from 'node:assert';
import cluster from 'node:cluster';
import { describe, it } from 'node:test';

if (!cluster.isPrimary) {
	import('../dist/index.js');
} else {
	describe('dist build', () => {
		it('loads and doesn\'t crash', async () => {
			await import('../dist/index.js');

			await new Promise((resolve, reject) => {
				setTimeout(resolve, 10000).unref();
				cluster.removeAllListeners('exit');

				cluster.on('exit', ({ code, signal }) => {
					reject(new assert.AssertionError({ message: `Exited with code ${code}, signal ${signal}.` }));
				});
			});

			cluster.removeAllListeners('exit');

			Object.values(cluster.workers).forEach((worker) => {
				worker.kill();
			});
		});
	});
}

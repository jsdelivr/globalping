import assert from 'node:assert';
import cluster from 'node:cluster';
import { after, before, describe, it } from 'node:test';
import config from 'config';

if (!cluster.isPrimary) {
	import('../dist/src/index.js');
} else {
	describe('dist build', () => {
		before(async () => {
			await import('../dist/src/index.js');
		});

		after(() => {
			cluster.removeAllListeners('exit');

			Object.values(cluster.workers).forEach((worker) => {
				worker.kill();
			});

			setTimeout(() => {
				process.exit(process.exitCode);
			}, 1000).unref();
		});

		it('loads and doesn\'t crash', async () => {
			await new Promise((resolve, reject) => {
				setTimeout(resolve, 10000).unref();
				cluster.removeAllListeners('exit');

				cluster.on('exit', ({ code, signal }) => {
					reject(new assert.AssertionError({ message: `Exited with code ${code}, signal ${signal}.` }));
				});
			});

			const response = await fetch(`http://localhost:${config.get('server.port')}/favicon.ico`);
			assert.equal(response.status, 200);
		});
	});
}

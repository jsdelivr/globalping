import { expect } from 'chai';
import { randomUUID } from 'crypto';
import { client } from '../../../src/lib/sql/client.js';
import { docker } from '../docker.js';
import { waitProbeToConnect, waitProbeToDisconnect, waitRowInTable } from '../utils.js';

describe.only('adoption token', () => {
	beforeEach(async function () {
		this.timeout(60000);
		await docker.startProbeContainer();
		await waitProbeToConnect();
	});

	after(async function () {
		this.timeout(60000);
		await docker.startProbeContainer();
		await waitProbeToConnect();
	});

	it('should adopt probe by token', async () => {
		await docker.stopProbeContainer();
		await waitProbeToDisconnect();

		const userId = randomUUID();
		await client('directus_users').insert({
			id: userId,
			github_username: 'jimaek',
			adoption_token: 'telimyn6kx7kppcp5uuk3xfwsgsjqoxb',
		});

		await docker.startProbeContainer();
		await waitProbeToConnect();

		const row = await waitRowInTable('gp_probes');
		expect(row).to.include({
			userId,
		});
	});
});

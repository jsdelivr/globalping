import path from 'node:path';
import { fileURLToPath } from 'node:url';
import chai from 'chai';

import chaiOas from '../test/plugins/oas/index.js';
import { removeProbeContainer, createProbeContainer, removeApiContainer, createApiContainer } from './docker.js';
import { waitProbeToConnect } from './utils.js';

before(async () => {
	chai.use(await chaiOas({ specPath: path.join(fileURLToPath(new URL('.', import.meta.url)), '../public/v1/spec.yaml') }));

	await removeApiContainer();
	await createApiContainer();

	await removeProbeContainer();
	await createProbeContainer();

	await waitProbeToConnect();
});

after(async () => {
	await removeProbeContainer();

	await removeApiContainer();
});

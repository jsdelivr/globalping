import path from 'node:path';
import { fileURLToPath } from 'node:url';
import chai from 'chai';

import chaiOas from '../../plugins/oas/index.js';
import { docker } from './docker.js';
import { waitProbeToConnect } from './utils.js';

before(async () => {
	chai.use(await chaiOas({ specPath: path.join(fileURLToPath(new URL('.', import.meta.url)), '../../../public/v1/spec.yaml') }));

	await docker.removeProbeContainer();

	await docker.createProbeContainer();
	await waitProbeToConnect();
});

after(async () => {
	await docker.removeProbeContainer();
});

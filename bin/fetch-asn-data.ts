import url from 'node:url';
import { updateAsnData } from '../src/lib/geoip/asns.js';

async function main () {
	await updateAsnData();
}

if (import.meta.url === url.pathToFileURL(process.argv[1]!).href) {
	main().catch((error) => {
		console.error('Error:', error);
		process.exit(1);
	});
}

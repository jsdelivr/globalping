import {geoIpLookup} from './lib/geoip/client.js';

geoIpLookup('212.47.235.43').then(res => {
	console.log(res);
});

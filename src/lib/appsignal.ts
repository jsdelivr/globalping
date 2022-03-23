import {Appsignal} from '@appsignal/nodejs';
import * as AppsignalKoa from '@appsignal/koa';
import config from 'config';

const appsignal = new Appsignal({
	active: config.get('appsignal.active'),
	name: 'GlobalPing API',
	pushApiKey: config.get('appsignal.pushApiKey'),
});

appsignal.instrument(AppsignalKoa);

export default appsignal;

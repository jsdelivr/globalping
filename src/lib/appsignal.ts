import * as process from 'node:process';
import {Appsignal} from '@appsignal/nodejs';
import * as AppsignalKoa from '@appsignal/koa';

const appsignal = new Appsignal({
	active: process.env['NODE_ENV'] === 'prod',
	name: 'GlobalPing API',
	pushApiKey: '389f2523-556c-42ce-944b-d9497cf9a1ad',
});

appsignal.instrument(AppsignalKoa);

export default appsignal;

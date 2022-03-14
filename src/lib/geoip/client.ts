import config from 'config';
import {City, WebServiceClient} from '@maxmind/geoip2-node';

const client = new WebServiceClient(config.get('maxmind.accountId'), config.get('maxmind.licenseKey'));

export const geoIpLookup = async (addr: string): Promise<City> => client.city(addr);

import {City, WebServiceClient} from '@maxmind/geoip2-node';

const client = new WebServiceClient('436355', 'yOY2nrcNgDoLTvuK');

export const geoIpLookup = async (addr: string): Promise<City> => client.city(addr);

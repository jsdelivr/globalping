import * as sinon from 'sinon';
import _ from 'lodash';
import { expect } from 'chai';
import * as td from 'testdouble';

import { ProbeRouter } from '../../../../src/probe/router.js';
import type { RemoteProbeSocket } from '../../../../src/lib/ws/server.js';
import type { DeepPartial } from '../../../types.js';
import type { Probe, ProbeLocation } from '../../../../src/probe/types.js';
import type { Location } from '../../../../src/lib/location/types.js';
import { getRegionByCountry } from '../../../../src/lib/location/location.js';

const defaultLocation = {
	continent: '',
	country: 'PL',
	state: undefined,
	city: '',
	region: '',
	normalizedCity: '',
	asn: 43_939,
	latitude: 50.0787,
	longitude: 19.874,
	network: '',
	normalizedNetwork: '',
};

describe('probe router', () => {
	const sandbox = sinon.createSandbox();
	const fetchSocketsMock = sinon.stub();
	const geoLookupMock = sinon.stub();
	const getRegionMock = sinon.stub();
	const router = new ProbeRouter(fetchSocketsMock);
	let buildProbe: (socket: RemoteProbeSocket) => Promise<Probe>;

	const buildSocket = async (
		id: string,
		location: Partial<ProbeLocation>,
		status: Probe['status'] = 'ready',
	): Promise<RemoteProbeSocket> => {
		const socket: DeepPartial<RemoteProbeSocket> = {
			id,
			handshake: {
				query: {
					version: '0.11.0',
				},
			},
			data: {},
		};
		geoLookupMock.resolves({ ...defaultLocation, ...location });

		socket.data!.probe = {
			...await buildProbe(socket as RemoteProbeSocket),
			status,
		};

		return socket as unknown as RemoteProbeSocket;
	};

	before(async () => {
		await td.replaceEsm('../../../../src/lib/geoip/client.ts', { createGeoipClient: () => ({ lookup: geoLookupMock }) });
		await td.replaceEsm('../../../../src/lib/ip-ranges.ts', { getRegion: getRegionMock });
		buildProbe = (await import('../../../../src/probe/builder.js')).buildProbe as unknown as (socket: RemoteProbeSocket) => Promise<Probe>;
	});

	beforeEach(() => {
		sandbox.reset();
	});

	afterEach(() => {
		geoLookupMock.reset();
		fetchSocketsMock.reset();
		getRegionMock.reset();
	});

	after(() => {
		td.reset();
	});

	describe('route with location limit', () => {
		it('should find probes for each location', async () => {
			const sockets: Array<DeepPartial<RemoteProbeSocket>> = [
				await buildSocket('socket-1', { continent: 'EU', country: 'UA' }),
				await buildSocket('socket-2', { continent: 'EU', country: 'PL' }),
				await buildSocket('socket-3', { continent: 'EU', country: 'PL' }),
				await buildSocket('socket-4', { continent: 'NA', country: 'UA' }),
				await buildSocket('socket-5', { continent: 'EU', country: 'PL' }),
			];
			fetchSocketsMock.resolves(sockets as never);

			const probes = await router.findMatchingProbes([
				{ country: 'UA', limit: 2 },
				{ country: 'PL', limit: 2 },
			]);

			expect(fetchSocketsMock.calledOnce).to.be.true;
			expect(fetchSocketsMock.firstCall.args).to.deep.equal([]);
			expect(probes.length).to.equal(4);
			expect(probes.filter(p => p.location.country === 'UA').length).to.equal(2);
			expect(probes.filter(p => p.location.country === 'PL').length).to.equal(2);
		});

		it('should return 1 probe if location limit is not set', async () => {
			const sockets: Array<DeepPartial<RemoteProbeSocket>> = [
				await buildSocket('socket-1', { continent: 'EU', country: 'UA' }),
				await buildSocket('socket-2', { continent: 'EU', country: 'PL' }),
				await buildSocket('socket-3', { continent: 'EU', country: 'PL' }),
				await buildSocket('socket-4', { continent: 'NA', country: 'UA' }),
				await buildSocket('socket-5', { continent: 'EU', country: 'PL' }),
			];

			fetchSocketsMock.resolves(sockets as never);

			const probes = await router.findMatchingProbes([
				{ country: 'UA', limit: 2 },
				{ country: 'PL' },
			]);

			expect(fetchSocketsMock.calledOnce).to.be.true;
			expect(fetchSocketsMock.firstCall.args).to.deep.equal([]);

			expect(probes.length).to.equal(3);
			expect(probes.filter(p => p.location.country === 'UA').length).to.equal(2);
			expect(probes.filter(p => p.location.country === 'PL').length).to.equal(1);
		});

		it('should shuffle result probes', async () => {
			const sockets: Array<DeepPartial<RemoteProbeSocket>> = [
				await buildSocket('socket-1', { continent: 'EU', country: 'UA' }),
				await buildSocket('socket-2', { continent: 'EU', country: 'PL' }),
				await buildSocket('socket-3', { continent: 'EU', country: 'LV' }),
				await buildSocket('socket-4', { continent: 'EU', country: 'LT' }),
				await buildSocket('socket-5', { continent: 'EU', country: 'DE' }),
				await buildSocket('socket-6', { continent: 'EU', country: 'AT' }),
				await buildSocket('socket-7', { continent: 'EU', country: 'BE' }),
				await buildSocket('socket-8', { continent: 'EU', country: 'BG' }),
				await buildSocket('socket-9', { continent: 'EU', country: 'CZ' }),
				await buildSocket('socket-10', { continent: 'EU', country: 'FR' }),
			];
			fetchSocketsMock.resolves(sockets as never);

			const probes1 = await router.findMatchingProbes([
				{ continent: 'EU', limit: 10 },
			]);
			const probes2 = await router.findMatchingProbes([
				{ continent: 'EU', limit: 10 },
			]);

			expect(fetchSocketsMock.calledTwice).to.be.true;
			expect(probes1.length).to.equal(10);
			expect(probes2.length).to.equal(10);
			const countries1 = probes1.map(probe => probe.location.country);
			const countries2 = probes2.map(probe => probe.location.country);
			expect(countries1).to.not.deep.equal(countries2);
		});
	});

	describe('probe readiness', () => {
		it('should find 2 probes', async () => {
			const sockets: Array<DeepPartial<RemoteProbeSocket>> = [
				await buildSocket('socket-1', { continent: 'EU', country: 'GB' }, 'unbuffer-missing'),
				await buildSocket('socket-2', { continent: 'EU', country: 'PL' }, 'unbuffer-missing'),
				await buildSocket('socket-4', { continent: 'EU', country: 'GB' }),
				await buildSocket('socket-5', { continent: 'EU', country: 'PL' }),
			];

			fetchSocketsMock.resolves(sockets as never);

			const probes = await router.findMatchingProbes([
				{ country: 'GB', limit: 2 },
				{ country: 'PL', limit: 2 },
			]);

			expect(fetchSocketsMock.calledOnce).to.be.true;
			expect(fetchSocketsMock.firstCall.args).to.deep.equal([]);

			expect(probes.length).to.equal(2);
			expect(probes.filter(p => p.location.country === 'GB').length).to.equal(1);
			expect(probes.filter(p => p.location.country === 'PL').length).to.equal(1);
		});
	});

	describe('route globally distributed', () => {
		it('should find probes when each group is full', async () => {
			const sockets = await Promise.all([ 'AF', 'AS', 'EU', 'OC', 'NA', 'SA' ]
				.flatMap(continent => _.range(50).map(i => buildSocket(`${continent}-${i}`, { continent }))));

			fetchSocketsMock.resolves(sockets as never);

			const probes = await router.findMatchingProbes([], 100);
			const grouped = _.groupBy(probes, 'location.continent');

			expect(probes.length).to.equal(100);
			expect(grouped['AF']?.length).to.equal(5);
			expect(grouped['AS']?.length).to.equal(15);
			expect(grouped['EU']?.length).to.equal(30);
			expect(grouped['OC']?.length).to.equal(10);
			expect(grouped['NA']?.length).to.equal(30);
			expect(grouped['SA']?.length).to.equal(10);
		});

		it('should find probes when some groups are not full', async () => {
			const sockets: DeepPartial<RemoteProbeSocket[]> = await Promise.all([
				..._.range(15).map(i => buildSocket(`AF-${i}`, { continent: 'AF' })),
				..._.range(15).map(i => buildSocket(`AS-${i}`, { continent: 'AS' })),
				..._.range(20).map(i => buildSocket(`EU-${i}`, { continent: 'EU' })),
				..._.range(10).map(i => buildSocket(`OC-${i}`, { continent: 'OC' })),
				..._.range(20).map(i => buildSocket(`NA-${i}`, { continent: 'NA' })),
				..._.range(30).map(i => buildSocket(`SA-${i}`, { continent: 'SA' })),
			]);

			fetchSocketsMock.resolves(sockets as never);

			const probes = await router.findMatchingProbes([], 100);
			const grouped = _.groupBy(probes, 'location.continent');

			expect(probes.length).to.equal(100);
			expect(grouped['AF']?.length).to.equal(13);
			expect(grouped['AS']?.length).to.equal(15);
			expect(grouped['EU']?.length).to.equal(20);
			expect(grouped['OC']?.length).to.equal(10);
			expect(grouped['NA']?.length).to.equal(20);
			expect(grouped['SA']?.length).to.equal(22);
		});

		it('should return exactly the same number of probes if limit can\'t be divided evenly', async () => {
			const sockets: DeepPartial<RemoteProbeSocket[]> = await Promise.all([
				..._.range(5).map(i => buildSocket(`AF-${i}`, { continent: 'AF' })),
				..._.range(5).map(i => buildSocket(`NA-${i}`, { continent: 'NA' })),
				..._.range(5).map(i => buildSocket(`SA-${i}`, { continent: 'SA' })),
			]);

			fetchSocketsMock.resolves(sockets as never);

			const probes = await router.findMatchingProbes([{ continent: 'AF' }, { continent: 'NA' }, { continent: 'SA' }], 7);
			expect(probes.length).to.equal(7);
		});

		it('should find when probes not enough', async () => {
			const sockets: DeepPartial<RemoteProbeSocket[]> = await Promise.all([
				..._.range(15).map(i => buildSocket(`AF-${i}`, { continent: 'AF' })),
				..._.range(20).map(i => buildSocket(`EU-${i}`, { continent: 'EU' })),
				..._.range(10).map(i => buildSocket(`OC-${i}`, { continent: 'OC' })),
				..._.range(20).map(i => buildSocket(`NA-${i}`, { continent: 'NA' })),
			]);

			fetchSocketsMock.resolves(sockets as never);

			const probes = await router.findMatchingProbes([], 100);
			const grouped = _.groupBy(probes, 'location.continent');

			expect(probes.length).to.equal(65);
			expect(grouped['AF']?.length).to.equal(15);
			expect(grouped['EU']?.length).to.equal(20);
			expect(grouped['OC']?.length).to.equal(10);
			expect(grouped['NA']?.length).to.equal(20);
		});

		it('should shuffle result probes', async () => {
			const sockets: Array<DeepPartial<RemoteProbeSocket>> = [
				await buildSocket('socket-1', { continent: 'EU', country: 'UA' }),
				await buildSocket('socket-2', { continent: 'EU', country: 'PL' }),
				await buildSocket('socket-3', { continent: 'EU', country: 'LV' }),
				await buildSocket('socket-4', { continent: 'EU', country: 'LT' }),
				await buildSocket('socket-5', { continent: 'EU', country: 'DE' }),
				await buildSocket('socket-6', { continent: 'EU', country: 'AT' }),
				await buildSocket('socket-7', { continent: 'EU', country: 'BE' }),
				await buildSocket('socket-8', { continent: 'EU', country: 'BG' }),
				await buildSocket('socket-9', { continent: 'EU', country: 'CZ' }),
				await buildSocket('socket-10', { continent: 'EU', country: 'FR' }),
			];
			fetchSocketsMock.resolves(sockets as never);

			const probes1 = await router.findMatchingProbes([], 100);
			const probes2 = await router.findMatchingProbes([], 100);

			expect(fetchSocketsMock.calledTwice).to.be.true;
			expect(probes1.length).to.equal(10);
			expect(probes2.length).to.equal(10);
			const countries1 = probes1.map(probe => probe.location.country);
			const countries2 = probes2.map(probe => probe.location.country);
			expect(countries1).to.not.deep.equal(countries2);
		});
	});

	describe('route with global limit', () => {
		it('should find probes even in overlapping locations', async () => {
			const cache: Record<string, RemoteProbeSocket> = {};
			const memoizedBuildSocket = async (id: string, location: ProbeLocation) => {
				const cached = cache[location.country];

				if (cached) {
					return { ...cached };
				}

				const socket = await buildSocket(id, location);
				cache[location.country] = socket;
				return socket;
			};

			const euSockets: RemoteProbeSocket[] = [];

			for (const i of _.range(10_000)) {
				// eslint-disable-next-line no-await-in-loop
				const socket = await memoizedBuildSocket(`PL-${i}`, { continent: 'EU', country: 'PL' } as ProbeLocation);
				euSockets.push(socket as never);
			}

			const uaSocket = await buildSocket(`UA-${1}`, { continent: 'EU', country: 'UA' });
			const sockets: DeepPartial<RemoteProbeSocket[]> = [ ...euSockets, uaSocket ];
			const locations: Location[] = [
				{ continent: 'EU' },
				{ country: 'UA' },
			];

			fetchSocketsMock.resolves(sockets as never);

			const probes = await router.findMatchingProbes(locations, 100);
			const grouped = _.groupBy(probes, 'location.country');

			expect(probes.length).to.equal(100);
			expect(grouped['PL']?.length).to.equal(99);
			expect(grouped['UA']?.length).to.equal(1);
		});

		it('should evenly distribute probes', async () => {
			const sockets: DeepPartial<RemoteProbeSocket[]> = await Promise.all([
				..._.range(100).map(i => buildSocket(`PL-${i}`, { country: 'PL' })),
				..._.range(100).map(i => buildSocket(`UA-${i}`, { country: 'UA' })),
				..._.range(100).map(i => buildSocket(`NL-${i}`, { country: 'NL' })),
			]);
			const locations: Location[] = [
				{ country: 'PL' },
				{ country: 'UA' },
				{ country: 'NL' },
			];

			fetchSocketsMock.resolves(sockets as never);

			const probes = await router.findMatchingProbes(locations, 100);
			const grouped = _.groupBy(probes, 'location.country');

			expect(probes.length).to.equal(100);
			expect(grouped['PL']?.length).to.equal(34);
			expect(grouped['UA']?.length).to.equal(33);
			expect(grouped['NL']?.length).to.equal(33);
		});

		it('should shuffle result probes', async () => {
			const sockets: Array<DeepPartial<RemoteProbeSocket>> = [
				await buildSocket('socket-1', { continent: 'EU', country: 'UA' }),
				await buildSocket('socket-2', { continent: 'EU', country: 'PL' }),
				await buildSocket('socket-3', { continent: 'EU', country: 'LV' }),
				await buildSocket('socket-4', { continent: 'EU', country: 'LT' }),
				await buildSocket('socket-5', { continent: 'EU', country: 'DE' }),
				await buildSocket('socket-6', { continent: 'EU', country: 'AT' }),
				await buildSocket('socket-7', { continent: 'EU', country: 'BE' }),
				await buildSocket('socket-8', { continent: 'EU', country: 'BG' }),
				await buildSocket('socket-9', { continent: 'EU', country: 'CZ' }),
				await buildSocket('socket-10', { continent: 'EU', country: 'FR' }),
			];
			fetchSocketsMock.resolves(sockets as never);

			const probes1 = await router.findMatchingProbes([
				{ continent: 'EU' },
			], 100);
			const probes2 = await router.findMatchingProbes([
				{ continent: 'EU' },
			], 100);

			expect(fetchSocketsMock.calledTwice).to.be.true;
			expect(probes1.length).to.equal(10);
			expect(probes2.length).to.equal(10);
			const countries1 = probes1.map(probe => probe.location.country);
			const countries2 = probes2.map(probe => probe.location.country);
			expect(countries1).to.not.deep.equal(countries2);
		});
	});

	describe('normalized fields', () => {
		const location = {
			continent: 'NA',
			region: getRegionByCountry('US'),
			country: 'US',
			state: 'NY',
			city: 'The New York City',
			normalizedCity: 'new york',
			asn: 5089,
			normalizedNetwork: 'abc',
		};

		it('should find probe by normalizedCity value', async () => {
			const sockets: DeepPartial<RemoteProbeSocket[]> = [
				await buildSocket(String(Date.now), location),
			];

			const locations: Location[] = [
				{ city: 'new york' },
			];

			fetchSocketsMock.resolves(sockets as never);

			const probes = await router.findMatchingProbes(locations, 100);

			expect(probes.length).to.equal(1);
			expect(probes[0]!.location.country).to.equal('US');
		});

		it('should not find probe by continent alias if it is used not in magic field', async () => {
			const sockets: DeepPartial<RemoteProbeSocket[]> = [
				await buildSocket('socket-1', location),
			];

			fetchSocketsMock.resolves(sockets as never);
			const probes = await router.findMatchingProbes([{ continent: 'NA' }], 100);
			expect(probes.length).to.equal(1);
			const probes2 = await router.findMatchingProbes([{ continent: 'North America' }], 100);
			expect(probes2.length).to.equal(0);
		});

		it('should not find probe by region alias if it is used not in magic field', async () => {
			const sockets: DeepPartial<RemoteProbeSocket[]> = [
				await buildSocket('socket-1', { region: 'Northern Africa' }),
			];

			fetchSocketsMock.resolves(sockets as never);

			const probes = await router.findMatchingProbes([{ region: 'Northern Africa' }], 100);
			expect(probes.length).to.equal(1);
			const probes2 = await router.findMatchingProbes([{ region: 'North Africa' }], 100);
			expect(probes2.length).to.equal(0);
		});
	});

	describe('route with magic location', () => {
		const location = {
			continent: 'EU',
			region: getRegionByCountry('GB'),
			country: 'GB',
			state: undefined,
			city: 'London',
			normalizedCity: 'london',
			asn: 5089,
			normalizedNetwork: 'a-virgin media',
		};

		it('should return match (continent alias)', async () => {
			const sockets: DeepPartial<RemoteProbeSocket[]> = [
				await buildSocket(String(Date.now()), location),
			];

			fetchSocketsMock.resolves(sockets as never);

			const probes = await router.findMatchingProbes([{ magic: 'europe' }], 100);

			expect(probes.length).to.equal(1);
			expect(probes[0]!.location.country).to.equal('GB');
		});

		it('should return match (region alias)', async () => {
			const sockets: DeepPartial<RemoteProbeSocket[]> = [
				await buildSocket('socket-1', { region: 'Northern Africa' }),
			];

			fetchSocketsMock.resolves(sockets as never);

			const probes = await router.findMatchingProbes([{ magic: 'north africa' }], 100);

			expect(probes.length).to.equal(1);
			expect(probes[0]!.location.region).to.equal('Northern Africa');
		});

		it('should not return match (non-existing region alias)', async () => {
			const sockets: DeepPartial<RemoteProbeSocket[]> = [
				await buildSocket('socket-1', { region: 'Southern Africa' }),
			];

			fetchSocketsMock.resolves(sockets as never);

			const probes = await router.findMatchingProbes([{ magic: 'south africa' }], 100);

			expect(probes.length).to.equal(0);
		});

		it('should return match (country alias)', async () => {
			const sockets: DeepPartial<RemoteProbeSocket[]> = [
				await buildSocket('socket-1', location),
			];

			const locations: Location[] = [
				{ magic: 'england' },
			];

			fetchSocketsMock.resolves(sockets as never);

			const probes = await router.findMatchingProbes(locations, 100);

			expect(probes.length).to.equal(1);
			expect(probes[0]!.location.country).to.equal('GB');
		});

		it('should return match (magic nested)', async () => {
			const sockets: DeepPartial<RemoteProbeSocket[]> = [
				await buildSocket(String(Date.now()), location),
			];

			const locations: Location[] = [
				{ magic: 'england+as5089' },
			];

			fetchSocketsMock.resolves(sockets as never);

			const probes = await router.findMatchingProbes(locations, 100);

			expect(probes.length).to.equal(1);
			expect(probes[0]!.location.country).to.equal('GB');
		});

		it('should return result sorted by priority of magic fields in case of partial match', async () => {
			const sockets: Array<DeepPartial<RemoteProbeSocket>> = [
				await buildSocket('socket-3', { country: 'CZ', normalizedCity: 'praga', normalizedNetwork: 'ultra development networks' }),
				await buildSocket('socket-2', { country: 'RS', normalizedCity: 'belgrade', normalizedNetwork: 'belgrade networks' }),
				await buildSocket('socket-1', { country: 'DE', normalizedCity: 'berlin', normalizedNetwork: 'berlin networks' }),
			];
			fetchSocketsMock.resolves(sockets as never);

			const probes = await router.findMatchingProbes([
				{ magic: 'd' },
			], 100);

			expect(fetchSocketsMock.calledOnce).to.be.true;
			expect(probes.length).to.equal(3);
			expect(probes[0]!.location.country).to.equal('DE');
			expect(probes[1]!.location.country).to.equal('RS');
			expect(probes[2]!.location.country).to.equal('CZ');
		});

		it('should ignore low-priority partial matches if there is an exact match', async () => {
			const sockets: Array<DeepPartial<RemoteProbeSocket>> = [
				await buildSocket('socket-3', { country: 'VN', normalizedCity: 'hanoi', normalizedNetwork: 'ultra networks' }),
				await buildSocket('socket-2', { country: 'RU', normalizedCity: 'vnukovo', normalizedNetwork: 'super networks' }),
				await buildSocket('socket-1', { country: 'HU', normalizedCity: 'budapest', normalizedNetwork: '23VNet Kft' }),
			];
			fetchSocketsMock.resolves(sockets as never);

			const probes = await router.findMatchingProbes([
				{ magic: 'vn' },
			], 100);

			expect(fetchSocketsMock.calledOnce).to.be.true;
			expect(probes.length).to.equal(1);
			expect(probes[0]!.location.country).to.equal('VN');
		});

		it('should ignore high-priority partial matches if there is an exact match', async () => {
			const sockets: Array<DeepPartial<RemoteProbeSocket>> = [
				await buildSocket('socket-1', { country: 'PL', normalizedCity: 'warsaw', normalizedNetwork: 'super networks' }),
				await buildSocket('socket-2', { country: 'PL', normalizedCity: 'warsaw', normalizedNetwork: 'wars networks' }),
				await buildSocket('socket-3', { country: 'PL', normalizedCity: 'poznan', normalizedNetwork: 'wars' }),
			];
			fetchSocketsMock.resolves(sockets as never);

			const probes = await router.findMatchingProbes([
				{ magic: 'wars' },
			], 100);

			expect(fetchSocketsMock.calledOnce).to.be.true;
			expect(probes.length).to.equal(1);
			expect(probes[0]!.location.normalizedCity).to.equal('poznan');
		});

		it('should ignore same-level partial matches if there is an exact match', async () => {
			const sockets: Array<DeepPartial<RemoteProbeSocket>> = [
				await buildSocket('socket-1', { country: 'US', normalizedCity: 'new york' }),
				await buildSocket('socket-2', { country: 'GB', normalizedCity: 'york' }),
			];
			fetchSocketsMock.resolves(sockets as never);

			const probes = await router.findMatchingProbes([
				{ magic: 'york' },
			], 100);

			expect(fetchSocketsMock.calledOnce).to.be.true;
			expect(probes.length).to.equal(1);
			expect(probes[0]!.location.country).to.equal('GB');
		});

		it('should shuffle result considering priority of magic fields', async () => {
			const sockets: Array<DeepPartial<RemoteProbeSocket>> = [
				await buildSocket('socket-3', { normalizedCity: 'praga1', country: 'CZ', normalizedNetwork: 'ultra development networks' }),
				await buildSocket('socket-3', { normalizedCity: 'praga2', country: 'CZ', normalizedNetwork: 'ultra development networks' }),
				await buildSocket('socket-3', { normalizedCity: 'praga3', country: 'CZ', normalizedNetwork: 'ultra development networks' }),
				await buildSocket('socket-3', { normalizedCity: 'praga4', country: 'CZ', normalizedNetwork: 'ultra development networks' }),
				await buildSocket('socket-3', { normalizedCity: 'praga5', country: 'CZ', normalizedNetwork: 'ultra development networks' }),
				await buildSocket('socket-3', { normalizedCity: 'praga6', country: 'CZ', normalizedNetwork: 'ultra development networks' }),
				await buildSocket('socket-3', { normalizedCity: 'praga7', country: 'CZ', normalizedNetwork: 'ultra development networks' }),
				await buildSocket('socket-3', { normalizedCity: 'praga8', country: 'CZ', normalizedNetwork: 'ultra development networks' }),
				await buildSocket('socket-3', { normalizedCity: 'praga9', country: 'CZ', normalizedNetwork: 'ultra development networks' }),
				await buildSocket('socket-3', { normalizedCity: 'praga10', country: 'CZ', normalizedNetwork: 'ultra development networks' }),
				await buildSocket('socket-2', { normalizedCity: 'belgrade1', country: 'RS', normalizedNetwork: 'belgrade networks' }),
				await buildSocket('socket-2', { normalizedCity: 'belgrade2', country: 'RS', normalizedNetwork: 'belgrade networks' }),
				await buildSocket('socket-2', { normalizedCity: 'belgrade3', country: 'RS', normalizedNetwork: 'belgrade networks' }),
				await buildSocket('socket-2', { normalizedCity: 'belgrade4', country: 'RS', normalizedNetwork: 'belgrade networks' }),
				await buildSocket('socket-2', { normalizedCity: 'belgrade5', country: 'RS', normalizedNetwork: 'belgrade networks' }),
				await buildSocket('socket-2', { normalizedCity: 'belgrade6', country: 'RS', normalizedNetwork: 'belgrade networks' }),
				await buildSocket('socket-2', { normalizedCity: 'belgrade7', country: 'RS', normalizedNetwork: 'belgrade networks' }),
				await buildSocket('socket-2', { normalizedCity: 'belgrade8', country: 'RS', normalizedNetwork: 'belgrade networks' }),
				await buildSocket('socket-2', { normalizedCity: 'belgrade9', country: 'RS', normalizedNetwork: 'belgrade networks' }),
				await buildSocket('socket-2', { normalizedCity: 'belgrade10', country: 'RS', normalizedNetwork: 'belgrade networks' }),
				await buildSocket('socket-1', { normalizedCity: 'berlin1', country: 'DE', normalizedNetwork: 'berlin networks' }),
				await buildSocket('socket-1', { normalizedCity: 'berlin2', country: 'DE', normalizedNetwork: 'berlin networks' }),
				await buildSocket('socket-1', { normalizedCity: 'berlin3', country: 'DE', normalizedNetwork: 'berlin networks' }),
				await buildSocket('socket-1', { normalizedCity: 'berlin4', country: 'DE', normalizedNetwork: 'berlin networks' }),
				await buildSocket('socket-1', { normalizedCity: 'berlin5', country: 'DE', normalizedNetwork: 'berlin networks' }),
				await buildSocket('socket-1', { normalizedCity: 'berlin6', country: 'DE', normalizedNetwork: 'berlin networks' }),
				await buildSocket('socket-1', { normalizedCity: 'berlin7', country: 'DE', normalizedNetwork: 'berlin networks' }),
				await buildSocket('socket-1', { normalizedCity: 'berlin8', country: 'DE', normalizedNetwork: 'berlin networks' }),
				await buildSocket('socket-1', { normalizedCity: 'berlin9', country: 'DE', normalizedNetwork: 'berlin networks' }),
				await buildSocket('socket-1', { normalizedCity: 'berlin10', country: 'DE', normalizedNetwork: 'berlin networks' }),
			];
			fetchSocketsMock.resolves(sockets as never);

			const probes1 = await router.findMatchingProbes([
				{ magic: 'd' },
			], 100);
			const probes2 = await router.findMatchingProbes([
				{ magic: 'd' },
			], 100);

			expect(fetchSocketsMock.calledTwice).to.be.true;
			expect(probes1.length).to.equal(30);
			expect(probes2.length).to.equal(30);
			expect(probes1.slice(0, 9).every(probe => probe.location.country === 'DE')).to.be.true;
			expect(probes2.slice(0, 9).every(probe => probe.location.country === 'DE')).to.be.true;
			expect(probes1.slice(0, 9).map(probe => probe.location.normalizedCity)).to.not.deep.equal(probes2.slice(0, 9).map(probe => probe.location.normalizedCity));
			expect(probes1.slice(10, 19).every(probe => probe.location.country === 'RS')).to.be.true;
			expect(probes1.slice(10, 19).every(probe => probe.location.country === 'RS')).to.be.true;
			expect(probes1.slice(10, 19).map(probe => probe.location.normalizedCity)).to.not.deep.equal(probes2.slice(0, 9).map(probe => probe.location.normalizedCity));
			expect(probes1.slice(20, 29).every(probe => probe.location.country === 'CZ')).to.be.true;
			expect(probes1.slice(20, 29).every(probe => probe.location.country === 'CZ')).to.be.true;
			expect(probes1.slice(20, 29).map(probe => probe.location.normalizedCity)).to.not.deep.equal(probes2.slice(0, 9).map(probe => probe.location.normalizedCity));
		});

		it('should shuffle result in case of exact match', async () => {
			const sockets: Array<DeepPartial<RemoteProbeSocket>> = [
				await buildSocket('socket-3', { normalizedCity: 'praga1', country: 'CZ', normalizedNetwork: 'ultra development networks' }),
				await buildSocket('socket-3', { normalizedCity: 'praga2', country: 'CZ', normalizedNetwork: 'ultra development networks' }),
				await buildSocket('socket-3', { normalizedCity: 'praga3', country: 'CZ', normalizedNetwork: 'ultra development networks' }),
				await buildSocket('socket-2', { normalizedCity: 'belgrade1', country: 'RS', normalizedNetwork: 'belgrade networks' }),
				await buildSocket('socket-2', { normalizedCity: 'belgrade2', country: 'RS', normalizedNetwork: 'belgrade networks' }),
				await buildSocket('socket-2', { normalizedCity: 'belgrade3', country: 'RS', normalizedNetwork: 'belgrade networks' }),
				await buildSocket('socket-1', { normalizedCity: 'berlin1', country: 'DE', normalizedNetwork: 'berlin networks' }),
				await buildSocket('socket-1', { normalizedCity: 'berlin2', country: 'DE', normalizedNetwork: 'berlin networks' }),
				await buildSocket('socket-1', { normalizedCity: 'berlin3', country: 'DE', normalizedNetwork: 'berlin networks' }),
				await buildSocket('socket-1', { normalizedCity: 'berlin4', country: 'DE', normalizedNetwork: 'berlin networks' }),
				await buildSocket('socket-1', { normalizedCity: 'berlin5', country: 'DE', normalizedNetwork: 'berlin networks' }),
				await buildSocket('socket-1', { normalizedCity: 'berlin6', country: 'DE', normalizedNetwork: 'berlin networks' }),
				await buildSocket('socket-1', { normalizedCity: 'berlin7', country: 'DE', normalizedNetwork: 'berlin networks' }),
				await buildSocket('socket-1', { normalizedCity: 'berlin8', country: 'DE', normalizedNetwork: 'berlin networks' }),
				await buildSocket('socket-1', { normalizedCity: 'berlin9', country: 'DE', normalizedNetwork: 'berlin networks' }),
				await buildSocket('socket-1', { normalizedCity: 'berlin10', country: 'DE', normalizedNetwork: 'berlin networks' }),
			];
			fetchSocketsMock.resolves(sockets as never);

			const probes1 = await router.findMatchingProbes([
				{ magic: 'de' },
			], 100);
			const probes2 = await router.findMatchingProbes([
				{ magic: 'de' },
			], 100);

			expect(fetchSocketsMock.calledTwice).to.be.true;
			expect(probes1.length).to.equal(10);
			expect(probes2.length).to.equal(10);
			expect(probes1.slice(0, 9).every(probe => probe.location.country === 'DE')).to.be.true;
			expect(probes2.slice(0, 9).every(probe => probe.location.country === 'DE')).to.be.true;
			expect(probes1.slice(0, 9).map(probe => probe.location.normalizedCity)).to.not.deep.equal(probes2.slice(0, 9).map(probe => probe.location.normalizedCity));
		});

		describe('Location type - Network', () => {
			for (const testCase of [ 'a-virgin', 'virgin', 'media' ]) {
				it(`should match network - ${testCase}`, async () => {
					const sockets: DeepPartial<RemoteProbeSocket[]> = [
						await buildSocket(String(Date.now()), location),
					];

					const locations: Location[] = [
						{ magic: testCase },
					];

					fetchSocketsMock.resolves(sockets as never);

					const probes = await router.findMatchingProbes(locations, 100);

					expect(probes.length).to.equal(1);
					expect(probes[0]!.location.country).to.equal('GB');
				});
			}
		});

		describe('Location type - ASN', () => {
			for (const testCase of [ '5089', 'as5089' ]) {
				it(`should match ASN - ${testCase}`, async () => {
					const sockets: DeepPartial<RemoteProbeSocket[]> = [
						await buildSocket(String(Date.now()), location),
					];

					const locations: Location[] = [
						{ magic: testCase },
					];

					fetchSocketsMock.resolves(sockets as never);

					const probes = await router.findMatchingProbes(locations, 100);

					expect(probes.length).to.equal(1);
					expect(probes[0]!.location.country).to.equal('GB');
				});
			}
		});

		describe('Location type - State', () => {
			for (const testCase of [ 'dc', 'district of columbia', 'district' ]) {
				it(`should match state value - ${testCase}`, async () => {
					const location = {
						continent: 'NA',
						region: getRegionByCountry('US'),
						country: 'US',
						state: 'DC',
						city: 'Washington',
						asn: 3969,
						network: 'Google Cloud',
					};

					const sockets: DeepPartial<RemoteProbeSocket[]> = [
						await buildSocket(String(Date.now()), location),
					];

					const locations: Location[] = [
						{ magic: testCase },
					];

					fetchSocketsMock.resolves(sockets as never);

					const probes = await router.findMatchingProbes(locations, 100);

					expect(probes.length).to.equal(1);
					expect(probes[0]!.location.country).to.equal('US');
				});
			}
		});

		describe('Location type - tag', () => {
			for (const testCase of [ 'aws-eu', 'west 1' ]) {
				it(`should match tag - ${testCase}`, async () => {
					getRegionMock.returns('aws-eu-west-1');
					const sockets: DeepPartial<RemoteProbeSocket[]> = [
						await buildSocket(String(Date.now()), location),
					];

					const locations: Location[] = [
						{ magic: testCase },
					];

					fetchSocketsMock.resolves(sockets as never);

					const probes = await router.findMatchingProbes(locations, 100);

					expect(probes.length).to.equal(1);
					expect(probes[0]!.location.country).to.equal('GB');
				});
			}
		});
	});

	describe('route with tags location', () => {
		const location = {
			continent: 'EU',
			region: getRegionByCountry('GB'),
			country: 'GB',
			state: undefined,
			city: 'london',
			asn: 5089,
			network: 'a-virgin media',
		};

		it('should return match for existing tag', async () => {
			getRegionMock.returns('aws-eu-west-1');
			const sockets: DeepPartial<RemoteProbeSocket[]> = [
				await buildSocket(String(Date.now()), location),
			];

			const locations: Location[] = [
				{ tags: [ 'aws-eu-west-1' ] },
			];

			fetchSocketsMock.resolves(sockets as never);

			const probes = await router.findMatchingProbes(locations, 100);

			expect(probes.length).to.equal(1);
			expect(probes[0]!.location.country).to.equal('GB');
		});

		it('should return 0 matches for partial tag value', async () => {
			getRegionMock.returns('aws-eu-west-1');
			const sockets: DeepPartial<RemoteProbeSocket[]> = [
				await buildSocket(String(Date.now()), location),
			];

			const locations: Location[] = [
				{ tags: [ 'tag-v' ] },
			];

			fetchSocketsMock.resolves(sockets as never);

			const probes = await router.findMatchingProbes(locations, 100);

			expect(probes.length).to.equal(0);
		});

		it('should return match for user tag', async () => {
			const socket = await buildSocket(String(Date.now()), location);
			socket.data.probe.tags = [
				...socket.data.probe.tags,
				{ type: 'user', value: 'u-jimaek-dashboardtag' },
			];

			const sockets: DeepPartial<RemoteProbeSocket[]> = [ socket ];

			const locations: Location[] = [
				{ tags: [ 'u-jimaek-dashboardtag' ] },
			];

			fetchSocketsMock.resolves(sockets as never);

			const probes = await router.findMatchingProbes(locations, 100);

			expect(probes.length).to.equal(1);
			expect(probes[0]!.location.country).to.equal('GB');
		});
	});
});

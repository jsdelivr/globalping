import * as sinon from 'sinon';
import _ from 'lodash';
import { expect } from 'chai';
import * as td from 'testdouble';

import { ProbeRouter } from '../../../../src/probe/router.js';
import { ProbesLocationFilter } from '../../../../src/probe/probes-location-filter.js';
import { getRegionByCountry } from '../../../../src/lib/location/location.js';
import type { RemoteProbeSocket } from '../../../../src/lib/ws/server.js';
import type { DeepPartial } from '../../../types.js';
import type { ServerProbe, ProbeLocation } from '../../../../src/probe/types.js';
import type { Location } from '../../../../src/lib/location/types.js';
import type { MeasurementStore } from '../../../../src/measurement/store.js';
import type { UserRequest } from '../../../../src/measurement/types.js';

const defaultLocation = {
	continent: '',
	country: 'PL',
	state: null,
	city: '',
	region: '',
	normalizedCity: '',
	asn: 43_939,
	latitude: 50.08,
	longitude: 19.87,
	network: '',
	normalizedNetwork: '',
};

describe('probe router', () => {
	const sandbox = sinon.createSandbox();
	const probesLocationFilter = new ProbesLocationFilter();
	let fetchProbesMockHandler: (probes: ServerProbe[]) => void;

	const onServerProbesUpdateMock: (onUpdate: (probes: ServerProbe[]) => void) => () => void = (handler) => {
		fetchProbesMockHandler = (probes) => {
			probesLocationFilter.updateGlobalIndex(probes);
			return handler(probes);
		};

		return () => {};
	};

	const setProbes = (probes: ServerProbe[]) => fetchProbesMockHandler(probes);
	const geoLookupMock = sandbox.stub();
	const getCloudTagsMock = sandbox.stub();
	const store = {
		getMeasurementIps: sandbox.stub().resolves([]),
		getMeasurement: sandbox.stub(),
	};
	const router = new ProbeRouter(onServerProbesUpdateMock, probesLocationFilter, store as unknown as MeasurementStore);
	const mockedMeasurementId = '2E2SZgEwA6W6HvzlT0001z9VK';

	let buildProbeInternal: (socket: RemoteProbeSocket, probeIpLimit: any) => Promise<ServerProbe>;
	const mockProbeIpLimit = { verifyIpLimit: sandbox.stub().resolves() };

	const buildProbe = async (
		id: string,
		location: Partial<ProbeLocation>,
		additionalProperties: Partial<ServerProbe> = {},
	): Promise<ServerProbe> => {
		const socket: DeepPartial<RemoteProbeSocket> = {
			id,
			handshake: {
				query: {
					version: '0.39.0',
				},
			},
			data: {},
		};
		geoLookupMock.resolves({ ...defaultLocation, ...location });

		socket.data!.probe = {
			...await buildProbeInternal(socket as RemoteProbeSocket, mockProbeIpLimit),
			status: 'ready',
			isIPv4Supported: true,
			isIPv6Supported: false,
			...additionalProperties,
		};

		return socket.data!.probe as unknown as ServerProbe;
	};

	before(async () => {
		await td.replaceEsm('../../../../src/lib/geoip/client.ts', { getGeoIpClient: () => ({ lookup: geoLookupMock }) });
		await td.replaceEsm('../../../../src/lib/cloud-ip-ranges.ts', { getCloudTags: getCloudTagsMock });
		buildProbeInternal = (await import('../../../../src/probe/builder.js')).buildProbe as unknown as (socket: RemoteProbeSocket) => Promise<ServerProbe>;
	});

	beforeEach(() => {
		sandbox.reset();
		getCloudTagsMock.returns([]);
		store.getMeasurementIps.resolves([]);
	});

	after(() => {
		sandbox.restore();
		td.reset();
	});

	describe('route with location limit', () => {
		it('should find probes for each location', async () => {
			const probes: Array<DeepPartial<ServerProbe>> = [
				await buildProbe('socket-1', { continent: 'EU', country: 'UA' }),
				await buildProbe('socket-2', { continent: 'EU', country: 'PL' }),
				await buildProbe('socket-3', { continent: 'EU', country: 'PL' }),
				await buildProbe('socket-4', { continent: 'NA', country: 'UA' }),
				await buildProbe('socket-5', { continent: 'EU', country: 'PL' }),
			];

			setProbes(probes as never);

			const userRequest = {
				locations: [
					{ country: 'UA', limit: 2 },
					{ country: 'PL', limit: 2 },
				],
			} as UserRequest;

			const { onlineProbesMap, allProbes, request } = await router.findMatchingProbes(userRequest);

			expect(request).to.equal(userRequest);
			expect(onlineProbesMap.size).to.equal(4);
			expect(allProbes.length).to.equal(4);
			expect(onlineProbesMap.size).to.equal(4);
			expect(allProbes.filter(p => p.location.country === 'UA').length).to.equal(2);
			expect(allProbes.filter(p => p.location.country === 'PL').length).to.equal(2);
		});

		it('should return 1 probe if location limit is not set', async () => {
			const probes: Array<DeepPartial<ServerProbe>> = [
				await buildProbe('socket-1', { continent: 'EU', country: 'UA' }),
				await buildProbe('socket-2', { continent: 'EU', country: 'PL' }),
				await buildProbe('socket-3', { continent: 'EU', country: 'PL' }),
				await buildProbe('socket-4', { continent: 'NA', country: 'UA' }),
				await buildProbe('socket-5', { continent: 'EU', country: 'PL' }),
			];

			setProbes(probes as never);

			const { onlineProbesMap, allProbes } = await router.findMatchingProbes({
				locations: [
					{ country: 'UA', limit: 2 },
					{ country: 'PL' },
				],
			} as UserRequest);

			expect(onlineProbesMap.size).to.equal(3);
			expect(allProbes.length).to.equal(3);
			expect(allProbes.filter(p => p.location.country === 'UA').length).to.equal(2);
			expect(allProbes.filter(p => p.location.country === 'PL').length).to.equal(1);
		});

		it('should return 1 probe if global limit is not set', async () => {
			const probes: Array<DeepPartial<ServerProbe>> = [
				await buildProbe('socket-1', { continent: 'EU', country: 'UA' }),
				await buildProbe('socket-2', { continent: 'EU', country: 'PL' }),
				await buildProbe('socket-3', { continent: 'EU', country: 'PL' }),
				await buildProbe('socket-4', { continent: 'NA', country: 'UA' }),
				await buildProbe('socket-5', { continent: 'EU', country: 'PL' }),
			];

			setProbes(probes as never);

			const userRequest = { locations: [] } as unknown as UserRequest;
			const { onlineProbesMap, allProbes, request } = await router.findMatchingProbes(userRequest);

			expect(request).to.equal(userRequest);
			expect(onlineProbesMap.size).to.equal(1);
			expect(allProbes.length).to.equal(1);
		});

		it('should shuffle result probes', async () => {
			const probes: Array<DeepPartial<ServerProbe>> = [
				await buildProbe('socket-1', { continent: 'EU', country: 'UA' }),
				await buildProbe('socket-2', { continent: 'EU', country: 'PL' }),
				await buildProbe('socket-3', { continent: 'EU', country: 'LV' }),
				await buildProbe('socket-4', { continent: 'EU', country: 'LT' }),
				await buildProbe('socket-5', { continent: 'EU', country: 'DE' }),
				await buildProbe('socket-6', { continent: 'EU', country: 'AT' }),
				await buildProbe('socket-7', { continent: 'EU', country: 'BE' }),
				await buildProbe('socket-8', { continent: 'EU', country: 'BG' }),
				await buildProbe('socket-9', { continent: 'EU', country: 'CZ' }),
				await buildProbe('socket-10', { continent: 'EU', country: 'FR' }),
			];

			setProbes(probes as never);

			const { allProbes: probes1, onlineProbesMap: online1 } = await router.findMatchingProbes({
				locations: [
					{ continent: 'EU', limit: 10 },
				],
			} as UserRequest);
			const { allProbes: probes2, onlineProbesMap: online2 } = await router.findMatchingProbes({
				locations: [
					{ continent: 'EU', limit: 10 },
				],
			} as UserRequest);

			expect(online1.size).to.equal(10);
			expect(probes1.length).to.equal(10);
			expect(online2.size).to.equal(10);
			expect(probes2.length).to.equal(10);
			const countries1 = probes1.map(probe => probe.location.country);
			const countries2 = probes2.map(probe => probe.location.country);
			expect(countries1).to.not.deep.equal(countries2);
		});
	});

	describe('probe readiness', () => {
		it('should find 2 probes', async () => {
			const probes: Array<DeepPartial<ServerProbe>> = [
				await buildProbe('socket-1', { continent: 'EU', country: 'GB' }, { status: 'unbuffer-missing' }),
				await buildProbe('socket-2', { continent: 'EU', country: 'PL' }, { status: 'unbuffer-missing' }),
				await buildProbe('socket-4', { continent: 'EU', country: 'GB' }),
				await buildProbe('socket-5', { continent: 'EU', country: 'PL' }),
			];

			setProbes(probes as never);

			const { onlineProbesMap, allProbes } = await router.findMatchingProbes({
				locations: [
					{ country: 'GB', limit: 2 },
					{ country: 'PL', limit: 2 },
				],
			} as UserRequest);

			expect(onlineProbesMap.size).to.equal(2);
			expect(allProbes.length).to.equal(2);
			expect(allProbes.filter(p => p.location.country === 'GB').length).to.equal(1);
			expect(allProbes.filter(p => p.location.country === 'PL').length).to.equal(1);
		});
	});

	describe('probe filtered by IP version', () => {
		it('should find only probes supporting IPv4', async () => {
			const probes: Array<DeepPartial<ServerProbe>> = [
				await buildProbe('socket-1', { continent: 'EU', country: 'GB' }, { status: 'unbuffer-missing', isIPv4Supported: false, isIPv6Supported: false }),
				await buildProbe('socket-2', { continent: 'EU', country: 'CZ' }, { status: 'ready', isIPv4Supported: true, isIPv6Supported: true }),
				await buildProbe('socket-3', { continent: 'EU', country: 'PL' }, { status: 'ready', isIPv4Supported: true, isIPv6Supported: false }),
				await buildProbe('socket-4', { continent: 'EU', country: 'AU' }, { status: 'ready', isIPv4Supported: false, isIPv6Supported: true }),
			];

			setProbes(probes as never);

			const { onlineProbesMap, allProbes } = await router.findMatchingProbes({
				locations: [
					{ continent: 'EU', limit: 4 },
				],
				measurementOptions: { ipVersion: 4 },
			} as UserRequest);

			expect(onlineProbesMap.size).to.equal(2);
			expect(allProbes.length).to.equal(2);
			expect(allProbes.filter(p => p.location.country === 'CZ').length).to.equal(1);
			expect(allProbes.filter(p => p.location.country === 'PL').length).to.equal(1);
		});

		it('should find only probes supporting IPv6', async () => {
			const probes: Array<DeepPartial<ServerProbe>> = [
				await buildProbe('socket-1', { continent: 'EU', country: 'GB' }, { status: 'unbuffer-missing', isIPv4Supported: false, isIPv6Supported: false }),
				await buildProbe('socket-2', { continent: 'EU', country: 'CZ' }, { status: 'ready', isIPv4Supported: true, isIPv6Supported: true }),
				await buildProbe('socket-3', { continent: 'EU', country: 'PL' }, { status: 'ready', isIPv4Supported: true, isIPv6Supported: false }),
				await buildProbe('socket-4', { continent: 'EU', country: 'AU' }, { status: 'ready', isIPv4Supported: false, isIPv6Supported: true }),
			];

			setProbes(probes as never);

			const { onlineProbesMap, allProbes } = await router.findMatchingProbes({
				locations: [
					{ continent: 'EU', limit: 4 },
				],
				measurementOptions: { ipVersion: 6 },
			} as UserRequest);

			expect(onlineProbesMap.size).to.equal(2);
			expect(allProbes.length).to.equal(2);
			expect(allProbes.filter(p => p.location.country === 'CZ').length).to.equal(1);
			expect(allProbes.filter(p => p.location.country === 'AU').length).to.equal(1);
		});

		it('should find only probes supporting IPv4 by default', async () => {
			const probes: Array<DeepPartial<ServerProbe>> = [
				await buildProbe('socket-1', { continent: 'EU', country: 'GB' }, { status: 'unbuffer-missing', isIPv4Supported: false, isIPv6Supported: false }),
				await buildProbe('socket-2', { continent: 'EU', country: 'CZ' }, { status: 'ready', isIPv4Supported: true, isIPv6Supported: true }),
				await buildProbe('socket-3', { continent: 'EU', country: 'PL' }, { status: 'ready', isIPv4Supported: true, isIPv6Supported: false }),
				await buildProbe('socket-4', { continent: 'EU', country: 'AU' }, { status: 'ready', isIPv4Supported: false, isIPv6Supported: true }),
			];

			setProbes(probes as never);

			const { onlineProbesMap, allProbes } = await router.findMatchingProbes({
				locations: [
					{ continent: 'EU', limit: 4 },
				],
			} as UserRequest);

			expect(onlineProbesMap.size).to.equal(2);
			expect(allProbes.length).to.equal(2);
			expect(allProbes.filter(p => p.location.country === 'CZ').length).to.equal(1);
			expect(allProbes.filter(p => p.location.country === 'PL').length).to.equal(1);
		});
	});

	describe('route globally distributed', () => {
		it('should find probes when each group is full', async () => {
			const probes = await Promise.all([ 'AF', 'AS', 'EU', 'OC', 'NA', 'SA' ]
				.flatMap(continent => _.range(50).map(i => buildProbe(`${continent}-${i}`, { continent }))));

			setProbes(probes as never);

			const { onlineProbesMap, allProbes } = await router.findMatchingProbes({ locations: [], limit: 100 } as unknown as UserRequest);
			const grouped = _.groupBy(allProbes, 'location.continent');

			expect(onlineProbesMap.size).to.equal(100);
			expect(allProbes.length).to.equal(100);
			expect(grouped['AF']?.length).to.equal(5);
			expect(grouped['AS']?.length).to.equal(15);
			expect(grouped['EU']?.length).to.equal(30);
			expect(grouped['OC']?.length).to.equal(10);
			expect(grouped['NA']?.length).to.equal(30);
			expect(grouped['SA']?.length).to.equal(10);
		});

		it('should find probes when some groups are not full', async () => {
			const probes: DeepPartial<ServerProbe[]> = await Promise.all([
				..._.range(15).map(i => buildProbe(`AF-${i}`, { continent: 'AF' })),
				..._.range(15).map(i => buildProbe(`AS-${i}`, { continent: 'AS' })),
				..._.range(20).map(i => buildProbe(`EU-${i}`, { continent: 'EU' })),
				..._.range(10).map(i => buildProbe(`OC-${i}`, { continent: 'OC' })),
				..._.range(20).map(i => buildProbe(`NA-${i}`, { continent: 'NA' })),
				..._.range(30).map(i => buildProbe(`SA-${i}`, { continent: 'SA' })),
			]);

			setProbes(probes as never);

			const { onlineProbesMap, allProbes } = await router.findMatchingProbes({ locations: [], limit: 100 } as unknown as UserRequest);
			const grouped = _.groupBy(allProbes, 'location.continent');

			expect(allProbes.length).to.equal(100);
			expect(onlineProbesMap.size).to.equal(100);
			// Depending on the _.shuffle(globalDistribution) "AF" may be handled before "SA" which leads to {AF: 12, SA: 23}. Or vice-versa, which leads to {AF: 11, SA: 24}
			expect(grouped['AF']?.length).to.be.oneOf([ 11, 12 ]);
			expect(grouped['AS']?.length).to.equal(15);
			expect(grouped['EU']?.length).to.equal(20);
			expect(grouped['OC']?.length).to.equal(10);
			expect(grouped['NA']?.length).to.equal(20);
			expect(grouped['SA']?.length).to.be.oneOf([ 23, 24 ]);
		});

		it('should return exactly the same number of probes if limit can\'t be divided evenly', async () => {
			const probes: DeepPartial<ServerProbe[]> = await Promise.all([
				..._.range(5).map(i => buildProbe(`AF-${i}`, { continent: 'AF' })),
				..._.range(5).map(i => buildProbe(`NA-${i}`, { continent: 'NA' })),
				..._.range(5).map(i => buildProbe(`SA-${i}`, { continent: 'SA' })),
			]);

			setProbes(probes as never);

			const { onlineProbesMap, allProbes } = await router.findMatchingProbes({ locations: [{ continent: 'AF' }, { continent: 'NA' }, { continent: 'SA' }], limit: 7 } as UserRequest);
			expect(allProbes.length).to.equal(7);
			expect(onlineProbesMap.size).to.equal(7);
		});

		it('should find when probes not enough', async () => {
			const probes: DeepPartial<ServerProbe[]> = await Promise.all([
				..._.range(15).map(i => buildProbe(`AF-${i}`, { continent: 'AF' })),
				..._.range(20).map(i => buildProbe(`EU-${i}`, { continent: 'EU' })),
				..._.range(10).map(i => buildProbe(`OC-${i}`, { continent: 'OC' })),
				..._.range(20).map(i => buildProbe(`NA-${i}`, { continent: 'NA' })),
			]);

			setProbes(probes as never);

			const { onlineProbesMap, allProbes } = await router.findMatchingProbes({ locations: [], limit: 100 } as unknown as UserRequest);
			const grouped = _.groupBy(allProbes, 'location.continent');

			expect(allProbes.length).to.equal(65);
			expect(onlineProbesMap.size).to.equal(65);
			expect(grouped['AF']?.length).to.equal(15);
			expect(grouped['EU']?.length).to.equal(20);
			expect(grouped['OC']?.length).to.equal(10);
			expect(grouped['NA']?.length).to.equal(20);
		});

		it('should shuffle result probes', async () => {
			const probes: Array<DeepPartial<ServerProbe>> = [
				await buildProbe('socket-1', { continent: 'EU', country: 'UA' }),
				await buildProbe('socket-2', { continent: 'EU', country: 'PL' }),
				await buildProbe('socket-3', { continent: 'EU', country: 'LV' }),
				await buildProbe('socket-4', { continent: 'EU', country: 'LT' }),
				await buildProbe('socket-5', { continent: 'EU', country: 'DE' }),
				await buildProbe('socket-6', { continent: 'EU', country: 'AT' }),
				await buildProbe('socket-7', { continent: 'EU', country: 'BE' }),
				await buildProbe('socket-8', { continent: 'EU', country: 'BG' }),
				await buildProbe('socket-9', { continent: 'EU', country: 'CZ' }),
				await buildProbe('socket-10', { continent: 'EU', country: 'FR' }),
			];
			setProbes(probes as never);

			const { allProbes: probes1 } = await router.findMatchingProbes({ locations: [], limit: 100 } as unknown as UserRequest);
			const { allProbes: probes2 } = await router.findMatchingProbes({ locations: [], limit: 100 } as unknown as UserRequest);

			expect(probes1.length).to.equal(10);
			expect(probes2.length).to.equal(10);
			const countries1 = probes1.map(probe => probe.location.country);
			const countries2 = probes2.map(probe => probe.location.country);
			expect(countries1).to.not.deep.equal(countries2);
		});
	});

	describe('route with global limit', () => {
		it('should find probes even in overlapping locations', async () => {
			const cache: Record<string, ServerProbe> = {};
			const memoizedBuildSocket = async (id: string, location: ProbeLocation) => {
				const cached = cache[location.country];

				if (cached) {
					return {
						...cached,
					};
				}

				const socket = await buildProbe(id, location);
				cache[location.country] = socket;
				return socket;
			};

			const euSockets: ServerProbe[] = [];

			for (const i of _.range(10_000)) {
				const socket = await memoizedBuildSocket(`PL-${i}`, { continent: 'EU', country: 'PL' } as ProbeLocation);
				euSockets.push(socket as never);
			}

			const uaSocket = await buildProbe(`UA-${1}`, { continent: 'EU', country: 'UA' });
			const probes: DeepPartial<ServerProbe[]> = [ ...euSockets, uaSocket ];
			const locations: Location[] = [
				{ continent: 'EU' },
				{ country: 'UA' },
			];

			setProbes(probes as never);

			const { onlineProbesMap, allProbes } = await router.findMatchingProbes({ locations, limit: 100 } as unknown as UserRequest);
			const grouped = _.groupBy(allProbes, 'location.country');

			expect(allProbes.length).to.equal(100);
			expect(onlineProbesMap.size).to.equal(100);
			expect(grouped['PL']?.length).to.equal(99);
			expect(grouped['UA']?.length).to.equal(1);
		});

		it('should evenly distribute probes', async () => {
			const probes: DeepPartial<ServerProbe[]> = await Promise.all([
				..._.range(5).map(i => buildProbe(`US-${i}`, { country: 'US' })),
				..._.range(5).map(i => buildProbe(`CN-${i}`, { country: 'CN' })),
				..._.range(5).map(i => buildProbe(`AU-${i}`, { country: 'AU' })),
				..._.range(5).map(i => buildProbe(`PL-${i}`, { country: 'PL' })),
			]);
			const locations: Location[] = [
				{ country: 'US' },
				{ country: 'CN' },
				{ country: 'AU' },
				{ country: 'PL' },
			];

			setProbes(probes as never);

			const { onlineProbesMap, allProbes } = await router.findMatchingProbes({ locations, limit: 5 } as unknown as UserRequest);
			const grouped = _.groupBy(allProbes, 'location.country');

			expect(allProbes.length).to.equal(5);
			expect(onlineProbesMap.size).to.equal(5);
			expect(grouped['US']?.length).to.equal(2);
			expect(grouped['CN']?.length).to.equal(1);
			expect(grouped['AU']?.length).to.equal(1);
			expect(grouped['PL']?.length).to.equal(1);
		});

		it('should evenly distribute probes 2', async () => {
			const probes: DeepPartial<ServerProbe[]> = await Promise.all([
				..._.range(5).map(i => buildProbe(`US-${i}`, { country: 'US' })),
				..._.range(5).map(i => buildProbe(`CN-${i}`, { country: 'CN' })),
				..._.range(5).map(i => buildProbe(`AU-${i}`, { country: 'AU' })),
				..._.range(5).map(i => buildProbe(`PL-${i}`, { country: 'PL' })),
			]);
			const locations: Location[] = [
				{ country: 'US' },
				{ country: 'CN' },
				{ country: 'AU' },
				{ country: 'PL' },
			];

			setProbes(probes as never);

			const { onlineProbesMap, allProbes } = await router.findMatchingProbes({ locations, limit: 6 } as unknown as UserRequest);
			const grouped = _.groupBy(allProbes, 'location.country');

			expect(allProbes.length).to.equal(6);
			expect(onlineProbesMap.size).to.equal(6);
			expect(grouped['US']?.length).to.equal(2);
			expect(grouped['CN']?.length).to.equal(2);
			expect(grouped['AU']?.length).to.equal(1);
			expect(grouped['PL']?.length).to.equal(1);
		});

		it('should evenly distribute probes 3', async () => {
			const probes: DeepPartial<ServerProbe[]> = await Promise.all([
				..._.range(100).map(i => buildProbe(`US-${i}`, { country: 'US' })),
				..._.range(10).map(i => buildProbe(`CN-${i}`, { country: 'CN' })),
				..._.range(100).map(i => buildProbe(`AU-${i}`, { country: 'AU' })),
			]);
			const locations: Location[] = [
				{ country: 'US' },
				{ country: 'CN' },
				{ country: 'AU' },
			];

			setProbes(probes as never);

			const { onlineProbesMap, allProbes } = await router.findMatchingProbes({ locations, limit: 60 } as unknown as UserRequest);
			const grouped = _.groupBy(allProbes, 'location.country');

			expect(allProbes.length).to.equal(60);
			expect(onlineProbesMap.size).to.equal(60);
			expect(grouped['US']?.length).to.equal(25);
			expect(grouped['CN']?.length).to.equal(10);
			expect(grouped['AU']?.length).to.equal(25);
		});

		it('should evenly distribute many probes', async () => {
			const probes: DeepPartial<ServerProbe[]> = await Promise.all([
				..._.range(100).map(i => buildProbe(`PL-${i}`, { country: 'PL' })),
				..._.range(100).map(i => buildProbe(`UA-${i}`, { country: 'UA' })),
				..._.range(100).map(i => buildProbe(`NL-${i}`, { country: 'NL' })),
			]);
			const locations: Location[] = [
				{ country: 'PL' },
				{ country: 'UA' },
				{ country: 'NL' },
			];

			setProbes(probes as never);

			const { onlineProbesMap, allProbes } = await router.findMatchingProbes({ locations, limit: 100 } as unknown as UserRequest);
			const grouped = _.groupBy(allProbes, 'location.country');

			expect(allProbes.length).to.equal(100);
			expect(onlineProbesMap.size).to.equal(100);
			expect(grouped['PL']?.length).to.equal(34);
			expect(grouped['UA']?.length).to.equal(33);
			expect(grouped['NL']?.length).to.equal(33);
		});

		it('should shuffle result probes', async () => {
			const probes: Array<DeepPartial<ServerProbe>> = [
				await buildProbe('socket-1', { continent: 'EU', country: 'UA' }),
				await buildProbe('socket-2', { continent: 'EU', country: 'PL' }),
				await buildProbe('socket-3', { continent: 'EU', country: 'LV' }),
				await buildProbe('socket-4', { continent: 'EU', country: 'LT' }),
				await buildProbe('socket-5', { continent: 'EU', country: 'DE' }),
				await buildProbe('socket-6', { continent: 'EU', country: 'AT' }),
				await buildProbe('socket-7', { continent: 'EU', country: 'BE' }),
				await buildProbe('socket-8', { continent: 'EU', country: 'BG' }),
				await buildProbe('socket-9', { continent: 'EU', country: 'CZ' }),
				await buildProbe('socket-10', { continent: 'EU', country: 'FR' }),
			];
			setProbes(probes as never);

			const { allProbes: probes1, onlineProbesMap: online1 } = await router.findMatchingProbes({ locations: [{ continent: 'EU' }], limit: 100 } as unknown as UserRequest);
			const { allProbes: probes2, onlineProbesMap: online2 } = await router.findMatchingProbes({ locations: [{ continent: 'EU' }], limit: 100 } as unknown as UserRequest);

			expect(probes1.length).to.equal(10);
			expect(online1.size).to.equal(10);
			expect(probes2.length).to.equal(10);
			expect(online2.size).to.equal(10);
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
			const probes: DeepPartial<ServerProbe[]> = [
				await buildProbe(String(Date.now()), location),
			];

			const locations: Location[] = [
				{ city: 'new york' },
			];

			setProbes(probes as never);

			const { onlineProbesMap, allProbes } = await router.findMatchingProbes({ locations, limit: 100 } as unknown as UserRequest);

			expect(allProbes.length).to.equal(1);
			expect(onlineProbesMap.size).to.equal(1);
			expect(allProbes[0]!.location.country).to.equal('US');
		});

		it('should not find probe by continent alias if it is used not in magic field', async () => {
			const probes: DeepPartial<ServerProbe[]> = [
				await buildProbe('socket-1', location),
			];

			setProbes(probes as never);
			const { onlineProbesMap, allProbes } = await router.findMatchingProbes({ locations: [{ continent: 'NA' }], limit: 100 } as unknown as UserRequest);
			expect(allProbes.length).to.equal(1);
			expect(onlineProbesMap.size).to.equal(1);
			const { allProbes: probes2 } = await router.findMatchingProbes({ locations: [{ continent: 'North America' }], limit: 100 } as unknown as UserRequest);
			expect(probes2.length).to.equal(0);
		});

		it('should not find probe by region alias if it is used not in magic field', async () => {
			const probes: DeepPartial<ServerProbe[]> = [
				await buildProbe('socket-1', { region: 'Northern Africa' }),
			];

			setProbes(probes as never);

			const { onlineProbesMap, allProbes } = await router.findMatchingProbes({ locations: [{ region: 'Northern Africa' }], limit: 100 } as unknown as UserRequest);
			expect(allProbes.length).to.equal(1);
			expect(onlineProbesMap.size).to.equal(1);
			const { allProbes: probes2 } = await router.findMatchingProbes({ locations: [{ region: 'North Africa' }], limit: 100 } as unknown as UserRequest);
			expect(probes2.length).to.equal(0);
		});
	});

	describe('route with magic location', () => {
		const location = {
			continent: 'EU',
			region: getRegionByCountry('GB'),
			country: 'GB',
			state: null,
			city: 'London',
			normalizedCity: 'london',
			asn: 5089,
			normalizedNetwork: 'a-virgin media',
		};

		it('should return match (continent alias)', async () => {
			const probes: DeepPartial<ServerProbe[]> = [
				await buildProbe(String(Date.now()), location),
			];

			setProbes(probes as never);

			const { onlineProbesMap, allProbes } = await router.findMatchingProbes({ locations: [{ magic: 'europe' }], limit: 100 } as unknown as UserRequest);

			expect(allProbes.length).to.equal(1);
			expect(onlineProbesMap.size).to.equal(1);
			expect(allProbes[0]!.location.country).to.equal('GB');
		});

		it('should return match (region alias)', async () => {
			const probes: DeepPartial<ServerProbe[]> = [
				await buildProbe('socket-1', { region: 'Northern Africa' }),
			];

			setProbes(probes as never);

			const { onlineProbesMap, allProbes } = await router.findMatchingProbes({ locations: [{ magic: 'north africa' }], limit: 100 } as unknown as UserRequest);

			expect(allProbes.length).to.equal(1);
			expect(onlineProbesMap.size).to.equal(1);
			expect(allProbes[0]!.location.region).to.equal('Northern Africa');
		});

		it('should not return match (non-existing region alias)', async () => {
			const probes: DeepPartial<ServerProbe[]> = [
				await buildProbe('socket-1', { region: 'Southern Africa' }),
			];

			setProbes(probes as never);

			const { onlineProbesMap, allProbes } = await router.findMatchingProbes({ locations: [{ magic: 'south africa' }], limit: 100 } as unknown as UserRequest);

			expect(allProbes.length).to.equal(0);
			expect(onlineProbesMap.size).to.equal(0);
		});

		it('should return match (country alias)', async () => {
			const probes: DeepPartial<ServerProbe[]> = [
				await buildProbe('socket-1', location),
			];

			const locations: Location[] = [
				{ magic: 'england' },
			];

			setProbes(probes as never);

			const { onlineProbesMap, allProbes } = await router.findMatchingProbes({ locations, limit: 100 } as unknown as UserRequest);

			expect(allProbes.length).to.equal(1);
			expect(onlineProbesMap.size).to.equal(1);
			expect(allProbes[0]!.location.country).to.equal('GB');
		});

		it('should return match (magic nested)', async () => {
			const probes: DeepPartial<ServerProbe[]> = [
				await buildProbe(String(Date.now()), location),
			];

			const locations: Location[] = [
				{ magic: 'england+as5089' },
			];

			setProbes(probes as never);

			const { onlineProbesMap, allProbes } = await router.findMatchingProbes({ locations, limit: 100 } as unknown as UserRequest);

			expect(allProbes.length).to.equal(1);
			expect(onlineProbesMap.size).to.equal(1);
			expect(allProbes[0]!.location.country).to.equal('GB');
		});

		it('should return result sorted by priority of magic fields in case of partial match', async () => {
			const probes: Array<DeepPartial<ServerProbe>> = [
				await buildProbe('socket-3', { country: 'CZ', normalizedCity: 'praga', normalizedNetwork: 'ultra development networks' }),
				await buildProbe('socket-2', { country: 'RS', normalizedCity: 'belgrade', normalizedNetwork: 'belgrade networks' }),
				await buildProbe('socket-1', { country: 'DE', normalizedCity: 'berlin', normalizedNetwork: 'berlin networks' }),
			];
			setProbes(probes as never);

			const { onlineProbesMap, allProbes } = await router.findMatchingProbes({
				locations: [
					{ magic: 'd' },
				],
				limit: 100,
			} as unknown as UserRequest);

			expect(allProbes.length).to.equal(3);
			expect(onlineProbesMap.size).to.equal(3);
			expect(allProbes[0]!.location.country).to.equal('DE');
			expect(allProbes[1]!.location.country).to.equal('RS');
			expect(allProbes[2]!.location.country).to.equal('CZ');
		});

		it('should ignore low-priority partial matches if there is an exact match', async () => {
			const probes: Array<DeepPartial<ServerProbe>> = [
				await buildProbe('socket-3', { country: 'VN', normalizedCity: 'hanoi', normalizedNetwork: 'ultra networks' }),
				await buildProbe('socket-2', { country: 'RU', normalizedCity: 'vnukovo', normalizedNetwork: 'super networks' }),
				await buildProbe('socket-1', { country: 'HU', normalizedCity: 'budapest', normalizedNetwork: '23VNet Kft' }),
			];
			setProbes(probes as never);

			const { onlineProbesMap, allProbes } = await router.findMatchingProbes({
				locations: [
					{ magic: 'vn' },
				],
				limit: 100,
			} as unknown as UserRequest);

			expect(allProbes.length).to.equal(1);
			expect(onlineProbesMap.size).to.equal(1);
			expect(allProbes[0]!.location.country).to.equal('VN');
		});

		it('should ignore high-priority partial matches if there is an exact match', async () => {
			const probes: Array<DeepPartial<ServerProbe>> = [
				await buildProbe('socket-1', { country: 'PL', normalizedCity: 'warsaw', normalizedNetwork: 'super networks' }),
				await buildProbe('socket-2', { country: 'PL', normalizedCity: 'warsaw', normalizedNetwork: 'wars networks' }),
				await buildProbe('socket-3', { country: 'PL', normalizedCity: 'poznan', normalizedNetwork: 'wars' }),
			];
			setProbes(probes as never);

			const { onlineProbesMap, allProbes } = await router.findMatchingProbes({
				locations: [
					{ magic: 'wars' },
				],
				limit: 100,
			} as unknown as UserRequest);

			expect(allProbes.length).to.equal(2);
			expect(onlineProbesMap.size).to.equal(2);
			expect(allProbes.map(p => p.location.normalizedCity)).to.include.members([ 'warsaw', 'poznan' ]);
		});

		it('should ignore same-level partial matches if there is an exact match', async () => {
			const probes: Array<DeepPartial<ServerProbe>> = [
				await buildProbe('socket-1', { country: 'US', normalizedCity: 'new york' }),
				await buildProbe('socket-2', { country: 'GB', normalizedCity: 'york' }),
			];
			setProbes(probes as never);

			const { onlineProbesMap, allProbes } = await router.findMatchingProbes({
				locations: [
					{ magic: 'york' },
				],
				limit: 100,
			} as unknown as UserRequest);

			expect(allProbes.length).to.equal(1);
			expect(onlineProbesMap.size).to.equal(1);
			expect(allProbes[0]!.location.country).to.equal('GB');
		});

		it('should shuffle result considering priority of magic fields', async () => {
			const probes: Array<DeepPartial<ServerProbe>> = [
				await buildProbe('socket-3', { normalizedCity: 'praga1', country: 'CZ', normalizedNetwork: 'ultra development networks' }),
				await buildProbe('socket-3', { normalizedCity: 'praga2', country: 'CZ', normalizedNetwork: 'ultra development networks' }),
				await buildProbe('socket-3', { normalizedCity: 'praga3', country: 'CZ', normalizedNetwork: 'ultra development networks' }),
				await buildProbe('socket-3', { normalizedCity: 'praga4', country: 'CZ', normalizedNetwork: 'ultra development networks' }),
				await buildProbe('socket-3', { normalizedCity: 'praga5', country: 'CZ', normalizedNetwork: 'ultra development networks' }),
				await buildProbe('socket-3', { normalizedCity: 'praga6', country: 'CZ', normalizedNetwork: 'ultra development networks' }),
				await buildProbe('socket-3', { normalizedCity: 'praga7', country: 'CZ', normalizedNetwork: 'ultra development networks' }),
				await buildProbe('socket-3', { normalizedCity: 'praga8', country: 'CZ', normalizedNetwork: 'ultra development networks' }),
				await buildProbe('socket-3', { normalizedCity: 'praga9', country: 'CZ', normalizedNetwork: 'ultra development networks' }),
				await buildProbe('socket-3', { normalizedCity: 'praga10', country: 'CZ', normalizedNetwork: 'ultra development networks' }),
				await buildProbe('socket-2', { normalizedCity: 'belgrade1', country: 'RS', normalizedNetwork: 'belgrade networks' }),
				await buildProbe('socket-2', { normalizedCity: 'belgrade2', country: 'RS', normalizedNetwork: 'belgrade networks' }),
				await buildProbe('socket-2', { normalizedCity: 'belgrade3', country: 'RS', normalizedNetwork: 'belgrade networks' }),
				await buildProbe('socket-2', { normalizedCity: 'belgrade4', country: 'RS', normalizedNetwork: 'belgrade networks' }),
				await buildProbe('socket-2', { normalizedCity: 'belgrade5', country: 'RS', normalizedNetwork: 'belgrade networks' }),
				await buildProbe('socket-2', { normalizedCity: 'belgrade6', country: 'RS', normalizedNetwork: 'belgrade networks' }),
				await buildProbe('socket-2', { normalizedCity: 'belgrade7', country: 'RS', normalizedNetwork: 'belgrade networks' }),
				await buildProbe('socket-2', { normalizedCity: 'belgrade8', country: 'RS', normalizedNetwork: 'belgrade networks' }),
				await buildProbe('socket-2', { normalizedCity: 'belgrade9', country: 'RS', normalizedNetwork: 'belgrade networks' }),
				await buildProbe('socket-2', { normalizedCity: 'belgrade10', country: 'RS', normalizedNetwork: 'belgrade networks' }),
				await buildProbe('socket-1', { normalizedCity: 'berlin1', country: 'DE', normalizedNetwork: 'berlin networks' }),
				await buildProbe('socket-1', { normalizedCity: 'berlin2', country: 'DE', normalizedNetwork: 'berlin networks' }),
				await buildProbe('socket-1', { normalizedCity: 'berlin3', country: 'DE', normalizedNetwork: 'berlin networks' }),
				await buildProbe('socket-1', { normalizedCity: 'berlin4', country: 'DE', normalizedNetwork: 'berlin networks' }),
				await buildProbe('socket-1', { normalizedCity: 'berlin5', country: 'DE', normalizedNetwork: 'berlin networks' }),
				await buildProbe('socket-1', { normalizedCity: 'berlin6', country: 'DE', normalizedNetwork: 'berlin networks' }),
				await buildProbe('socket-1', { normalizedCity: 'berlin7', country: 'DE', normalizedNetwork: 'berlin networks' }),
				await buildProbe('socket-1', { normalizedCity: 'berlin8', country: 'DE', normalizedNetwork: 'berlin networks' }),
				await buildProbe('socket-1', { normalizedCity: 'berlin9', country: 'DE', normalizedNetwork: 'berlin networks' }),
				await buildProbe('socket-1', { normalizedCity: 'berlin10', country: 'DE', normalizedNetwork: 'berlin networks' }),
			];
			setProbes(probes as never);

			const { allProbes: probes1, onlineProbesMap: online1 } = await router.findMatchingProbes({
				locations: [
					{ magic: 'd' },
				],
				limit: 100,
			} as unknown as UserRequest);
			const { allProbes: probes2, onlineProbesMap: online2 } = await router.findMatchingProbes({
				locations: [
					{ magic: 'd' },
				],
				limit: 100,
			} as unknown as UserRequest);

			expect(probes1.length).to.equal(30);
			expect(online1.size).to.equal(30);
			expect(probes2.length).to.equal(30);
			expect(online2.size).to.equal(30);
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
			const probes: Array<DeepPartial<ServerProbe>> = [
				await buildProbe('socket-3', { normalizedCity: 'praga1', country: 'CZ', normalizedNetwork: 'ultra development networks' }),
				await buildProbe('socket-3', { normalizedCity: 'praga2', country: 'CZ', normalizedNetwork: 'ultra development networks' }),
				await buildProbe('socket-3', { normalizedCity: 'praga3', country: 'CZ', normalizedNetwork: 'ultra development networks' }),
				await buildProbe('socket-2', { normalizedCity: 'belgrade1', country: 'RS', normalizedNetwork: 'belgrade networks' }),
				await buildProbe('socket-2', { normalizedCity: 'belgrade2', country: 'RS', normalizedNetwork: 'belgrade networks' }),
				await buildProbe('socket-2', { normalizedCity: 'belgrade3', country: 'RS', normalizedNetwork: 'belgrade networks' }),
				await buildProbe('socket-1', { normalizedCity: 'berlin1', country: 'DE', normalizedNetwork: 'berlin networks' }),
				await buildProbe('socket-1', { normalizedCity: 'berlin2', country: 'DE', normalizedNetwork: 'berlin networks' }),
				await buildProbe('socket-1', { normalizedCity: 'berlin3', country: 'DE', normalizedNetwork: 'berlin networks' }),
				await buildProbe('socket-1', { normalizedCity: 'berlin4', country: 'DE', normalizedNetwork: 'berlin networks' }),
				await buildProbe('socket-1', { normalizedCity: 'berlin5', country: 'DE', normalizedNetwork: 'berlin networks' }),
				await buildProbe('socket-1', { normalizedCity: 'berlin6', country: 'DE', normalizedNetwork: 'berlin networks' }),
				await buildProbe('socket-1', { normalizedCity: 'berlin7', country: 'DE', normalizedNetwork: 'berlin networks' }),
				await buildProbe('socket-1', { normalizedCity: 'berlin8', country: 'DE', normalizedNetwork: 'berlin networks' }),
				await buildProbe('socket-1', { normalizedCity: 'berlin9', country: 'DE', normalizedNetwork: 'berlin networks' }),
				await buildProbe('socket-1', { normalizedCity: 'berlin10', country: 'DE', normalizedNetwork: 'berlin networks' }),
			];
			setProbes(probes as never);

			const { allProbes: probes1, onlineProbesMap: online1 } = await router.findMatchingProbes({
				locations: [
					{ magic: 'de' },
				],
				limit: 100,
			} as unknown as UserRequest);
			const { allProbes: probes2, onlineProbesMap: online2 } = await router.findMatchingProbes({
				locations: [
					{ magic: 'de' },
				],
				limit: 100,
			} as unknown as UserRequest);

			expect(probes1.length).to.equal(10);
			expect(online1.size).to.equal(10);
			expect(probes2.length).to.equal(10);
			expect(online2.size).to.equal(10);
			expect(probes1.slice(0, 9).every(probe => probe.location.country === 'DE')).to.be.true;
			expect(probes2.slice(0, 9).every(probe => probe.location.country === 'DE')).to.be.true;
			expect(probes1.slice(0, 9).map(probe => probe.location.normalizedCity)).to.not.deep.equal(probes2.slice(0, 9).map(probe => probe.location.normalizedCity));
		});

		describe('Location type - Network', () => {
			for (const testCase of [ 'a-virgin', 'virgin', 'media' ]) {
				it(`should match network - ${testCase}`, async () => {
					const probes: DeepPartial<ServerProbe[]> = [
						await buildProbe(String(Date.now()), location),
					];

					const locations: Location[] = [
						{ magic: testCase },
					];

					setProbes(probes as never);

					const { onlineProbesMap, allProbes } = await router.findMatchingProbes({ locations, limit: 100 } as unknown as UserRequest);

					expect(allProbes.length).to.equal(1);
					expect(onlineProbesMap.size).to.equal(1);
					expect(allProbes[0]!.location.country).to.equal('GB');
				});
			}
		});

		describe('Location type - ASN', () => {
			for (const testCase of [ '5089', 'as5089' ]) {
				it(`should match ASN - ${testCase}`, async () => {
					const probes: DeepPartial<ServerProbe[]> = [
						await buildProbe(String(Date.now()), location),
					];

					const locations: Location[] = [
						{ magic: testCase },
					];

					setProbes(probes as never);

					const { onlineProbesMap, allProbes } = await router.findMatchingProbes({ locations, limit: 100 } as unknown as UserRequest);

					expect(allProbes.length).to.equal(1);
					expect(onlineProbesMap.size).to.equal(1);
					expect(allProbes[0]!.location.country).to.equal('GB');
				});
			}
		});

		describe('Location type - State', () => {
			for (const testCase of [ 'dc', 'district of columbia', 'district', 'us-dc' ]) {
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

					const probes: DeepPartial<ServerProbe[]> = [
						await buildProbe(String(Date.now()), location),
					];

					const locations: Location[] = [
						{ magic: testCase },
					];

					setProbes(probes as never);

					const { onlineProbesMap, allProbes } = await router.findMatchingProbes({ locations, limit: 100 } as unknown as UserRequest);

					expect(allProbes.length).to.equal(1);
					expect(onlineProbesMap.size).to.equal(1);
					expect(allProbes[0]!.location.country).to.equal('US');
				});
			}
		});

		describe('Location type - tag', () => {
			for (const testCase of [ 'aws-eu', 'west 1' ]) {
				it(`should match tag - ${testCase}`, async () => {
					getCloudTagsMock.returns([ 'aws-eu-west-1', 'aws' ]);
					const probes: DeepPartial<ServerProbe[]> = [
						await buildProbe(String(Date.now()), location),
					];

					const locations: Location[] = [
						{ magic: testCase },
					];

					setProbes(probes as never);

					const { onlineProbesMap, allProbes } = await router.findMatchingProbes({ locations, limit: 100 } as unknown as UserRequest);

					expect(allProbes.length).to.equal(1);
					expect(onlineProbesMap.size).to.equal(1);
					expect(allProbes[0]!.location.country).to.equal('GB');
				});
			}
		});
	});

	describe('route with tags location', () => {
		const location = {
			continent: 'EU',
			region: getRegionByCountry('GB'),
			country: 'GB',
			state: null,
			city: 'london',
			normalizedCity: 'london',
			asn: 5089,
			network: 'a-virgin media',
			normalizedNetwork: 'a-virgin media',
		};

		it('should return match for existing tag', async () => {
			getCloudTagsMock.returns([ 'aws-eu-west-1', 'aws' ]);
			const probes: DeepPartial<ServerProbe[]> = [
				await buildProbe(String(Date.now()), location),
			];

			const locations: Location[] = [
				{ tags: [ 'aws-eu-west-1' ] },
			];

			setProbes(probes as never);

			const { onlineProbesMap, allProbes } = await router.findMatchingProbes({ locations, limit: 100 } as unknown as UserRequest);

			expect(allProbes.length).to.equal(1);
			expect(onlineProbesMap.size).to.equal(1);
			expect(allProbes[0]!.location.country).to.equal('GB');
		});

		it('should return 0 matches for partial tag value', async () => {
			getCloudTagsMock.returns([ 'aws-eu-west-1', 'aws' ]);
			const probes: DeepPartial<ServerProbe[]> = [
				await buildProbe(String(Date.now()), location),
			];

			const locations: Location[] = [
				{ tags: [ 'tag-v' ] },
			];

			setProbes(probes as never);

			const { onlineProbesMap, allProbes } = await router.findMatchingProbes({ locations, limit: 100 } as unknown as UserRequest);
			expect(allProbes.length).to.equal(0);
			expect(onlineProbesMap.size).to.equal(0);
		});

		it('should return match for user tag', async () => {
			const probe = await buildProbe(String(Date.now()), location, {
				tags: [{ type: 'user', value: 'u-MartinKolarik:DashboardTag' }],
				normalizedTags: [{ type: 'user', value: 'u-martinkolarik:dashboardtag' }],
			});

			const probes: DeepPartial<ServerProbe[]> = [ probe ];

			const locations: Location[] = [
				{ tags: [ 'u-martinkolarik:dashboardtag' ] },
			];

			setProbes(probes as never);

			const { onlineProbesMap, allProbes } = await router.findMatchingProbes({ locations, limit: 100 } as unknown as UserRequest);
			expect(allProbes.length).to.equal(1);
			expect(onlineProbesMap.size).to.equal(1);
			expect(allProbes[0]!.location.country).to.equal('GB');
		});

		it('should combine tags filter with other filters', async () => {
			getCloudTagsMock.returns([ 'aws-eu-west-1', 'aws' ]);
			const probes: DeepPartial<ServerProbe[]> = [
				await buildProbe(String(Date.now()), location),
			];

			const locations: Location[] = [{
				city: 'paris',
				tags: [ 'aws-eu-west-1' ],
			}];

			setProbes(probes as never);

			const { onlineProbesMap, allProbes } = await router.findMatchingProbes({ locations, limit: 100 } as unknown as UserRequest);

			expect(allProbes.length).to.equal(0);
			expect(onlineProbesMap.size).to.equal(0);
		});
	});

	describe('route with measurement id string', async () => {
		it('should find probes by prev measurement id', async () => {
			const probes: Array<DeepPartial<ServerProbe>> = [
				await buildProbe('socket-1', { continent: 'EU', country: 'PL' }),
			];
			setProbes(probes as never);
			store.getMeasurementIps.resolves([ '1.2.3.4' ]);

			store.getMeasurement.resolves({
				results: [{
					probe: {
						continent: 'EU',
						country: 'PL',
						city: 'Warsaw',
						network: 'Liberty Global B.V.',
						tags: [],
					},
				}],
			});

			const { onlineProbesMap, allProbes, request } = await router.findMatchingProbes({ locations: mockedMeasurementId } as UserRequest);

			expect(request).to.deep.equal({ limit: undefined, locations: undefined });
			expect(store.getMeasurementIps.args[0]).to.deep.equal([ mockedMeasurementId ]);
			expect(store.getMeasurement.args[0]).to.deep.equal([ mockedMeasurementId ]);
			expect(allProbes[0]!.location.country).to.equal('PL');
			expect(allProbes[0]!.status).to.equal('ready');
			expect(onlineProbesMap.get(0)?.location.country).to.equal('PL');
		});

		it('should find probes by prev measurement id in magic field', async () => {
			const probes: Array<DeepPartial<ServerProbe>> = [
				await buildProbe('socket-1', { continent: 'EU', country: 'PL' }),
			];
			setProbes(probes as never);
			store.getMeasurementIps.resolves([ '1.2.3.4' ]);

			store.getMeasurement.resolves({
				results: [{
					probe: {
						continent: 'EU',
						country: 'PL',
						city: 'Warsaw',
						network: 'Liberty Global B.V.',
						tags: [],
					},
				}],
			});

			const { onlineProbesMap, allProbes, request } = await router.findMatchingProbes({ locations: [{ magic: mockedMeasurementId }] } as UserRequest);

			expect(request).to.deep.equal({ limit: undefined, locations: undefined });
			expect(store.getMeasurementIps.args[0]).to.deep.equal([ mockedMeasurementId ]);
			expect(store.getMeasurement.args[0]).to.deep.equal([ mockedMeasurementId ]);
			expect(allProbes[0]!.location.country).to.equal('PL');
			expect(allProbes[0]!.status).to.equal('ready');
			expect(onlineProbesMap.get(0)?.location.country).to.equal('PL');
		});

		it('should find probes by prev measurement id that are now connected by another ip', async () => {
			const probes: Array<DeepPartial<ServerProbe>> = [
				await buildProbe('socket-1', { continent: 'EU', country: 'PL' }, { ipAddress: '2.2.2.2', altIpAddresses: [ '1.2.3.4' ] }),
			];
			setProbes(probes as never);
			store.getMeasurementIps.resolves([ '1.2.3.4' ]);

			store.getMeasurement.resolves({
				results: [{
					probe: {
						continent: 'EU',
						country: 'PL',
						city: 'Warsaw',
						network: 'Liberty Global B.V.',
						tags: [],
					},
				}],
			});

			const { onlineProbesMap, allProbes, request } = await router.findMatchingProbes({ locations: mockedMeasurementId } as UserRequest);

			expect(request).to.deep.equal({ limit: undefined, locations: undefined });
			expect(store.getMeasurementIps.args[0]).to.deep.equal([ mockedMeasurementId ]);
			expect(store.getMeasurement.args[0]).to.deep.equal([ mockedMeasurementId ]);
			expect(allProbes[0]!.location.country).to.equal('PL');
			expect(allProbes[0]!.status).to.equal('ready');
			expect(onlineProbesMap.get(0)?.location.country).to.equal('PL');
		});

		it('should not find probes without errors by prev measurement id in magic field if no such measurement found', async () => {
			const probes: Array<DeepPartial<ServerProbe>> = [
				await buildProbe('socket-1', { continent: 'EU', country: 'PL' }),
			];
			setProbes(probes as never);

			const { onlineProbesMap, allProbes, request } = await router.findMatchingProbes({ locations: [{ magic: mockedMeasurementId }] } as UserRequest);

			expect(request).to.deep.equal({ locations: [{ magic: mockedMeasurementId }] });
			expect(store.getMeasurementIps.args[0]).to.deep.equal([ mockedMeasurementId ]);
			expect(store.getMeasurement.args[0]).to.deep.equal([ mockedMeasurementId ]);
			expect(allProbes.length).to.equal(0);
			expect(onlineProbesMap.size).to.equal(0);
		});

		it('should return proper values for locations and limit in request object', async () => {
			const probes: Array<DeepPartial<ServerProbe>> = [
				await buildProbe('socket-1', { continent: 'EU', country: 'PL' }),
			];
			setProbes(probes as never);
			store.getMeasurementIps.resolves([ '1.2.3.4', '1.2.3.4' ]);

			store.getMeasurement.resolves({
				limit: 2,
				locations: [{
					continent: 'EU',
				}],
				results: [{
					probe: {
						continent: 'EU',
						country: 'PL',
						city: 'Warsaw',
						network: 'Liberty Global B.V.',
						tags: [],
					},
				}, {
					probe: {
						continent: 'EU',
						country: 'PL',
						city: 'Warsaw',
						network: 'Liberty Global B.V.',
						tags: [],
					},
				}],
			});

			const { request } = await router.findMatchingProbes({ locations: [{ magic: mockedMeasurementId }] } as UserRequest);

			expect(request).to.deep.equal({ locations: [{ continent: 'EU' }], limit: 2 });
		});

		it('should replace non-connected probes with offline probe data', async () => {
			const probes: Array<DeepPartial<ServerProbe>> = [
				await buildProbe('socket-1', { continent: 'EU', country: 'PL' }),
			];
			setProbes(probes as never);
			store.getMeasurementIps.resolves([ '9.9.9.9' ]);

			store.getMeasurement.resolves({
				results: [{
					probe: {
						continent: 'EU',
						country: 'PL',
						city: 'Warsaw',
						network: 'Liberty Global B.V.',
						tags: [],
					},
				}],
			});

			const { onlineProbesMap, allProbes, request } = await router.findMatchingProbes({ locations: mockedMeasurementId } as UserRequest);

			expect(request).to.deep.equal({ locations: undefined, limit: undefined });
			expect(store.getMeasurementIps.args[0]).to.deep.equal([ mockedMeasurementId ]);
			expect(store.getMeasurement.args[0]).to.deep.equal([ mockedMeasurementId ]);
			expect(allProbes.length).to.equal(1);
			expect(allProbes[0]!.location.country).to.equal('PL');
			expect(allProbes[0]!.status).to.equal('offline');
			expect(onlineProbesMap.size).to.equal(0);
		});

		it('should return empty data if measurement ips wasn\'t found', async () => {
			const probes: Array<DeepPartial<ServerProbe>> = [
				await buildProbe('socket-1', { continent: 'EU', country: 'PL' }),
			];
			setProbes(probes as never);
			store.getMeasurementIps.resolves([]);

			store.getMeasurement.resolves({
				results: [{
					probe: {
						continent: 'EU',
						country: 'PL',
						city: 'Warsaw',
						network: 'Liberty Global B.V.',
						tags: [],
					},
				}],
			});

			const { onlineProbesMap, allProbes } = await router.findMatchingProbes({ locations: mockedMeasurementId } as UserRequest);

			expect(store.getMeasurementIps.args[0]).to.deep.equal([ mockedMeasurementId ]);
			expect(allProbes.length).to.equal(0);
			expect(onlineProbesMap.size).to.equal(0);
		});

		it('should return empty data if measurement itself wasn\'t found', async () => {
			const probes: Array<DeepPartial<ServerProbe>> = [
				await buildProbe('socket-1', { continent: 'EU', country: 'PL' }),
			];
			setProbes(probes as never);
			store.getMeasurementIps.resolves([ '9.9.9.9' ]);

			store.getMeasurement.resolves(null);

			const { onlineProbesMap, allProbes } = await router.findMatchingProbes({ locations: mockedMeasurementId } as UserRequest);

			expect(store.getMeasurementIps.args[0]).to.deep.equal([ mockedMeasurementId ]);
			expect(store.getMeasurement.args[0]).to.deep.equal([ mockedMeasurementId ]);
			expect(allProbes.length).to.equal(0);
			expect(onlineProbesMap.size).to.equal(0);
		});

		it(`should return same result if placed in 'locations' or 'magic' fields`, async () => {
			const probes: Array<DeepPartial<ServerProbe>> = [
				await buildProbe('socket-1', { continent: 'EU', country: 'PL' }),
			];
			setProbes(probes as never);
			store.getMeasurementIps.resolves([ '1.2.3.4' ]);

			store.getMeasurement.resolves({
				results: [{
					probe: {
						continent: 'EU',
						country: 'PL',
						city: 'Warsaw',
						network: 'Liberty Global B.V.',
						tags: [],
					},
				}],
			});

			const locationsResult = await router.findMatchingProbes({ locations: mockedMeasurementId, measurementOptions: { ipVersion: 6 } } as UserRequest);
			const magicResult = await router.findMatchingProbes({ locations: [{ magic: mockedMeasurementId }], measurementOptions: { ipVersion: 6 } } as UserRequest);

			expect(locationsResult.allProbes[0]!.location.country).to.equal('PL');
			expect(locationsResult.allProbes[0]!.status).to.equal('ready');
			expect(locationsResult.onlineProbesMap.get(0)?.location.country).to.equal('PL');

			expect(magicResult.allProbes[0]!.location.country).to.equal('PL');
			expect(magicResult.allProbes[0]!.status).to.equal('ready');
			expect(magicResult.onlineProbesMap.get(0)?.location.country).to.equal('PL');
		});
	});
});

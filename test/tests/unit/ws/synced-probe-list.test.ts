import * as sinon from 'sinon';
import { expect } from 'chai';

import type { WsServerNamespace } from '../../../../src/lib/ws/server.js';
import { SyncedProbeList } from '../../../../src/lib/ws/synced-probe-list.js';
import { type AdoptedProbe, AdoptedProbes } from '../../../../src/lib/adopted-probes.js';
import type { Probe } from '../../../../src/probe/types.js';
import { getRegionByCountry } from '../../../../src/lib/location/location.js';
import { getRedisClient } from '../../../../src/lib/redis/client.js';
import { ProbeOverride } from '../../../../src/lib/probe-override.js';
import { AdminData } from '../../../../src/lib/admin-data.js';

describe('SyncedProbeList', () => {
	const sandbox = sinon.createSandbox();
	const redisClient = getRedisClient();
	const localFetchSocketsStub = sandbox.stub();
	const redisXAdd = sandbox.stub(redisClient, 'xAdd');
	const redisXRange = sandbox.stub(redisClient, 'xRange');
	const redisPExpire = sandbox.stub(redisClient, 'pExpire');
	const redisJsonGet = sandbox.stub(redisClient.json, 'get');

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

	const ioNamespace = {
		local: {
			fetchSockets: localFetchSocketsStub,
		},
	} as unknown as WsServerNamespace;

	const adoptedProbes = sandbox.createStubInstance(AdoptedProbes);
	const adminData = new AdminData(sandbox.stub() as any);
	const probeOverride = new ProbeOverride(adoptedProbes, adminData);

	let syncedProbeList: SyncedProbeList;

	beforeEach(() => {
		redisXRange.resolves([]);
		redisJsonGet.callThrough();
		redisPExpire.callThrough();
		localFetchSocketsStub.resolves([]);
		adoptedProbes.getUpdatedLocation.callThrough();
		adoptedProbes.getUpdatedTags.callThrough();
		adoptedProbes.getUpdatedProbes.callThrough();

		syncedProbeList = new SyncedProbeList(redisClient, ioNamespace, probeOverride);
	});

	afterEach(() => {
		syncedProbeList.unscheduleSync();
		sandbox.reset();
	});

	it('updates and emits local probes during sync', async () => {
		const sockets = [
			{ data: { probe: { client: 'A', location: {} } } },
			{ data: { probe: { client: 'B', location: {} } } },
		];

		localFetchSocketsStub.resolves(sockets);
		await syncedProbeList.sync();

		expect(localFetchSocketsStub.callCount).to.equal(1);
		expect(syncedProbeList.getProbes()).to.deep.equal(sockets.map(s => s.data.probe));

		expect(redisXAdd.callCount).to.equal(1);
		expect(redisXAdd.firstCall.args[2]).to.deep.include({ r: '1' });
		expect(redisXAdd.firstCall.args[2]).to.not.have.property('s');

		localFetchSocketsStub.resolves(sockets.slice(1));
		await syncedProbeList.sync();

		expect(localFetchSocketsStub.callCount).to.equal(2);
		expect(syncedProbeList.getProbes()).to.deep.equal(sockets.slice(1).map(s => s.data.probe));

		expect(redisXAdd.callCount).to.equal(2);
		expect(redisXAdd.secondCall.args[2]).to.deep.include({ '-': 'A' });
		expect(redisXAdd.secondCall.args[2]).to.not.have.property('+');
		expect(redisXAdd.secondCall.args[2]).to.not.have.property('s');

		localFetchSocketsStub.resolves(sockets);
		await syncedProbeList.sync();

		expect(localFetchSocketsStub.callCount).to.equal(3);
		expect(syncedProbeList.getProbes()).to.deep.equal(sockets.map(s => s.data.probe));

		expect(redisXAdd.callCount).to.equal(3);
		expect(redisXAdd.thirdCall.args[2]).to.deep.include({ '+': 'A' });
		expect(redisXAdd.thirdCall.args[2]).to.not.have.property('-');
		expect(redisXAdd.thirdCall.args[2]).to.not.have.property('s');
	});

	it('emits stats in the message on change', async () => {
		const sockets = [
			{ data: { probe: { client: 'A', location: {}, stats: { cpu: { count: 1, load: [{ idle: 0, usage: 0 }] }, jobs: { count: 0 } } } } },
			{ data: { probe: { client: 'B', location: {}, stats: { cpu: { count: 1, load: [{ idle: 0, usage: 0 }] }, jobs: { count: 0 } } } } },
			{ data: { probe: { client: 'C', location: {}, stats: { cpu: { count: 1, load: [{ idle: 0, usage: 0 }] }, jobs: { count: 0 } } } } },
		];

		localFetchSocketsStub.resolves(sockets);
		await syncedProbeList.sync();

		expect(localFetchSocketsStub.callCount).to.equal(1);
		expect(syncedProbeList.getProbes()).to.deep.equal(sockets.map(s => s.data.probe));

		expect(redisXAdd.callCount).to.equal(1);

		sockets.slice(1).forEach(socket => socket.data.probe.stats.jobs.count = 1);
		localFetchSocketsStub.resolves(sockets);
		await syncedProbeList.sync();

		expect(localFetchSocketsStub.callCount).to.equal(2);
		expect(syncedProbeList.getProbes()).to.deep.equal(sockets.map(s => s.data.probe));

		expect(redisXAdd.callCount).to.equal(2);

		// @ts-expect-error the arg must be an object
		expect(JSON.parse(redisXAdd.secondCall.args[2].s)).to.deep.equal({
			B: '1,0,0',
			C: '1,0,0',
		});

		expect(redisXAdd.secondCall.args[2]).to.not.have.property('r');
		expect(redisXAdd.secondCall.args[2]).to.not.have.property('+');
		expect(redisXAdd.secondCall.args[2]).to.not.have.property('-');

		localFetchSocketsStub.resolves(sockets);
		await syncedProbeList.sync();

		expect(localFetchSocketsStub.callCount).to.equal(3);
		expect(syncedProbeList.getProbes()).to.deep.equal(sockets.map(s => s.data.probe));

		expect(redisXAdd.callCount).to.equal(3);
		expect(redisXAdd.thirdCall.args[2]).to.not.have.property('s');
		expect(redisXAdd.thirdCall.args[2]).to.not.have.property('r');
		expect(redisXAdd.thirdCall.args[2]).to.not.have.property('+');
		expect(redisXAdd.thirdCall.args[2]).to.not.have.property('-');

		sockets[1]!.data.probe.client = 'D';
		sockets.slice(2).forEach(socket => socket.data.probe.stats.jobs.count = 2);
		localFetchSocketsStub.resolves(sockets);
		await syncedProbeList.sync();

		expect(localFetchSocketsStub.callCount).to.equal(4);
		expect(syncedProbeList.getProbes()).to.deep.equal(sockets.map(s => s.data.probe));

		expect(redisXAdd.callCount).to.equal(4);

		// @ts-expect-error the arg must be an object
		expect(JSON.parse(redisXAdd.args[3][2].s)).to.deep.equal({
			C: '2,0,0',
		});

		expect(redisXAdd.args[3]![2]).to.deep.include({ '+': 'D', '-': 'B' });
		expect(redisXAdd.args[3]![2]).to.not.have.property('r');
	});

	it('refreshes remote TTL when needed', async () => {
		syncedProbeList.remoteDataTtl = 20 * 1000;

		const sockets = [
			{ data: { probe: { client: 'A' } } },
			{ data: { probe: { client: 'B' } } },
		];

		localFetchSocketsStub.resolves(sockets);
		await syncedProbeList.syncPush();

		expect(redisPExpire.callCount).to.equal(1);

		await syncedProbeList.sync();
		expect(redisPExpire.callCount).to.equal(1);

		let elapsed = 0;

		// Simulate running for the duration of syncedProbeList.remoteDataTtl.
		while ((elapsed += syncedProbeList.syncInterval) < syncedProbeList.remoteDataTtl / 2) {
			await clock.tickAsync(syncedProbeList.syncInterval);
			await syncedProbeList.sync();
		}

		await clock.tickAsync(2 * syncedProbeList.syncInterval);
		await syncedProbeList.sync();
		expect(redisPExpire.callCount).to.equal(2);
	});

	it('reads remote stats updates', async () => {
		const probes = {
			A: { client: 'A', location: {}, stats: { cpu: { count: 1, load: [{ idle: 0, usage: 0 }] }, jobs: { count: 0 } } },
			B: { client: 'B', location: {}, stats: { cpu: { count: 1, load: [{ idle: 0, usage: 0 }] }, jobs: { count: 0 } } },
			C: { client: 'C', location: {}, stats: { cpu: { count: 1, load: [{ idle: 0, usage: 0 }] }, jobs: { count: 0 } } },
		} as unknown as Record<string, Probe>;

		redisXRange.resolves([
			{ id: '1-1', message: { n: 'remote', r: '1' } },
		]);

		redisJsonGet.resolves({
			nodeId: 'remote',
			probesById: probes,
			changeTimestamp: Date.now(),
			revalidateTimestamp: Date.now(),
		});

		await syncedProbeList.sync();
		expect(syncedProbeList.getProbes()).to.deep.equal(Object.values(probes));

		redisXRange.resolves([
			{ id: '1-1', message: {} },
			{ id: '1-2', message: { n: 'remote', s: '{"B":"1,0,0","C":"1,0,0"}' } },
		]);

		await syncedProbeList.sync();
		expect(syncedProbeList.getProbes()[0]?.stats).to.deep.include({ jobs: { count: 0 } });
		expect(syncedProbeList.getProbes()[1]?.stats).to.deep.include({ jobs: { count: 1 } });
		expect(syncedProbeList.getProbes()[2]?.stats).to.deep.include({ jobs: { count: 1 } });
	});

	it('should do a full reload if some removed events were missed', async () => {
		redisXRange.resolves([
			{ id: '1-1', message: { n: 'remote', a: '1' } },
		]);

		redisJsonGet.resolves({
			nodeId: 'remote',
			probesById: {},
			changeTimestamp: Date.now(),
			revalidateTimestamp: Date.now(),
		});

		await syncedProbeList.syncPull();
		expect(redisJsonGet.callCount).to.equal(1);

		redisXRange.resolves([
			{ id: '1-1', message: { n: 'remote', a: '1' } },
			{ id: '1-2', message: { n: 'remote', a: '1' } },
		]);

		await syncedProbeList.syncPull();
		expect(redisJsonGet.callCount).to.equal(1);

		redisXRange.resolves([
			{ id: '1-3', message: { n: 'remote', a: '1' } },
		]);

		await syncedProbeList.syncPull();
		expect(redisJsonGet.callCount).to.equal(2);
	});

	it('expires remote probes after the timeout', async () => {
		const probes = {
			A: { client: 'A', location: {} },
			B: { client: 'B', location: {} },
		} as unknown as Record<string, Probe>;

		redisXRange.resolves([
			{ id: '1-1', message: { n: 'remote', r: '1' } },
		]);

		redisJsonGet.resolves({
			nodeId: 'remote',
			probesById: probes,
			changeTimestamp: Date.now(),
			revalidateTimestamp: Date.now(),
		});

		await syncedProbeList.sync();
		expect(syncedProbeList.getProbes()).to.deep.equal(Object.values(probes));

		await syncedProbeList.sync();
		expect(syncedProbeList.getProbes()).to.deep.equal(Object.values(probes));

		await clock.tickAsync(syncedProbeList.syncTimeout + 100);
		expect(syncedProbeList.getProbes()).to.be.empty;
	});

	it('applies adoption data to getProbes()/fetchProbes() but not to getRawProbes()', async () => {
		const sockets = [
			{ data: { probe: { client: 'A', location: { ...location }, tags: [], ipAddress: '1.1.1.1' } } },
			{ data: { probe: { client: 'B', location: { ...location }, tags: [] } } },
		];

		const tags = [{ type: 'user', value: 'u-name-tag1' }] as AdoptedProbe['tags'];
		const adoptedProbe = { tags } as AdoptedProbe;

		localFetchSocketsStub.resolves(sockets);
		adoptedProbes.getByIp.withArgs('1.1.1.1').returns(adoptedProbe);

		const fetchedProbesPromise = syncedProbeList.fetchProbes();
		clock.tick(1);

		await syncedProbeList.sync();
		const fetchedProbes = await fetchedProbesPromise;

		expect(localFetchSocketsStub.callCount).to.equal(1);
		expect(syncedProbeList.getProbes()[0]).to.deep.include({ tags });
		expect(syncedProbeList.getProbes()[1]).not.to.deep.include({ tags });

		expect(fetchedProbes[0]).to.deep.include({ tags });
		expect(fetchedProbes[1]).not.to.deep.include({ tags });

		expect(syncedProbeList.getRawProbes()[0]).not.to.deep.include({ tags });
		expect(syncedProbeList.getRawProbes()[1]).not.to.deep.include({ tags });
	});

	it('resolves fetchProbes() only after new data arrives', async () => {
		const fetchedProbesPromise = syncedProbeList.fetchProbes();

		let resolved;
		fetchedProbesPromise.then(() => resolved = true).catch(() => {});

		await syncedProbeList.sync();
		expect(resolved).to.be.undefined;

		await clock.tickAsync(syncedProbeList.syncInterval);
		expect(resolved).to.be.undefined;

		await syncedProbeList.sync();
		await clock.nextAsync();
		expect(resolved).to.be.true;
	});
});

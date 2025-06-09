import * as sinon from 'sinon';
import { expect } from 'chai';

import { type WsServerNamespace } from '../../../../src/lib/ws/server.js';
import { SyncedProbeList } from '../../../../src/lib/ws/synced-probe-list.js';
import type { Probe } from '../../../../src/probe/types.js';
import { getRegionByCountry } from '../../../../src/lib/location/location.js';
import { getRedisClient, RedisClient } from '../../../../src/lib/redis/client.js';
import { ProbeOverride } from '../../../../src/lib/override/probe-override.js';
import { initSubscriptionRedisClient } from '../../../../src/lib/redis/subscription-client.js';

describe('SyncedProbeList', () => {
	const sandbox = sinon.createSandbox();
	const redisClient = getRedisClient().duplicate();
	let subRedisClient: RedisClient;
	const localFetchSocketsStub = sandbox.stub();
	const redisXAdd = sandbox.stub(redisClient, 'xAdd');
	const redisXRange = sandbox.stub(redisClient, 'xRange');
	const redisPExpire = sandbox.stub(redisClient, 'pExpire');
	const redisJsonGet = sandbox.stub(redisClient.json, 'get');
	const redisPublish = sandbox.stub(redisClient, 'publish');
	let redisSubscribe: sinon.SinonStub;
	redisClient.connect();

	const idToIp = {
		A: '1.1.1.1',
		B: '2.2.2.2',
		C: '3.3.3.3',
	};

	const getProbe = (id: 'A' | 'B' | 'C') => ({
		client: id,
		ipAddress: idToIp[id],
		altIpAddresses: [],
		location: {
			continent: 'NA',
			region: getRegionByCountry('US'),
			country: 'US',
			state: 'NY',
			city: 'The New York City',
			normalizedCity: 'new york',
			asn: 5089,
			normalizedNetwork: 'abc',
		},
		stats: { cpu: { load: [{ usage: 0 }] }, jobs: { count: 0 } },
	} as unknown as Probe);

	const ioNamespace = {
		local: {
			fetchSockets: localFetchSocketsStub,
		},
	} as unknown as WsServerNamespace;

	const probeOverride = sandbox.createStubInstance(ProbeOverride);

	let syncedProbeList: SyncedProbeList;

	beforeEach(async () => {
		redisXRange.resolves([]);
		redisJsonGet.callThrough();
		redisPExpire.callThrough();
		localFetchSocketsStub.resolves([]);
		probeOverride.addAdminData.returnsArg(0);
		probeOverride.addAdoptedData.returnsArg(0);

		subRedisClient = await initSubscriptionRedisClient();
		redisSubscribe = sandbox.stub(subRedisClient, 'subscribe');
		syncedProbeList = new SyncedProbeList(redisClient, subRedisClient, ioNamespace, probeOverride);
	});

	afterEach(() => {
		syncedProbeList.unscheduleSync();
		sandbox.reset();
	});

	it('updates and emits local probes during sync', async () => {
		const sockets = [
			{ data: { probe: getProbe('A') } },
			{ data: { probe: getProbe('B') } },
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
			{ data: { probe: getProbe('A') } },
			{ data: { probe: getProbe('B') } },
			{ data: { probe: getProbe('C') } },
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
			B: '1,0',
			C: '1,0',
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
			C: '2,0',
		});

		expect(redisXAdd.args[3]![2]).to.deep.include({ '+': 'D', '-': 'B' });
		expect(redisXAdd.args[3]![2]).to.not.have.property('r');
	});

	it('refreshes remote TTL when needed', async () => {
		syncedProbeList.remoteDataTtl = 20 * 1000;

		const sockets = [
			{ data: { probe: getProbe('A') } },
			{ data: { probe: getProbe('B') } },
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
			A: getProbe('A'),
			B: getProbe('B'),
			C: getProbe('C'),
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
			A: getProbe('A'),
			B: getProbe('B'),
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

	it('applies adoption data to getProbes()/fetchProbes()/getProbeByIp() but not to getRawProbes()/getProbesWithAdminData()', async () => {
		const probe1 = getProbe('A');
		const probe2 = getProbe('B');
		const sockets = [{ data: { probe: probe1 } }, { data: { probe: probe2 } }];

		const tags = [{ type: 'user', value: 'u-name:tag1' }] as Probe['tags'];

		const adoptedData = { tags } as Probe;

		localFetchSocketsStub.resolves(sockets);
		probeOverride.addAdoptedData.reset();
		probeOverride.addAdoptedData.returns([{ ...probe1, ...adoptedData }, probe2 ]);

		const fetchedProbesPromise = syncedProbeList.fetchProbes();
		clock.tick(1);

		await syncedProbeList.sync();
		const fetchedProbes = await fetchedProbesPromise;

		expect(localFetchSocketsStub.callCount).to.equal(1);
		expect(syncedProbeList.getProbes()[0]).to.deep.include({ tags });
		expect(syncedProbeList.getProbes()[1]).not.to.deep.include({ tags });

		expect(fetchedProbes[0]).to.deep.include({ tags });
		expect(fetchedProbes[1]).not.to.deep.include({ tags });

		expect(syncedProbeList.getProbeByIp('1.1.1.1')).to.deep.include({ tags });
		expect(syncedProbeList.getProbeByIp('2.2.2.2')).not.to.deep.include({ tags });

		expect(syncedProbeList.getProbesWithAdminData()[0]).not.to.deep.include({ tags });
		expect(syncedProbeList.getProbesWithAdminData()[1]).not.to.deep.include({ tags });

		expect(syncedProbeList.getRawProbes()[0]).not.to.deep.include({ tags });
		expect(syncedProbeList.getRawProbes()[1]).not.to.deep.include({ tags });
	});

	it('applies admin location override data to getProbes()/fetchProbes()/getProbeByIp()/getProbesWithAdminData() but not to getRawProbes()', async () => {
		const probe1 = getProbe('A');
		const probe2 = getProbe('B');
		const sockets = [{ data: { probe: probe1 } }, { data: { probe: probe2 } }];

		const updatedProbe1 = { ...probe1, location: { ...probe1.location, city: 'Miami' } } as unknown as Probe;

		localFetchSocketsStub.resolves(sockets);
		probeOverride.addAdminData.reset();
		probeOverride.addAdminData.returns([ updatedProbe1, probe2 ]);

		const fetchedProbesPromise = syncedProbeList.fetchProbes();
		clock.tick(1);

		await syncedProbeList.sync();
		const fetchedProbes = await fetchedProbesPromise;

		expect(localFetchSocketsStub.callCount).to.equal(1);
		expect(syncedProbeList.getProbes()[0]?.location.city).to.deep.equal('Miami');
		expect(syncedProbeList.getProbes()[1]?.location.city).to.deep.equal('The New York City');

		expect(fetchedProbes[0]?.location.city).to.deep.equal('Miami');
		expect(fetchedProbes[1]?.location.city).to.deep.equal('The New York City');

		expect(syncedProbeList.getProbesWithAdminData()[0]?.location.city).to.deep.equal('Miami');
		expect(syncedProbeList.getProbesWithAdminData()[1]?.location.city).to.deep.equal('The New York City');

		expect(syncedProbeList.getProbeByIp('1.1.1.1')?.location.city).to.deep.equal('Miami');
		expect(syncedProbeList.getProbeByIp('2.2.2.2')?.location.city).to.deep.equal('The New York City');

		expect(syncedProbeList.getRawProbes()[0]?.location.city).to.deep.equal('The New York City');
		expect(syncedProbeList.getRawProbes()[1]?.location.city).to.deep.equal('The New York City');
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

	it('is able to publish messages directly to another nodes', async () => {
		const nodeId = syncedProbeList.getNodeId();
		const body = { data: 1 };

		await syncedProbeList.publishToNode('anotherNodeId', 'MESSAGE_TYPE', body);

		expect(redisPublish.callCount).to.equal(1);
		expect(redisPublish.firstCall.args[0]).to.equal('gp:spl:pub-sub:anotherNodeId');

		expect(JSON.parse(redisPublish.firstCall.args[1] as string)).to.deep.include({
			reqNodeId: nodeId,
			type: 'MESSAGE_TYPE',
			body,
		});
	});

	it('is able to read direct messages from another nodes', async () => {
		const message = {
			id: 'messageId',
			reqNodeId: 'reqNodeId',
			type: 'MESSAGE_TYPE',
			body: {
				data: 1,
			},
		};
		let receivedMessage: typeof message;
		await syncedProbeList.subscribeToNodeMessages<any>('MESSAGE_TYPE', (m) => { receivedMessage = m; });

		expect(redisSubscribe.callCount).to.equal(1);
		expect(redisSubscribe.args[0]?.[0]).to.equal(`gp:spl:pub-sub:${syncedProbeList.getNodeId()}`);
		const redisSubscriptionCallback = redisSubscribe.args[0]?.[1];

		await redisSubscriptionCallback!(JSON.stringify(message), `gp:spl:pub-sub:${syncedProbeList.getNodeId()}`);

		expect(receivedMessage!).to.deep.equal(message);
	});

	it(`errors in subscription callbacks doesn't affect execution of other callbacks`, async () => {
		const message = {
			id: 'messageId',
			reqNodeId: 'reqNodeId',
			type: 'MESSAGE_TYPE',
			body: {
				data: 1,
			},
		};
		let receivedMessage: typeof message;
		await syncedProbeList.subscribeToNodeMessages<any>('MESSAGE_TYPE', () => { throw new Error('Handling message error'); });
		await syncedProbeList.subscribeToNodeMessages<any>('MESSAGE_TYPE', (m) => { receivedMessage = m; });

		expect(redisSubscribe.callCount).to.equal(1);
		expect(redisSubscribe.args[0]?.[0]).to.equal(`gp:spl:pub-sub:${syncedProbeList.getNodeId()}`);
		const redisSubscriptionCallback = redisSubscribe.args[0]?.[1];

		await redisSubscriptionCallback!(JSON.stringify(message), `gp:spl:pub-sub:${syncedProbeList.getNodeId()}`);

		expect(receivedMessage!).to.deep.equal(message);
	});
});

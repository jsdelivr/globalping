import * as sinon from 'sinon';
import { expect } from 'chai';

import type { WsServerNamespace } from '../../../../src/lib/ws/server.js';
import { SyncedProbeList } from '../../../../src/lib/ws/synced-probe-list.js';
import { type AdoptedProbe, AdoptedProbes } from '../../../../src/lib/adopted-probes.js';
import type { Probe } from '../../../../src/probe/types.js';
import { getRegionByCountry } from '../../../../src/lib/location/location.js';

describe('SyncedProbeList', () => {
	const sandbox = sinon.createSandbox();
	const onStub = sandbox.stub();
	const serverSideEmitStub = sandbox.stub();
	const localFetchSocketsStub = sandbox.stub();

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
		on: onStub,
		serverSideEmit: serverSideEmitStub,
		local: {
			fetchSockets: localFetchSocketsStub,
		},
	} as unknown as WsServerNamespace;

	const adoptedProbes = sandbox.createStubInstance(AdoptedProbes);

	let syncedProbeList: SyncedProbeList;
	let updateHandler: SyncedProbeList['handleUpdate'];

	beforeEach(() => {
		localFetchSocketsStub.resolves([]);
		onStub.callsFake((_e, h) => updateHandler = h);
		adoptedProbes.getUpdatedLocation.callThrough();
		adoptedProbes.getUpdatedTags.callThrough();

		syncedProbeList = new SyncedProbeList(ioNamespace, adoptedProbes);
	});

	afterEach(() => {
		sandbox.reset();
	});

	it('updates and emits local probes during sync', async () => {
		const sockets = [
			{ data: { probe: { client: 'A' } } },
			{ data: { probe: { client: 'B' } } },
		];

		localFetchSocketsStub.resolves(sockets);

		await syncedProbeList.sync();

		expect(localFetchSocketsStub.callCount).to.equal(1);
		expect(syncedProbeList.getProbes()).to.deep.equal(sockets.map(s => s.data.probe));

		localFetchSocketsStub.resolves(sockets.slice(1));

		await syncedProbeList.sync();

		expect(localFetchSocketsStub.callCount).to.equal(2);
		expect(syncedProbeList.getProbes()).to.deep.equal(sockets.slice(1).map(s => s.data.probe));
	});

	it('expires remote probes after the timeout', async () => {
		const probes = [
			{ client: 'A' },
			{ client: 'B' },
		] as Probe[];

		updateHandler({
			nodeId: 'remote',
			probes,
			timestamp: Date.now(),
		});

		expect(syncedProbeList.getProbes()).to.deep.equal(probes);

		await syncedProbeList.sync();
		expect(syncedProbeList.getProbes()).to.deep.equal(probes);

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

import { expect } from 'chai';
import * as sinon from 'sinon';
import relativeDayUtc from 'relative-day-utc';
import { AdoptedProbes, Row } from '../../../../src/lib/override/adopted-probes.js';
import type { Probe } from '../../../../src/probe/types.js';

describe('AdoptedProbes', () => {
	const defaultAdoption: Row = {
		id: 'p-1',
		name: 'probe-1',
		userId: '3cff97ae-4a0a-4f34-9f1a-155e6def0a45',
		ip: '1.1.1.1',
		altIps: '[]',
		uuid: '1-1-1-1-1',
		lastSyncDate: new Date(),
		tags: '[{"prefix":"jimaek","value":"dashboardtag"}]',
		systemTags: '["datacenter-network"]',
		isCustomCity: 0,
		status: 'ready',
		isIPv4Supported: 1,
		isIPv6Supported: 1,
		version: '0.26.0',
		nodeVersion: 'v18.17.0',
		hardwareDevice: null,
		hardwareDeviceFirmware: null,
		country: 'IE',
		state: null,
		countryOfCustomCity: '',
		city: 'Dublin',
		latitude: 53.33,
		longitude: -6.25,
		asn: 16509,
		network: 'Amazon.com, Inc.',
		githubUsername: 'jimaek',
		publicProbes: 0,
		adoptionToken: null,
	};

	const defaultConnectedProbe: Probe = {
		ipAddress: '1.1.1.1',
		altIpAddresses: [],
		uuid: '1-1-1-1-1',
		status: 'ready',
		isIPv4Supported: true,
		isIPv6Supported: true,
		version: '0.26.0',
		nodeVersion: 'v18.17.0',
		location: {
			continent: 'EU',
			region: 'Northern Europe',
			country: 'IE',
			state: null,
			city: 'Dublin',
			normalizedCity: 'dublin',
			asn: 16509,
			latitude: 53.33,
			longitude: -6.25,
			network: 'Amazon.com, Inc.',
			normalizedNetwork: 'amazon.com, inc.',
		},
		isHardware: false,
		hardwareDevice: null,
		hardwareDeviceFirmware: null,
		tags: [{
			type: 'system',
			value: 'datacenter-network',
		}],
		index: [],
		client: '',
		host: '',
		resolvers: [],
		stats: {
			cpu: {
				load: [],
			},
			jobs: { count: 0 },
		},
		hostInfo: {
			totalMemory: 0,
			totalDiskSize: 0,
			availableDiskSpace: 0,
		},
		adoptionToken: null,
	};

	const sandbox = sinon.createSandbox();

	const sql = {
		select: sandbox.stub(),
		update: sandbox.stub(),
		delete: sandbox.stub(),
		raw: sandbox.stub(),
		where: sandbox.stub(),
		orWhere: sandbox.stub(),
		whereIn: sandbox.stub(),
		whereNotNull: sandbox.stub(),
		leftJoin: sandbox.stub(),
		orderByRaw: sandbox.stub(),
		insert: sandbox.stub(),
	} as any;
	const sqlStub = sandbox.stub() as any;
	sqlStub.raw = sql.raw;
	const getProbesWithAdminData = sandbox.stub();

	beforeEach(() => {
		sandbox.reset();
		sql.select.returns(sql);
		sql.update.returns(sql);
		sql.delete.returns(sql);
		sql.raw.returns(sql);
		sql.where.returns(sql);
		sql.orWhere.returns(sql);
		sql.whereIn.returns(sql);
		sql.leftJoin.returns(sql);
		sql.orderByRaw.returns(sql);
		sql.select.resolves([ defaultAdoption ]);
		sqlStub.returns(sql);
		getProbesWithAdminData.returns([ defaultConnectedProbe ]);
		process.env['SHOULD_SYNC_ADOPTIONS'] = 'true';
	});

	after(() => {
		delete process.env['SHOULD_SYNC_ADOPTIONS'];
	});

	it('syncDashboardData method should sync the data', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub, getProbesWithAdminData);

		expect(sqlStub.callCount).to.equal(0);
		expect(sql.select.callCount).to.equal(0);

		await adoptedProbes.syncDashboardData();

		expect(sqlStub.callCount).to.equal(1);
		expect(sqlStub.args[0]).deep.equal([ 'gp_probes' ]);
		expect(sql.select.callCount).to.equal(1);
	});

	it('syncDashboardData method should fetch adoption data even without SHOULD_SYNC_ADOPTIONS', async () => {
		delete process.env['SHOULD_SYNC_ADOPTIONS'];
		const adoptedProbes = new AdoptedProbes(sqlStub, getProbesWithAdminData);

		expect(sqlStub.callCount).to.equal(0);
		expect(sql.select.callCount).to.equal(0);

		await adoptedProbes.syncDashboardData();

		expect(sqlStub.callCount).to.equal(1);
		expect(sqlStub.args[0]).deep.equal([ 'gp_probes' ]);
		expect(sql.select.callCount).to.equal(1);
		expect(sql.where.callCount).to.equal(1);
		const builder = sql.where.args[0][0];
		builder(sql);
		expect(sql.whereNotNull.callCount).to.equal(1);
		expect(sql.whereNotNull.args[0]).to.deep.equal([ 'userId' ]);
	});

	it('class should match dProbe to probe by: UUID', async () => {
		sql.select.resolves([
			{ ...defaultAdoption, ip: 'unsyncedIp' },
			{ ...defaultAdoption, id: 'p-2', uuid: 'unsyncedUuid' },
			{ ...defaultAdoption, id: 'p-3', ip: '2.2.2.2', uuid: '2-2-2-2-2', altIps: '[]' },
			{ ...defaultAdoption, id: 'p-4', ip: '3.3.3.3', uuid: '3-3-3-3-3', altIps: '["2.2.2.2"]' },
		]);

		getProbesWithAdminData.returns([{ ...defaultConnectedProbe, altIpAddresses: [ '2.2.2.2' ] }]);

		const adoptedProbes = new AdoptedProbes(sqlStub, getProbesWithAdminData);
		await adoptedProbes.syncDashboardData();

		expect(sql.update.callCount).to.equal(2);

		expect(sql.where.args[1]).to.deep.equal([{ id: 'p-1' }]);
		expect(sql.update.args[0]).to.deep.equal([{ ip: '1.1.1.1', altIps: '["2.2.2.2"]' }]);

		expect(sql.where.args[2]).to.deep.equal([{ id: 'p-4' }]);
		expect(sql.update.args[1]).to.deep.equal([{ status: 'offline', altIps: '[]' }]);

		expect(sql.whereIn.args[0]).to.deep.equal([ 'id', [ 'p-2', 'p-3' ] ]);
		expect(sql.delete.callCount).to.equal(1);
		expect(sql.insert.callCount).to.equal(0);
	});

	it('class should match dProbe to probe by: adoption IP -> probe IP', async () => {
		sql.select.resolves([
			{ ...defaultAdoption, uuid: 'unsyncedUuid' },
			{ ...defaultAdoption, id: 'p-2', ip: '2.2.2.2', uuid: '2-2-2-2-2', altIps: '[]' },
			{ ...defaultAdoption, id: 'p-3', ip: '3.3.3.3', uuid: '3-3-3-3-3', altIps: '["2.2.2.2"]' },
		]);

		getProbesWithAdminData.returns([{ ...defaultConnectedProbe, altIpAddresses: [ '2.2.2.2' ] }]);

		const adoptedProbes = new AdoptedProbes(sqlStub, getProbesWithAdminData);
		await adoptedProbes.syncDashboardData();

		expect(sql.update.callCount).to.equal(2);

		expect(sql.where.args[1]).to.deep.equal([{ id: 'p-1' }]);
		expect(sql.update.args[0]).to.deep.equal([{ uuid: '1-1-1-1-1', altIps: '["2.2.2.2"]' }]);

		expect(sql.where.args[2]).to.deep.equal([{ id: 'p-3' }]);
		expect(sql.update.args[1]).to.deep.equal([{ status: 'offline', altIps: '[]' }]);

		expect(sql.whereIn.args[0]).to.deep.equal([ 'id', [ 'p-2' ] ]);
		expect(sql.delete.callCount).to.equal(1);
		expect(sql.insert.callCount).to.equal(0);
	});

	it('class should match dProbe to probe by: adoption IP -> probe alt IP', async () => {
		sql.select.resolves([
			{ ...defaultAdoption, id: 'p-2', ip: '2.2.2.2', uuid: '2-2-2-2-2', altIps: '[]' },
			{ ...defaultAdoption, id: 'p-3', ip: '3.3.3.3', uuid: '3-3-3-3-3', altIps: '["2.2.2.2"]' },
		]);

		getProbesWithAdminData.returns([{ ...defaultConnectedProbe, altIpAddresses: [ '2.2.2.2' ] }]);

		const adoptedProbes = new AdoptedProbes(sqlStub, getProbesWithAdminData);
		await adoptedProbes.syncDashboardData();

		expect(sql.update.callCount).to.equal(2);

		expect(sql.where.args[1]).to.deep.equal([{ id: 'p-2' }]);
		expect(sql.update.args[0]).to.deep.equal([{ uuid: '1-1-1-1-1', ip: '1.1.1.1', altIps: '["2.2.2.2"]' }]);

		expect(sql.where.args[2]).to.deep.equal([{ id: 'p-3' }]);
		expect(sql.update.args[1]).to.deep.equal([{ status: 'offline', altIps: '[]' }]);
		expect(sql.delete.callCount).to.equal(0);
		expect(sql.insert.callCount).to.equal(0);
	});

	it('class should match dProbe to probe by: adoption alt IP -> probe IP', async () => {
		sql.select.resolves([
			{ ...defaultAdoption, ip: '3.3.3.3', uuid: '3-3-3-3-3', altIps: '["1.1.1.1"]' },
		]);

		getProbesWithAdminData.returns([ defaultConnectedProbe ]);

		const adoptedProbes = new AdoptedProbes(sqlStub, getProbesWithAdminData);
		await adoptedProbes.syncDashboardData();

		expect(sql.where.callCount).to.equal(2);
		expect(sql.update.callCount).to.equal(1);
		expect(sql.where.args[1]).to.deep.equal([{ id: 'p-1' }]);
		expect(sql.update.args[0]).to.deep.equal([{ uuid: '1-1-1-1-1', ip: '1.1.1.1', altIps: '[]' }]);
		expect(sql.delete.callCount).to.equal(0);
		expect(sql.insert.callCount).to.equal(0);
	});

	it('class should match dProbe to probe by: adoption alt IP -> probe alt IP', async () => {
		sql.select.resolves([
			{ ...defaultAdoption, ip: '3.3.3.3', uuid: '3-3-3-3-3', altIps: '["2.2.2.2"]' },
		]);

		getProbesWithAdminData.returns([{ ...defaultConnectedProbe, altIpAddresses: [ '2.2.2.2' ] }]);

		const adoptedProbes = new AdoptedProbes(sqlStub, getProbesWithAdminData);
		await adoptedProbes.syncDashboardData();

		expect(sql.where.callCount).to.equal(2);
		expect(sql.update.callCount).to.equal(1);
		expect(sql.where.args[1]).to.deep.equal([{ id: 'p-1' }]);
		expect(sql.update.args[0]).to.deep.equal([{ uuid: '1-1-1-1-1', ip: '1.1.1.1' }]);
		expect(sql.delete.callCount).to.equal(0);
		expect(sql.insert.callCount).to.equal(0);
	});

	it('class should match dProbe to probe by: offline dProbe token+asn+city -> probe token+asn+city', async () => {
		sql.select.resolves([{ ...defaultAdoption, status: 'offline', adoptionToken: 'adoptionTokenValue' }]);

		getProbesWithAdminData.returns([{ ...defaultConnectedProbe, ipAddress: '2.2.2.2', uuid: '2-2-2-2-2', altIpAddresses: [ '2.2.2.2' ], adoptionToken: 'adoptionTokenValue' }]);

		const adoptedProbes = new AdoptedProbes(sqlStub, getProbesWithAdminData);
		await adoptedProbes.syncDashboardData();

		expect(sql.where.callCount).to.equal(2);
		expect(sql.update.callCount).to.equal(1);
		expect(sql.where.args[1]).to.deep.equal([{ id: 'p-1' }]);

		expect(sql.update.args[0]).to.deep.equal([{
			uuid: '2-2-2-2-2',
			ip: '2.2.2.2',
			altIps: '["2.2.2.2"]',
			status: 'ready',
		}]);

		expect(sql.delete.callCount).to.equal(0);
		expect(sql.insert.callCount).to.equal(0);
	});

	it('class should not use already matched probes in search by: offline dProbe token+asn+city -> probe token+asn+city', async () => {
		sql.select.resolves([
			defaultAdoption,
			{ ...defaultAdoption, status: 'offline', ip: '2.2.2.2', uuid: '2-2-2-2-2', adoptionToken: 'adoptionTokenValue' },
		]);

		getProbesWithAdminData.returns([{ ...defaultConnectedProbe, adoptionToken: 'adoptionTokenValue' }]);

		const adoptedProbes = new AdoptedProbes(sqlStub, getProbesWithAdminData);
		await adoptedProbes.syncDashboardData();

		expect(sql.update.callCount).to.equal(0);
		expect(sql.delete.callCount).to.equal(0);
		expect(sql.insert.callCount).to.equal(0);
	});

	it('class should update status to "offline" if probe was not found', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub, getProbesWithAdminData);
		sql.select.resolves([{ ...defaultAdoption, lastSyncDate: relativeDayUtc(-15) }]);
		getProbesWithAdminData.returns([]);

		await adoptedProbes.syncDashboardData();

		expect(sql.where.callCount).to.equal(2);
		expect(sql.update.callCount).to.equal(1);
		expect(sql.update.args[0]).to.deep.equal([{ status: 'offline' }]);
		expect(sql.delete.callCount).to.equal(0);
		expect(sql.insert.callCount).to.equal(0);
	});

	it('class should do nothing if probe was not found but it is already "offline"', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub, getProbesWithAdminData);
		sql.select.resolves([{ ...defaultAdoption, lastSyncDate: relativeDayUtc(-15), status: 'offline' }]);
		getProbesWithAdminData.returns([]);

		await adoptedProbes.syncDashboardData();

		expect(sql.where.callCount).to.equal(1);
		expect(sql.update.callCount).to.equal(0);
		expect(sql.delete.callCount).to.equal(0);
		expect(sql.insert.callCount).to.equal(0);
	});

	it('class should update lastSyncDate if probe is connected', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub, getProbesWithAdminData);
		sql.select.resolves([{ ...defaultAdoption, lastSyncDate: relativeDayUtc(-15) }]);

		await adoptedProbes.syncDashboardData();

		expect(sql.where.callCount).to.equal(2);
		expect(sql.where.args[1]).to.deep.equal([{ id: 'p-1' }]);
		expect(sql.update.callCount).to.equal(1);
		expect(sql.update.firstCall.args[0].lastSyncDate).to.be.greaterThanOrEqual(relativeDayUtc());
		expect(sql.delete.callCount).to.equal(0);
		expect(sql.insert.callCount).to.equal(0);
	});

	it('class should not update anything if lastSyncDate is today', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub, getProbesWithAdminData);

		await adoptedProbes.syncDashboardData();

		expect(sql.where.callCount).to.equal(1);
		expect(sql.update.callCount).to.equal(0);
		expect(sql.delete.callCount).to.equal(0);
		expect(sql.insert.callCount).to.equal(0);
	});

	it('class should update probe meta info if it is outdated and "isCustomCity: false"', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub, getProbesWithAdminData);

		getProbesWithAdminData.returns([
			{
				ipAddress: '1.1.1.1',
				altIpAddresses: [] as string[],
				uuid: '1-1-1-1-1',
				status: 'initializing',
				isIPv4Supported: false,
				isIPv6Supported: false,
				version: '0.27.0',
				nodeVersion: 'v18.17.1',
				isHardware: true,
				hardwareDevice: 'v1',
				hardwareDeviceFirmware: 'v2.2',
				tags: [
					{ type: 'system', value: 'eyeball-network' },
				],
				location: {
					continent: 'EU',
					region: 'Northern Europe',
					country: 'GB',
					state: null,
					city: 'London',
					asn: 20473,
					latitude: 51.51,
					longitude: -0.13,
					network: 'The Constant Company, LLC',
				},
			} as Probe,
		]);

		await adoptedProbes.syncDashboardData();

		expect(sql.where.callCount).to.equal(2);
		expect(sql.where.args[1]).to.deep.equal([{ id: 'p-1' }]);
		expect(sql.update.callCount).to.equal(1);

		expect(sql.update.args[0]).to.deep.equal([{
			status: 'initializing',
			isIPv4Supported: false,
			isIPv6Supported: false,
			version: '0.27.0',
			nodeVersion: 'v18.17.1',
			hardwareDevice: 'v1',
			hardwareDeviceFirmware: 'v2.2',
			systemTags: '["eyeball-network"]',
			asn: 20473,
			network: 'The Constant Company, LLC',
			country: 'GB',
			city: 'London',
			latitude: 51.51,
			longitude: -0.13,
		}]);

		expect(sql.insert.callCount).to.equal(0);
	});

	it('class should update country and send notification if country of the probe changes', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub, getProbesWithAdminData);
		const defaultAdoptions = [
			defaultAdoption,
			{
				...defaultAdoption,
				id: 'p-9',
				ip: '9.9.9.9',
				uuid: '9-9-9-9-9',
				name: 'probe-gb-london-01',
			}];

		sql.select.resolves(defaultAdoptions.map(probe => ({ ...probe, countryOfCustomCity: 'IE', isCustomCity: 1 })));

		getProbesWithAdminData.returns([
			{
				ipAddress: '1.1.1.1',
				altIpAddresses: [] as string[],
				uuid: '1-1-1-1-1',
				status: 'initializing',
				isIPv4Supported: false,
				isIPv6Supported: false,
				version: '0.27.0',
				nodeVersion: 'v18.17.0',
				isHardware: false,
				hardwareDevice: null,
				hardwareDeviceFirmware: null,
				tags: [
					{ type: 'system', value: 'datacenter-network' },
				],
				location: {
					continent: 'EU',
					region: 'Northern Europe',
					country: 'GB',
					state: null,
					city: 'London',
					asn: 20473,
					latitude: 51.51,
					longitude: -0.13,
					network: 'The Constant Company, LLC',
				},
			} as Probe,
			{
				ipAddress: '9.9.9.9',
				altIpAddresses: [] as string[],
				uuid: '9-9-9-9-9',
				status: 'initializing',
				isIPv4Supported: false,
				isIPv6Supported: false,
				version: '0.27.0',
				nodeVersion: 'v18.17.0',
				isHardware: false,
				hardwareDevice: null,
				hardwareDeviceFirmware: null,
				tags: [
					{ type: 'system', value: 'datacenter-network' },
				],
				location: {
					continent: 'EU',
					region: 'Northern Europe',
					country: 'GB',
					state: null,
					city: 'London',
					asn: 20473,
					latitude: 51.51,
					longitude: -0.13,
					network: 'The Constant Company, LLC',
				},
			} as Probe,
		]);

		await adoptedProbes.syncDashboardData();

		expect(sql.raw.callCount).to.equal(2);

		expect(sql.raw.args[0]![1]).to.deep.equal({
			recipient: '3cff97ae-4a0a-4f34-9f1a-155e6def0a45',
			subject: 'Your probe\'s location has changed',
			message: 'Globalping detected that your probe [**probe-1**](/probes/p-1) with IP address **1.1.1.1** has changed its location from Ireland to United Kingdom. The custom city value "Dublin" is not applied anymore.\n\nIf this change is not right, please report it in [this issue](https://github.com/jsdelivr/globalping/issues/268).',
		});

		expect(sql.raw.args[1]![1]).to.deep.equal({
			recipient: '3cff97ae-4a0a-4f34-9f1a-155e6def0a45',
			subject: 'Your probe\'s location has changed',
			message: 'Globalping detected that your probe [**probe-gb-london-01**](/probes/p-9) with IP address **9.9.9.9** has changed its location from Ireland to United Kingdom. The custom city value "Dublin" is not applied anymore.\n\nIf this change is not right, please report it in [this issue](https://github.com/jsdelivr/globalping/issues/268).',
		});

		expect(sql.where.callCount).to.equal(3);
		expect(sql.where.args[1]).to.deep.equal([{ id: 'p-1' }]);
		expect(sql.where.args[2]).to.deep.equal([{ id: 'p-9' }]);
		expect(sql.update.callCount).to.equal(2);

		expect(sql.update.args[0]).to.deep.equal([
			{
				status: 'initializing',
				isIPv4Supported: false,
				isIPv6Supported: false,
				version: '0.27.0',
				asn: 20473,
				network: 'The Constant Company, LLC',
				country: 'GB',
			},
		]);

		expect(sql.update.args[1]).to.deep.equal([
			{
				status: 'initializing',
				isIPv4Supported: false,
				isIPv6Supported: false,
				version: '0.27.0',
				asn: 20473,
				network: 'The Constant Company, LLC',
				country: 'GB',
			},
		]);

		sql.select.resolves(defaultAdoptions.map(probe => ({ ...probe, country: 'GB', countryOfCustomCity: 'IE', isCustomCity: 1 })));

		getProbesWithAdminData.returns([
			{
				ipAddress: '1.1.1.1',
				altIpAddresses: [] as string[],
				uuid: '1-1-1-1-1',
				status: 'initializing',
				isIPv4Supported: false,
				isIPv6Supported: false,
				version: '0.27.0',
				nodeVersion: 'v18.17.0',
				isHardware: false,
				hardwareDevice: null,
				hardwareDeviceFirmware: null,
				tags: [
					{ type: 'system', value: 'datacenter-network' },
				],
				location: {
					continent: 'EU',
					region: 'Northern Europe',
					country: 'IE',
					state: null,
					city: 'London',
					asn: 20473,
					latitude: 51.51,
					longitude: -0.13,
					network: 'The Constant Company, LLC',
				},
			} as Probe,
			{
				ipAddress: '9.9.9.9',
				altIpAddresses: [] as string[],
				uuid: '9-9-9-9-9',
				status: 'initializing',
				isIPv4Supported: false,
				isIPv6Supported: false,
				version: '0.27.0',
				nodeVersion: 'v18.17.0',
				isHardware: false,
				hardwareDevice: null,
				hardwareDeviceFirmware: null,
				tags: [
					{ type: 'system', value: 'datacenter-network' },
				],
				location: {
					continent: 'EU',
					region: 'Northern Europe',
					country: 'IE',
					state: null,
					city: 'London',
					asn: 20473,
					latitude: 51.51,
					longitude: -0.13,
					network: 'The Constant Company, LLC',
				},
			} as Probe,
		]);

		await adoptedProbes.syncDashboardData();

		expect(sql.raw.callCount).to.equal(4);

		expect(sql.raw.args[2]![1]).to.deep.equal({
			recipient: '3cff97ae-4a0a-4f34-9f1a-155e6def0a45',
			subject: 'Your probe\'s location has changed back',
			message: 'Globalping detected that your probe [**probe-1**](/probes/p-1) with IP address **1.1.1.1** has changed its location back from United Kingdom to Ireland. The custom city value "Dublin" is now applied again.',
		});

		expect(sql.raw.args[3]![1]).to.deep.equal({
			recipient: '3cff97ae-4a0a-4f34-9f1a-155e6def0a45',
			subject: `Your probe's location has changed back`,
			message: 'Globalping detected that your probe [**probe-gb-london-01**](/probes/p-9) with IP address **9.9.9.9** has changed its location back from United Kingdom to Ireland. The custom city value "Dublin" is now applied again.',
		});

		expect(sql.where.callCount).to.equal(6);
		expect(sql.where.args[4]).to.deep.equal([{ id: 'p-1' }]);
		expect(sql.where.args[5]).to.deep.equal([{ id: 'p-9' }]);
		expect(sql.update.callCount).to.equal(4);

		expect(sql.update.args[2]).to.deep.equal([
			{
				status: 'initializing',
				isIPv4Supported: false,
				isIPv6Supported: false,
				version: '0.27.0',
				asn: 20473,
				network: 'The Constant Company, LLC',
				country: 'IE',
			},
		]);

		expect(sql.update.args[3]).to.deep.equal([
			{
				status: 'initializing',
				isIPv4Supported: false,
				isIPv6Supported: false,
				version: '0.27.0',
				asn: 20473,
				network: 'The Constant Company, LLC',
				country: 'IE',
			},
		]);

		expect(sql.insert.callCount).to.equal(0);
	});

	it('class should partially update probe meta info if it is outdated and "isCustomCity: true"', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub, getProbesWithAdminData);
		sql.select.resolves([{ ...defaultAdoption, countryOfCustomCity: 'IE', isCustomCity: 1 }]);

		getProbesWithAdminData.returns([
			{
				ipAddress: '1.1.1.1',
				altIpAddresses: [] as string[],
				uuid: '1-1-1-1-1',
				status: 'initializing',
				isIPv4Supported: false,
				isIPv6Supported: false,
				version: '0.27.0',
				nodeVersion: 'v18.17.0',
				isHardware: false,
				hardwareDevice: null,
				hardwareDeviceFirmware: null,
				tags: [
					{ type: 'system', value: 'datacenter-network' },
				],
				location: {
					continent: 'EU',
					region: 'Northern Europe',
					country: 'GB',
					state: null,
					city: 'London',
					asn: 20473,
					latitude: 51.51,
					longitude: -0.13,
					network: 'The Constant Company, LLC',
				},
			} as Probe,
		]);

		await adoptedProbes.syncDashboardData();

		expect(sql.where.callCount).to.equal(2);
		expect(sql.where.args[1]).to.deep.equal([{ id: 'p-1' }]);
		expect(sql.update.callCount).to.equal(1);

		expect(sql.update.args[0]).to.deep.equal([{
			status: 'initializing',
			isIPv4Supported: false,
			isIPv6Supported: false,
			version: '0.27.0',
			country: 'GB',
			asn: 20473,
			network: 'The Constant Company, LLC',
		}]);

		expect(sql.insert.callCount).to.equal(0);
	});

	it('class should not update probe meta info if it is actual', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub, getProbesWithAdminData);

		await adoptedProbes.syncDashboardData();

		expect(sql.where.callCount).to.equal(1);
		expect(sql.update.callCount).to.equal(0);
		expect(sql.delete.callCount).to.equal(0);
		expect(sql.insert.callCount).to.equal(0);
	});

	it('class should treat null and undefined values as equal', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub, getProbesWithAdminData);
		sql.select.resolves([{ ...defaultAdoption, state: null }]);

		await adoptedProbes.syncDashboardData();

		expect(sql.where.callCount).to.equal(1);
		expect(sql.update.callCount).to.equal(0);
		expect(sql.delete.callCount).to.equal(0);
		expect(sql.insert.callCount).to.equal(0);
	});

	it('class should delete duplicated adopted probes', async () => {
		// There are two rows for the same probe in the db.
		sql.select.resolves([ defaultAdoption, { ...defaultAdoption, id: 'p-2', ip: '2.2.2.2', uuid: '2-2-2-2-2' }]);

		// Now probe connects with the uuid of first adoption and ip of second.
		getProbesWithAdminData.returns([{ ...defaultConnectedProbe, uuid: '1-1-1-1-1', ipAddress: '2.2.2.2' }]);

		const adoptedProbes = new AdoptedProbes(sqlStub, getProbesWithAdminData);
		await adoptedProbes.syncDashboardData();

		// Match found by UUID.
		// Duplicated probe with ip 1.1.1.1 is deleted.
		expect(sql.delete.callCount).to.equal(1);
		expect(sql.whereIn.args[0]).to.deep.equal([ 'id', [ 'p-2' ] ]);

		expect(sql.update.callCount).to.equal(1);
		expect(sql.where.args[1]).to.deep.equal([{ id: 'p-1' }]);
		expect(sql.update.args[0]).to.deep.equal([{ ip: '2.2.2.2' }]);
		expect(sql.insert.callCount).to.equal(0);
	});

	it('class should delete/update adoptions correctly in case of multiple duplications', async () => {
		sql.select.resolves([
			{ ...defaultAdoption, altIps: JSON.stringify([ '2.2.2.2' ]) },
			{ ...defaultAdoption, id: 'p-2', ip: '2.2.2.2', uuid: '2-2-2-2-2', altIps: JSON.stringify([ '1.1.1.1' ]) },
			{ ...defaultAdoption, id: 'p-3', ip: '3.3.3.3', uuid: '3-3-3-3-3', altIps: JSON.stringify([ '1.1.1.1' ]) },
		]);

		getProbesWithAdminData.returns([{ ...defaultConnectedProbe, uuid: '1-1-1-1-1', ipAddress: '2.2.2.2', altIpAddresses: [ '1.1.1.1' ] }]);

		const adoptedProbes = new AdoptedProbes(sqlStub, getProbesWithAdminData);
		await adoptedProbes.syncDashboardData();

		expect(sql.delete.callCount).to.equal(1);
		expect(sql.whereIn.args[0]).to.deep.equal([ 'id', [ 'p-2' ] ]);

		expect(sql.update.callCount).to.equal(2);
		expect(sql.where.args[1]).to.deep.equal([{ id: 'p-1' }]);
		expect(sql.update.args[0]).to.deep.equal([{ ip: '2.2.2.2', altIps: '["1.1.1.1"]' }]);
		expect(sql.where.args[2]).to.deep.equal([{ id: 'p-3' }]);
		expect(sql.update.args[1]).to.deep.equal([{ status: 'offline', altIps: '[]' }]);
		expect(sql.insert.callCount).to.equal(0);
	});

	it('class should only delete duplicated probes in the same country', async () => {
		// There are two rows for the same probe in the db.
		sql.select.resolves([ defaultAdoption, { ...defaultAdoption, id: 'p-2', ip: '2.2.2.2', uuid: '2-2-2-2-2', country: 'anotherCountry' }]);

		// Now probe connects with the uuid of first adoption and ip of second.
		getProbesWithAdminData.returns([{ ...defaultConnectedProbe, uuid: '1-1-1-1-1', ipAddress: '2.2.2.2' }]);

		const adoptedProbes = new AdoptedProbes(sqlStub, getProbesWithAdminData);
		await adoptedProbes.syncDashboardData();

		// Duplicated probe with ip 1.1.1.1 is deleted.
		expect(sql.delete.callCount).to.equal(0);

		// Match found by UUID.
		expect(sql.update.callCount).to.equal(2);
		expect(sql.where.args[1]).to.deep.equal([{ id: 'p-1' }]);
		expect(sql.update.args[0]).to.deep.equal([{ ip: '2.2.2.2' }]);
		expect(sql.where.args[2]).to.deep.equal([{ id: 'p-2' }]);
		expect(sql.update.args[1]).to.deep.equal([{ status: 'offline' }]);
		expect(sql.insert.callCount).to.equal(0);
	});

	it('class should only delete duplicated probes of the same user', async () => {
		// There are two rows for the same probe in the db.
		sql.select.resolves([ defaultAdoption, { ...defaultAdoption, id: 'p-2', ip: '2.2.2.2', uuid: '2-2-2-2-2', userId: 'anotherUserId' }]);

		// Now probe connects with the uuid of first adoption and ip of second.
		getProbesWithAdminData.returns([{ ...defaultConnectedProbe, uuid: '1-1-1-1-1', ipAddress: '2.2.2.2' }]);

		const adoptedProbes = new AdoptedProbes(sqlStub, getProbesWithAdminData);
		await adoptedProbes.syncDashboardData();

		// Duplicated probe with ip 1.1.1.1 is deleted.
		expect(sql.delete.callCount).to.equal(0);

		// Match found by UUID.
		expect(sql.update.callCount).to.equal(2);
		expect(sql.where.args[1]).to.deep.equal([{ id: 'p-1' }]);
		expect(sql.update.args[0]).to.deep.equal([{ ip: '2.2.2.2' }]);
		expect(sql.where.args[2]).to.deep.equal([{ id: 'p-2' }]);
		expect(sql.update.args[1]).to.deep.equal([{ status: 'offline' }]);
		expect(sql.insert.callCount).to.equal(0);
	});

	it('class should not delete adotions in case of duplicated alt IP, only update the altIps list', async () => {
		sql.select.resolves([
			{ ...defaultAdoption, altIps: JSON.stringify([ '9.9.9.9' ]) },
			{ ...defaultAdoption, id: 'p-2', ip: '2.2.2.2', uuid: '2-2-2-2-2', altIps: JSON.stringify([ '9.9.9.9' ]) },
		]);

		getProbesWithAdminData.returns([{ ...defaultConnectedProbe, altIpAddresses: [ '9.9.9.9' ] }]);

		const adoptedProbes = new AdoptedProbes(sqlStub, getProbesWithAdminData);
		await adoptedProbes.syncDashboardData();

		expect(sql.update.callCount).to.equal(1);
		expect(sql.where.args[1]).to.deep.equal([{ id: 'p-2' }]);
		expect(sql.update.args[0]).to.deep.equal([{ status: 'offline', altIps: '[]' }]);
		expect(sql.insert.callCount).to.equal(0);
	});

	it('class should create new dProbes if match for connected probes not found', async () => {
		// There are two rows for the same probe in the db.
		sql.select.resolves([ defaultAdoption ]);
		getProbesWithAdminData.returns([{ ...defaultConnectedProbe, uuid: '2-2-2-2-2', ipAddress: '2.2.2.2' }]);

		const adoptedProbes = new AdoptedProbes(sqlStub, getProbesWithAdminData);
		await adoptedProbes.syncDashboardData();

		// Match found by UUID.
		// Duplicated probe with ip 1.1.1.1 is deleted.
		expect(sql.delete.callCount).to.equal(0);
		expect(sql.update.callCount).to.equal(1);
		expect(sql.where.args[1]).to.deep.equal([{ id: 'p-1' }]);
		expect(sql.update.args[0]).to.deep.equal([{ status: 'offline' }]);
		expect(sql.insert.callCount).to.equal(1);

		expect(sql.insert.args[0][0]).to.deep.include({
			uuid: '2-2-2-2-2',
			ip: '2.2.2.2',
			altIps: '[]',
			status: 'ready',
			isIPv4Supported: true,
			isIPv6Supported: true,
			version: '0.26.0',
			nodeVersion: 'v18.17.0',
			hardwareDevice: null,
			hardwareDeviceFirmware: null,
			systemTags: '["datacenter-network"]',
			asn: 16509,
			network: 'Amazon.com, Inc.',
			country: 'IE',
			city: 'Dublin',
			state: null,
			latitude: 53.33,
			longitude: -6.25,
		});
	});

	it('class should proceed with syncing other probes if one probe sync fails', async () => {
		sql.select.resolves([ defaultAdoption, { ...defaultAdoption, id: 'p-2', ip: '2.2.2.2', uuid: '2-2-2-2-2' }]);

		// UUID of 2 probes changed.
		getProbesWithAdminData.returns([
			{ ...defaultConnectedProbe, ipAddress: '1.1.1.1', uuid: '1-1-1-1-2' },
			{ ...defaultConnectedProbe, ipAddress: '2.2.2.2', uuid: '2-2-2-2-3' },
		]);

		sql.update.rejects(new Error('some sql error'));

		const adoptedProbes = new AdoptedProbes(sqlStub, getProbesWithAdminData);
		await adoptedProbes.syncDashboardData();

		// Second update is still fired, even when first was rejected.
		expect(sql.update.callCount).to.equal(2);
		expect(sql.update.args[0]).to.deep.equal([{ uuid: '1-1-1-1-2' }]);
		expect(sql.update.args[1]).to.deep.equal([{ uuid: '2-2-2-2-3' }]);
		expect(sql.insert.callCount).to.equal(0);
	});

	it('getByIp method should return adopted probe data', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub, getProbesWithAdminData);

		await adoptedProbes.syncDashboardData();

		const adoption = adoptedProbes.getByIp('1.1.1.1');
		expect(adoption).to.deep.equal({
			...defaultAdoption,
			altIps: [],
			systemTags: [ 'datacenter-network' ],
			tags: [{ type: 'user', value: 'u-jimaek:dashboardtag' }],
			isCustomCity: false,
			isIPv4Supported: true,
			isIPv6Supported: true,
			publicProbes: false,
		});
	});

	it('getUpdatedLocation method should return updated location', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub, getProbesWithAdminData);
		sql.select.resolves([{
			...defaultAdoption,
			city: 'Dundalk',
			countryOfCustomCity: 'IE',
			isCustomCity: 1,
			latitude: 54,
			longitude: -6.42,
		}]);

		await adoptedProbes.syncDashboardData();
		const updatedLocation = adoptedProbes.getUpdatedLocation(defaultConnectedProbe.ipAddress, defaultConnectedProbe.location);
		expect(updatedLocation).to.deep.equal({
			continent: 'EU',
			region: 'Northern Europe',
			country: 'IE',
			city: 'Dundalk',
			state: null,
			normalizedCity: 'dundalk',
			asn: 16509,
			latitude: 54,
			longitude: -6.42,
			network: 'Amazon.com, Inc.',
			normalizedNetwork: 'amazon.com, inc.',
		});
	});

	it('getUpdatedLocation method should return null if connected.country !== adopted.countryOfCustomCity', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub, getProbesWithAdminData);
		sql.select.resolves([{
			...defaultAdoption,
			country: 'IE',
			countryOfCustomCity: 'GB',
			city: 'London',
			isCustomCity: 1,
			latitude: 51.51,
			longitude: -0.13,
		}]);

		await adoptedProbes.syncDashboardData();
		const updatedLocation = adoptedProbes.getUpdatedLocation(defaultConnectedProbe.ipAddress, defaultConnectedProbe.location);
		expect(updatedLocation).to.equal(null);
	});

	it('getUpdatedLocation method should return null if "isCustomCity: false"', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub, getProbesWithAdminData);
		sql.select.resolves([{
			...defaultAdoption,
			city: 'Dundalk',
			isCustomCity: 0,
			latitude: 54,
			longitude: -6.42,
		}]);

		await adoptedProbes.syncDashboardData();
		const updatedLocation = adoptedProbes.getUpdatedLocation(defaultConnectedProbe.ipAddress, defaultConnectedProbe.location);
		expect(updatedLocation).to.equal(null);
	});

	it('getUpdatedTags method should return same tags array', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub, getProbesWithAdminData);
		sql.select.resolves([{ ...defaultAdoption, tags: '[]' }]);

		await adoptedProbes.syncDashboardData();
		const updatedTags = adoptedProbes.getUpdatedTags(defaultConnectedProbe);
		expect(updatedTags).to.equal(defaultConnectedProbe.tags);
	});

	it('getUpdatedTags method should return user tags', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub, getProbesWithAdminData);

		await adoptedProbes.syncDashboardData();
		const updatedTags = adoptedProbes.getUpdatedTags(defaultConnectedProbe);
		expect(updatedTags).to.deep.equal([
			{ type: 'system', value: 'datacenter-network' },
			{ type: 'user', value: 'u-jimaek:dashboardtag' },
		]);
	});

	it('getUpdatedTags method should include user tag if public_probes: true', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub, getProbesWithAdminData);
		sql.select.resolves([{ ...defaultAdoption, tags: '[]', publicProbes: 1 }]);

		await adoptedProbes.syncDashboardData();

		expect(sql.update.callCount).to.equal(1);
		expect(sql.where.args[1]).to.deep.equal([{ id: 'p-1' }]);
		expect(sql.update.args[0]).to.deep.equal([{ systemTags: '["u-jimaek","datacenter-network"]' }]);
		const updatedTags = adoptedProbes.getUpdatedTags(defaultConnectedProbe);
		expect(updatedTags).to.deep.equal([
			{ type: 'system', value: 'datacenter-network' },
			{ type: 'system', value: 'u-jimaek' },
		]);
	});
});

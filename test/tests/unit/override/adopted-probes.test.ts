import { expect } from 'chai';
import type { Knex } from 'knex';
import * as sinon from 'sinon';
import relativeDayUtc from 'relative-day-utc';
import { AdoptedProbes } from '../../../../src/lib/override/adopted-probes.js';
import type { Probe } from '../../../../src/probe/types.js';

describe('AdoptedProbes', () => {
	const defaultAdoptedProbe = {
		userId: '3cff97ae-4a0a-4f34-9f1a-155e6def0a45',
		username: 'jimaek',
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
		country: 'IE',
		state: null,
		countryOfCustomCity: '',
		city: 'Dublin',
		latitude: 53.3331,
		longitude: -6.2489,
		asn: 16509,
		network: 'Amazon.com, Inc.',
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
			latitude: 53.3331,
			longitude: -6.2489,
			network: 'Amazon.com, Inc.',
			normalizedNetwork: 'amazon.com, inc.',
		},
		isHardware: false,
		hardwareDevice: null,
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
	};

	const sandbox = sinon.createSandbox();
	const selectStub = sandbox.stub();
	const updateStub = sandbox.stub();
	const deleteStub = sandbox.stub();
	const rawStub = sandbox.stub();
	const whereStub = sandbox.stub().returns({
		update: updateStub,
		delete: deleteStub,
	});
	const sqlStub = sandbox.stub().returns({
		select: selectStub,
		where: whereStub,
	}) as sinon.SinonStub<any[], any> & {raw: any};
	sqlStub.raw = rawStub;
	const fetchProbesWithAdminData = sandbox.stub().resolves([]);

	beforeEach(() => {
		sandbox.resetHistory();
		selectStub.resolves([ defaultAdoptedProbe ]);
		fetchProbesWithAdminData.resolves([ defaultConnectedProbe ]);
	});

	it('syncDashboardData method should sync the data', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchProbesWithAdminData);

		expect(sqlStub.callCount).to.equal(0);
		expect(selectStub.callCount).to.equal(0);

		await adoptedProbes.syncDashboardData();

		expect(sqlStub.callCount).to.equal(1);
		expect(sqlStub.args[0]).deep.equal([ 'gp_adopted_probes' ]);
		expect(selectStub.callCount).to.equal(1);
	});

	it('class should update uuid if it is wrong', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchProbesWithAdminData);
		fetchProbesWithAdminData.resolves([{ ...defaultConnectedProbe, uuid: '2-2-2-2-2' }]);

		await adoptedProbes.syncDashboardData();

		expect(whereStub.callCount).to.equal(1);
		expect(whereStub.args[0]).to.deep.equal([{ ip: '1.1.1.1' }]);
		expect(updateStub.callCount).to.equal(1);
		expect(updateStub.args[0]).to.deep.equal([{ ip: '1.1.1.1', altIps: '[]', uuid: '2-2-2-2-2' }]);
	});

	it('class should update ip if it is wrong', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchProbesWithAdminData);
		fetchProbesWithAdminData.resolves([{ ...defaultConnectedProbe, ipAddress: '2.2.2.2' }]);

		await adoptedProbes.syncDashboardData();

		expect(whereStub.callCount).to.equal(1);
		expect(whereStub.args[0]).to.deep.equal([{ ip: '1.1.1.1' }]);
		expect(updateStub.callCount).to.equal(1);
		expect(updateStub.args[0]).to.deep.equal([{ ip: '2.2.2.2', altIps: '[]', uuid: '1-1-1-1-1' }]);
	});

	it('class should update alt ips if it is wrong', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchProbesWithAdminData);
		fetchProbesWithAdminData.resolves([{ ...defaultConnectedProbe, altIpAddresses: [ '2.2.2.2' ] }]);

		await adoptedProbes.syncDashboardData();

		expect(whereStub.callCount).to.equal(1);
		expect(whereStub.args[0]).to.deep.equal([{ ip: '1.1.1.1' }]);
		expect(updateStub.callCount).to.equal(1);
		expect(updateStub.args[0]).to.deep.equal([{ ip: '1.1.1.1', altIps: JSON.stringify([ '2.2.2.2' ]), uuid: '1-1-1-1-1' }]);
	});

	it('class should update status to "offline" if adopted probe was not found and lastSyncDate < 30 days away', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchProbesWithAdminData);
		selectStub.resolves([{ ...defaultAdoptedProbe, lastSyncDate: relativeDayUtc(-15) }]);
		fetchProbesWithAdminData.resolves([]);

		await adoptedProbes.syncDashboardData();

		expect(whereStub.callCount).to.equal(1);
		expect(updateStub.callCount).to.equal(1);
		expect(updateStub.args[0]).to.deep.equal([{ status: 'offline' }]);
		expect(deleteStub.callCount).to.equal(0);
	});

	it('class should do nothing if adopted probe was not found and lastSyncDate < 30 days away but it is already "offline"', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchProbesWithAdminData);
		selectStub.resolves([{ ...defaultAdoptedProbe, lastSyncDate: relativeDayUtc(-15), status: 'offline' }]);
		fetchProbesWithAdminData.resolves([]);

		await adoptedProbes.syncDashboardData();

		expect(whereStub.callCount).to.equal(0);
		expect(updateStub.callCount).to.equal(0);
		expect(deleteStub.callCount).to.equal(0);
	});

	it('class should delete adoption if adopted probe was not found and lastSyncDate > 30 days away', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchProbesWithAdminData);
		selectStub.resolves([{ ...defaultAdoptedProbe, lastSyncDate: relativeDayUtc(-45) }]);
		fetchProbesWithAdminData.resolves([]);

		await adoptedProbes.syncDashboardData();

		expect(whereStub.callCount).to.equal(2);
		expect(whereStub.args[0]).to.deep.equal([{ ip: '1.1.1.1' }]);
		expect(updateStub.callCount).to.equal(1);
		expect(updateStub.args[0]).to.deep.equal([{ status: 'offline' }]);
		expect(deleteStub.callCount).to.equal(1);
	});

	it('class should update lastSyncDate if probe is connected and lastSyncDate < 30 days away', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchProbesWithAdminData);
		selectStub.resolves([{ ...defaultAdoptedProbe, lastSyncDate: relativeDayUtc(-15) }]);

		await adoptedProbes.syncDashboardData();

		expect(whereStub.callCount).to.equal(1);
		expect(whereStub.args[0]).to.deep.equal([{ ip: '1.1.1.1' }]);
		expect(updateStub.callCount).to.equal(1);
		expect(updateStub.firstCall.args[0].lastSyncDate).to.be.greaterThanOrEqual(relativeDayUtc());
		expect(deleteStub.callCount).to.equal(0);
	});

	it('class should update lastSyncDate if probe is connected and lastSyncDate > 30 days away', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchProbesWithAdminData);
		selectStub.resolves([{ ...defaultAdoptedProbe, lastSyncDate: relativeDayUtc(-45) }]);

		await adoptedProbes.syncDashboardData();

		expect(whereStub.callCount).to.equal(1);
		expect(whereStub.args[0]).to.deep.equal([{ ip: '1.1.1.1' }]);
		expect(updateStub.callCount).to.equal(1);
		expect(updateStub.firstCall.args[0].lastSyncDate).to.be.greaterThanOrEqual(relativeDayUtc());
		expect(deleteStub.callCount).to.equal(0);
	});

	it('class should update lastSyncDate should not update anything if lastSyncDate is today', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchProbesWithAdminData);

		await adoptedProbes.syncDashboardData();

		expect(whereStub.callCount).to.equal(0);
		expect(updateStub.callCount).to.equal(0);
		expect(deleteStub.callCount).to.equal(0);
	});

	it('class should update probe meta info if it is outdated and "isCustomCity: false"', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchProbesWithAdminData);

		fetchProbesWithAdminData.resolves([
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
					latitude: 51.50853,
					longitude: -0.12574,
					network: 'The Constant Company, LLC',
				},
			} as Probe,
		]);

		await adoptedProbes.syncDashboardData();

		expect(whereStub.callCount).to.equal(1);
		expect(whereStub.args[0]).to.deep.equal([{ ip: '1.1.1.1' }]);
		expect(updateStub.callCount).to.equal(1);

		expect(updateStub.args[0]).to.deep.equal([{
			status: 'initializing',
			isIPv4Supported: false,
			isIPv6Supported: false,
			version: '0.27.0',
			nodeVersion: 'v18.17.1',
			hardwareDevice: 'v1',
			systemTags: '["eyeball-network"]',
			asn: 20473,
			network: 'The Constant Company, LLC',
			country: 'GB',
			city: 'London',
			latitude: 51.50853,
			longitude: -0.12574,
		}]);
	});

	it('class should update country and send notification if country of the probe changes', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchProbesWithAdminData);
		selectStub.resolves([{ ...defaultAdoptedProbe, countryOfCustomCity: 'IE', isCustomCity: 1 }]);

		fetchProbesWithAdminData.resolves([
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
					latitude: 51.50853,
					longitude: -0.12574,
					network: 'The Constant Company, LLC',
				},
			} as Probe,
		]);

		await adoptedProbes.syncDashboardData();

		expect(rawStub.callCount).to.equal(1);

		expect(rawStub.args[0]![1]).to.deep.equal({
			recipient: '3cff97ae-4a0a-4f34-9f1a-155e6def0a45',
			subject: 'Adopted probe country change',
			message: 'Globalping API detected that your adopted probe with ip: 1.1.1.1 is located at "GB". So its country value changed from "IE" to "GB", and custom city value "Dublin" is not applied right now.\n\nIf this change is not right please report in [that issue](https://github.com/jsdelivr/globalping/issues/268).',
		});

		expect(whereStub.callCount).to.equal(1);
		expect(whereStub.args[0]).to.deep.equal([{ ip: '1.1.1.1' }]);
		expect(updateStub.callCount).to.equal(1);

		expect(updateStub.args[0]).to.deep.equal([
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
	});

	it('class should partially update probe meta info if it is outdated and "isCustomCity: true"', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchProbesWithAdminData);
		selectStub.resolves([{ ...defaultAdoptedProbe, countryOfCustomCity: 'IE', isCustomCity: 1 }]);

		fetchProbesWithAdminData.resolves([
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
					latitude: 51.50853,
					longitude: -0.12574,
					network: 'The Constant Company, LLC',
				},
			} as Probe,
		]);

		await adoptedProbes.syncDashboardData();

		expect(whereStub.callCount).to.equal(1);
		expect(whereStub.args[0]).to.deep.equal([{ ip: '1.1.1.1' }]);
		expect(updateStub.callCount).to.equal(1);

		expect(updateStub.args[0]).to.deep.equal([{
			status: 'initializing',
			isIPv4Supported: false,
			isIPv6Supported: false,
			version: '0.27.0',
			country: 'GB',
			asn: 20473,
			network: 'The Constant Company, LLC',
		}]);
	});

	it('class should not update probe meta info if it is actual', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchProbesWithAdminData);

		await adoptedProbes.syncDashboardData();

		expect(whereStub.callCount).to.equal(0);
		expect(updateStub.callCount).to.equal(0);
		expect(deleteStub.callCount).to.equal(0);
	});

	it('class should treat null and undefined values as equal', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchProbesWithAdminData);
		selectStub.resolves([{ ...defaultAdoptedProbe, state: null }]);

		await adoptedProbes.syncDashboardData();

		expect(whereStub.callCount).to.equal(0);
		expect(updateStub.callCount).to.equal(0);
		expect(deleteStub.callCount).to.equal(0);
	});

	it('getByIp method should return adopted probe data', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchProbesWithAdminData);

		await adoptedProbes.syncDashboardData();

		const adoptedProbe = adoptedProbes.getByIp('1.1.1.1');
		expect(adoptedProbe).to.deep.equal({
			...defaultAdoptedProbe,
			altIps: [],
			systemTags: [ 'datacenter-network' ],
			tags: [{ type: 'user', value: 'u-jimaek-dashboardtag' }],
			isCustomCity: false,
			isIPv4Supported: true,
			isIPv6Supported: true,
		});
	});

	it('getUpdatedLocation method should return updated location', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchProbesWithAdminData);
		selectStub.resolves([{
			...defaultAdoptedProbe,
			city: 'Dundalk',
			countryOfCustomCity: 'IE',
			isCustomCity: 1,
			latitude: 54,
			longitude: -6.41667,
		}]);

		await adoptedProbes.syncDashboardData();
		const updatedLocation = adoptedProbes.getUpdatedLocation(defaultConnectedProbe);
		expect(updatedLocation).to.deep.equal({
			continent: 'EU',
			region: 'Northern Europe',
			country: 'IE',
			city: 'Dundalk',
			state: null,
			normalizedCity: 'dundalk',
			asn: 16509,
			latitude: 54,
			longitude: -6.41667,
			network: 'Amazon.com, Inc.',
			normalizedNetwork: 'amazon.com, inc.',
		});
	});

	it('getUpdatedLocation method should return null if connected.country !== adopted.countryOfCustomCity', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchProbesWithAdminData);
		selectStub.resolves([{
			...defaultAdoptedProbe,
			country: 'IE',
			countryOfCustomCity: 'GB',
			city: 'London',
			isCustomCity: 1,
			latitude: 51.50853,
			longitude: -0.12574,
		}]);

		await adoptedProbes.syncDashboardData();
		const updatedLocation = adoptedProbes.getUpdatedLocation(defaultConnectedProbe);
		expect(updatedLocation).to.equal(null);
	});

	it('getUpdatedLocation method should return null if "isCustomCity: false"', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchProbesWithAdminData);
		selectStub.resolves([{
			...defaultAdoptedProbe,
			city: 'Dundalk',
			isCustomCity: 0,
			latitude: 54,
			longitude: -6.41667,
		}]);

		await adoptedProbes.syncDashboardData();
		const updatedLocation = adoptedProbes.getUpdatedLocation(defaultConnectedProbe);
		expect(updatedLocation).to.equal(null);
	});

	it('getUpdatedTags method should return updated tags', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchProbesWithAdminData);

		await adoptedProbes.syncDashboardData();
		const updatedTags = adoptedProbes.getUpdatedTags(defaultConnectedProbe);
		expect(updatedTags).to.deep.equal([
			{ type: 'system', value: 'datacenter-network' },
			{ type: 'user', value: 'u-jimaek-dashboardtag' },
		]);
	});

	it('getUpdatedTags method should return same tags array if user tags are empty', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchProbesWithAdminData);
		selectStub.resolves([{ ...defaultAdoptedProbe, tags: '[]' }]);

		await adoptedProbes.syncDashboardData();
		const updatedTags = adoptedProbes.getUpdatedTags(defaultConnectedProbe);
		expect(updatedTags).to.equal(defaultConnectedProbe.tags);
	});
});

import { expect } from 'chai';
import type { Knex } from 'knex';
import * as sinon from 'sinon';
import { AdoptedProbes } from '../../../src/lib/adopted-probes.js';
import type { Probe } from '../../../src/probe/types.js';

const defaultAdoptedProbe = {
	userId: '3cff97ae-4a0a-4f34-9f1a-155e6def0a45',
	username: 'jimaek',
	ip: '1.1.1.1',
	uuid: '1-1-1-1-1',
	lastSyncDate: new Date('1970-01-01'),
	tags: '[{"prefix":"jimaek","value":"dashboardtag"}]',
	isCustomCity: 0,
	status: 'ready',
	version: '0.26.0',
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
	uuid: '1-1-1-1-1',
	status: 'ready',
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
	tags: [],
	index: [],
	client: '',
	host: '',
	resolvers: [],
	stats: {
		cpu: {
			count: 0,
			load: [],
		},
		jobs: { count: 0 },
	},
};

const selectStub = sinon.stub();
const updateStub = sinon.stub();
const deleteStub = sinon.stub();
const rawStub = sinon.stub();
const whereStub = sinon.stub().returns({
	update: updateStub,
	delete: deleteStub,
});
const sqlStub = sinon.stub().returns({
	select: selectStub,
	where: whereStub,
}) as sinon.SinonStub<any[], any> & {raw: any};
sqlStub.raw = rawStub;
const fetchSocketsStub = sinon.stub().resolves([]);
let sandbox: sinon.SinonSandbox;

describe('AdoptedProbes', () => {
	beforeEach(() => {
		sandbox = sinon.createSandbox({ useFakeTimers: true });
		sinon.resetHistory();
		selectStub.resolves([ defaultAdoptedProbe ]);
		fetchSocketsStub.resolves([{ data: {	probe: defaultConnectedProbe } }]);
	});

	afterEach(() => {
		sandbox.restore();
	});

	it('syncDashboardData method should sync the data', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchSocketsStub);

		expect(sqlStub.callCount).to.equal(0);
		expect(selectStub.callCount).to.equal(0);

		await adoptedProbes.syncDashboardData();

		expect(sqlStub.callCount).to.equal(1);
		expect(sqlStub.args[0]).deep.equal([{ probes: 'gp_adopted_probes' }]);
		expect(selectStub.callCount).to.equal(1);
	});

	it('class should update uuid if it is wrong', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchSocketsStub);
		fetchSocketsStub.resolves([{ data: { probe: { ...defaultConnectedProbe, uuid: '2-2-2-2-2' } } }]);

		await adoptedProbes.syncDashboardData();

		expect(whereStub.callCount).to.equal(1);
		expect(whereStub.args[0]).to.deep.equal([{ ip: '1.1.1.1' }]);
		expect(updateStub.callCount).to.equal(1);
		expect(updateStub.args[0]).to.deep.equal([{ uuid: '2-2-2-2-2' }]);
	});

	it('class should update ip if it is wrong', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchSocketsStub);
		fetchSocketsStub.resolves([{ data: { probe: { ...defaultConnectedProbe, ipAddress: '2.2.2.2' } } }]);

		await adoptedProbes.syncDashboardData();

		expect(whereStub.callCount).to.equal(1);
		expect(whereStub.args[0]).to.deep.equal([{ uuid: '1-1-1-1-1' }]);
		expect(updateStub.callCount).to.equal(1);
		expect(updateStub.args[0]).to.deep.equal([{ ip: '2.2.2.2' }]);
	});

	it('class should do nothing if adopted probe was not found and lastSyncDate < 30 days away', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchSocketsStub);
		selectStub.resolves([{ ...defaultAdoptedProbe, lastSyncDate: new Date('1969-12-15') }]);
		fetchSocketsStub.resolves([]);

		await adoptedProbes.syncDashboardData();

		expect(whereStub.callCount).to.equal(0);
		expect(updateStub.callCount).to.equal(0);
		expect(deleteStub.callCount).to.equal(0);
	});

	it('class should delete adoption if adopted probe was not found and lastSyncDate > 30 days away', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchSocketsStub);
		selectStub.resolves([{ ...defaultAdoptedProbe, lastSyncDate: new Date('1969-11-15') }]);
		fetchSocketsStub.resolves([]);

		await adoptedProbes.syncDashboardData();

		expect(whereStub.callCount).to.equal(1);
		expect(whereStub.args[0]).to.deep.equal([{ ip: '1.1.1.1' }]);
		expect(updateStub.callCount).to.equal(0);
		expect(deleteStub.callCount).to.equal(1);
	});

	it('class should update lastSyncDate if probe is connected and lastSyncDate < 30 days away', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchSocketsStub);
		selectStub.resolves([{ ...defaultAdoptedProbe, lastSyncDate: new Date('1969-12-31') }]);

		await adoptedProbes.syncDashboardData();

		expect(whereStub.callCount).to.equal(1);
		expect(whereStub.args[0]).to.deep.equal([{ ip: '1.1.1.1' }]);
		expect(updateStub.callCount).to.equal(1);
		expect(updateStub.args[0]).to.deep.equal([{ lastSyncDate: new Date() }]);
		expect(deleteStub.callCount).to.equal(0);
	});

	it('class should update lastSyncDate if probe is connected and lastSyncDate > 30 days away', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchSocketsStub);
		selectStub.resolves([{ ...defaultAdoptedProbe, lastSyncDate: new Date('1969-11-15') }]);

		await adoptedProbes.syncDashboardData();

		expect(whereStub.callCount).to.equal(1);
		expect(whereStub.args[0]).to.deep.equal([{ ip: '1.1.1.1' }]);
		expect(updateStub.callCount).to.equal(1);
		expect(updateStub.args[0]).to.deep.equal([{ lastSyncDate: new Date() }]);
		expect(deleteStub.callCount).to.equal(0);
	});

	it('class should update lastSyncDate should not update anything if lastSyncDate is today', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchSocketsStub);

		await adoptedProbes.syncDashboardData();

		expect(whereStub.callCount).to.equal(0);
		expect(updateStub.callCount).to.equal(0);
		expect(deleteStub.callCount).to.equal(0);
	});

	it('class should update probe meta info if it is outdated and "isCustomCity: false"', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchSocketsStub);

		fetchSocketsStub.resolves([{
			data: {
				probe: {
					ipAddress: '1.1.1.1',
					uuid: '1-1-1-1-1',
					status: 'initializing',
					version: '0.27.0',
					nodeVersion: 'v18.17.0',
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
			},
		}]);

		await adoptedProbes.syncDashboardData();

		expect(whereStub.callCount).to.equal(1);
		expect(whereStub.args[0]).to.deep.equal([{ ip: '1.1.1.1' }]);
		expect(updateStub.callCount).to.equal(1);

		expect(updateStub.args[0]).to.deep.equal([{
			status: 'initializing',
			version: '0.27.0',
			asn: 20473,
			network: 'The Constant Company, LLC',
			country: 'GB',
			city: 'London',
			latitude: 51.50853,
			longitude: -0.12574,
		}]);
	});

	it('class should update country and send notification if country of the probe changes', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchSocketsStub);
		selectStub.resolves([{ ...defaultAdoptedProbe, countryOfCustomCity: 'IE', isCustomCity: true }]);

		fetchSocketsStub.resolves([{
			data: {
				probe: {
					ipAddress: '1.1.1.1',
					uuid: '1-1-1-1-1',
					status: 'initializing',
					version: '0.27.0',
					nodeVersion: 'v18.17.0',
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
				},
			},
		}]);

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
				version: '0.27.0',
				asn: 20473,
				network: 'The Constant Company, LLC',
				country: 'GB',
			},
		]);
	});

	it('class should partially update probe meta info if it is outdated and "isCustomCity: true"', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchSocketsStub);
		selectStub.resolves([{ ...defaultAdoptedProbe, countryOfCustomCity: 'IE', isCustomCity: true }]);

		fetchSocketsStub.resolves([{
			data: {
				probe: {
					ipAddress: '1.1.1.1',
					uuid: '1-1-1-1-1',
					status: 'initializing',
					version: '0.27.0',
					nodeVersion: 'v18.17.0',
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
				},
			},
		}]);

		await adoptedProbes.syncDashboardData();

		expect(whereStub.callCount).to.equal(1);
		expect(whereStub.args[0]).to.deep.equal([{ ip: '1.1.1.1' }]);
		expect(updateStub.callCount).to.equal(1);

		expect(updateStub.args[0]).to.deep.equal([{
			status: 'initializing',
			version: '0.27.0',
			country: 'GB',
			asn: 20473,
			network: 'The Constant Company, LLC',
		}]);
	});

	it('class should not update probe meta info if it is actual', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchSocketsStub);

		await adoptedProbes.syncDashboardData();

		expect(whereStub.callCount).to.equal(0);
		expect(updateStub.callCount).to.equal(0);
		expect(deleteStub.callCount).to.equal(0);
	});

	it('class should treat null and undefined values as equal', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchSocketsStub);
		selectStub.resolves([{ ...defaultAdoptedProbe, state: null }]);

		await adoptedProbes.syncDashboardData();

		expect(whereStub.callCount).to.equal(0);
		expect(updateStub.callCount).to.equal(0);
		expect(deleteStub.callCount).to.equal(0);
	});

	it('getByIp method should return adopted probe data', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchSocketsStub);

		await adoptedProbes.syncDashboardData();

		const adoptedProbe = adoptedProbes.getByIp('1.1.1.1');
		expect(adoptedProbe).to.deep.equal({ ...defaultAdoptedProbe, tags: [{ type: 'user', value: 'u-jimaek-dashboardtag' }], isCustomCity: false });
	});

	it('getUpdatedLocation method should return updated location', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchSocketsStub);
		selectStub.resolves([{
			...defaultAdoptedProbe,
			city: 'Dundalk',
			countryOfCustomCity: 'IE',
			isCustomCity: true,
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

	it('getUpdatedLocation method should return same location object if connected.country !== adopted.countryOfCustomCity', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchSocketsStub);
		selectStub.resolves([{
			...defaultAdoptedProbe,
			country: 'IE',
			countryOfCustomCity: 'GB',
			city: 'London',
			isCustomCity: true,
			latitude: 51.50853,
			longitude: -0.12574,
		}]);

		await adoptedProbes.syncDashboardData();
		const updatedLocation = adoptedProbes.getUpdatedLocation(defaultConnectedProbe);
		expect(updatedLocation).to.equal(defaultConnectedProbe.location);
	});

	it('getUpdatedLocation method should return same location object if "isCustomCity: false"', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchSocketsStub);
		selectStub.resolves([{
			...defaultAdoptedProbe,
			city: 'Dundalk',
			isCustomCity: false,
			latitude: 54,
			longitude: -6.41667,
		}]);

		await adoptedProbes.syncDashboardData();
		const updatedLocation = adoptedProbes.getUpdatedLocation(defaultConnectedProbe);
		expect(updatedLocation).to.equal(defaultConnectedProbe.location);
	});

	it('getUpdatedTags method should return updated tags', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchSocketsStub);

		await adoptedProbes.syncDashboardData();
		const updatedTags = adoptedProbes.getUpdatedTags(defaultConnectedProbe);
		expect(updatedTags).to.deep.equal([{ type: 'user', value: 'u-jimaek-dashboardtag' }]);
	});

	it('getUpdatedTags method should return same tags array if user tags are empty', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchSocketsStub);
		selectStub.resolves([{ ...defaultAdoptedProbe, tags: undefined }]);

		await adoptedProbes.syncDashboardData();
		const updatedTags = adoptedProbes.getUpdatedTags(defaultConnectedProbe);
		expect(updatedTags).to.equal(defaultConnectedProbe.tags);
	});
});

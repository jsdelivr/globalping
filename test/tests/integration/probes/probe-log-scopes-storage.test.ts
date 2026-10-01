import { expect } from 'chai';
import * as sinon from 'sinon';
import { getPersistentRedisClient } from '../../../../src/lib/redis/persistent-client.js';
import { getIpKey } from '../../../../src/lib/ws/helper/probe-ip-limit.js';
import {
	KNOWN_SCOPES_KEY,
	MAX_SCOPES_PER_REPORTER,
	MIN_SCOPE_REPORTERS,
	ProbeLogScopesStorage,
	REPORTER_SCOPES_KEY_PREFIX,
	SCOPE_ACTIVE_WINDOW,
	SCOPE_KEY_PREFIX,
	SCOPE_READ_CACHE_TTL,
} from '../../../../src/probe/log-scopes-storage.js';

describe('Probe Log Scopes Storage', () => {
	const sandbox = sinon.createSandbox();
	const redis = getPersistentRedisClient();
	const scopeNames = new Set<string>();
	const reporterIps = new Set<string>();
	let initialNow: number;

	const scopeKey = (scope: string) => {
		scopeNames.add(scope);
		return `${SCOPE_KEY_PREFIX}${scope}`;
	};

	const createStorage = () => new ProbeLogScopesStorage(redis);
	const writeScopes = (storage: ProbeLogScopesStorage, ipAddress: string, scopes: string[]) => {
		reporterIps.add(getIpKey(ipAddress));
		scopes.forEach(scope => scopeNames.add(scope));
		return storage.writeScopes(ipAddress, scopes);
	};

	const report = async (storage: ProbeLogScopesStorage, count: number, scopes: string[], offset = 0) => {
		for (let index = 0; index < count; index++) {
			await writeScopes(storage, `192.0.2.${index + offset}`, scopes);
		}
	};

	beforeEach(async () => {
		initialNow = Date.now();
		scopeNames.clear();
		reporterIps.clear();
		await redis.del(KNOWN_SCOPES_KEY);
	});

	afterEach(async () => {
		sandbox.restore();
		clock.setSystemTime(initialNow);
		const keys = [
			KNOWN_SCOPES_KEY,
			...[ ...scopeNames ].map(scope => `${SCOPE_KEY_PREFIX}${scope}`),
			...[ ...reporterIps ].map(ipAddress => `${REPORTER_SCOPES_KEY_PREFIX}${ipAddress}`),
		];
		await redis.del(keys);
	});

	it('counts each IP once and refreshes both last-report timestamps', async () => {
		const storage = createStorage();
		const ipAddress = '192.0.2.1';
		const reporterKey = `${REPORTER_SCOPES_KEY_PREFIX}${ipAddress}`;
		const key = scopeKey('score-refresh');
		const [ redisNow ] = await redis.time();
		const previousScore = Number(redisNow) - 1;

		await redis.sAdd(KNOWN_SCOPES_KEY, 'score-refresh');
		await redis.zAdd(key, { score: previousScore, value: ipAddress });
		await redis.zAdd(reporterKey, { score: previousScore, value: 'score-refresh' });

		await writeScopes(storage, ipAddress, [ 'score-refresh' ]);
		const scopeScore = await redis.zScore(key, ipAddress);
		const reporterScore = await redis.zScore(reporterKey, 'score-refresh');

		expect(await redis.zCard(key)).to.equal(1);
		expect(scopeScore).to.be.greaterThan(previousScore);
		expect(reporterScore).to.equal(scopeScore);

		await writeScopes(storage, '192.0.2.2', [ 'score-refresh' ]);
		expect(await redis.zCard(key)).to.equal(2);
	});

	it('does not move last-report timestamps backwards', async () => {
		const storage = createStorage();
		const ipAddress = '192.0.2.3';
		const scope = 'monotonic-score';
		const key = scopeKey(scope);
		const reporterKey = `${REPORTER_SCOPES_KEY_PREFIX}${ipAddress}`;
		const [ redisNow ] = await redis.time();
		const futureScore = Number(redisNow) + 60;

		await redis.sAdd(KNOWN_SCOPES_KEY, scope);
		await redis.zAdd(key, { score: futureScore, value: ipAddress });
		await redis.zAdd(reporterKey, { score: futureScore, value: scope });
		await writeScopes(storage, ipAddress, [ scope ]);

		expect(await redis.zScore(key, ipAddress)).to.equal(futureScore);
		expect(await redis.zScore(reporterKey, scope)).to.equal(futureScore);
	});

	it('expires reporters at the ten-day boundary and refreshes the scope TTL', async () => {
		const storage = createStorage();
		const key = scopeKey('rolling-window');
		const [ redisNow ] = await redis.time();
		const now = Number(redisNow);
		const cutoff = now - SCOPE_ACTIVE_WINDOW;

		await redis.sAdd(KNOWN_SCOPES_KEY, 'rolling-window');

		await redis.zAdd(key, [
			{ score: cutoff, value: '192.0.2.1' },
			{ score: now, value: '192.0.2.2' },
		]);

		await redis.expire(key, 5);

		await writeScopes(storage, '192.0.2.3', [ 'rolling-window' ]);

		expect(await redis.zRange(key, 0, -1)).to.deep.equal([ '192.0.2.2', '192.0.2.3' ]);
		expect(await redis.ttl(key)).to.be.within(SCOPE_ACTIVE_WINDOW - 2, SCOPE_ACTIVE_WINDOW);
	});

	it('limits each IP to 64 active scopes without partially storing rejected reports', async () => {
		const storage = createStorage();
		const ipAddress = '192.0.2.64';
		const initialScopes = Array.from({ length: MAX_SCOPES_PER_REPORTER - 1 }, (_, index) => `initial-${index}`);
		const rejectedScopes = [ initialScopes[0]!, 'rejected-one', 'rejected-two' ];
		const reporterKey = `${REPORTER_SCOPES_KEY_PREFIX}${ipAddress}`;

		expect(await writeScopes(storage, ipAddress, initialScopes)).to.equal(true);
		expect(await writeScopes(storage, ipAddress, rejectedScopes)).to.equal(false);
		expect(await redis.zCard(reporterKey)).to.equal(MAX_SCOPES_PER_REPORTER - 1);
		expect(await redis.sIsMember(KNOWN_SCOPES_KEY, 'rejected-one')).to.equal(0);
		expect(await redis.exists(scopeKey('rejected-one'))).to.equal(0);
		expect(await redis.exists(scopeKey('rejected-two'))).to.equal(0);

		expect(await writeScopes(storage, ipAddress, [ 'accepted-64th' ])).to.equal(true);
		expect(await redis.zCard(reporterKey)).to.equal(MAX_SCOPES_PER_REPORTER);
	});

	it('atomically enforces the per-IP limit for concurrent reports', async () => {
		const storage = createStorage();
		const ipAddress = '192.0.2.65';
		const firstScopes = Array.from({ length: 40 }, (_, index) => `first-${index}`);
		const secondScopes = Array.from({ length: 40 }, (_, index) => `second-${index}`);
		const [ firstAccepted, secondAccepted ] = await Promise.all([
			writeScopes(storage, ipAddress, firstScopes),
			writeScopes(storage, ipAddress, secondScopes),
		]);
		const rejectedScopes = firstAccepted ? secondScopes : firstScopes;

		expect([ firstAccepted, secondAccepted ].filter(Boolean)).to.have.length(1);
		expect(await redis.zCard(`${REPORTER_SCOPES_KEY_PREFIX}${ipAddress}`)).to.equal(40);

		for (const scope of rejectedScopes) {
			expect(await redis.exists(scopeKey(scope))).to.equal(0);
		}
	});

	it('uses one reporter identity for an IPv6 /64', async () => {
		const storage = createStorage();
		const firstIp = '2001:db8:1:2::1';
		const secondIp = '2001:db8:1:2::2';
		const reporterIdentity = getIpKey(firstIp);
		const generalKey = scopeKey('general');

		expect(await writeScopes(storage, firstIp, [ 'general' ])).to.equal(true);
		expect(await writeScopes(storage, secondIp, [ 'general' ])).to.equal(true);

		expect(await redis.zRange(generalKey, 0, -1)).to.deep.equal([ reporterIdentity ]);
		expect(await redis.zCard(`${REPORTER_SCOPES_KEY_PREFIX}${reporterIdentity}`)).to.equal(1);

		const additionalScopes = Array.from({ length: MAX_SCOPES_PER_REPORTER }, (_, index) => `additional-${index}`);
		expect(await writeScopes(storage, secondIp, additionalScopes)).to.equal(false);
	});

	it('allows new scopes after an IP\'s previous scopes expire', async () => {
		const storage = createStorage();
		const ipAddress = '192.0.2.66';
		const reporterKey = `${REPORTER_SCOPES_KEY_PREFIX}${ipAddress}`;
		const [ redisNow ] = await redis.time();
		const cutoff = Number(redisNow) - SCOPE_ACTIVE_WINDOW;
		const expiredScopes = Array.from({ length: MAX_SCOPES_PER_REPORTER }, (_, index) => `expired-${index}`);
		const replacementScopes = Array.from({ length: MAX_SCOPES_PER_REPORTER }, (_, index) => `replacement-${index}`);

		reporterIps.add(ipAddress);
		await redis.zAdd(reporterKey, expiredScopes.map(scope => ({ score: cutoff, value: scope })));

		expect(await writeScopes(storage, ipAddress, replacementScopes)).to.equal(true);
		expect(await redis.zCard(reporterKey)).to.equal(MAX_SCOPES_PER_REPORTER);
		expect(await redis.zScore(reporterKey, expiredScopes[0]!)).to.equal(null);
		expect(await redis.ttl(reporterKey)).to.be.within(SCOPE_ACTIVE_WINDOW - 2, SCOPE_ACTIVE_WINDOW);
	});

	it('requires both ten reporters and half of the reporting fleet', async () => {
		const writer = createStorage();
		const scopes = [ 'general', 'alpha', 'below-half' ];
		scopes.forEach(scopeKey);

		await report(writer, 9, [ 'general', 'alpha' ]);
		expect(await redis.sIsMember(KNOWN_SCOPES_KEY, 'alpha')).to.equal(0);
		expect(await createStorage().readScopes()).to.deep.equal([]);

		await writeScopes(writer, '192.0.2.9', [ 'general', 'alpha' ]);
		expect(await redis.sIsMember(KNOWN_SCOPES_KEY, 'alpha')).to.equal(1);
		expect(await createStorage().readScopes()).to.deep.equal([ 'alpha', 'general' ]);

		await report(writer, 10, [ 'general' ], 10);
		await report(writer, 9, [ 'below-half' ]);

		expect(await createStorage().readScopes()).to.deep.equal([ 'alpha', 'general' ]);
	});

	it('excludes scopes reported by only one IP', async () => {
		const storage = createStorage();
		[ 'general', 'arbitrary-one', 'arbitrary-two' ].forEach(scopeKey);

		await report(storage, 10, [ 'general' ]);
		await writeScopes(storage, '192.0.2.250', [ 'arbitrary-one', 'arbitrary-two' ]);

		expect(await createStorage().readScopes()).to.deep.equal([ 'general' ]);
	});

	it('returns eligible scopes alphabetically', async () => {
		const storage = createStorage();
		[ 'general', 'zeta', 'alpha' ].forEach(scopeKey);

		await report(storage, 10, [ 'general', 'zeta', 'alpha' ]);

		expect(await createStorage().readScopes()).to.deep.equal([ 'alpha', 'general', 'zeta' ]);
	});

	it('removes scopes with no reporters from the known-scope set', async () => {
		const storage = createStorage();
		scopeKey('general');
		scopeKey('dead');

		await report(storage, 10, [ 'general' ]);
		await redis.sAdd(KNOWN_SCOPES_KEY, 'dead');
		await createStorage().readScopes();

		expect(await redis.sIsMember(KNOWN_SCOPES_KEY, 'dead')).to.equal(0);
	});

	it('excludes reporters that expire without another report', async () => {
		const storage = createStorage();
		const generalKey = scopeKey('general');
		const partialKey = scopeKey('partial');
		const [ redisNow ] = await redis.time();
		const now = Number(redisNow);
		const expiredAt = now - SCOPE_ACTIVE_WINDOW;
		const reporters = Array.from({ length: 10 }, (_, index) => `192.0.2.${index}`);

		await redis.sAdd(KNOWN_SCOPES_KEY, [ 'general', 'partial' ]);
		await redis.zAdd(generalKey, reporters.map(value => ({ score: now, value })));

		await redis.zAdd(partialKey, reporters.map((value, index) => ({
			score: index === 0 ? expiredAt : now,
			value,
		})));

		expect(await storage.readScopes()).to.deep.equal([ 'general' ]);
		expect(await redis.zCard(partialKey)).to.equal(9);
		expect(await redis.sIsMember(KNOWN_SCOPES_KEY, 'partial')).to.equal(0);
	});

	it('delegates scope registration to one Redis command', async () => {
		const storage = createStorage();
		const ipAddress = '192.0.2.100';
		const scopes = [ 'general', 'status-manager' ];
		const registerScopes = sandbox.stub(redis, 'registerProbeLogScopes').resolves(true);
		const separateCommands = [
			sandbox.spy(redis, 'sAdd'),
			sandbox.spy(redis, 'zAdd'),
			sandbox.spy(redis, 'zRemRangeByScore'),
			sandbox.spy(redis, 'expire'),
		];

		expect(await writeScopes(storage, ipAddress, scopes)).to.equal(true);

		expect(registerScopes.calledOnceWithExactly(
			`${REPORTER_SCOPES_KEY_PREFIX}${ipAddress}`,
			KNOWN_SCOPES_KEY,
			scopes.map(scope => `${SCOPE_KEY_PREFIX}${scope}`),
			ipAddress,
			SCOPE_ACTIVE_WINDOW,
			MAX_SCOPES_PER_REPORTER,
			MIN_SCOPE_REPORTERS,
			scopes,
		)).to.equal(true);

		expect(separateCommands.some(command => command.called)).to.equal(false);
	});

	it('returns cached non-empty results until one hour expires', async () => {
		const storage = createStorage();
		[ 'general', 'cached' ].forEach(scopeKey);
		await report(storage, 10, [ 'general', 'cached' ]);

		expect(await storage.readScopes()).to.deep.equal([ 'cached', 'general' ]);
		await redis.del(scopeKey('cached'));
		expect(await storage.readScopes()).to.deep.equal([ 'cached', 'general' ]);

		clock.tick(SCOPE_READ_CACHE_TTL);
		expect(await storage.readScopes()).to.deep.equal([ 'general' ]);
	});

	it('returns cached empty results until one hour expires', async () => {
		const storage = createStorage();
		scopeKey('general');

		expect(await storage.readScopes()).to.deep.equal([]);
		await report(storage, 10, [ 'general' ]);
		expect(await storage.readScopes()).to.deep.equal([]);

		clock.tick(SCOPE_READ_CACHE_TTL);
		expect(await storage.readScopes()).to.deep.equal([ 'general' ]);
	});
});

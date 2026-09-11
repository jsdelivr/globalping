import { expect } from 'chai';
import * as sinon from 'sinon';
import { handleLogScopes } from '../../../../src/probe/handler/log-scopes.js';
import { getProbeLogScopesStorage } from '../../../../src/probe/log-scopes-storage.js';
import type { ServerProbe } from '../../../../src/probe/types.js';

describe('probe log scopes', () => {
	const sandbox = sinon.createSandbox();
	const probe = {
		uuid: '50d4b7ee-b37d-4c19-8e19-3155309cf90f',
		ipAddress: '1.1.1.1',
	} as ServerProbe;

	afterEach(() => sandbox.restore());

	it('stores valid reports using the probe IP address', async () => {
		const writeScopes = sandbox.stub(getProbeLogScopesStorage(), 'writeScopes').resolves(true);
		const scopes = [ 'general' ];

		await handleLogScopes(probe)(scopes);

		expect(writeScopes.calledOnceWithExactly(probe.ipAddress, scopes)).to.equal(true);
		expect(writeScopes.calledWith(probe.uuid, scopes)).to.equal(false);
	});

	it('accepts the maximum report size and scope-name length', async () => {
		const writeScopes = sandbox.stub(getProbeLogScopesStorage(), 'writeScopes').resolves(true);
		const scopes = [ 'a'.repeat(64), ...Array.from({ length: 63 }, (_, index) => `scope-${index}`) ];

		await handleLogScopes(probe)(scopes);

		expect(writeScopes.calledOnceWithExactly(probe.ipAddress, scopes)).to.equal(true);
	});

	it('rejects reports that exceed the per-IP scope limit', async () => {
		sandbox.stub(getProbeLogScopesStorage(), 'writeScopes').resolves(false);
		const error = await handleLogScopes(probe)([ 'scope' ]).catch(error => error as Error);

		expect(error).to.be.instanceof(Error);
		expect((error as Error).message).to.equal('Probe log scope limit exceeded.');
	});

	for (const { name, payload } of [
		{ name: 'reports containing more than 64 scopes', payload: Array.from({ length: 65 }, (_, index) => `scope-${index}`) },
		{ name: 'scope names longer than 64 characters', payload: [ 'a'.repeat(65) ] },
		{ name: 'non-array payloads', payload: 'scope' },
		{ name: 'empty scope names', payload: [ '' ] },
		{ name: 'scope names containing whitespace', payload: [ 'scope name' ] },
		{ name: 'scope names containing commas', payload: [ 'scope,name' ] },
		{ name: 'scope names containing unsupported characters', payload: [ 'scope.name' ] },
		{ name: 'non-string scope names', payload: [ 1 ] },
	]) {
		it(`rejects ${name} before writing`, async () => {
			const writeScopes = sandbox.stub(getProbeLogScopesStorage(), 'writeScopes').resolves(true);
			const error = await handleLogScopes(probe)(payload as string[]).catch(error => error as Error);

			expect(error).to.be.instanceof(Error);
			expect(writeScopes.called).to.equal(false);
		});
	}
});

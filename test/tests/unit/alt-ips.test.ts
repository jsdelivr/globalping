import sinon from 'sinon';
import { expect } from 'chai';
import createHttpError from 'http-errors';
import { ALT_IP_REQ_MESSAGE_TYPE, ALT_IP_RES_MESSAGE_TYPE, AltIps } from '../../../src/lib/alt-ips.js';
import { type ServerSocket } from '../../../src/lib/ws/server.js';

describe('AltIps', () => {
	const sandbox = sinon.createSandbox();

	let socket: ServerSocket;
	let syncedProbeList: any;
	let geoIpClient: any;
	let altIps: AltIps;

	beforeEach(() => {
		socket = { id: 'socketId1', data: { probe: {
			client: 'socketId1',
			ipAddress: '1.1.1.1',
			altIpAddresses: [],
			location: {
				country: 'IT',
			},
		} } } as unknown as ServerSocket;

		syncedProbeList = {
			subscribeToNodeMessages: sandbox.stub(),
			fetchProbes: sandbox.stub().resolves([ socket.data.probe ]),
			getProbeByIp: sandbox.stub(),
			getNodeId: sandbox.stub().returns('nodeId1'),
			publishToNode: sandbox.stub().resolves('messageId1'),
			getNodeIdBySocketId: sandbox.stub().callsFake((socketId: string) => {
				return socketId === 'socketId1' ? 'nodeId1' : null;
			}),
		};

		geoIpClient = {
			lookup: sandbox.stub().resolves({ country: 'IT', isAnycast: false }),
		};

		altIps = new AltIps(syncedProbeList, geoIpClient);
	});

	afterEach(async () => {
		sandbox.reset();
	});

	it('should add alt ip for local probe', async () => {
		const token = await altIps.generateToken(socket);
		await altIps.validateTokenFromHttp({
			socketId: 'socketId1',
			ip: '2.2.2.2',
			token,
		});

		expect(socket.data.probe.altIpAddresses).to.deep.equal([ '2.2.2.2' ]);
	});

	it('should not add alt ip for duplicated connected ip', async () => {
		syncedProbeList.getProbeByIp.returns({});

		const token = await altIps.generateToken(socket);
		const err = await altIps.validateTokenFromHttp({
			socketId: 'socketId1',
			ip: '2.2.2.2',
			token,
		}).catch(err => err);

		expect(syncedProbeList.getProbeByIp.args[0]).to.deep.equal([ '2.2.2.2' ]);
		expect(err).to.deep.equal(createHttpError(400, 'Another probe with that ip is already connected.', { type: 'alt_ip_duplication' }));
		expect(socket.data.probe.altIpAddresses).to.deep.equal([]);
	});

	it('should do nothing if alt ip is already added', async () => {
		syncedProbeList.getProbeByIp.returns(socket.data.probe);

		const token = await altIps.generateToken(socket);
		await altIps.validateTokenFromHttp({
			socketId: 'socketId1',
			ip: '2.2.2.2',
			token,
		});

		expect(socket.data.probe.altIpAddresses).to.deep.equal([]);
	});

	it('should throw for invalid token for local probe', async () => {
		const err = await altIps.validateTokenFromHttp({
			socketId: 'socketId1',
			ip: '2.2.2.2',
			token: 'invalidToken',
		}).catch(err => err);

		expect(err).to.deep.equal(createHttpError(400, 'Token value is wrong.', { type: 'wrong_token' }));
		expect(socket.data.probe.altIpAddresses).to.deep.equal([]);
	});

	it('should throw for not found probe', async () => {
		const err = await altIps.validateTokenFromHttp({
			socketId: 'socketId2',
			ip: '2.2.2.2',
			token: 'token2',
		}).catch(err => err);

		expect(err).to.deep.equal(createHttpError(400, 'Unable to find a probe by specified socketId.', { type: 'probe_not_found' }));
	});

	it('should add alt ip for external probe', async () => {
		syncedProbeList.getNodeIdBySocketId.returns('nodeId2');

		setTimeout(() => {
			altIps.handleRes({
				id: 'messageId2',
				reqNodeId: 'nodeId1',
				type: ALT_IP_RES_MESSAGE_TYPE,
				body: {
					result: 'success',
					reqMessageId: 'messageId1',
				},
			});
		});

		await altIps.validateTokenFromHttp({
			socketId: 'socketId2',
			ip: '2.2.2.2',
			token: 'token2',
		});

		expect(syncedProbeList.publishToNode.args[0]).to.deep.equal([
			'nodeId2',
			'alt-ip:req',
			{ socketId: 'socketId2', ip: '2.2.2.2', token: 'token2' },
		]);
	});

	it('should throw for not found remote probe', async () => {
		syncedProbeList.getNodeIdBySocketId.returns('nodeId2');

		setTimeout(() => {
			altIps.handleRes({
				id: 'messageId2',
				reqNodeId: 'nodeId1',
				type: ALT_IP_RES_MESSAGE_TYPE,
				body: {
					result: 'probe-not-found',
					reqMessageId: 'messageId1',
				},
			});
		});

		const err = await altIps.validateTokenFromHttp({
			socketId: 'socketId2',
			ip: '2.2.2.2',
			token: 'token2',
		}).catch(err => err);

		expect(syncedProbeList.publishToNode.args[0]).to.deep.equal([
			'nodeId2',
			'alt-ip:req',
			{ socketId: 'socketId2', ip: '2.2.2.2', token: 'token2' },
		]);

		expect(err).to.deep.equal(createHttpError(400, 'Unable to find a probe on the remote node.', { type: 'probe_not_found_on_remote' }));
	});

	it('should throw if no answer from remote node', async () => {
		syncedProbeList.getNodeIdBySocketId.returns('nodeId2');

		setTimeout(async () => {
			clock.tickAsync(15000);
		});

		const err = await altIps.validateTokenFromHttp({
			socketId: 'socketId2',
			ip: '2.2.2.2',
			token: 'token2',
		}).catch(err => err);

		expect(syncedProbeList.publishToNode.args[0]).to.deep.equal([
			'nodeId2',
			'alt-ip:req',
			{ socketId: 'socketId2', ip: '2.2.2.2', token: 'token2' },
		]);

		expect(err).to.deep.equal(createHttpError(504, 'Node owning the probe failed to handle alt ip in specified timeout.', { type: 'node_response_timeout' }));
	});

	it('should add alt ip from pub/sub', async () => {
		const token = await altIps.generateToken(socket);
		geoIpClient.lookup.resolves({ country: 'IT', isAnycast: false });

		await altIps.validateTokenFromPubSub({
			id: 'message1',
			reqNodeId: 'node1',
			type: ALT_IP_REQ_MESSAGE_TYPE,
			body: {
				socketId: 'socketId2',
				ip: '2.2.2.2',
				token,
			},
		});

		expect(socket.data.probe.altIpAddresses).to.deep.equal([ '2.2.2.2' ]);

		expect(syncedProbeList.publishToNode.args[0]).to.deep.equal([
			'node1',
			'alt-ip:res',
			{ result: 'success', reqMessageId: 'message1' },
		]);
	});

	it('should throw if local probe not found after pub/sub message', async () => {
		await altIps.validateTokenFromPubSub({
			id: 'message1',
			reqNodeId: 'node1',
			type: ALT_IP_REQ_MESSAGE_TYPE,
			body: {
				socketId: 'socketId2',
				ip: '2.2.2.2',
				token: 'token2',
			},
		});

		expect(syncedProbeList.publishToNode.args[0]).to.deep.equal([
			'node1',
			'alt-ip:res',
			{ result: 'probe-not-found', reqMessageId: 'message1' },
		]);
	});

	it('should throw if alt ip is anycast', async () => {
		const token = await altIps.generateToken(socket);
		geoIpClient.lookup.resolves({ country: 'IT', isAnycast: true });

		await altIps.validateTokenFromPubSub({
			id: 'message1',
			reqNodeId: 'node1',
			type: ALT_IP_REQ_MESSAGE_TYPE,
			body: {
				socketId: 'socketId2',
				ip: '2.2.2.2',
				token,
			},
		});

		expect(socket.data.probe.altIpAddresses).to.deep.equal([]);

		expect(syncedProbeList.publishToNode.args[0]).to.deep.equal([
			'node1',
			'alt-ip:res',
			{ result: 'invalid-alt-ip', reqMessageId: 'message1' },
		]);
	});

	it('should throw if alt ip is not in the same country', async () => {
		const token = await altIps.generateToken(socket);
		geoIpClient.lookup.resolves({ country: 'FR', isAnycast: false });

		await altIps.validateTokenFromPubSub({
			id: 'message1',
			reqNodeId: 'node1',
			type: ALT_IP_REQ_MESSAGE_TYPE,
			body: {
				socketId: 'socketId2',
				ip: '2.2.2.2',
				token,
			},
		});

		expect(socket.data.probe.altIpAddresses).to.deep.equal([]);

		expect(syncedProbeList.publishToNode.args[0]).to.deep.equal([
			'node1',
			'alt-ip:res',
			{ result: 'invalid-alt-ip', reqMessageId: 'message1' },
		]);
	});
});

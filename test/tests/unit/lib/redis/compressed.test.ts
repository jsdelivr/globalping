import { brotliCompress as brotliCompressCallback } from 'node:zlib';
import { promisify } from 'node:util';
import { expect } from 'chai';
import * as sinon from 'sinon';

import { compressedJsonCompress, compressedJsonGet, compressedJsonGetBuffer, compressedJsonGetBufferCompressed } from '../../../../../src/lib/redis/compressed.js';

const brotliCompress = promisify(brotliCompressCallback);

describe('redis compressed helper', () => {
	const sandbox = sinon.createSandbox();

	afterEach(() => {
		sandbox.restore();
	});

	it('should call COMPRESSED.JSON.GET with the same options shape as JSON.GET', async () => {
		const sendCommand = sandbox.stub().resolves(Buffer.concat([ Buffer.from([ 0x00 ]), Buffer.from('{"ok":true}') ]));

		const result = await compressedJsonGetBuffer.call({ sendCommand } as never, 'key', { path: '$.foo' });

		expect(result?.toString()).to.equal('{"ok":true}');

		expect(sendCommand.firstCall.args).to.deep.equal([
			'key',
			true,
			[ 'COMPRESSED.JSON.GET', 'key', '$.foo' ],
			{ returnBuffers: true },
		]);
	});

	it('should decode Brotli-compressed replies', async () => {
		const compressed = await brotliCompress(Buffer.from('{"ok":true}'));
		const sendCommand = sandbox.stub().resolves(Buffer.concat([ Buffer.from([ 0x01 ]), compressed ]));

		const result = await compressedJsonGetBuffer.call({ sendCommand } as never, 'key');

		expect(result?.toString()).to.equal('{"ok":true}');
	});

	it('should normalize plain replies into Brotli-compressed buffers', async () => {
		const sendCommand = sandbox.stub().resolves(Buffer.concat([ Buffer.from([ 0x00 ]), Buffer.from('{"ok":true}') ]));

		const result = await compressedJsonGetBufferCompressed.call({ sendCommand } as never, 'key');

		expect(result).to.be.instanceOf(Buffer);
		expect(result).to.deep.equal(await brotliCompress(Buffer.from('{"ok":true}')));
	});

	it('should unwrap Brotli replies for compressed buffer reads', async () => {
		const compressed = await brotliCompress(Buffer.from('{"ok":true}'));
		const sendCommand = sandbox.stub().resolves(Buffer.concat([ Buffer.from([ 0x01 ]), compressed ]));

		const result = await compressedJsonGetBufferCompressed.call({ sendCommand } as never, 'key');

		expect(result).to.deep.equal(compressed);
	});

	it('should call COMPRESSED.JSON.COMPRESS for RedisJSON keys', async () => {
		const sendCommand = sandbox.stub().resolves('OK');

		const result = await compressedJsonCompress.call({ sendCommand } as never, 'key');

		expect(result).to.equal('OK');

		expect(sendCommand.firstCall.args).to.deep.equal([
			'key',
			false,
			[ 'COMPRESSED.JSON.COMPRESS', 'key' ],
		]);
	});

	it('should parse JSON replies for compressedJsonGet', async () => {
		const sendCommand = sandbox.stub().resolves(Buffer.concat([ Buffer.from([ 0x00 ]), Buffer.from('{"ok":true}') ]));

		const result = await compressedJsonGet.call({ sendCommand } as never, 'key');

		expect(result).to.deep.equal({ ok: true });
	});
});

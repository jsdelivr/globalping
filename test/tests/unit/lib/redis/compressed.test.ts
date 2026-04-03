import { brotliCompress as brotliCompressCallback } from 'node:zlib';
import { promisify } from 'node:util';
import { expect } from 'chai';
import * as sinon from 'sinon';

import { compressedJsonGetBuffer } from '../../../../../src/lib/redis/compressed.js';

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
});

import { defineScript } from 'redis';

export type RedisScripts = {
	count: {
		NUMBER_OF_KEYS: number;
		SCRIPT: string;
		transformArguments (this: void, key: string): Array<string>;
		transformReply (this: void, reply: number): number;
	} & {
		SHA1: string;
	}
};

export const count = defineScript({
	NUMBER_OF_KEYS: 1,
	SCRIPT: `
	local cursor = 0
	local count = 0
	repeat
		local result = redis.call('SCAN', cursor, 'MATCH', KEYS[1], 'COUNT', 1000)
		cursor = tonumber(result[1])
		local keys = result[2]
		count = count + #keys
	until cursor == 0
	return count
	`,
	transformArguments (key: string) {
		return [ key ];
	},
	transformReply (reply: number) {
		return reply;
	},
});

import Bluebird from 'bluebird';
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const up = async (db) => {
	const __dirname = path.dirname(fileURLToPath(import.meta.url));
	const sql = fs.readFileSync(path.join(__dirname, 'init.sql'), 'utf8');
	const queries = sql.split('\n\n');
	await Bluebird.map(queries, query => db.schema.raw(query));
};

export const down = () => {};

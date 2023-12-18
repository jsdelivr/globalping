import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const up = async (db) => {
	const __dirname = path.dirname(fileURLToPath(import.meta.url));
	const query = fs.readFileSync(path.join(__dirname, 'init.sql'), 'utf8');
	await db.schema.raw(query);
};

export const down = () => {};

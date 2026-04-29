import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const findProjectRoot = () => {
	let currentDir = path.dirname(fileURLToPath(import.meta.url));

	while (true) {
		if (fs.existsSync(path.join(currentDir, 'package.json'))) {
			return currentDir;
		}

		const parentDir = path.dirname(currentDir);

		if (parentDir === currentDir) {
			throw new Error(`Could not find package.json from ${currentDir}`);
		}

		currentDir = parentDir;
	}
};

const projectRoot = findProjectRoot();

export const fromProjectRoot = (...parts: string[]) => path.join(projectRoot, ...parts);

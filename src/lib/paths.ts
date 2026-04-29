import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../..', import.meta.url));

export const fromProjectRoot = (...parts: string[]) => path.join(projectRoot, ...parts);

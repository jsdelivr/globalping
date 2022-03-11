import {getRedisClient} from '../lib/redis/client.js';
import {ProbeStore} from './store.js';

export const probeStore = new ProbeStore(getRedisClient());

import {scopedLogger} from './logger.js';
import {updateMalwareFiles} from './malware/client.js';
import {updateIpRangeFiles} from './ip-ranges.js';

const logger = scopedLogger('malware.blacklist');

logger.info('updating malware blacklist JSON files');
await updateMalwareFiles();
logger.info('updating cloud ip ranges JSON files');
await updateIpRangeFiles();
logger.info('update complete');

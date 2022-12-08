import {scopedLogger} from './logger.js';
import {updateMalwareList} from './malware/client.js';
import {updateIpRangesList} from './ip-ranges.js';

const logger = scopedLogger('malware.blacklist');

logger.info('updating malware blacklist JSON files');
await updateMalwareList();
logger.info('updating cloud ip ranges JSON files');
await updateIpRangesList();
logger.info('update complete');

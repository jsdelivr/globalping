import { scopedLogger } from './logger.js';
import { updateMalwareFiles } from './malware/client.js';
import { updateIpRangeFiles } from './cloud-ip-ranges.js';
import { updateGeonamesCitiesFile } from './geoip/city-approximation.js';

const logger = scopedLogger('download-files');

logger.info('Updating malware blacklist JSON files.');
await updateMalwareFiles();
logger.info('Updating cloud ip ranges JSON files.');
await updateIpRangeFiles();
logger.info('Updating geonames cities CSV file.');
await updateGeonamesCitiesFile();
logger.info('Update complete.');

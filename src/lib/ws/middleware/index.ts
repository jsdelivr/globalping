import {errorHandler} from '../helper/error-handler.js';
import {probeMetadata as probeMetadataMw} from './probe-metadata.js';

export const probeMetadata = errorHandler(probeMetadataMw);

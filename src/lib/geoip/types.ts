import type {ProbeLocation} from '../../probe/types.js';

export type LocationInfo = Omit<ProbeLocation, 'region'>;
export type LocationInfoWithProvider = LocationInfo & {provider: string};

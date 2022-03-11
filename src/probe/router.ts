import _ from 'lodash';
import type {Locations} from '../measurement/locations.js';
import type {Probe} from './store.js';
import {probeStore} from './store-factory.js';

const getGlobalyDistributed = async () => {
	const all = await probeStore.getAll();

	return all;
};

export const findMatchingProbes = async (locations: Locations[], limit: number): Promise<Probe[]> => {
	let probes: Probe[] = [];

	probes = await (locations.length > 0 ? probeStore.getByLocations(locations) : getGlobalyDistributed());

	return _.sampleSize(probes, limit);
};

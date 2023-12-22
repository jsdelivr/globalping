import config from 'config';
import _ from 'lodash';
import type { Location } from '../lib/location/types.js';
import type { Probe, ProbeLocation } from './types.js';

/*
 * [
 *    [ public key, internal key]
 * ]
 *
 * */
const locationKeyMap = [
	[ 'network', 'normalizedNetwork' ],
	[ 'city', 'normalizedCity' ],
];

export class ProbesLocationFilter {
	static magicFilter (probes: Probe[], magicLocation: string) {
		let filteredProbes = probes;
		const keywords = magicLocation.split('+');

		for (const keyword of keywords) {
			const closestExactMatchPosition = probes.reduce((smallestExactMatchPosition, probe) => {
				const exactMatchPosition = ProbesLocationFilter.getExactIndexPosition(probe, keyword);

				if (exactMatchPosition === -1) {
					return smallestExactMatchPosition;
				}

				return exactMatchPosition < smallestExactMatchPosition ? exactMatchPosition : smallestExactMatchPosition;
			}, Number.POSITIVE_INFINITY);
			const noExactMatches = closestExactMatchPosition === Number.POSITIVE_INFINITY;

			if (noExactMatches) {
				filteredProbes = filteredProbes.filter(probe => ProbesLocationFilter.getIndexPosition(probe, keyword) !== -1);
			} else {
				filteredProbes = filteredProbes.filter(probe => ProbesLocationFilter.getExactIndexPosition(probe, keyword) === closestExactMatchPosition);
			}
		}

		return filteredProbes;
	}

	static getExactIndexPosition (probe: Probe, value: string) {
		return probe.index.findIndex(category => category.some(index => index === value.toLowerCase().replaceAll('-', ' ').trim()));
	}

	static getIndexPosition (probe: Probe, value: string) {
		return probe.index.findIndex(category => category.some(index => index.includes(value.toLowerCase().replaceAll('-', ' ').trim())));
	}

	static hasTag (probe: Probe, tag: string) {
		return probe.tags.some(({ value }) => value.toLowerCase() === tag);
	}

	public filterGloballyDistibuted (probes: Probe[], limit: number): Probe[] {
		const distribution = this.getDistibutionConfig();
		return this.filterByLocationAndWeight(probes, distribution, limit);
	}

	public filterByLocation (probes: Probe[], location: Location): Probe[] {
		if (location.magic?.toLowerCase() === 'world') {
			return _.shuffle(this.filterGloballyDistibuted(probes, probes.length));
		}

		let filteredProbes = probes;

		Object.keys(location).forEach((key) => {
			if (key === 'tags') {
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				filteredProbes = probes.filter(probe => location.tags!.every(tag => ProbesLocationFilter.hasTag(probe, tag)));
			} else if (key === 'magic') {
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				filteredProbes = ProbesLocationFilter.magicFilter(filteredProbes, location.magic!);
			} else {
				const probeKey = locationKeyMap.find(m => m.includes(key))?.[1] ?? key;
				filteredProbes = filteredProbes.filter(probe => location[key as keyof Location] === probe.location[probeKey as keyof ProbeLocation]);
			}
		});

		const isMagicSorting = Object.keys(location).includes('magic');
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		return isMagicSorting ? this.magicSort(filteredProbes, location.magic!) : _.shuffle(filteredProbes);
	}

	public filterByLocationAndWeight (probes: Probe[], distribution: Map<Location, number>, limit: number): Probe[] {
		const groupedByLocation = new Map<Location, Probe[]>();

		for (const [ location ] of distribution) {
			const foundProbes = this.filterByLocation(probes, location);

			if (foundProbes.length > 0) {
				groupedByLocation.set(location, foundProbes);
			}
		}

		const pickedProbes = new Set<Probe>();

		while (groupedByLocation.size > 0 && pickedProbes.size < limit) {
			const selectedCount = pickedProbes.size;

			for (const [ location, locationProbes ] of groupedByLocation) {
				if (pickedProbes.size === limit) {
					break;
				}

				const locationWeight = distribution.get(location);

				if (!locationWeight) {
					continue;
				}

				let count = Math.ceil((limit - selectedCount) * locationWeight / 100);
				const remainingSpace = limit - pickedProbes.size;
				count = count > remainingSpace ? remainingSpace : count;

				for (const s of locationProbes.splice(0, count)) {
					pickedProbes.add(s);
				}

				if (locationProbes.length === 0) {
					groupedByLocation.delete(location);
				}
			}
		}

		return [ ...pickedProbes ];
	}

	private magicSort (probes: Probe[], magicString: string): Probe[] {
		const getClosestIndexPosition = (probe: Probe) => {
			const keywords = magicString.split('+');
			const closestIndexPosition = keywords.reduce((smallesIndex, keyword) => {
				const indexPosition = ProbesLocationFilter.getIndexPosition(probe, keyword);
				return indexPosition < smallesIndex ? indexPosition : smallesIndex;
			}, Number.POSITIVE_INFINITY);
			return closestIndexPosition;
		};

		const probesGroupedByIndexPosition = _.groupBy(probes, getClosestIndexPosition);
		const groupsSortedByIndexPosition = Object.values(probesGroupedByIndexPosition); // Object.values sorts values by key
		const groupsWithShuffledItems = groupsSortedByIndexPosition.map(group => _.shuffle(group));
		const resultProbes = groupsWithShuffledItems.flat();

		return resultProbes;
	}

	private getDistibutionConfig () {
		return new Map<Location, number>(_.shuffle(Object.entries(config.get<Record<string, number>>('measurement.globalDistribution')))
			.map(([ value, weight ]) => [{ continent: value }, weight ]));
	}
}

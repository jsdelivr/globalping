import config from 'config';
import _ from 'lodash';
import type { Location } from '../lib/location/types.js';
import type { Probe, ProbeLocation } from './types.js';

/*
 * [ public key ]: internal key
 *
 * */
const locationKeyMap = {
	network: 'normalizedNetwork',
	city: 'normalizedCity',
};

export class ProbesLocationFilter {
	static magicFilter (probes: Probe[], magicLocation: string) {
		let resultProbes = probes;
		const keywords = magicLocation.toLowerCase().split('+').map(k => ({ system: k.replaceAll('-', ' ').trim(), userTag: k.trim() }));

		for (const keyword of keywords) {
			const closestExactMatchPosition = probes.reduce((smallestExactMatchPosition, probe) => {
				const exactMatchPosition = ProbesLocationFilter.getExactIndexPosition(probe, keyword.system);

				if (exactMatchPosition === -1) {
					return smallestExactMatchPosition;
				}

				return exactMatchPosition < smallestExactMatchPosition ? exactMatchPosition : smallestExactMatchPosition;
			}, Number.POSITIVE_INFINITY);
			const noExactMatches = closestExactMatchPosition === Number.POSITIVE_INFINITY;

			let filteredProbes = [];

			if (noExactMatches) {
				filteredProbes = resultProbes.filter(probe => ProbesLocationFilter.getIndexPosition(probe, keyword.system) !== -1);
			} else {
				filteredProbes = resultProbes.filter(probe => ProbesLocationFilter.getExactIndexPosition(probe, keyword.system) === closestExactMatchPosition);
			}

			if (filteredProbes.length === 0) {
				filteredProbes = resultProbes.filter(probe => ProbesLocationFilter.hasUserTag(probe, keyword.userTag));
			}

			resultProbes = filteredProbes;
		}

		return resultProbes;
	}

	static getExactIndexPosition (probe: Probe, filterValue: string) {
		return probe.index.findIndex(category => category.some(index => index === filterValue));
	}

	static getIndexPosition (probe: Probe, filterValue: string) {
		return probe.index.findIndex(category => category.some(index => index.includes(filterValue)));
	}

	static hasTag (probe: Probe, filterValue: string) {
		return probe.tags.some(({ value }) => value.toLowerCase() === filterValue.toLowerCase());
	}

	static hasUserTag (probe: Probe, filterValue: string) {
		return probe.tags.filter(({ type }) => type === 'user').some(({ value }) => value.toLowerCase() === filterValue);
	}

	public filterGloballyDistributed (probes: Probe[], limit: number): Probe[] {
		const distribution = this.getDistributionConfig();
		return this.filterByLocationAndWeight(probes, distribution, limit);
	}

	public filterByIpVersion (probes: Probe[], ipVersion: 4 | 6) : Probe[] {
		if (ipVersion === 4) {
			return probes.filter(probe => probe.isIPv4Supported);
		} else if (ipVersion === 6) {
			return probes.filter(probe => probe.isIPv6Supported);
		}

		return probes;
	}

	public filterByLocation (probes: Probe[], location: Location): Probe[] {
		if (location.magic?.toLowerCase() === 'world') {
			return this.diversifiedShuffle(this.filterGloballyDistributed(probes, probes.length));
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
				const probeKey = Object.hasOwn(locationKeyMap, key) ? locationKeyMap[key as keyof typeof locationKeyMap] : key;
				// @ts-expect-error it's a string
				// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
				const filterValue = Object.hasOwn(locationKeyMap, key) ? location[key].toLowerCase() as string : location[key as keyof Location];
				filteredProbes = filteredProbes.filter(probe => filterValue === probe.location[probeKey as keyof ProbeLocation]);
			}
		});

		const isMagicSorting = Object.keys(location).includes('magic');
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		return isMagicSorting ? this.magicSort(filteredProbes, location.magic!) : this.diversifiedShuffle(filteredProbes);
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
			const remainingWeight = [ ...distribution.values() ].reduce((sum, value) => sum + value, 0);

			for (const [ location, locationProbes ] of groupedByLocation) {
				if (pickedProbes.size === limit) {
					break;
				}

				const locationWeight = distribution.get(location) || 0;
				const count = Math.floor((limit - selectedCount) * locationWeight / remainingWeight) || 1;

				for (const s of locationProbes.splice(0, count)) {
					pickedProbes.add(s);
				}

				if (locationProbes.length === 0) {
					groupedByLocation.delete(location);
					distribution.delete(location);
				}
			}
		}

		return [ ...pickedProbes ];
	}

	private magicSort (probes: Probe[], magicString: string): Probe[] {
		const getClosestIndexPosition = (probe: Probe) => {
			const keywords = magicString.split('+');
			const closestIndexPosition = keywords.reduce((smallestIndex, keyword) => {
				const indexPosition = ProbesLocationFilter.getIndexPosition(probe, keyword);
				return indexPosition < smallestIndex ? indexPosition : smallestIndex;
			}, Number.POSITIVE_INFINITY);
			return closestIndexPosition;
		};

		const probesGroupedByIndexPosition = _.groupBy(probes, getClosestIndexPosition);
		const groupsSortedByIndexPosition = Object.values(probesGroupedByIndexPosition); // Object.values sorts values by key
		const groupsWithShuffledItems = groupsSortedByIndexPosition.map(group => this.diversifiedShuffle(group));
		const resultProbes = groupsWithShuffledItems.flat();

		return resultProbes;
	}

	// Returns the probes in randomized order while prioritizing unique locations.
	// See https://github.com/jsdelivr/globalping/issues/636#issuecomment-2748843542
	private diversifiedShuffle (probes: Probe[]): Probe[] {
		// Prioritize groups with more probes but preserve a bit of randomness by reducing the number of unique values.
		const groupRank = (count: number) => count < 8 ? Math.floor(count / 2) : Math.ceil(Math.log2(count));

		// Group by unique location + ASN, order by the ranking function.
		let groupedProbes = _(probes)
			.shuffle() // Ensure the initial order of groups and their content is random.
			.groupBy(probe => `${probe.location.country}-${probe.location.state}-${probe.location.city}-${probe.location.asn}`)
			.map((probes, groupKey) => ({ probes, rank: groupRank(probes.length), cityKey: groupKey.split('-').slice(0, -1).join('-'), prevSameCity: 0 }))
			.sort((a, b) => b.rank - a.rank)
			.value();

		// For each group, compute the frequency of the same city in earlier groups.
		const counts: {[k: string]: number} = {};
		const shuffledProbes: Probe[] = [];

		for (const group of groupedProbes) {
			group.prevSameCity = counts[group.cityKey] ?? (counts[group.cityKey] = 0);
			counts[group.cityKey]++;
		}

		// Prioritize less common cities within the same ranking group.
		groupedProbes.sort((a, b) => {
			if (a.rank === b.rank) {
				return a.prevSameCity - b.prevSameCity;
			}

			return b.rank - a.rank;
		});

		while (shuffledProbes.length < probes.length) {
			for (const group of groupedProbes) {
				if (group.probes.length) {
					shuffledProbes.push(group.probes.pop()!);
				}
			}

			groupedProbes = groupedProbes.filter(group => group.probes.length);
		}

		return shuffledProbes;
	}

	private getDistributionConfig () {
		return new Map<Location, number>(_.shuffle(Object.entries(config.get<Record<string, number>>('measurement.globalDistribution')))
			.map(([ value, weight ]) => [{ continent: value }, weight ]));
	}
}

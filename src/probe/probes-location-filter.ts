import { countries } from 'countries-list';
import config from 'config';
import _ from 'lodash';
import type { Location } from '../lib/location/types.js';
import type { Probe, ProbeLocation } from './types.js';
import { captureSpan } from '../lib/metrics.js';
import { alpha, aliases as countryAliases } from '../lib/location/countries.js';
import { continents } from '../lib/location/continents.js';
import { states, statesIso } from '../lib/location/states.js';
import { aliases as networkAliases } from '../lib/location/networks.js';
import { regionNames, aliases as regionAliases } from '../lib/location/regions.js';

/*
 * [ public key ]: internal key
 *
 * */
const locationKeyMap = {
	network: 'normalizedNetwork',
	city: 'normalizedCity',
};

export class ProbesLocationFilter {
	private readonly globalIndex: Set<string>[];

	constructor () {
		this.globalIndex = [
			/* 00 */ new Set(Object.keys(countries).map(c => c.toLowerCase())),
			/* 01 */ new Set(Object.values(alpha).map(c => c.toLowerCase())),
			/* 02 */ new Set(Object.values(countries).map(c => c.name.toLowerCase())),
			/* 03 */ new Set(countryAliases.flat()),
			/* 04 */ new Set(),
			/* 05 */ new Set(Object.values(states).map(s => s.toLowerCase())),
			/* 06 */ new Set(Object.values(statesIso).map(s => s.toLowerCase())),
			/* 07 */ new Set(Object.keys(states).map(s => s.toLowerCase())),
			/* 08 */ new Set(Object.keys(continents).map(c => c.toLowerCase())),
			/* 09 */ new Set(Object.values(continents).map(c => c.toLowerCase())),
			/* 10 */ new Set(regionNames.map(r => r.toLowerCase())),
			/* 11 */ new Set(regionAliases.flat()),
			/* 12 */ new Set(),
			/* 13 */ new Set(),
			/* 14 */ new Set(),
			/* 15 */ new Set(networkAliases.flat()),
		];
	}

	updateGlobalIndex (probes: Probe[]) {
		this.globalIndex[4] = new Set(probes.map(p => p.index[4]).flat());
		this.globalIndex[13] = new Set(probes.map(p => p.index[13]).flat());
		this.globalIndex[14] = new Set(probes.map(p => p.index[14]).flat());
	}

	getExactGlobalIndexPosition (keyword: string) {
		const i = this.globalIndex.findIndex((set, index) => {
			// Instead of collecting all ASNs, match anything in the specific format.
			if (index === 12) {
				return /^as\d+$/.test(keyword);
			}

			return set.has(keyword);
		});

		return i === -1 ? Number.MAX_SAFE_INTEGER : i;
	}

	magicFilter (probes: Probe[], magicLocation: string) {
		let resultProbes = probes;
		const keywords = magicLocation.toLowerCase().split('+').map(k => ({ system: k.replaceAll('-', ' ').trim(), userTag: k.trim() }));

		const keywordsWithPositions = keywords.map(keyword => ({
			keyword,
			position: this.getExactGlobalIndexPosition(keyword.system),
		})).sort((a, b) => a.position - b.position);

		for (const { keyword, position } of keywordsWithPositions) {
			const noExactMatches = position === Number.MAX_SAFE_INTEGER;
			let filteredProbes = [];

			if (noExactMatches) {
				filteredProbes = resultProbes.filter(probe => this.getIndexPosition(probe, keyword.system) !== -1);
			} else {
				filteredProbes = resultProbes.filter(probe => this.checkExactIndexPosition(probe, keyword.system, position));
			}

			if (filteredProbes.length === 0 && keyword.userTag.startsWith('u-')) {
				filteredProbes = resultProbes.filter(probe => this.hasUserTag(probe, keyword.userTag));
			}

			resultProbes = filteredProbes;
		}

		return resultProbes;
	}

	checkExactIndexPosition (probe: Probe, filterValue: string, position: number) {
		if (!probe.index[position]) {
			return false;
		}

		return probe.index[position].some(index => index === filterValue);
	}

	getIndexPosition (probe: Probe, filterValue: string) {
		return probe.index.findIndex(category => category.some(index => index.includes(filterValue)));
	}

	hasTag (probe: Probe, filterValue: string) {
		return probe.tags.some(({ value }) => value.toLowerCase() === filterValue.toLowerCase());
	}

	hasUserTag (probe: Probe, filterValue: string) {
		return probe.tags.filter(({ type }) => type === 'user').some(({ value }) => value.toLowerCase() === filterValue);
	}

	public filterGloballyDistributed (probes: Probe[], limit: number): Probe[] {
		const distribution = this.getDistributionConfig();
		return this.filterByLocationAndWeight(probes, distribution, limit);
	}

	public filterByIpVersion (probes: Probe[], ipVersion: 4 | 6): Probe[] {
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
				filteredProbes = probes.filter(probe => location.tags!.every(tag => this.hasTag(probe, tag)));
			} else if (key === 'magic') {
				filteredProbes = captureSpan('magicFilter', () => this.magicFilter(filteredProbes, location.magic!));
			} else {
				const probeKey = Object.hasOwn(locationKeyMap, key) ? locationKeyMap[key as keyof typeof locationKeyMap] : key;
				// @ts-expect-error it's a string
				// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
				const filterValue = Object.hasOwn(locationKeyMap, key) ? location[key].toLowerCase() as string : location[key as keyof Location];
				filteredProbes = filteredProbes.filter(probe => filterValue === probe.location[probeKey as keyof ProbeLocation]);
			}
		});

		const isMagicSorting = Object.keys(location).includes('magic');

		return captureSpan('shuffle', () => isMagicSorting ? this.magicSort(filteredProbes, location.magic!) : this.diversifiedShuffle(filteredProbes));
	}

	public filterByLocationAndWeight (probes: Probe[], distribution: Map<Location, number>, limit: number): Probe[] {
		const groupedByLocation = new Map<Location, Probe[]>();

		for (const [ location ] of distribution) {
			const foundProbes = captureSpan('filterByLocation', () => this.filterByLocation(probes, location));

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
				const indexPosition = this.getIndexPosition(probe, keyword);
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
			.groupBy(probe => probe.location.groupingKey)
			.map((probes, groupKey) => ({ probes, rank: groupRank(probes.length), cityKey: groupKey.split('-').slice(0, -1).join('-'), prevSameCity: 0 }))
			.sort((a, b) => b.rank - a.rank)
			.value();

		// For each group, compute the frequency of the same city in earlier groups.
		const counts: { [k: string]: number } = {};
		const shuffledProbes: Probe[] = [];

		for (const group of groupedProbes) {
			group.prevSameCity = counts[group.cityKey] ?? (counts[group.cityKey] = 0);
			counts[group.cityKey]!++;
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

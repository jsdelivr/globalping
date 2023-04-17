import config from 'config';
import _ from 'lodash';
import type { Location } from '../lib/location/types';
import type { Socket } from './router.js';
import type { ProbeLocation } from './types';

/*
 * [
 *    [ public key, internal key]
 * ]
 *
 * */
const locationKeyMap = [
	[ 'region', 'normalizedRegion' ],
	[ 'network', 'normalizedNetwork' ],
	[ 'city', 'normalizedCity' ],
];

export class SocketsLocationFilter {
	static magicFilter (sockets: Socket[], magicLocation: string) {
		const keywords = magicLocation.split('+'); // eslint-disable-line @typescript-eslint/no-non-null-assertion
		return sockets.filter(socket => keywords.every(keyword => SocketsLocationFilter.getIndexPosition(socket, keyword) !== -1));
	}

	static getIndexPosition (socket: Socket, value: string) {
		return socket.data.probe.index.findIndex(index => index.includes(value.replaceAll('-', ' ').trim()));
	}

	static hasTag (socket: Socket, tag: string) {
		return socket.data.probe.tags.some(({ type, value }) => type === 'system' && value === tag);
	}

	public filterGloballyDistibuted (sockets: Socket[], limit: number): Socket[] {
		const distribution = this.getDistibutionConfig();
		return this.filterByLocationAndWeight(sockets, distribution, limit);
	}

	public filterByLocation (sockets: Socket[], location: Location): Socket[] {
		if (location.magic === 'world') {
			return _.shuffle(this.filterGloballyDistibuted(sockets, sockets.length));
		}

		let filteredSockets = sockets;

		Object.keys(location).forEach((key) => {
			if (key === 'tags') {
				filteredSockets = filteredSockets.filter(socket => location.tags!.every(tag => SocketsLocationFilter.hasTag(socket, tag)));
			} else if (key === 'magic') {
				filteredSockets = SocketsLocationFilter.magicFilter(filteredSockets, location.magic!);
			} else {
				const probeKey = locationKeyMap.find(m => m.includes(key))?.[1] ?? key;
				filteredSockets = filteredSockets.filter(socket => location[key as keyof Location] === socket.data.probe.location[probeKey as keyof ProbeLocation]);
			}
		});

		const isMagicSorting = Object.keys(location).includes('magic');
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		return isMagicSorting ? this.magicSort(filteredSockets, location.magic!) : _.shuffle(filteredSockets);
	}

	public filterByLocationAndWeight (sockets: Socket[], distribution: Map<Location, number>, limit: number): Socket[] {
		const groupedByLocation = new Map<Location, Socket[]>();

		for (const [ location ] of distribution) {
			const foundSockets = this.filterByLocation(sockets, location);

			if (foundSockets.length > 0) {
				groupedByLocation.set(location, foundSockets);
			}
		}

		const pickedSockets = new Set<Socket>();

		while (groupedByLocation.size > 0 && pickedSockets.size < limit) {
			const selectedCount = pickedSockets.size;

			for (const [ location, locationSockets ] of groupedByLocation) {
				if (pickedSockets.size === limit) {
					break;
				}

				const locationWeight = distribution.get(location);

				if (!locationWeight) {
					continue;
				}

				const count = Math.ceil((limit - selectedCount) * locationWeight / 100);

				for (const s of locationSockets.splice(0, count)) {
					pickedSockets.add(s);
				}

				if (locationSockets.length === 0) {
					groupedByLocation.delete(location);
				}
			}
		}

		return [ ...pickedSockets ];
	}

	private magicSort (sockets: Socket[], magicString: string): Socket[] {
		const getClosestIndexPosition = (socket: Socket) => {
			const keywords = magicString.split('+');
			const closestIndexPosition = keywords.reduce((smallesIndex, keyword) => {
				const indexPosition = SocketsLocationFilter.getIndexPosition(socket, keyword);
				return indexPosition < smallesIndex ? indexPosition : smallesIndex;
			}, Number.POSITIVE_INFINITY);
			return closestIndexPosition;
		};

		const socketsGroupedByIndexPosition = _.groupBy(sockets, getClosestIndexPosition);
		const groupsSortedByIndexPosition = Object.values(socketsGroupedByIndexPosition); // Object.values sorts values by key
		const groupsWithShuffledItems = groupsSortedByIndexPosition.map(group => _.shuffle(group));
		const resultSockets = groupsWithShuffledItems.flat();

		return resultSockets;
	}

	private getDistibutionConfig () {
		return new Map<Location, number>(_.shuffle(Object.entries(config.get<Record<string, number>>('measurement.globalDistribution')))
			.map(([ value, weight ]) => [{ continent: value }, weight ]));
	}
}

import config from 'config';
import _ from 'lodash';
import type {Location} from '../lib/location/types';
import type {Socket} from './router.js';
import type {ProbeLocation} from './types';

/*
 * [
 *    [ public key, internal key]
 * ]
 *
 * */
const locationKeyMap = [
	['region', 'normalizedRegion'],
	['network', 'normalizedNetwork'],
	['city', 'normalizedCity'],
];

export class SocketsLocationFilter {
	static hasIndex(socket: Socket, index: string) {
		return socket.data.probe.index.some(v => v.includes(index.replace('-', ' ').trim()));
	}

	static hasTag(socket: Socket, tag: string) {
		return socket.data.probe.tags.some(({type, value}) => type === 'system' && value.includes(tag.trim()));
	}

	static hasTagStrict(socket: Socket, tag: string) {
		return socket.data.probe.tags.some(({type, value}) => type === 'system' && value === tag);
	}

	public filterGloballyDistibuted(sockets: Socket[], limit: number): Socket[] {
		const distribution = this.getDistibutionConfig();
		return this.filterByLocationAndWeight(sockets, distribution, limit);
	}

	public filterByLocation(sockets: Socket[], location: Location): Socket[] {
		if (location.magic === 'world') {
			return this.filterGloballyDistibuted(sockets, sockets.length);
		}

		return sockets.filter(s => Object.keys(location).every(k => {
			if (k === 'tags') {
				const tags = location[k]!;
				return tags.every(tag => SocketsLocationFilter.hasTagStrict(s, tag));
			}

			if (k === 'magic') {
				const keywords = String(location[k]).split('+');
				return keywords.every(keyword => SocketsLocationFilter.hasIndex(s, keyword) || SocketsLocationFilter.hasTag(s, keyword));
			}

			const key = locationKeyMap.find(m => m.includes(k))?.[1] ?? k;

			return location[k as keyof Location] === s.data.probe.location[key as keyof ProbeLocation];
		}));
	}

	public filterByLocationAndWeight(sockets: Socket[], distribution: Map<Location, number>, limit: number): Socket[] {
		const groupedByLocation = new Map<Location, Socket[]>();

		for (const [location] of distribution) {
			const foundSockets = _.shuffle(this.filterByLocation(sockets, location));
			if (foundSockets.length > 0) {
				groupedByLocation.set(location, foundSockets);
			}
		}

		const pickedSockets = new Set<Socket>();

		while (groupedByLocation.size > 0 && pickedSockets.size < limit) {
			const selectedCount = pickedSockets.size;

			for (const [location, locationSockets] of groupedByLocation) {
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

		return [...pickedSockets];
	}

	private getDistibutionConfig() {
		return new Map<Location, number>(
			_.shuffle(Object.entries(config.get<Record<string, number>>('measurement.globalDistribution')))
				.map(([value, weight]) => ([{continent: value}, weight])),
		);
	}
}

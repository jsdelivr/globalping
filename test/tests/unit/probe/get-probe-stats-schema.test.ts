import { expect } from 'chai';
import { resolveStatsPeriod } from '../../../../src/probe/schema/get-probe-stats-schema.js';

const resolve = (period: string, now: string) => {
	const range = resolveStatsPeriod(period, new Date(now).getTime());
	return range && { from: range.from.toISOString(), to: range.to.toISOString(), interval: range.interval };
};

describe('resolveStatsPeriod', () => {
	const now = '2026-03-01T10:42:13.123Z';

	it('resolves rolling periods to completed UTC buckets', () => {
		expect(resolve('day', now)).to.deep.equal({ from: '2026-02-28T10:00:00.000Z', to: '2026-03-01T10:00:00.000Z', interval: 'hour' });
		expect(resolve('week', now)).to.deep.equal({ from: '2026-02-22T10:00:00.000Z', to: '2026-03-01T10:00:00.000Z', interval: 'hour' });
		expect(resolve('month', now)).to.deep.equal({ from: '2026-01-30T00:00:00.000Z', to: '2026-03-01T00:00:00.000Z', interval: 'day' });
		expect(resolve('year', now)).to.deep.equal({ from: '2025-03-01T00:00:00.000Z', to: '2026-03-01T00:00:00.000Z', interval: 'day' });
	});

	it('resolves calendar periods to UTC days, months, and years', () => {
		expect(resolve('2026-02-28', now)).to.deep.equal({ from: '2026-02-28T00:00:00.000Z', to: '2026-03-01T00:00:00.000Z', interval: 'hour' });
		expect(resolve('2026-02', now)).to.deep.equal({ from: '2026-02-01T00:00:00.000Z', to: '2026-03-01T00:00:00.000Z', interval: 'day' });
		expect(resolve('2025-12', now)).to.deep.equal({ from: '2025-12-01T00:00:00.000Z', to: '2026-01-01T00:00:00.000Z', interval: 'day' });
		expect(resolve('2025', now)).to.deep.equal({ from: '2025-01-02T00:00:00.000Z', to: '2026-01-01T00:00:00.000Z', interval: 'day' });
	});

	it('excludes the current hour or day from current calendar periods', () => {
		expect(resolve('2026-03-01', now)).to.deep.equal({ from: '2026-03-01T00:00:00.000Z', to: '2026-03-01T10:00:00.000Z', interval: 'hour' });
		expect(resolve('2026-03', now)).to.deep.equal({ from: '2026-03-01T00:00:00.000Z', to: '2026-03-01T00:00:00.000Z', interval: 'day' });
		expect(resolve('2026', now)).to.deep.equal({ from: '2026-01-01T00:00:00.000Z', to: '2026-03-01T00:00:00.000Z', interval: 'day' });
	});

	it('handles leap days', () => {
		expect(resolve('2028-02-29', '2028-03-01T00:00:00.000Z')).to.deep.equal({ from: '2028-02-29T00:00:00.000Z', to: '2028-03-01T00:00:00.000Z', interval: 'hour' });
		expect(resolve('day', '2028-03-01T00:00:00.000Z')).to.deep.equal({ from: '2028-02-29T00:00:00.000Z', to: '2028-03-01T00:00:00.000Z', interval: 'hour' });
		expect(resolve('2026-02-29', now)).to.equal(null);
	});

	it('rejects invalid values', () => {
		for (const period of [ '2026-02-30', '2026-13', '2026-00', '2026-1', '26', '', 'constructor', 'toString', 'hour', '2026-02-01T00:00' ]) {
			expect(resolve(period, now), period).to.equal(null);
		}
	});

	it('rejects future periods', () => {
		expect(resolve('2026-03-02', now)).to.equal(null);
		expect(resolve('2026-04', now)).to.equal(null);
		expect(resolve('2027', now)).to.equal(null);
	});

	it('rejects periods entirely before the retained 14 months and accepts partially retained ones', () => {
		expect(resolve('2024-12-31', now)).to.equal(null);
		expect(resolve('2024-12', now)).to.equal(null);
		expect(resolve('2024', now)).to.equal(null);
		expect(resolve('2025-01-01', now)).to.not.equal(null);
		expect(resolve('2025-01', now)).to.not.equal(null);
		expect(resolve('2025', now)).to.not.equal(null);
	});

	it('starts partially retained periods with the first whole bucket of the retained history', () => {
		expect(resolve('2025-01-01', now)).to.deep.equal({ from: '2025-01-01T11:00:00.000Z', to: '2025-01-02T00:00:00.000Z', interval: 'hour' });
		expect(resolve('2025-01', now)).to.deep.equal({ from: '2025-01-02T00:00:00.000Z', to: '2025-02-01T00:00:00.000Z', interval: 'day' });
		expect(resolve('2025-01-01', '2026-03-01T10:00:00.000Z')).to.deep.equal({ from: '2025-01-01T10:00:00.000Z', to: '2025-01-02T00:00:00.000Z', interval: 'hour' });
	});

	it('clamps the retention start at month ends like PostgreSQL intervals', () => {
		const monthEnd = '2026-04-30T12:00:00.000Z';
		expect(resolve('2025-02-27', monthEnd)).to.equal(null);
		expect(resolve('2025-02-28', monthEnd)).to.deep.equal({ from: '2025-02-28T12:00:00.000Z', to: '2025-03-01T00:00:00.000Z', interval: 'hour' });
		expect(resolve('2025-02', monthEnd)).to.deep.equal({ from: '2025-03-01T00:00:00.000Z', to: '2025-03-01T00:00:00.000Z', interval: 'day' });
		expect(resolve('2025-03-01', monthEnd)).to.deep.equal({ from: '2025-03-01T00:00:00.000Z', to: '2025-03-02T00:00:00.000Z', interval: 'hour' });
	});
});

import config from 'config';
import got from 'got';
import type { Knex } from 'knex';
import { scopedLogger } from './logger.js';
import { dashboardClient } from './sql/client.js';

export const CREDITS_TABLE = 'gp_credits';
const ER_CONSTRAINT_FAILED_CODE = 4025;

const logger = scopedLogger('credits');
const directusUrl = config.get<string>('dashboard.directusUrl');
const systemKey = config.get<string>('systemApi.key');

type NotificationPreferences = {
	low_credits?: {
		enabled?: boolean;
		parameter?: number;
	};
};
type UserPreferenceRow = {
	id: string;
	notification_preferences: string;
};

export class Credits {
	private userIdToPreference = new Map<string, false | number>(); // false = disabled, number = custom threshold
	private defaultThreshold: number | undefined;
	private syncTimer: NodeJS.Timeout | undefined;

	constructor (private readonly sql: Knex) {}

	scheduleSync (): void {
		this.syncTimer = setTimeout(() => {
			this.syncPreferences()
				.finally(() => this.scheduleSync())
				.catch(err => logger.error('Failed to sync low_credits preferences', err));
		}, 60_000).unref();
	}

	unscheduleSync (): void {
		clearTimeout(this.syncTimer);
	}

	async syncPreferences (): Promise<void> {
		await this.refreshDefaultThreshold();

		const rows = await this.sql('directus_users')
			.whereNotNull('notification_preferences')
			.select<UserPreferenceRow[]>('id', 'notification_preferences');

		this.userIdToPreference = new Map(rows.flatMap<[string, false | number]>(({ id, notification_preferences }) => {
			const prefs = JSON.parse(notification_preferences) as NotificationPreferences;
			const lowCredits = prefs.low_credits;

			if (!lowCredits) { return []; }

			if (lowCredits.enabled === false) { return [ [ id, false ] ]; }

			if (lowCredits.enabled === true && lowCredits.parameter !== undefined) { return [ [ id, lowCredits.parameter ] ]; }

			return [];
		}));
	}

	async consume (userId: string, credits: number): Promise<{ isConsumed: boolean; remainingCredits: number }> {
		let numberOfUpdates: number;

		try {
			numberOfUpdates = await this.sql(CREDITS_TABLE).where({ user_id: userId }).update({ amount: this.sql.raw('amount - ?', [ credits ]) });
		} catch (error) {
			if (error && (error as Error & { errno?: number }).errno === ER_CONSTRAINT_FAILED_CODE) {
				const remainingCredits = await this.getRemainingCredits(userId);
				return { isConsumed: false, remainingCredits };
			}

			throw error;
		}

		if (numberOfUpdates === 0) {
			return { isConsumed: false, remainingCredits: 0 };
		}

		const remainingCredits = await this.getRemainingCredits(userId);
		this.notifyLowCredits(userId, remainingCredits + credits, remainingCredits);
		return { isConsumed: true, remainingCredits };
	}

	async getRemainingCredits (userId: string): Promise<number> {
		const result = await this.sql(CREDITS_TABLE).where({ user_id: userId }).first<{ amount: number } | undefined>('amount');
		return result?.amount || 0;
	}

	private notifyLowCredits (userId: string, previousAmount: number, remainingAmount: number): void {
		const userPreference = this.userIdToPreference.get(userId);

		if (userPreference === false) { return; }

		const threshold = typeof userPreference === 'number' ? userPreference : this.defaultThreshold;

		if (threshold && previousAmount >= threshold && remainingAmount < threshold) {
			got.post(`${directusUrl}/notifications`, {
				json: {
					recipient: userId,
					type: 'low_credits',
					subject: 'Your Globalping credits are running low',
					message: `You have ${remainingAmount} credits remaining, below your configured threshold of ${threshold}.`,
				},
				headers: { Authorization: `Bearer ${systemKey}` },
				timeout: { request: 5000 },
				retry: { limit: 2 },
			}).catch(err => logger.error('Failed to send low_credits notification', err));
		}
	}

	private async refreshDefaultThreshold (): Promise<void> {
		const row = await this.sql('directus_settings').first<{ low_credits_default_threshold: number | null } | undefined>('low_credits_default_threshold');

		if (typeof row?.low_credits_default_threshold === 'number') {
			this.defaultThreshold = row.low_credits_default_threshold;
		}
	}
}

export const credits = new Credits(dashboardClient);

import knex, { Knex } from 'knex';
import dashboardKnexfile from '../../../knexfile.dashboard.js';
import measurementStoreKnexfile from '../../../knexfile.measurement-store-1.js';
import timeSeriesKnexfile from '../../../knexfile.time-series-1.js';

const env = process.env['NODE_ENV'] || 'development';

export const dashboardClient: Knex = knex(dashboardKnexfile[env] || {});
export const measurementStoreClient: Knex = knex(measurementStoreKnexfile[env] || {});
export const timeSeriesClient: Knex = knex(timeSeriesKnexfile[env] || {});

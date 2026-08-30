import { migrate } from '../src/db/migrate';

/** Brings the test database up to schema once, before any suite runs. */
export default async function setup() {
  try {
    process.loadEnvFile('.env');
  } catch {
    // CI supplies the variables directly.
  }
  const adminUrl = process.env.TEST_ADMIN_DATABASE_URL;
  const appPassword = process.env.NISBA_APP_DB_PASSWORD;
  if (!adminUrl || !appPassword) {
    throw new Error(
      'TEST_ADMIN_DATABASE_URL and NISBA_APP_DB_PASSWORD must be set to run the database suites. ' +
        'See nisba/.env.example.',
    );
  }
  await migrate({ adminUrl, appPassword });
}

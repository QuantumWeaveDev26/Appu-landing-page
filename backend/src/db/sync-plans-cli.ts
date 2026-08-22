import 'dotenv/config';
import { loadConfig } from '../config/index.js';
import { createDatabase } from './client.js';
import { SubscriptionService } from '../domain/subscription/service.js';

async function main() {
  const config = loadConfig(process.env);

  if (!config.DATABASE_URL) {
    console.error('Plan sync failed: DATABASE_URL is not configured.');
    process.exit(1);
  }

  const db = createDatabase({ connectionString: config.DATABASE_URL });

  try {
    const isHealthy = await db.isHealthy();
    if (!isHealthy) {
      console.error('Plan sync failed: Could not connect to database.');
      process.exit(1);
    }

    const mappings = SubscriptionService.parsePlanMappings(
      config.RAZORPAY_PLAN_MAPPINGS,
      {
        starterId: config.RAZORPAY_PLAN_STARTER_ID,
        growthId: config.RAZORPAY_PLAN_GROWTH_ID,
        familyId: config.RAZORPAY_PLAN_FAMILY_ID
      }
    );

    const result = await SubscriptionService.syncPlans(db, mappings);

    console.log(
      `[PlanSync] Successfully synchronized ${result.syncedCount} plan(s): [${result.updatedPlans.join(', ')}]`
    );
  } catch (error: any) {
    console.error(`[PlanSync] Synchronization error: ${error.message}`);
    process.exit(1);
  } finally {
    await db.close().catch(() => {});
  }
}

main();

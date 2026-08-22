import 'dotenv/config';
import { loadConfig } from '../config/index.js';
import { createDatabase } from '../db/client.js';
import { DefaultRazorpayClient } from '../domain/razorpay/client.js';
import { SubscriptionService } from '../domain/subscription/service.js';

async function main() {
  const providerSubscriptionId = process.argv[2]?.trim();

  if (!providerSubscriptionId) {
    console.error('Usage: npm run subscriptions:reconcile -- <providerSubscriptionId>');
    console.error('Example: npm run subscriptions:reconcile -- sub_TSlhuAnSifaffi');
    process.exit(1);
  }

  const config = loadConfig(process.env);

  if (!config.DATABASE_URL) {
    console.error('[Reconcile] Error: DATABASE_URL is not configured.');
    process.exit(1);
  }

  if (!config.RAZORPAY_KEY_ID || !config.RAZORPAY_KEY_SECRET) {
    console.error('[Reconcile] Error: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be configured.');
    process.exit(1);
  }

  const db = createDatabase({ connectionString: config.DATABASE_URL });
  const razorpayClient = new DefaultRazorpayClient({
    keyId: config.RAZORPAY_KEY_ID,
    keySecret: config.RAZORPAY_KEY_SECRET,
    webhookSecret: config.RAZORPAY_WEBHOOK_SECRET
  });

  try {
    const isHealthy = await db.isHealthy();
    if (!isHealthy) {
      console.error('[Reconcile] Error: Could not connect to database.');
      process.exit(1);
    }

    console.log(`[Reconcile] Initiating reconciliation for provider subscription: ${providerSubscriptionId}...`);

    const result = await SubscriptionService.reconcileSubscription(db, razorpayClient, {
      providerSubscriptionId
    });

    console.log('----------------------------------------------------');
    console.log('[Reconcile] Reconciliation Complete:');
    console.log(`  - Reconciled:       ${result.reconciled}`);
    console.log(`  - Action Taken:     ${result.actionTaken}`);
    console.log(`  - Provider Status:  ${result.providerStatus}`);
    console.log(`  - Previous Status:  ${result.previousStatus}`);
    console.log(`  - Current Status:   ${result.currentStatus}`);
    console.log(`  - Subscription ID:  ${result.subscriptionId}`);
    console.log(`  - Household ID:     ${result.householdId}`);
    console.log(`  - Plan Code:        ${result.planCode}`);
    console.log('----------------------------------------------------');
  } catch (error: any) {
    console.error(`[Reconcile] Reconciliation failed: ${error.message}`);
    process.exit(1);
  } finally {
    await db.close().catch(() => {});
  }
}

main();

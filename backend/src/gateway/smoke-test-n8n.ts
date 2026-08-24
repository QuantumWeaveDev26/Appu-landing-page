import 'dotenv/config';
import { loadConfig } from '../config/index.js';
import { DefaultN8nClient } from '../domain/gateway/client.js';

async function runSmokeTest() {
  const config = loadConfig(process.env);

  if (!config.N8N_APPU_WEBHOOK_URL) {
    console.log('[SmokeTest] N8N_APPU_WEBHOOK_URL is not set in environment.');
    console.log('[SmokeTest] LIVE N8N GATEWAY VALIDATION: PENDING (opt-in configuration missing)');
    return;
  }

  console.log('[SmokeTest] Executing live n8n gateway test envelope...');
  const client = new DefaultN8nClient({
    webhookUrl: config.N8N_APPU_WEBHOOK_URL,
    timeoutMs: 25000
  });

  try {
    const response = await client.sendMessage({
      action: 'sendMessage',
      channel: 'website',
      sessionId: 'smoke_test_session_' + Date.now(),
      chatInput: 'Hello Appu, this is a smoke test from backend gateway.',
      message: 'Hello Appu, this is a smoke test from backend gateway.',
      language: 'en',
      childId: '00000000-0000-0000-0000-000000000000',
      mentorContext: {
        mode: 'authenticated',
        learnerId: '00000000-0000-0000-0000-000000000000',
        learnerName: 'SmokeTestChild',
        grade: 'Grade 5',
        primaryLanguage: 'en',
        learningStyle: 'visual',
        responseStyle: 'playful',
        favoriteSubjects: ['math'],
        interests: ['science'],
        learningGoals: ['smoke test'],
        personalizationEnabled: true,
        advancedPersonalizationEnabled: true,
        longTermContextEnabled: true
      }
    });

    console.log('[SmokeTest] Gateway received valid response:');
    console.log(`[SmokeTest] Text length: ${response.text.length} chars`);
    console.log(`[SmokeTest] Audio present: ${response.audioSource ? 'YES' : 'NO'}`);
    console.log('[SmokeTest] LIVE N8N GATEWAY VALIDATION: SUCCESS');
  } catch (err: any) {
    console.error(`[SmokeTest] Gateway request failed: ${err.message}`);
    console.log('[SmokeTest] LIVE N8N GATEWAY VALIDATION: FAILED');
  }
}

runSmokeTest();

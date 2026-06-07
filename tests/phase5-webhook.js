/**
 * Phase 5 Webhook Tests
 * Run with: node tests/phase5-webhook.js
 *
 * This script generates real HMAC-SHA256 signatures exactly as Korapay does,
 * so your signature verification logic is tested accurately.
 *
 * Prerequisites:
 *   1. npm run dev (server running)
 *   2. A click record exists in Supabase with a known session_id
 *      (run phase4 tests first, then copy a session_id from the clicks table)
 */

import { createHmac } from 'crypto';

const BASE = 'http://localhost:3000';

// ⚠️  Update this to match your .env KORAPAY_WEBHOOK_SECRET
const WEBHOOK_SECRET = 'placeholder-webhook-secret';

// ⚠️  Update this to a real session_id from your clicks table
const TEST_SESSION_ID = 'paste-a-real-session-id-from-clicks-table';

// ⚠️  Update this to a real vendor_id from your users table (first 20 chars)
const TEST_VENDOR_ID = 'paste-first-20-chars-of-vendor-id';

// ─── HELPER: Build a signed webhook request ───────────────────────────────
function buildWebhookRequest(dataObject) {
  const payload = {
    event: 'charge.success',
    data: dataObject,
  };

  // Sign ONLY the data object — exactly as Korapay does
  const signature = createHmac('sha256', WEBHOOK_SECRET)
    .update(JSON.stringify(dataObject))
    .digest('hex');

  return { payload, signature };
}

async function sendWebhook(payload, signature) {
  const res = await fetch(`${BASE}/api/webhook/korapay`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-korapay-signature': signature,
    },
    body: JSON.stringify(payload),
  });
  return { status: res.status, body: await res.json() };
}

async function test(name, fn) {
  process.stdout.write(`\n${'─'.repeat(55)}\n`);
  process.stdout.write(`TEST: ${name}\n`);
  process.stdout.write(`${'─'.repeat(55)}\n`);
  try {
    await fn();
  } catch (err) {
    console.error(`ERROR: ${err.message}`);
  }
}

// ── TEST 1: Valid webhook with attribution ────────────────────────────────
await test('Valid charge.success with traqq-session (attributed)', async () => {
  const data = {
    reference: `KPY-TEST-${Date.now()}`,
    currency: 'NGN',
    amount: 25000,
    fee: 250,
    status: 'success',
    payment_method: 'bank_transfer',
    transaction_date: new Date().toISOString(),
    metadata: {
      'traqq-session': TEST_SESSION_ID,
      'vendor-id': TEST_VENDOR_ID,
    },
  };

  const { payload, signature } = buildWebhookRequest(data);
  const { status, body } = await sendWebhook(payload, signature);

  console.log('Response status (expect 200):', status);
  console.log('Response body:', JSON.stringify(body));
  console.log('\n→ Check Supabase:');
  console.log('  sales table — new row with platform from click');
  console.log('  clicks table — converted=true for session_id:', TEST_SESSION_ID);
  console.log('  webhook_logs — status=processed');
});

// ── TEST 2: Duplicate webhook (same reference) ────────────────────────────
await test('Duplicate reference — should be skipped (not double-recorded)', async () => {
  // Send same reference as TEST 1 — should be a duplicate
  const sameRef = `KPY-DUPE-${Date.now() - 5000}`; // reuse a ref

  const data = {
    reference: sameRef,
    currency: 'NGN',
    amount: 25000,
    status: 'success',
    metadata: { 'traqq-session': TEST_SESSION_ID },
  };

  const { payload, signature } = buildWebhookRequest(data);

  // Send twice
  await sendWebhook(payload, signature);
  const { status, body } = await sendWebhook(payload, signature);

  console.log('Second send status (expect 200):', status);
  console.log('→ Check webhook_logs: second entry should have status=duplicate');
  console.log('→ Check sales table: only ONE sale for this reference');
});

// ── TEST 3: Invalid signature ─────────────────────────────────────────────
await test('Invalid signature — should be rejected', async () => {
  const data = {
    reference: `KPY-FAKE-${Date.now()}`,
    currency: 'NGN',
    amount: 99999,
    status: 'success',
  };

  const payload = { event: 'charge.success', data };
  const fakeSignature = 'thisisafakesignaturethatdoesnotmatch';

  const { status, body } = await sendWebhook(payload, fakeSignature);

  console.log('Response status (expect 200 — we always return 200):', status);
  console.log('→ Check webhook_logs: status=failed, signature_valid=false');
  console.log('→ Check sales table: NO new sale created');
});

// ── TEST 4: charge.failed event ───────────────────────────────────────────
await test('charge.failed event — logged but no sale recorded', async () => {
  const data = {
    reference: `KPY-FAIL-${Date.now()}`,
    currency: 'NGN',
    amount: 15000,
    status: 'failed',
  };

  const { payload, signature } = buildWebhookRequest(data);
  const { status } = await sendWebhook(payload, signature);

  console.log('Response status (expect 200):', status);
  console.log('→ Check webhook_logs: event logged, status=processed');
  console.log('→ Check sales table: NO new sale (failed payment)');
});

// ── TEST 5: Missing signature header ─────────────────────────────────────
await test('Missing x-korapay-signature header — rejected', async () => {
  const res = await fetch(`${BASE}/api/webhook/korapay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'charge.success',
      data: { reference: 'KPY-NO-SIG', amount: 1000, status: 'success' },
    }),
  });

  console.log('Status (expect 200):', res.status);
  console.log('→ Check webhook_logs: signature_valid=false');
});

// ── TEST 6: Webhook without traqq-session (unattributed sale) ─────────────
await test('No traqq-session metadata — sale recorded as unknown platform', async () => {
  const data = {
    reference: `KPY-NOATTR-${Date.now()}`,
    currency: 'NGN',
    amount: 8000,
    status: 'success',
    metadata: {
      'vendor-id': TEST_VENDOR_ID,
    },
  };

  const { payload, signature } = buildWebhookRequest(data);
  const { status } = await sendWebhook(payload, signature);

  console.log('Status (expect 200):', status);
  console.log('→ Check sales table: new sale with platform=unknown');
});

console.log('\n\n✅ Phase 5 tests complete.');
console.log('Open Supabase Table Editor and verify:');
console.log('  webhook_logs — entries for each test above');
console.log('  sales        — entries only for valid, non-duplicate charges');
console.log('  clicks       — converted=true for attributed sales');

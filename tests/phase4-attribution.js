/**
 * Phase 4 Attribution Tests
 * Run with: node tests/phase4-attribution.js
 * Works on Windows, Mac, Linux — no bash needed.
 *
 * Prerequisites:
 *   1. Server running: npm run dev
 *   2. Supabase has a vendor row with vendor_slug = 'test-vendor-abc'
 *      and a valid korapay_link set (from Phase 2 seed data or manually)
 */

const BASE = 'http://localhost:3000';

async function test(name, fn) {
  process.stdout.write(`\n${'─'.repeat(50)}\n`);
  process.stdout.write(`TEST: ${name}\n`);
  process.stdout.write(`${'─'.repeat(50)}\n`);
  try {
    await fn();
  } catch (err) {
    console.error(`FAILED: ${err.message}`);
  }
}

// ── TEST 1: Health check ───────────────────────────────────
await test('Health check', async () => {
  const res = await fetch(`${BASE}/health`);
  const data = await res.json();
  console.log('Status:', res.status);
  console.log('Body:', JSON.stringify(data, null, 2));
});

// ── TEST 2: Valid vendor slug — should redirect to Korapay ─
await test('Valid slug → 302 redirect to Korapay', async () => {
  // fetch() follows redirects by default — use manual to catch 302
  const res = await fetch(`${BASE}/pay/adaeze-fashion-k92xp`, {
    redirect: 'manual',
  });
  console.log('Status (expect 302):', res.status);
  console.log('Location header:', res.headers.get('location'));
  console.log('Should start with https://checkout.korapay.com/...');
});

// ── TEST 3: Instagram referrer detection ──────────────────
await test('Instagram referrer → platform detected', async () => {
  const res = await fetch(`${BASE}/pay/adaeze-fashion-k92xp`, {
    redirect: 'manual',
    headers: {
      'Referer': 'https://www.instagram.com/stories/vendor/123',
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
    },
  });
  console.log('Status (expect 302):', res.status);
  console.log('Check Supabase clicks table — platform should be "instagram"');
});

// ── TEST 4: TikTok referrer ────────────────────────────────
await test('TikTok referrer → platform detected', async () => {
  const res = await fetch(`${BASE}/pay/adaeze-fashion-k92xp`, {
    redirect: 'manual',
    headers: {
      'Referer': 'https://www.tiktok.com/@vendor/video/123',
    },
  });
  console.log('Status (expect 302):', res.status);
  console.log('Check Supabase clicks table — platform should be "tiktok"');
});

// ── TEST 5: No referrer (WhatsApp likely) ─────────────────
await test('No referrer + WhatsApp UA → whatsapp platform', async () => {
  const res = await fetch(`${BASE}/pay/adaeze-fashion-k92xp`, {
    redirect: 'manual',
    headers: {
      'User-Agent': 'WhatsApp/2.23.1 A',
    },
  });
  console.log('Status (expect 302):', res.status);
  console.log('Check Supabase clicks table — platform should be "whatsapp"');
});

// ── TEST 6: Unknown vendor slug ────────────────────────────
await test('Invalid slug → 404', async () => {
  const res = await fetch(`${BASE}/pay/vendor-that-does-not-exist`, {
    redirect: 'manual',
  });
  const data = await res.json();
  console.log('Status (expect 404):', res.status);
  console.log('Body:', JSON.stringify(data, null, 2));
});

// ── TEST 7: Vendor info endpoint ───────────────────────────
await test('Vendor info endpoint', async () => {
  const res = await fetch(`${BASE}/pay/adaeze-fashion-k92xp/info`);
  const data = await res.json();
  console.log('Status (expect 200):', res.status);
  console.log('Body:', JSON.stringify(data, null, 2));
});

// ── TEST 8: Referrer detector unit test ───────────────────
await test('Referrer detector — unit test', async () => {
  // Import and test the detector directly
  const { detectPlatform } = await import('../src/modules/attribution/referrer.detector.js');

  const cases = [
    { ref: 'https://www.instagram.com/p/abc', ua: '', expected: 'instagram' },
    { ref: 'https://l.instagram.com/?u=abc',  ua: '', expected: 'instagram' },
    { ref: 'https://www.tiktok.com/@user',    ua: '', expected: 'tiktok' },
    { ref: 'https://www.facebook.com/posts',  ua: '', expected: 'facebook' },
    { ref: 'https://t.co/abc123',             ua: '', expected: 'x' },
    { ref: '',  ua: 'WhatsApp/2.23.1 A',      expected: 'whatsapp' },
    { ref: 'https://somerandom.com',          ua: '', expected: 'unknown' },
    { ref: '',  ua: 'Mozilla/5.0 Chrome',     expected: 'unknown' },
  ];

  let passed = 0;
  for (const { ref, ua, expected } of cases) {
    const { platform } = detectPlatform(ref, ua);
    const ok = platform === expected;
    console.log(`  ${ok ? '✅' : '❌'} "${ref || '(empty)'}" → ${platform} (expected: ${expected})`);
    if (ok) passed++;
  }
  console.log(`\n  ${passed}/${cases.length} passed`);
});

console.log('\n✅ Phase 4 tests complete. Check Supabase clicks table for attribution records.');

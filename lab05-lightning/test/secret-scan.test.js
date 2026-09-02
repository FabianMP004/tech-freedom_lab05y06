const test = require('node:test');
const assert = require('node:assert/strict');

test('reports a mnemonic assignment in a fixture', async () => {
  const { scanText } = await import('../scripts/secret-scan.mjs');
  const words = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  const fixture = ['const WDK_MNEMONIC', ' = "', words, '";'].join('');
  const findings = scanText(fixture);

  assert.equal(findings.length, 1);
  assert.match(findings[0], /mnemonic/i);
});

test('allows placeholders and public bolt11 evidence labels in a clean fixture', async () => {
  const { scanText } = await import('../scripts/secret-scan.mjs');
  const findings = scanText([
    'WDK_MNEMONIC=replace-with-runtime-secret',
    'WDK_STORAGE_KEY=replace-with-32-byte-secret',
    'PAY_AUTH_TOKEN=<set-in-runtime>',
    'bolt11 invoice evidence: lnbc1testinvoice',
  ].join('\n'));

  assert.deepEqual(findings, []);
});

test('reports private-key assignments and realistic credential prefixes', async () => {
  const { scanText } = await import('../scripts/secret-scan.mjs');
  const credentialPrefix = ['sk', '_live_12345678901234567890'].join('');
  const findings = scanText([
    `WDK_PRIVATE_KEY=${'a'.repeat(64)}`,
    ['PAY_AUTH_TOKEN', '=', credentialPrefix].join(''),
  ].join('\n'), 'credential-fixture');

  assert.equal(findings.length, 2);
  assert.match(findings[0], /private-key/i);
  assert.match(findings[1], /credential/i);
});

import { stripNonDigits, normalizeDigits, formatDigits, parseFormatted } from './src/index.js';

let passed = 0;
let failed = 0;

function assert(fn, desc) {
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    console.error(`FAIL: ${desc} — ${e.message}`);
  }
}

function eq(a, b, desc) {
  assert(() => {
    if (a !== b) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
  }, desc);
}

// --- stripNonDigits ---
eq(stripNonDigits('+7 (916) 123-45-67'), '79161234567', 'stripNonDigits strips all non-digits');
eq(stripNonDigits('8-916-123-45-67'), '89161234567', 'stripNonDigits handles 8-prefix');
eq(stripNonDigits('abc123def'), '123', 'stripNonDigits strips letters');

// --- normalizeDigits ---
eq(normalizeDigits('+79161234567').digits, '9161234567', 'normalize +7 prefix');
eq(normalizeDigits('89161234567').digits, '9161234567', 'normalize 8 prefix → 7');
eq(normalizeDigits('79161234567').digits, '9161234567', 'normalize 7 prefix');
eq(normalizeDigits('9161234567').digits, '9161234567', 'normalize raw 10 digits');
eq(normalizeDigits('+7 (916) 123-45-67').digits, '9161234567', 'normalize formatted');
eq(normalizeDigits('916').digits, '916', 'normalize partial input');
eq(normalizeDigits('').digits, '', 'normalize empty');
eq(normalizeDigits('abc').digits, '', 'normalize letters only');

// --- formatDigits ---
eq(formatDigits('9161234567'), '+7 (916) 123-45-67', 'format full number');
eq(formatDigits('4951234567'), '+7 (495) 123-45-67', 'format Moscow');
eq(formatDigits('8001234567'), '+7 (800) 123-45-67', 'format 800');
eq(formatDigits('9'), '+7 (9', 'format 1 digit');
eq(formatDigits('91'), '+7 (91', 'format 2 digits');
eq(formatDigits('916'), '+7 (916)', 'format 3 digits');
eq(formatDigits('9161'), '+7 (916) 1', 'format 4 digits');
eq(formatDigits('916123'), '+7 (916) 123', 'format 6 digits');
eq(formatDigits('9161234'), '+7 (916) 123-4', 'format 7 digits');
eq(formatDigits('91612345'), '+7 (916) 123-45', 'format 8 digits');
eq(formatDigits('916123456'), '+7 (916) 123-45-6', 'format 9 digits');
eq(formatDigits(''), '', 'format empty → empty');

// --- parseFormatted ---
eq(parseFormatted('+7 (916) 123-45-67'), '9161234567', 'parse formatted');
eq(parseFormatted('9161234567'), '9161234567', 'parse raw digits');
eq(parseFormatted('+7 (916'), '916', 'parse partial');
eq(parseFormatted('+7 (916) 123'), '916123', 'parse partial 6');
eq(parseFormatted(''), '', 'parse empty');

// --- summary ---
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);

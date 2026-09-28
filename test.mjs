import { stripNonDigits, normalizeDigits, formatDigits, parseFormatted, applyMask } from './src/index.js';

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
eq(normalizeDigits('91612345670').digits, '9161234567', 'normalize >10 digits → trim');
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

// --- Mock Input Helper ---
function createMockInput(initialValue = '') {
  const listeners = {};
  return {
    value: initialValue,
    placeholder: '',
    attributes: {},
    selectionStart: 0,
    selectionEnd: 0,
    setAttribute(k, v) { this.attributes[k] = v; },
    getAttribute(k) { return this.attributes[k]; },
    setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; },
    addEventListener(event, fn) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(fn);
    },
    removeEventListener(event, fn) {
      if (!listeners[event]) return;
      listeners[event] = listeners[event].filter(f => f !== fn);
    },
    dispatch(event, eventObj = {}) {
      if (!listeners[event]) return;
      for (const fn of [...listeners[event]]) {
        fn({
          preventDefault() {},
          ...eventObj,
        });
      }
    },
    listenerCount(event) {
      return (listeners[event] || []).length;
    }
  };
}

// --- applyMask: single element ---
const singleInput = createMockInput();
const singleCtrl = applyMask(singleInput);
eq(singleInput.placeholder, '+7 (___) ___-__-__', 'single element sets placeholder');
eq(singleInput.getAttribute('inputmode'), 'numeric', 'single element sets inputmode');
eq(singleCtrl.input, singleInput, 'controller exposes input element');
eq(singleInput.listenerCount('input') > 0, true, 'single element registers input listener');
singleCtrl.destroy();
eq(singleInput.listenerCount('input'), 0, 'destroy removes listeners from single element');

// --- applyMask: array of elements ---
const inputA = createMockInput();
const inputB = createMockInput();
let completedInput = null;
let completedVal = null;
const arrayCtrl = applyMask([inputA, inputB], {
  onComplete(val, input) {
    completedVal = val;
    completedInput = input;
  }
});
eq(Array.isArray(arrayCtrl), true, 'multi-element returns array');
eq(arrayCtrl.length, 2, 'multi-element array length matches');
eq(arrayCtrl.input, inputA, 'multi-element exposes first input via .input');
eq(inputA.placeholder, '+7 (___) ___-__-__', 'inputA has placeholder set');
eq(inputB.placeholder, '+7 (___) ___-__-__', 'inputB has placeholder set');

// Focus and paste on inputB
inputB.dispatch('focus');
eq(inputB.value, '+7 (', 'focus inserts prefix');
inputB.dispatch('paste', { clipboardData: { getData: () => '9161234567' } });
eq(inputB.value, '+7 (916) 123-45-67', 'paste formats phone number');
eq(completedVal, '+7 (916) 123-45-67', 'onComplete called with formatted value');
eq(completedInput, inputB, 'onComplete called with the specific input that triggered it');

// Destroy all via arrayCtrl.destroy()
arrayCtrl.destroy();
eq(inputA.listenerCount('input'), 0, 'destroy removes listeners from inputA');
eq(inputB.listenerCount('input'), 0, 'destroy removes listeners from inputB');

// --- applyMask: selector string ---
const selInput1 = createMockInput();
const selInput2 = createMockInput();
globalThis.document = {
  querySelectorAll(selector) {
    if (selector === '.phone-input') return [selInput1, selInput2];
    return [];
  }
};

const selectorCtrl = applyMask('.phone-input');
eq(Array.isArray(selectorCtrl), true, 'selector returns array of controllers');
eq(selectorCtrl.length, 2, 'selector finds 2 elements');
eq(selInput1.listenerCount('input') > 0, true, 'selInput1 has listener');
selectorCtrl.destroy();
eq(selInput1.listenerCount('input'), 0, 'selectorCtrl.destroy removes listeners from all matched elements');

// Selector that matches nothing
const emptyCtrl = applyMask('.not-found');
eq(Array.isArray(emptyCtrl), true, 'not-found selector returns empty array');
eq(emptyCtrl.length, 0, 'empty array length 0');
assert(() => emptyCtrl.destroy(), 'calling destroy on empty controller does not throw');

// Iteration over single controller
let iteratedCount = 0;
const singleIterInput = createMockInput();
for (const c of applyMask(singleIterInput)) {
  iteratedCount++;
  c.destroy();
}
eq(iteratedCount, 1, 'single controller is iterable with Symbol.iterator');
eq(singleIterInput.listenerCount('input'), 0, 'destroyed inside loop');

// --- summary ---
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);


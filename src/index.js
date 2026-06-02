/**
 * rf-phone-mask — Input mask for Russian phone numbers
 *
 * Formats: +7 (XXX) XXX-XX-XX
 * Accepts: +7, 8, 7, or raw digits — normalizes everything to +7
 */

const DIGIT = /[\d]/;
const MAX_LENGTH = 11; // 7 + 10 digits

/**
 * Strip all non-digit chars from a string
 */
export function stripNonDigits(value) {
  return value.replace(/\D/g, '');
}

/**
 * Normalize raw digits to a Russian number (area code + subscriber)
 *
 * Rules:
 *   - If starts with 8 → replace with 7
 *   - If starts with 7 → strip it (will re-add +7 later)
 *   - If ≤10 digits → keep as-is
 *   - Otherwise → empty string
 *
 * Returns { digits: string, hasPrefix: boolean }
 *   digits = number without country code (up to 10 digits)
 */
export function normalizeDigits(raw) {
  let digits = stripNonDigits(raw);
  if (!digits.length) return { digits: '', hasPrefix: false };

  // 8 → 7
  if (digits.startsWith('8')) {
    digits = '7' + digits.slice(1);
  }
  // strip leading 7
  if (digits.startsWith('7')) {
    digits = digits.slice(1);
  }

  if (digits.length > 10) return { digits: '', hasPrefix: false };
  return { digits, hasPrefix: true };
}

/**
 * Format raw digits into +7 (XXX) XXX-XX-XX
 * Supports partial input — shows progress as digits are typed.
 *
 * - 0 digits: ''
 * - 1-3 digits: +7 (XXX
 * - 4-6 digits: +7 (XXX) XXX
 * - 7-8 digits: +7 (XXX) XXX-XX
 * - 9 digits:   +7 (XXX) XXX-XX-X
 * - 10 digits: +7 (XXX) XXX-XX-XX
 *
 * Returns '' if no digits.
 */
export function formatDigits(digits) {
  if (!digits || !digits.length) return '';

  const d = digits.slice(0, 10);
  let result = '';

  if (d.length >= 1) {
    result = '+7 (' + d.slice(0, 3);
  }
  if (d.length >= 4) {
    result += ') ' + d.slice(3, 6);
  } else if (d.length >= 3) {
    result += ')';
  }
  if (d.length >= 7) {
    result += '-' + d.slice(6, 8);
  }
  if (d.length >= 9) {
    result += '-' + d.slice(8, 10);
  }

  return result;
}

/**
 * Parse a formatted phone string back to raw digits
 */
export function parseFormatted(formatted) {
  let raw = stripNonDigits(formatted);
  // Strip the country code digit (7) if present at start
  if (raw.startsWith('7') && raw.length > 1) {
    raw = raw.slice(1);
  }
  return raw.length <= 10 ? raw : '';
}

/**
 * Apply mask to an input element.
 * Returns a controller object with .destroy() method.
 */
export function applyMask(input, options = {}) {
  const {
    placeholder = '+7 (___) ___-__-__',
    onComplete,
  } = options;

  if (input.placeholder !== placeholder) {
    input.placeholder = placeholder;
  }

  input.setAttribute('inputmode', 'numeric');
  input.setAttribute('maxlength', MAX_LENGTH + 4); // max formatted length

  function handleInput() {
    const raw = input.value;
    const cursor = input.selectionStart;

    const { digits } = normalizeDigits(raw);

    if (!digits.length) {
      input.value = '';
      return;
    }

    const prevDigits = parseFormatted(input.value);
    const digitDelta = digits.length - prevDigits.length;

    // Calculate cursor digit position before reformatting
    const cursorDigitPos = countDigitsBefore(raw, cursor);

    const formatted = formatDigits(digits);
    input.value = formatted;

    // Restore cursor: position it after the cursorDigitPos-th digit in the formatted string
    const newPos = cursorDigitPos + getPrefixUpTo(cursorDigitPos);
    input.setSelectionRange(newPos, newPos);

    // Callback on complete (10 digits)
    if (digits.length === 10 && onComplete) {
      onComplete(formatted);
    }
  }

  function countDigitsBefore(value, pos) {
    let count = 0;
    for (let i = 0; i < pos && i < value.length; i++) {
      if (DIGIT.test(value[i])) count++;
    }
    return count;
  }

  // Returns the number of non-digit chars before the n-th digit in the formatted string
  function getPrefixUpTo(n) {
    // +7 (XXX) XXX-XX-XX
    // digit 1-3: prefix = '+7 (' = 3 chars
    // digit 4-6: prefix = '+7 (' + ')' + ' ' = 5 chars
    // digit 7-8: prefix = '+7 (' + ')' + ' ' + '-' = 6 chars
    // digit 9-10: prefix = '+7 (' + ')' + ' ' + '-' + '-' = 7 chars
    if (n <= 3) return 3;
    if (n <= 6) return 5;
    if (n <= 8) return 6;
    return 7;
  }

  function handleKeydown(e) {
    // Allow: backspace, delete, arrows, tab, home, end, ctrl/cmd
    if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab', 'Home', 'End'].includes(e.key)) {
      return;
    }
    if (e.ctrlKey || e.metaKey) return;

    // Only allow digits
    if (!DIGIT.test(e.key) || e.key.length !== 1) {
      e.preventDefault();
    }
  }

  function handlePaste(e) {
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    const { digits } = normalizeDigits(text);

    const raw = input.value;
    const prevDigits = parseFormatted(raw);
    const cursorDigitPos = countDigitsBefore(raw, input.selectionStart);

    const combined = prevDigits.slice(0, cursorDigitPos) + digits + prevDigits.slice(cursorDigitPos);
    const trimmed = combined.slice(0, 10);

    const formatted = formatDigits(trimmed);
    input.value = formatted;

    const newPos = cursorDigitPos + trimmed.length - cursorDigitPos + getPrefixUpTo(trimmed.length);
    input.setSelectionRange(newPos, newPos);

    if (trimmed.length === 10 && onComplete) {
      onComplete(formatted);
    }
  }

  input.addEventListener('input', handleInput);
  input.addEventListener('keydown', handleKeydown);
  input.addEventListener('paste', handlePaste);

  return {
    destroy() {
      input.removeEventListener('input', handleInput);
      input.removeEventListener('keydown', handleKeydown);
      input.removeEventListener('paste', handlePaste);
    },
  };
}

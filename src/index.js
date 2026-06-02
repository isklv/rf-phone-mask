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
 *   - If >10 digits → trim to 10
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

  // Trim to max 10 digits (don't reject, just cap)
  if (digits.length > 10) digits = digits.slice(0, 10);

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
 * Parse a formatted phone string back to raw digits (without country code)
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
  input.setAttribute('maxlength', 18); // max formatted length: +7 (XXX) XXX-XX-XX

  let skipNextInput = false;
  let digitTyped = false;

  function handleFocus() {
    // If empty, insert +7 prefix
    if (!input.value) {
      input.value = '+7 (';
      input.setSelectionRange(4, 4);
    }
  }

  function handleBlur() {
    // If only prefix remains, clear it
    const digits = stripNonDigits(input.value);
    if (!digits.length) {
      input.value = '';
    }
  }

  function handleInput() {
    if (skipNextInput) {
      skipNextInput = false;
      return;
    }

    // Only reformat when a digit was just typed.
    // On other input events (Delete, IME, etc.) we skip reformatting
    // to avoid cursor jumps.
    if (!digitTyped) {
      digitTyped = false;
      return;
    }
    digitTyped = false;

    const raw = input.value;
    const cursor = input.selectionStart;

    const { digits } = normalizeDigits(raw);

    if (!digits.length) {
      input.value = '';
      return;
    }

    const cursorDigitPos = countUserDigitsBefore(raw, cursor);

    const formatted = formatDigits(digits);
    input.value = formatted;

    const newPos = cursorDigitPos + getPrefixUpTo(cursorDigitPos);
    input.setSelectionRange(newPos, newPos);

    if (digits.length === 10 && onComplete) {
      onComplete(formatted);
    }
  }

  // Count user's digits before cursor position, excluding the prefix digit '7'
  // Only counts digits in the range [4, pos) — i.e., after the "+7 (" prefix
  function countUserDigitsBefore(value, pos) {
    if (pos <= 4) return 0;
    let count = 0;
    for (let i = 4; i < pos && i < value.length; i++) {
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
    // Allow: arrows, tab, home, end, ctrl/cmd
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab', 'Home', 'End'].includes(e.key)) {
      return;
    }
    if (e.ctrlKey || e.metaKey) return;

    // Handle backspace
    if (e.key === 'Backspace') {
      const cursor = input.selectionStart || 0;
      const digitPos = countUserDigitsBefore(input.value, cursor);

      // Prevent backspace into the prefix area
      if (digitPos <= 0) {
        e.preventDefault();
        return;
      }

      e.preventDefault();

      const rawDigits = parseFormatted(input.value);
      const newDigits = rawDigits.slice(0, digitPos - 1) + rawDigits.slice(digitPos);

      if (!newDigits.length) {
        input.value = '';
        input.setSelectionRange(0, 0);
      } else {
        const formatted = formatDigits(newDigits);
        input.value = formatted;

        const newPos = (digitPos - 1) + getPrefixUpTo(digitPos - 1);
        input.setSelectionRange(newPos, newPos);
      }

      skipNextInput = true;
      return;
    }

    // Handle delete (same logic as backspace but removes digit at cursor)
    if (e.key === 'Delete') {
      const cursor = input.selectionStart || 0;
      const digitPos = countUserDigitsBefore(input.value, cursor);

      if (digitPos <= 0) {
        e.preventDefault();
        return;
      }

      e.preventDefault();

      const rawDigits = parseFormatted(input.value);
      // digitPos = number of user-digits before cursor; delete the next one (index digitPos)
      if (digitPos >= rawDigits.length) {
        // Cursor is after the last digit — nothing to delete
        return;
      }

      const newDigits = rawDigits.slice(0, digitPos) + rawDigits.slice(digitPos + 1);

      if (!newDigits.length) {
        input.value = '';
        input.setSelectionRange(0, 0);
      } else {
        const formatted = formatDigits(newDigits);
        input.value = formatted;

        const newPos = digitPos + getPrefixUpTo(digitPos);
        input.setSelectionRange(newPos, newPos);
      }

      skipNextInput = true;
      return;
    }

    // Digit typed — let the browser insert it, then reformat in handleInput
    if (DIGIT.test(e.key) && e.key.length === 1) {
      digitTyped = true;
      return;
    }

    e.preventDefault();
  }

  function handlePaste(e) {
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    const { digits } = normalizeDigits(text);

    const raw = input.value;
    const prevDigits = parseFormatted(raw);
    const cursorDigitPos = countUserDigitsBefore(raw, input.selectionStart);

    const combined = prevDigits.slice(0, cursorDigitPos) + digits + prevDigits.slice(cursorDigitPos);
    const trimmed = combined.slice(0, 10);

    const formatted = formatDigits(trimmed);
    input.value = formatted;

    const newPos = trimmed.length + getPrefixUpTo(trimmed.length);
    input.setSelectionRange(newPos, newPos);

    if (trimmed.length === 10 && onComplete) {
      onComplete(formatted);
    }
  }

  input.addEventListener('input', handleInput);
  input.addEventListener('keydown', handleKeydown);
  input.addEventListener('paste', handlePaste);
  input.addEventListener('focus', handleFocus);
  input.addEventListener('blur', handleBlur);

  return {
    destroy() {
      input.removeEventListener('input', handleInput);
      input.removeEventListener('keydown', handleKeydown);
      input.removeEventListener('paste', handlePaste);
      input.removeEventListener('focus', handleFocus);
      input.removeEventListener('blur', handleBlur);
    },
  };
}

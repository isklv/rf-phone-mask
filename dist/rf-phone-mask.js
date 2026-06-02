(function(global, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else {
    global.rfPhoneMask = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function() {
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
function stripNonDigits(value) {
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
function normalizeDigits(raw) {
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
function formatDigits(digits) {
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
function parseFormatted(formatted) {
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
function applyMask(input, options = {}) {
  const {
    placeholder = '+7 (___) ___-__-__',
    onComplete,
  } = options;

  if (input.placeholder !== placeholder) {
    input.placeholder = placeholder;
  }

  input.setAttribute('inputmode', 'numeric');
  input.setAttribute('maxlength', MAX_LENGTH + 4); // max formatted length

  let skipNextInput = false;

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

    const raw = input.value;
    const cursor = input.selectionStart;

    const { digits } = normalizeDigits(raw);

    if (!digits.length) {
      input.value = '';
      return;
    }

    // Count the user's digits before the cursor (exclude prefix '7' at position 1)
    // The prefix is '+7 (' (positions 0-3). Count digits from position 4 onward.
    // When typing a new digit, the cursor is AFTER that digit, so we count digits
    // in range [4, cursor) — this INCLUDES the newly typed digit.
    // cursorDigitPos = how many user-digits are before or at cursor.
    // After formatting, we want cursor positioned after the cursorDigitPos-th digit.
    const cursorDigitPos = countUserDigitsBefore(raw, cursor);

    const formatted = formatDigits(digits);
    input.value = formatted;

    // Position cursor after the cursorDigitPos-th digit
    const newPos = cursorDigitPos + getPrefixUpTo(cursorDigitPos);
    input.setSelectionRange(newPos, newPos);

    // Callback on complete (10 digits)
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

      // Prevent browser from deleting from the formatted string
      e.preventDefault();

      // Get the raw digits and remove the one before the cursor
      const rawDigits = parseFormatted(input.value);
      // digitPos is the count of user-digits before cursor
      // We want to remove the digitPos-th digit (0-indexed: digitPos-1)
      const newDigits = rawDigits.slice(0, digitPos - 1) + rawDigits.slice(digitPos);

      if (!newDigits.length) {
        input.value = '';
        input.setSelectionRange(0, 0);
      } else {
        const formatted = formatDigits(newDigits);
        input.value = formatted;

        // Position cursor after the (digitPos-1)-th digit
        const newPos = (digitPos - 1) + getPrefixUpTo(digitPos - 1);
        input.setSelectionRange(newPos, newPos);
      }

      // Skip the input event that will fire after backspace
      skipNextInput = true;
      return;
    }

    // Allow delete
    if (e.key === 'Delete') return;

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
    const cursorDigitPos = countUserDigitsBefore(raw, input.selectionStart);

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

return {
  stripNonDigits,
  normalizeDigits,
  formatDigits,
  parseFormatted,
  applyMask
};
});
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
  input.setAttribute('maxlength', 18); // max formatted length: +7 (XXX) XXX-XX-XX

  let skipNextInput = false;

  /**
   * Count user digits (excluding prefix '7') before a given cursor position
   * in the formatted string.
   * Digits before index 4 are part of the prefix, so we start from 4.
   */
  function countUserDigitsBefore(value, pos) {
    let count = 0;
    for (let i = 4; i < pos && i < value.length; i++) {
      if (DIGIT.test(value[i])) count++;
    }
    return count;
  }

  /**
   * Convert digit count (1-based) to cursor position in formatted string.
   * n=1 → 5  ("+7 (9|")
   * n=3 → 7  ("+7 (916|")
   * n=4 → 10 ("+7 (916) 1|")
   * n=6 → 12 ("+7 (916) 123|")
   * n=7 → 14 ("+7 (916) 123-4|")
   * n=8 → 15 ("+7 (916) 123-45|")
   * n=9 → 17 ("+7 (916) 123-45-6|")
   * n=10→ 18 ("+7 (916) 123-45-67|")
   */
  function cursorAfterDigit(n) {
    if (n <= 3) return n + 4;       // "+7 (" = 3 + n digits
    if (n <= 6) return n + 6;       // "+7 (" + 3 + ") " + (n-3) digits = 3+3+2+n-3
    if (n <= 8) return n + 7;       // "+7 (XXX) XXX-" + (n-6) digits = 13+n-6
    return n + 8;                     // "+7 (XXX) XXX-XX-" + (n-8) digits = 15+n-8
  }

  /**
   * Core reformat function. Takes raw user digits, formats them, and places cursor.
   * @param {string} digits - user digits (no country code)
   * @param {number} cursorDigitIndex - 0-indexed: number of user digits before the cursor
   */
  function setDigits(digits, cursorDigitIndex) {
    // Normalize
    const { digits: normalized } = normalizeDigits(digits);

    if (!normalized.length) {
      input.value = '';
      input.setSelectionRange(0, 0);
      if (onComplete) onComplete('');
      return;
    }

    const formatted = formatDigits(normalized);
    input.value = formatted;

    // Clamp cursorDigitIndex to valid range
    const idx = Math.min(cursorDigitIndex, normalized.length);
    const cursorPos = idx === 0 ? 4 : cursorAfterDigit(idx);
    input.setSelectionRange(cursorPos, cursorPos);

    if (normalized.length === 10 && onComplete) {
      onComplete(formatted);
    }
  }

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

  function handleKeydown(e) {
    // Allow: arrows, tab, home, end, ctrl/cmd
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab', 'Home', 'End'].includes(e.key)) {
      return;
    }
    if (e.ctrlKey || e.metaKey) return;

    const cursor = input.selectionStart || 0;
    const rawDigits = parseFormatted(input.value);
    const digitPos = countUserDigitsBefore(input.value, cursor);

    // Handle backspace
    if (e.key === 'Backspace') {
      if (digitPos <= 0) {
        // Can't delete prefix
        e.preventDefault();
        return;
      }

      e.preventDefault();
      const newDigits = rawDigits.slice(0, digitPos - 1) + rawDigits.slice(digitPos);
      setDigits(newDigits, digitPos - 1);
      skipNextInput = true;
      return;
    }

    // Handle delete
    if (e.key === 'Delete') {
      if (digitPos <= 0 || digitPos >= rawDigits.length) {
        e.preventDefault();
        return;
      }

      e.preventDefault();
      const newDigits = rawDigits.slice(0, digitPos) + rawDigits.slice(digitPos + 1);
      setDigits(newDigits, digitPos);
      skipNextInput = true;
      return;
    }

    // Digit typed
    if (DIGIT.test(e.key) && e.key.length === 1) {
      // Don't allow more than 10 digits
      if (rawDigits.length >= 10) {
        e.preventDefault();
        return;
      }

      e.preventDefault();
      // Insert digit at the cursor position in the digit sequence
      const newDigits = rawDigits.slice(0, digitPos) + e.key + rawDigits.slice(digitPos);
      setDigits(newDigits, digitPos + 1);
      skipNextInput = true;
      return;
    }

    // Block everything else
    e.preventDefault();
  }

  function handleInput() {
    if (skipNextInput) {
      skipNextInput = false;
      return;
    }

    // Fallback for any unhandled input (IME, mobile keyboards, etc.)
    const rawDigits = parseFormatted(input.value);
    const cursor = input.selectionStart || 0;
    const digitPos = countUserDigitsBefore(input.value, cursor);
    setDigits(rawDigits, digitPos);
  }

  function handlePaste(e) {
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    const { digits } = normalizeDigits(text);

    const rawDigits = parseFormatted(input.value);
    const cursor = input.selectionStart || 0;
    const cursorDigitPos = countUserDigitsBefore(input.value, cursor);

    const combined = rawDigits.slice(0, cursorDigitPos) + digits + rawDigits.slice(cursorDigitPos);
    const trimmed = combined.slice(0, 10);

    setDigits(trimmed, trimmed.length);
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
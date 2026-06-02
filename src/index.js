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
 * Normalize raw digits to a 10-digit Russian number (area code + subscriber)
 *
 * Rules:
 *   - If starts with 8 → replace with 7
 *   - If starts with 7 → strip it (will re-add +7 later)
 *   - If 11 digits and starts with 7 → strip leading 7
 *   - If 10 digits → keep as-is
 *   - Otherwise → empty string
 *
 * Returns { digits: string, hasPrefix: boolean }
 *   digits = 10-digit number without country code
 */
export function normalizeDigits(raw) {
  let digits = stripNonDigits(raw);

  if (!digits.length) return { digits: '', hasPrefix: false };

  // Strip leading + (already handled by stripNonDigits, but just in case)
  if (digits.startsWith('8')) {
    digits = '7' + digits.slice(1);
  }

  if (digits.startsWith('7')) {
    digits = digits.slice(1);
    if (digits.length === 10) return { digits, hasPrefix: true };
    return { digits: '', hasPrefix: false };
  }

  // No country code — just subscriber digits
  if (digits.length <= 10) return { digits, hasPrefix: false };

  return { digits: '', hasPrefix: false };
}

/**
 * Format 10 raw digits into +7 (XXX) XXX-XX-XX
 */
export function formatDigits(digits) {
  if (!digits || digits.length !== 10) return '';

  return `+7 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 8)}-${digits.slice(8, 10)}`;
}

/**
 * Parse a formatted phone string back to raw 10-digit number
 */
export function parseFormatted(formatted) {
  const raw = stripNonDigits(formatted);
  if (raw.startsWith('7') && raw.length === 11) return raw.slice(1);
  if (raw.length === 10) return raw;
  return '';
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

  let cursorPosition = null;

  function handleInput() {
    const raw = input.value;
    const cursor = input.selectionStart;

    const { digits, hasPrefix } = normalizeDigits(raw);

    if (!digits.length) {
      input.value = '';
      return;
    }

    const prevDigits = parseFormatted(input.value);
    const digitDelta = digits.length - prevDigits.length;

    // Calculate cursor position before reformatting
    const cursorDigitPos = countDigitsBefore(raw, cursor);

    const formatted = formatDigits(digits);
    input.value = formatted;

    // Restore cursor
    const newPos = cursorDigitPos + digitDelta + getPrefixLength(digits.length);
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

  function getPrefixLength(digitCount) {
    // +7 ( = 4 chars prefix before first digit
    if (digitCount > 3) return 4;
    return 4;
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

    input.value = formatDigits(trimmed);

    const newPos = cursorDigitPos + trimmed.length - cursorDigitPos + 4;
    input.setSelectionRange(newPos, newPos);

    if (trimmed.length === 10 && onComplete) {
      onComplete(input.value);
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

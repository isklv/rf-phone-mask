# rf-phone-mask

Input mask for Russian phone numbers. Formats as `+7 (XXX) XXX-XX-XX`.

👉 **Live Demo:** [isklv.github.io/rf-phone-mask](https://isklv.github.io/rf-phone-mask/)

Accepts any input format — `+7`, `8`, `7`, or raw digits — and normalizes everything.

## Features

- **Any input format** — works with `+7`, `8`, `7` prefixes or no prefix at all
- **Smart normalization** — `8` → `+7`, `7` → `+7`, raw digits → `+7`
- **Paste support** — paste any format, gets normalized
- **Cursor preservation** — cursor stays where you expect during formatting
- **Zero dependencies** — 1.9 KB minified, pure JS
- **ESM + UMD** — npm package or direct `<script>` tag

## Install

```bash
npm install rf-phone-mask
```

## Browser (without npm)

```html
<!-- Full version (4.3 KB) -->
<script src="https://unpkg.com/rf-phone-mask/dist/rf-phone-mask.js"></script>

<!-- Minified (1.9 KB) -->
<script src="https://unpkg.com/rf-phone-mask/dist/rf-phone-mask.min.js"></script>
```

After including, all functions are available on the `rfPhoneMask` global:

```html
<input type="text" id="phone">

<script>
  // DOM mask
  const controller = rfPhoneMask.applyMask(document.getElementById('phone'), {
    onComplete: (value) => console.log('Ready:', value),
  });

  // Utility functions
  rfPhoneMask.formatDigits('9161234567');
  // → '+7 (916) 123-45-67'

  rfPhoneMask.normalizeDigits('+79161234567');
  // → { digits: '9161234567', hasPrefix: true }

  // Remove mask later
  // controller.destroy();
</script>
```

## Usage

### DOM Mask (vanilla JS) — npm

```js
import { applyMask } from 'rf-phone-mask';

const input = document.querySelector('#phone');

const controller = applyMask(input, {
  placeholder: '+7 (___) ___-__-__',
  onComplete: (value) => {
    console.log('Phone complete:', value);
  },
});

// Later, if needed:
controller.destroy();
```

### Utility Functions

```js
import { formatDigits, parseFormatted, normalizeDigits } from 'rf-phone-mask';

// Format 10 digits → +7 (XXX) XXX-XX-XX
formatDigits('9161234567');
// → '+7 (916) 123-45-67'

// Parse formatted → raw 10 digits
parseFormatted('+7 (916) 123-45-67');
// → '9161234567'

// Normalize any input → { digits, hasPrefix }
normalizeDigits('+79161234567');
// → { digits: '9161234567', hasPrefix: true }

normalizeDigits('89161234567');
// → { digits: '9161234567', hasPrefix: true }

normalizeDigits('916');
// → { digits: '916', hasPrefix: false }
```

### With React

```jsx
import { useState } from 'react';
import { normalizeDigits, formatDigits } from 'rf-phone-mask';

function PhoneInput() {
  const [raw, setRaw] = useState('');

  const handleChange = (e) => {
    const { digits } = normalizeDigits(e.target.value);
    setRaw(digits);
  };

  return (
    <input
      type="text"
      value={formatDigits(raw)}
      onChange={handleChange}
      placeholder="+7 (___) ___-__-__"
      inputMode="numeric"
    />
  );
}
```

### With Vue

```vue
<template>
  <input
    type="text"
    :value="formatted"
    @input="handleInput"
    placeholder="+7 (___) ___-__-__"
    inputmode="numeric"
  />
</template>

<script setup>
import { ref, computed } from 'vue';
import { normalizeDigits, formatDigits } from 'rf-phone-mask';

const digits = ref('');

const formatted = computed(() => formatDigits(digits.value));

function handleInput(e) {
  const { digits: d } = normalizeDigits(e.target.value);
  digits.value = d;
}
</script>
```

## API

### `applyMask(input, options?)`

Attaches a mask to a DOM `<input>` element.

| Option | Type | Default | Description |
|---|---|---|---|
| `placeholder` | `string` | `+7 (___) ___-__-__` | Input placeholder |
| `onComplete` | `function(value)` | — | Called when 10 digits entered |

Returns `{ destroy() }` — call `destroy()` to remove the mask.

### `formatDigits(digits)`

Formats 10 raw digits into `+7 (XXX) XXX-XX-XX`. Returns `''` if not exactly 10 digits.

### `parseFormatted(formatted)`

Parses a formatted or raw phone string back to 10 raw digits.

### `normalizeDigits(raw)`

Normalizes any input to `{ digits: string, hasPrefix: boolean }`.

### `stripNonDigits(value)`

Strips all non-digit characters from a string.

## Format

All Russian numbers are formatted as:

```
+7 (XXX) XXX-XX-XX
```

Where:
- `XXX` = area code (3 digits)
- `XXX-XX-XX` = subscriber number (7 digits)

Total: 10 digits after the `+7` prefix.

## License

MIT

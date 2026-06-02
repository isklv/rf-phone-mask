import fs from 'fs';
import { minify } from 'terser';

// Read source and strip `export` keywords for UMD compat
const src = fs.readFileSync('src/index.js', 'utf8').replace(/export\s+/g, '');

// Build UMD wrapper
const umd = `(function(global, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else {
    global.rfPhoneMask = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function() {
${src}
return {
  stripNonDigits,
  normalizeDigits,
  formatDigits,
  parseFormatted,
  applyMask
};
});`;

// Write unminified browser version
fs.writeFileSync('dist/rf-phone-mask.js', umd);

// Minify with Terser
const result = await minify(umd, {
  mangle: {
    // Reserve the IIFE parameter name so it doesn't conflict with inner function params
    reserved: ['global', 'factory'],
    // Keep function names for readability
    keep_fnames: false,
  },
  compress: {
    defaults: true,
  },
  output: {
    comments: false,
  },
});

if (result.code) {
  fs.writeFileSync('dist/rf-phone-mask.min.js', result.code);
  console.log('Built dist/rf-phone-mask.js —', Buffer.byteLength(umd, 'utf8'), 'bytes');
  console.log('Built dist/rf-phone-mask.min.js —', Buffer.byteLength(result.code, 'utf8'), 'bytes');
} else {
  console.error('Minification failed!');
  process.exit(1);
}

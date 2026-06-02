import fs from 'fs';

// Read source
const src = fs.readFileSync('src/index.js', 'utf8');

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

// Simple minification
function minify(code) {
  // Remove single-line comments (but not inside strings)
  code = code.replace(/\/\/.*$/gm, '');
  // Remove multi-line comments
  code = code.replace(/\/\*[\s\S]*?\*\//g, '');
  // Remove blank lines
  code = code.replace(/^\s*[\r\n]/gm, '');
  // Collapse whitespace
  code = code.replace(/\s+/g, ' ');
  // Collapse around operators/punctuation
  code = code.replace(/\s*([{}();,:=\[>\]])\s*/g, '$1');
  // But keep space after keywords
  code = code.replace(/(\b(if|else|for|while|return|var|function|typeof|new|in|of|instanceof|try|catch|finally|throw|switch|case|break|continue|default|do|delete|void|with|yield|await|async)\b)/g, ' $1 ');
  return code.trim();
}

const minified = minify(umd);
fs.writeFileSync('dist/rf-phone-mask.min.js', minified);

console.log('Built dist/rf-phone-mask.js —', Buffer.byteLength(umd, 'utf8'), 'bytes');
console.log('Built dist/rf-phone-mask.min.js —', Buffer.byteLength(minified, 'utf8'), 'bytes');

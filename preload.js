// preload.js
const { ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');

const libsDir = path.join(__dirname, 'libs');
console.log('🔧 Preload starting — libs dir:', libsDir);

// ✅ Helper: read a file from libs/ safely
function readLib(filename) {
  try {
    return fs.readFileSync(path.join(libsDir, filename), 'utf8');
  } catch (e) {
    console.error(`❌ Could not read ${filename}:`, e.message);
    return null;
  }
}

// ✅ IMPORTANT: Do NOT eval jQuery here — document does not exist yet in preload.
// All DOM-dependent injection must happen inside DOMContentLoaded.

window.addEventListener('DOMContentLoaded', () => {
  console.log('🔧 DOMContentLoaded fired — injecting libs...');

  // ── 1. Inject jQuery ──────────────────────────────────────────────
  if (typeof window.jQuery === 'undefined') {
    const jquerySrc = readLib('jquery-3.6.0.min.js');
    if (jquerySrc) {
      try {
        // Use a Function so it runs in the window scope with document available
        const fn = new Function(jquerySrc);
        fn.call(window);
        console.log('✅ jQuery injected via fs, version:', window.jQuery?.fn?.jquery);
      } catch (e) {
        console.error('❌ jQuery eval failed:', e.message);
      }
    }
  } else {
    console.log('✅ jQuery already present, version:', window.jQuery?.fn?.jquery);
  }

  // Set $ alias
  if (window.jQuery && !window.$) {
    window.$ = window.jQuery;
    console.log('✅ $ alias set');
  }

  // ── 2. Inject Select2 CSS ─────────────────────────────────────────
  try {
    const css = readLib('select2.min.css');
    if (css) {
      const style = document.createElement('style');
      style.textContent = css;
      document.head.appendChild(style);
      console.log('✅ Select2 CSS injected');
    }
  } catch (e) {
    console.error('❌ Select2 CSS injection failed:', e.message);
  }

  // ── 3. Inject Select2 JS ──────────────────────────────────────────
  if (window.jQuery && typeof window.jQuery.fn.select2 === 'undefined') {
    const select2Src = readLib('select2.min.js');
    if (select2Src) {
      try {
        const fn = new Function('jQuery', '$', select2Src);
        fn.call(window, window.jQuery, window.jQuery);
        console.log('✅ Select2 injected via fs');
      } catch (e) {
        console.error('❌ Select2 eval failed:', e.message);
      }
    }
  } else if (window.jQuery) {
    console.log('✅ Select2 already present');
  }

  // ── 4. Patch Select2 dropdownParent to always use body ────────────
  if (window.jQuery && window.jQuery.fn.select2) {
    const originalSelect2 = window.jQuery.fn.select2;
    window.jQuery.fn.select2 = function (options, ...args) {
      if (typeof options === 'object' || options === undefined) {
        options = options || {};
        if (!options.dropdownParent) {
          options.dropdownParent = window.jQuery('body');
        }
      }
      return originalSelect2.call(this, options, ...args);
    };
    Object.assign(window.jQuery.fn.select2, originalSelect2);
    console.log('✅ Select2 patched — dropdownParent defaults to body');
  }

  // ── 5. Inject z-index + positioning fix styles ────────────────────
  const fixStyle = document.createElement('style');
  fixStyle.textContent = `
    .select2-dropdown {
      position: fixed !important;
      z-index: 999999 !important;
      background: white !important;
      border: 1px solid #aaa !important;
    }
    .select2-container--open .select2-dropdown {
      position: fixed !important;
      z-index: 999999 !important;
    }
    .select2-results__options {
      background: white !important;
      color: #333 !important;
    }
    .select2-results__option {
      background: white !important;
      color: #333 !important;
    }
    .select2-results__option--highlighted {
      background: #065f46 !important;
      color: white !important;
    }
    .select2-search__field {
      background: white !important;
      color: #333 !important;
    }
    .modal, .modal-content, [class*="modal"] {
      overflow: visible !important;
    }
    body {
      transform: none !important;
      -webkit-transform: none !important;
      isolation: auto !important;
    }
  `;
  document.head.appendChild(fixStyle);

  console.log('✅ DOMContentLoaded — jQuery:', typeof window.jQuery, '| Select2:', typeof window.$?.fn?.select2);
});

window.ipcRenderer = ipcRenderer;
console.log('✅ Preload complete');
import { useEffect, useRef } from 'react';
import { pushSheet } from '../lib/sheetBack';

/* ─── ONE LINE PER SHEET ──────────────────────────────────────────────
   useSheetBack(onClose) inside a sheet component, and the phone's back
   gesture closes it. See src/lib/sheetBack.js for why that is not
   automatic in an installed web app.

   The close handler is kept in a ref so that a sheet re-rendering with
   a fresh arrow function does not push a second mark into the history
   — which would take two back presses to get out of one sheet. */
export function useSheetBack(onClose) {
  const cb = useRef(onClose);
  cb.current = onClose;
  useEffect(() => {
    if (typeof onClose !== 'function') return undefined;
    const release = pushSheet(() => { if (cb.current) cb.current(); });
    return release;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

import { useState } from 'react';

export function useTextBoxes() {
  const [enabled, setEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem('showTextBoxes');
      if (saved !== null) return saved === 'true';
      return localStorage.getItem('readabilityMode') === '3';
    } catch { return false; }
  });
  function toggle() {
    const next = !enabled;
    setEnabled(next);
    try { localStorage.setItem('showTextBoxes', String(next)); }
    catch { /* The control remains usable when storage is unavailable. */ }
  }
  return [enabled, toggle];
}
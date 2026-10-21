import { useState } from 'react';

export function useReadabilityMode() {
  const [mode, setMode] = useState(() => {
    try {
      const saved = localStorage.getItem('readabilityMode');
      if (saved === '3') return 3;
      if (saved === '1' || saved === '2') return 2;
      return localStorage.getItem('showTextBoxes') === 'true' ? 3 : 2;
    } catch { return 2; }
  });

  function selectMode(next) {
    if (![2, 3].includes(next)) return;
    setMode(next);
    try { localStorage.setItem('readabilityMode', String(next)); }
    catch { /* The visual preference still works when storage is unavailable. */ }
  }
  return [mode, selectMode];
}

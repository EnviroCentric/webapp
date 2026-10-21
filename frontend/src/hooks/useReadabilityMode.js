import { useState } from 'react';

export function useReadabilityMode() {
  const [mode, setMode] = useState(() => {
    try {
      const saved = localStorage.getItem('readabilityMode');
      if (['1', '2', '3'].includes(saved)) return Number(saved);
      return localStorage.getItem('showTextBoxes') === 'true' ? 3 : 1;
    } catch { return 1; }
  });

  function selectMode(next) {
    if (![1, 2, 3].includes(next)) return;
    setMode(next);
    try { localStorage.setItem('readabilityMode', String(next)); }
    catch { /* The visual preference still works when storage is unavailable. */ }
  }
  return [mode, selectMode];
}

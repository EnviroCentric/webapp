import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  COUNT_HELPER_STORAGE_KEY,
  changeCurrentCount,
  countCsvFilename,
  createCountState,
  finalizeAndAdvance,
  moveToPreviousField,
  normalizeCsvFilename,
  restoreCountState,
  serializeCountCsv,
  totalFibers,
} from '../utils/countHelper';

const KEYS = {
  Numpad8: { label: '8', action: '+0.5 fiber' },
  Numpad5: { label: '5', action: '+1 fiber' },
  Numpad2: { label: '2', action: '−1 fiber' },
  Numpad4: { label: '4', action: 'Previous field' },
  Numpad6: { label: '6', action: 'Finalize / next' },
};

function playCompletionSound() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(740, context.currentTime);
  oscillator.frequency.setValueAtTime(988, context.currentTime + 0.16);
  gain.gain.setValueAtTime(0.18, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.38);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.4);
  oscillator.addEventListener('ended', () => context.close());
}

function playControlFeedback() {
  if (navigator.vibrate) navigator.vibrate(12);
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'square';
  oscillator.frequency.setValueAtTime(105, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(48, context.currentTime + 0.055);
  gain.gain.setValueAtTime(0.11, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.06);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.065);
  oscillator.addEventListener('ended', () => context.close());
}

export default function CountHelper() {
  const { user, setUser } = useAuth();
  const [state, setState] = useState(() => restoreCountState(localStorage.getItem(COUNT_HELPER_STORAGE_KEY)));
  const [csvFilename, setCsvFilename] = useState(() => countCsvFilename());
  const [soundSettings, setSoundSettings] = useState(() => ({
    feedback: user?.count_feedback_sound_enabled ?? true,
    completion: user?.count_completion_sound_enabled ?? true,
  }));
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const previousStatus = useRef(state.status);
  const fibers = useMemo(() => totalFibers(state), [state]);
  const locked = state.status !== 'active';

  useEffect(() => {
    localStorage.setItem(COUNT_HELPER_STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (previousStatus.current === 'active' && state.status !== 'active' && soundSettings.completion) playCompletionSound();
    previousStatus.current = state.status;
  }, [soundSettings.completion, state.status]);

  const handleKey = useCallback((event) => {
    if (!KEYS[event.code]) return;
    event.preventDefault();
    if (event.repeat || state.status !== 'active') return;
    if (soundSettings.feedback) playControlFeedback();

    if (event.code === 'Numpad8') setState((current) => changeCurrentCount(current, 0.5));
    if (event.code === 'Numpad5') setState((current) => changeCurrentCount(current, 1));
    if (event.code === 'Numpad2') setState((current) => changeCurrentCount(current, -1));
    if (event.code === 'Numpad4') setState(moveToPreviousField);
    if (event.code === 'Numpad6') setState(finalizeAndAdvance);
  }, [soundSettings.feedback, state.status]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  const downloadCsv = () => {
    const blob = new Blob([serializeCountCsv(state)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = normalizeCsvFilename(csvFilename);
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    if (!window.confirm('Start a new count? The current count will be erased.')) return;
    const fresh = createCountState();
    previousStatus.current = 'active';
    localStorage.removeItem(COUNT_HELPER_STORAGE_KEY);
    setState(fresh);
  };

  const saveSoundSettings = async (next) => {
    const previous = soundSettings;
    setSoundSettings(next);
    setSettingsSaving(true);
    setSettingsError('');
    try {
      const response = await api.put('/api/v1/users/me/count-helper-preferences', {
        count_feedback_sound_enabled: next.feedback,
        count_completion_sound_enabled: next.completion,
      });
      const saved = {
        feedback: response.data.count_feedback_sound_enabled,
        completion: response.data.count_completion_sound_enabled,
      };
      setSoundSettings(saved);
      setUser((current) => current ? {
        ...current,
        count_feedback_sound_enabled: saved.feedback,
        count_completion_sound_enabled: saved.completion,
      } : current);
    } catch {
      setSoundSettings(previous);
      setSettingsError('Could not save sound settings. Please try again.');
    } finally {
      setSettingsSaving(false);
    }
  };

  const statusMessage = state.status === 'overloaded'
    ? 'Overloaded — 100 or more fibers counted.'
    : state.status === 'complete'
      ? 'Complete — 100 fields counted.'
      : state.completedFields < 20
        ? `${20 - state.completedFields} fields remaining before the minimum.`
        : 'Minimum reached. Continue until 100 fibers or 100 fields.';

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-5 lg:px-6 py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Count Helper</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-300">Use the physical numpad to record fibers field by field.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-56 flex-1 text-sm font-medium text-gray-700 dark:text-gray-200">
            CSV filename
            <input
              type="text"
              value={csvFilename}
              onChange={(event) => setCsvFilename(event.target.value)}
              placeholder="count-helper.csv"
              className="mt-1 block w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
            />
          </label>
          <button type="button" onClick={downloadCsv} className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700">Save CSV</button>
          <button type="button" onClick={reset} className="rounded-lg border border-gray-400 px-4 py-2 font-medium text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700">Start New Count</button>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 mb-3" aria-label="Count totals">
        <div className="rounded-xl bg-white dark:bg-gray-800 p-3 text-center shadow">
          <div className="text-sm font-medium uppercase tracking-wide text-gray-600 dark:text-gray-300">Total Fibers</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">{fibers}</div>
        </div>
        <div className="rounded-xl bg-white dark:bg-gray-800 p-3 text-center shadow">
          <div className="text-sm font-medium uppercase tracking-wide text-gray-600 dark:text-gray-300">Fields Counted</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">{state.completedFields}</div>
        </div>
      </section>

      <div role="status" className={`mb-3 rounded-lg border px-4 py-2 font-semibold ${locked ? 'border-amber-500 bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100' : 'border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100'}`}>
        {statusMessage}
      </div>

      <section className="mb-3 rounded-xl bg-white dark:bg-gray-800 p-2 shadow">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-gray-900 dark:text-white">Numpad controls</h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={settingsSaving}
              aria-pressed={!soundSettings.feedback}
              onClick={() => saveSoundSettings({ ...soundSettings, feedback: !soundSettings.feedback })}
              className="rounded-md border border-gray-400 px-3 py-1 text-sm font-medium text-gray-800 disabled:opacity-50 dark:text-gray-100"
            >
              {soundSettings.feedback ? 'Mute key feedback' : 'Unmute key feedback'}
            </button>
            <button
              type="button"
              disabled={settingsSaving}
              aria-pressed={!soundSettings.completion}
              onClick={() => saveSoundSettings({ ...soundSettings, completion: !soundSettings.completion })}
              className="rounded-md border border-gray-400 px-3 py-1 text-sm font-medium text-gray-800 disabled:opacity-50 dark:text-gray-100"
            >
              {soundSettings.completion ? 'Mute completion ding' : 'Unmute completion ding'}
            </button>
          </div>
        </div>
        {settingsError && <p role="alert" className="mb-2 text-sm text-red-700 dark:text-red-300">{settingsError}</p>}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {Object.values(KEYS).map((key) => (
            <div key={key.label} className="flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 p-2">
              <kbd className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-gray-800 font-bold text-white">{key.label}</kbd>
              <span className="text-sm text-gray-700 dark:text-gray-200">{key.action}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="overflow-x-auto rounded-xl bg-white dark:bg-gray-800 p-2 sm:p-4 shadow" aria-label="Fiber counts by field">
        <div className="grid min-w-[500px] grid-cols-10 gap-1">
          {state.fields.map((value, index) => {
            const isCurrent = index === state.currentField && !locked;
            const isCompleted = index < state.completedFields;
            const shownValue = isCompleted || value !== null ? (value ?? 0) : '';
            return (
              <div
                key={index}
                aria-label={`Field ${index + 1}${isCurrent ? ', current' : ''}: ${shownValue === '' ? 'not counted' : `${shownValue} fibers`}`}
                className={`h-10 sm:h-11 rounded-md border px-0.5 text-center flex flex-col justify-center ${isCurrent ? 'border-blue-600 bg-blue-100 ring-2 ring-blue-500 dark:bg-blue-950' : isCompleted ? 'border-green-400 bg-green-50 dark:border-green-800 dark:bg-green-950' : 'border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-900'}`}
              >
                <span className="text-[9px] leading-none text-gray-500 dark:text-gray-400">Field {index + 1}</span>
                <span className="text-base leading-tight font-bold text-gray-900 dark:text-white">{shownValue}</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

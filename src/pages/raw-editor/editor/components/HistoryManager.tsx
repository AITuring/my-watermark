import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Options<T> = {
  storageKey: string;
  mergeWindowMs: number;
  initial: T;
  clone: (value: T) => T;
  equals: (a: T, b: T) => boolean;
};

type UseHistoryManagerResult<T> = {
  push: (next: T, allowMerge?: boolean) => void;
  undo: () => T | undefined;
  redo: () => T | undefined;
  reset: (initial: T) => void;
  canUndo: boolean;
  canRedo: boolean;
  current: T;
};

const clampInt = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(v)));

// 历史记录长度
const HISTORY_MAX_LENGTH = 200;

export function useHistoryManager<T>(options: Options<T>): UseHistoryManagerResult<T> {
  const {
    storageKey,
    mergeWindowMs,
    initial,
    clone,
    equals,
  } = options;

  const maxLengthState = clampInt(HISTORY_MAX_LENGTH, 20, 1000);

  const historyRef = useRef<T[]>([clone(initial)]);
  const redoRef = useRef<T[]>([]);
  const lastCommitTimeRef = useRef(0);

  const [counts, setCounts] = useState({ history: 1, redo: 0 });

  const syncCounts = useCallback(() => {
    setCounts({ history: historyRef.current.length, redo: redoRef.current.length });
  }, []);

  const persist = useCallback(() => {
    const payload = {
      history: historyRef.current,
      redo: redoRef.current,
      lastCommitTime: lastCommitTimeRef.current,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [storageKey]);

  useEffect(() => {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as {
        history?: T[];
        redo?: T[];
        lastCommitTime?: number;
      };
      if (Array.isArray(parsed.history) && parsed.history.length > 0) {
        historyRef.current = parsed.history.map((x) => clone(x));
      }
      if (Array.isArray(parsed.redo)) {
        redoRef.current = parsed.redo.map((x) => clone(x));
      }
      if (typeof parsed.lastCommitTime === 'number' && Number.isFinite(parsed.lastCommitTime)) {
        lastCommitTimeRef.current = parsed.lastCommitTime;
      }
      syncCounts();
    } catch {
    }
  }, [storageKey, clone, syncCounts]);



  const push = useCallback((next: T, allowMerge = true) => {
    const now = performance.now();
    const history = historyRef.current;
    const last = history[history.length - 1];
    if (last && equals(last, next)) return;

    if (allowMerge && history.length > 1 && now - lastCommitTimeRef.current < mergeWindowMs) {
      history[history.length - 1] = clone(next);
    } else {
      history.push(clone(next));
      if (history.length > maxLengthState) {
        history.shift();
      }
    }

    redoRef.current = [];
    lastCommitTimeRef.current = now;
    syncCounts();
    persist();
  }, [clone, equals, mergeWindowMs, maxLengthState, persist, syncCounts]);

  const undo = useCallback(() => {
    const history = historyRef.current;
    if (history.length <= 1) return undefined;

    const current = history.pop();
    if (current) {
      redoRef.current.push(clone(current));
      if (redoRef.current.length > maxLengthState) {
        redoRef.current.shift();
      }
    }

    const prev = history[history.length - 1];
    syncCounts();
    persist();
    return prev ? clone(prev) : undefined;
  }, [clone, maxLengthState, persist, syncCounts]);

  const redo = useCallback(() => {
    const next = redoRef.current.pop();
    if (!next) return undefined;

    historyRef.current.push(clone(next));
    if (historyRef.current.length > maxLengthState) {
      historyRef.current.shift();
    }

    syncCounts();
    persist();
    return clone(next);
  }, [clone, maxLengthState, persist, syncCounts]);

  const reset = useCallback((nextInitial: T) => {
    historyRef.current = [clone(nextInitial)];
    redoRef.current = [];
    lastCommitTimeRef.current = performance.now();
    syncCounts();
    persist();
  }, [clone, persist, syncCounts]);

  const current = useMemo(() => {
    const h = historyRef.current;
    return clone(h[h.length - 1]);
  }, [clone, counts.history]);

  return {
    push,
    undo,
    redo,
    reset,
    canUndo: counts.history > 1,
    canRedo: counts.redo > 0,
    current,
  };
}

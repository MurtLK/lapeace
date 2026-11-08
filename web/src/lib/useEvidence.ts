import { useEffect, useState } from 'react';
import { ApiError, getApi } from './api';

export type EvidenceState<T> = { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; message: string; unavailable: boolean };
export function useEvidence<T>(path: string, validate: (value: unknown) => value is T) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<EvidenceState<T>>({ status: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    void getApi(path, validate, controller.signal).then((data) => {
      if (!controller.signal.aborted) setState({ status: 'ready', data });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setState({ status: 'error', message: error instanceof Error ? error.message : 'The evidence service is unavailable.', unavailable: error instanceof ApiError && error.unavailable });
    });
    return () => controller.abort();
  }, [path, validate, version]);
  return { state, retry: () => setVersion((value) => value + 1) };
}

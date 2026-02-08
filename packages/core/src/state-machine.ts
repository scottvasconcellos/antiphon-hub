import type { DownloadPipelineEvent, DownloadPipelineState } from './types';

const transitions: Record<DownloadPipelineState, Partial<Record<DownloadPipelineEvent, DownloadPipelineState>>> = {
  idle: { QUEUE: 'queued', RESET: 'idle', CANCEL: 'cancelled' },
  queued: { START: 'downloading', CANCEL: 'cancelled', RESET: 'idle' },
  downloading: {
    PAUSE: 'paused',
    DOWNLOADED: 'verifying',
    FAIL: 'error',
    CANCEL: 'cancelled',
  },
  paused: { RESUME: 'downloading', CANCEL: 'cancelled', FAIL: 'error' },
  verifying: { VERIFY_OK: 'installing', VERIFY_FAIL: 'error', CANCEL: 'cancelled' },
  installing: { INSTALL_OK: 'complete', INSTALL_FAIL: 'error', CANCEL: 'cancelled' },
  complete: { RESET: 'idle' },
  error: { RESET: 'idle', QUEUE: 'queued' },
  cancelled: { RESET: 'idle', QUEUE: 'queued' },
};

export const transitionDownloadState = (
  state: DownloadPipelineState,
  event: DownloadPipelineEvent
): DownloadPipelineState => {
  const next = transitions[state]?.[event];
  return next ?? state;
};

export const canTransition = (state: DownloadPipelineState, event: DownloadPipelineEvent): boolean =>
  Boolean(transitions[state]?.[event]);

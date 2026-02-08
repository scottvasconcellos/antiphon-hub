import type { BootstrapError, BootstrapState } from './types';

export type BootstrapAction =
  | { type: 'BOOT_START' }
  | { type: 'BOOT_STEP'; stepLabel: string }
  | { type: 'BOOT_READY'; runtimeMode: 'tauri' | 'mock' }
  | { type: 'BOOT_FAILED'; error: BootstrapError }
  | { type: 'BOOT_RESET' };

export const initialBootstrapState: BootstrapState = {
  status: 'idle',
  stepLabel: 'Waiting to start...',
};

export const bootstrapReducer = (state: BootstrapState, action: BootstrapAction): BootstrapState => {
  switch (action.type) {
    case 'BOOT_START':
      return {
        status: 'booting',
        stepLabel: 'Starting Hub…',
      };
    case 'BOOT_STEP':
      return {
        ...state,
        status: 'booting',
        stepLabel: action.stepLabel,
      };
    case 'BOOT_READY':
      return {
        status: 'ready',
        stepLabel: 'Ready',
        runtimeMode: action.runtimeMode,
      };
    case 'BOOT_FAILED':
      return {
        status: 'failed',
        stepLabel: 'Startup failed',
        error: action.error,
      };
    case 'BOOT_RESET':
      return initialBootstrapState;
    default:
      return state;
  }
};

// Stub for @sentry/react — the real SDK is not installed in this environment.
// sentry.ts imports this module; all calls are no-ops.
import type React from 'react';

export function init(_options: Record<string, unknown>): void {}
export function captureException(_error: unknown): string { return ''; }
export function captureMessage(_message: string): string { return ''; }
export function setTag(_key: string, _value: string): void {}
export function configureScope(_cb: (scope: unknown) => void): void {}
export function withScope(_cb: (scope: unknown) => void): void {}
export function getCurrentHub(): unknown { return { setTag() {}, configureScope() {} }; }
export function getClient(): unknown { return undefined; }

export class Replay {
  constructor(_options?: Record<string, unknown>) {}
}
export class BrowserTracing {
  constructor(_options?: Record<string, unknown>) {}
}

export interface ErrorBoundaryProps {
  fallback?: React.ReactNode | ((props: { error: Error; componentStack: string; resetError: () => void }) => React.ReactNode);
  children?: React.ReactNode;
}

export const ErrorBoundary: React.ComponentType<ErrorBoundaryProps> = ({ children }) => children as React.ReactElement;

export function withProfiler<T>(component: T): T { return component; }

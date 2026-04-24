declare module '@sentry/react' {
  import type React from 'react';

  export interface SentryOptions {
    dsn?: string;
    environment?: string;
    release?: string;
    integrations?: unknown[];
    tracesSampleRate?: number;
    replaysSessionSampleRate?: number;
    replaysOnErrorSampleRate?: number;
    [key: string]: unknown;
  }

  export interface Hub {
    setTag(key: string, value: string): void;
    configureScope(callback: (scope: Scope) => void): void;
  }

  export interface Scope {
    setTag(key: string, value: string): void;
    setUser(user: Record<string, unknown> | null): void;
    setExtra(key: string, extra: unknown): void;
  }

  export interface Client {
    setTag(key: string, value: string): void;
  }

  export function init(options: SentryOptions): void;
  export function captureException(error: unknown, hint?: unknown): string;
  export function captureMessage(message: string, level?: string): string;
  export function setTag(key: string, value: string): void;
  export function configureScope(callback: (scope: Scope) => void): void;
  export function withScope(callback: (scope: Scope) => void): void;
  export function getCurrentHub(): Hub;
  export function getClient(): Client | undefined;

  export class Replay {
    constructor(options?: Record<string, unknown>);
  }
  export class BrowserTracing {
    constructor(options?: Record<string, unknown>);
  }

  export interface ErrorBoundaryProps {
    fallback?: React.ReactNode | ((props: { error: Error; componentStack: string; resetError: () => void }) => React.ReactNode);
    onError?: (error: Error, componentStack: string, eventId: string) => void;
    onMount?: () => void;
    onUnmount?: (error: Error | null, componentStack: string | null, eventId: string | null) => void;
    onReset?: (error: Error | null, componentStack: string | null, eventId: string | null) => void;
    resetKeys?: unknown[];
    children?: React.ReactNode;
  }

  export const ErrorBoundary: React.ComponentType<ErrorBoundaryProps>;

  export function withProfiler<T extends React.ComponentType<unknown>>(
    component: T,
    options?: Record<string, unknown>
  ): T;
}

import type { GeneratedConnectThread } from '@workspace/api-client-react';

/** Eligibility is read-only and only evaluated after the normal session save. */
export function shouldShowConnectThread(input: {
  secondaryStack: string | null | undefined;
  completedCount: number | undefined;
  thread: GeneratedConnectThread | undefined;
}): boolean {
  return !!input.secondaryStack && !!input.thread && Number.isInteger(input.completedCount)
    && input.completedCount! > 0 && input.completedCount! % 4 === 0;
}
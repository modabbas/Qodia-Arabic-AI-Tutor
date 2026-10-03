import type { GeneratedConnectThread } from '@workspace/api-client-react';
import { CONNECT_THREAD_TRIGGER } from '../../../../lib/api-zod/src/judge-demo-config.ts';

/** Eligibility is read-only and only evaluated after the normal session save. */
export function shouldShowConnectThread(input: {
  secondaryStack: string | null | undefined;
  completedCount: number | undefined;
  thread: GeneratedConnectThread | undefined;
}, trigger: "first" | number = CONNECT_THREAD_TRIGGER): boolean {
  return !!input.secondaryStack && !!input.thread && Number.isInteger(input.completedCount)
    && input.completedCount! > 0 && (trigger === "first"
      ? input.completedCount === 1 : input.completedCount! % trigger === 0);
}
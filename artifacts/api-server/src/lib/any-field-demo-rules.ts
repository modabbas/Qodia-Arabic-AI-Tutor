import type { AnyFieldSession } from "@workspace/api-zod";

/** Only this isolated demo's output is checked; student validators are never used. */
export function anyFieldSessionIssues(session: AnyFieldSession): string[] {
  const issues: string[] = [];
  const choices = [
    ["touch1", session.touch1_challenge.options],
    ["touch2", session.touch2_reveal.options],
    ["touch3", session.touch3_explore.options],
  ] as const;
  for (const [name, options] of choices) {
    if (options.filter(option => option.correct).length !== 1) issues.push(`${name}_correct_option`);
    if (new Set(options.map(option => option.text_ar.trim())).size !== options.length) issues.push(`${name}_duplicate_options`);
  }
  const task = session.touch4_analyze;
  if (new Set(task.items.map(item => item.id)).size !== task.items.length) issues.push("touch4_duplicate_ids");
  if (new Set(task.items.map(item => item.text_ar.trim())).size !== task.items.length) issues.push("touch4_duplicate_items");
  if (task.task_type === "multiple_choice") {
    if (task.items.filter(item => item.correct).length !== 1) issues.push("touch4_correct_option");
  } else {
    const indices = task.items.map(item => item.order_index).sort((a, b) => a - b);
    if (indices.some((value, index) => value !== index)) issues.push("touch4_invalid_order");
  }
  return issues;
}

/** Small, bounded, memory-only request budget. Never stores lesson/answer content. */
export class AnyFieldDemoBudget {
  private readonly entries = new Map<string, { used: number; expiresAt: number }>();
  private readonly maxRequests: number;
  private readonly windowMs: number;
  constructor(maxRequests = 24, windowMs = 10 * 60_000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  consume(key: string, now = Date.now()): boolean {
    for (const [entryKey, entry] of this.entries) if (entry.expiresAt <= now) this.entries.delete(entryKey);
    const entry = this.entries.get(key);
    if (entry) {
      if (entry.used >= this.maxRequests) return false;
      entry.used++;
      return true;
    }
    // Do not evict active limits under a flood of unique clients.
    if (this.entries.size >= 1024) return false;
    this.entries.set(key, { used: 1, expiresAt: now + this.windowMs });
    return true;
  }
}
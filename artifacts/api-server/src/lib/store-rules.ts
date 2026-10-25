import { createHash, timingSafeEqual } from "node:crypto";

const asciiDigits = (value: string) => value.replace(/[٠-٩۰-۹]/g, char => {
  const code = char.charCodeAt(0);
  return String(code >= 0x6f0 ? code - 0x6f0 : code - 0x660);
});

export function cleanStoreText(value: string, maxLength: number): string {
  const text = value.normalize("NFKC").trim().replace(/\r\n?/g, "\n");
  if (/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text) || text.length > maxLength) {
    throw new Error("INVALID_STORE_INPUT");
  }
  return text;
}

export function normalizeStoreContact(raw: string): { display: string; normalized: string } {
  const contact = cleanStoreText(asciiDigits(raw), 200);
  if (contact.includes("@")) {
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/u.test(contact)) throw new Error("INVALID_STORE_CONTACT");
    return { display: contact, normalized: `email:${contact.toLowerCase()}` };
  }
  if (!/^\+?[\d\s().-]+$/u.test(contact)) throw new Error("INVALID_STORE_CONTACT");
  const digits = contact.replace(/\D/g, "").replace(/^00/, "");
  if (digits.length < 7 || digits.length > 15) throw new Error("INVALID_STORE_CONTACT");
  return { display: contact, normalized: `phone:${digits}` };
}

export function validStoreAdminKey(provided: unknown, expected: string | undefined): boolean {
  if (!expected || expected.length < 16 || expected.length > 512 || typeof provided !== "string" || provided.length > 512) return false;
  return timingSafeEqual(createHash("sha256").update(provided).digest(), createHash("sha256").update(expected).digest());
}

export class StoreSubmissionLimiter {
  private readonly clients = new Map<string, { count: number; until: number }>();
  allow(client: string, now = Date.now()): boolean {
    for (const [id, entry] of this.clients) if (entry.until <= now) this.clients.delete(id);
    const entry = this.clients.get(client);
    if (entry) {
      if (entry.count >= 10) return false;
      entry.count++;
      return true;
    }
    if (this.clients.size >= 2000) return false;
    this.clients.set(client, { count: 1, until: now + 10 * 60 * 1000 });
    return true;
  }
}

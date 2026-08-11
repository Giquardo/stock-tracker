import { useEffect, useState } from 'react';
import { db } from '../../db/schema';

/**
 * Ensures exactly one draft stock_check exists and returns its id. Resumes
 * an existing draft if one is already in progress (spec: "state persists
 * on every tap... a refresh or crash resumes the draft session at the
 * exact point it stopped"). Session lines are created lazily per-tap in
 * WalkScreen, not seeded here, so items added to the catalogue mid-session
 * still show up.
 */
export function useDraftSession(): string | null {
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const existing = await db.stockChecks.where('status').equals('draft').first();
      if (existing) {
        if (!cancelled) setSessionId(existing.id);
        return;
      }

      const id = crypto.randomUUID();
      await db.stockChecks.add({
        id,
        startedAt: new Date().toISOString(),
        completedAt: null,
        status: 'draft',
        checkerLabel: null,
        note: null,
      });
      if (!cancelled) setSessionId(id);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  return sessionId;
}

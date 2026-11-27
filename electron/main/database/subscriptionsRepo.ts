import type Database from 'better-sqlite3';

export interface SubscriptionRecord {
  id: number;
  url: string;
  title: string;
  preset: string;
  seenUrls: string[];
  enabled: boolean;
  lastCheckedAt?: string;
  createdAt: string;
}

interface RawSubscriptionRow {
  id: number;
  url: string;
  title: string;
  preset: string;
  seen_urls_json: string;
  enabled: number;
  last_checked_at: string | null;
  created_at: string;
}

function mapRow(row: RawSubscriptionRow): SubscriptionRecord {
  let seenUrls: string[] = [];
  try {
    const parsed = JSON.parse(row.seen_urls_json) as unknown;
    if (Array.isArray(parsed)) seenUrls = parsed.filter((u): u is string => typeof u === 'string');
  } catch {
    seenUrls = [];
  }
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    preset: row.preset,
    seenUrls,
    enabled: row.enabled === 1,
    lastCheckedAt: row.last_checked_at ?? undefined,
    createdAt: row.created_at,
  };
}

export class SubscriptionsRepo {
  constructor(private readonly db: Database.Database) {}

  list(): SubscriptionRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM subscriptions ORDER BY created_at DESC')
      .all() as RawSubscriptionRow[];
    return rows.map(mapRow);
  }

  insert(input: { url: string; title: string; preset: string; seenUrls?: string[] }): SubscriptionRecord {
    const stmt = this.db.prepare(
      `INSERT INTO subscriptions (url, title, preset, seen_urls_json, last_checked_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(url) DO UPDATE SET title = excluded.title, preset = excluded.preset`,
    );
    stmt.run(input.url, input.title, input.preset, JSON.stringify(input.seenUrls ?? []));
    const row = this.db
      .prepare('SELECT * FROM subscriptions WHERE url = ?')
      .get(input.url) as RawSubscriptionRow;
    return mapRow(row);
  }

  remove(id: number): void {
    this.db.prepare('DELETE FROM subscriptions WHERE id = ?').run(id);
  }

  setEnabled(id: number, enabled: boolean): void {
    this.db.prepare('UPDATE subscriptions SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id);
  }

  updateCheck(id: number, seenUrls: string[]): void {
    this.db
      .prepare("UPDATE subscriptions SET seen_urls_json = ?, last_checked_at = datetime('now') WHERE id = ?")
      .run(JSON.stringify(seenUrls), id);
  }
}

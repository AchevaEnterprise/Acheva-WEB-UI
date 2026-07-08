/**
 * Normalizes the `/results/students/results/sessions` response.
 *
 * The API has shipped two shapes over time:
 *   flat:   [{ session, level, entries: [...] }]
 *   nested: [{ session, levels: [{ level, entries: [...] }] }]
 *
 * Both are mapped to a flat list of `{ session, level, entries }` groups so
 * consumers (moderation letter page, moderation detail history) never care.
 */
export interface ISessionEntriesGroup {
  session: string;
  level: string;
  entries: Array<Record<string, unknown>>;
}

export function normalizeSessionGroups(data: unknown): ISessionEntriesGroup[] {
  if (!Array.isArray(data)) return [];

  const groups: ISessionEntriesGroup[] = [];
  for (const raw of data as Array<Record<string, unknown>>) {
    const session = String(raw['session'] ?? raw['_id'] ?? '');
    if (Array.isArray(raw['entries'])) {
      groups.push({
        session,
        level: String(raw['level'] ?? ''),
        entries: raw['entries'] as Array<Record<string, unknown>>,
      });
      continue;
    }
    if (Array.isArray(raw['levels'])) {
      for (const lvl of raw['levels'] as Array<Record<string, unknown>>) {
        groups.push({
          session,
          level: String(lvl['level'] ?? ''),
          entries: (lvl['entries'] ?? []) as Array<Record<string, unknown>>,
        });
      }
    }
  }
  return groups;
}

import { INotification } from '../models/notification.model';

/** A resolved deep-link: router `commands` + optional `queryParams`. */
export interface NotificationRoute {
  commands: unknown[];
  queryParams?: Record<string, string>;
}

/** Normalise a result ref (string id or populated `{ _id }`) to its id. */
function resultId(
  ref: string | { _id: string } | null | undefined
): string | null {
  if (!ref) return null;
  return typeof ref === 'object' ? ref._id : ref;
}

/**
 * Single source of truth for where a notification / recent-activity item
 * navigates when clicked. Used by both the notification panel and the
 * dashboard's Recent Activity list. Returns null when the item isn't
 * navigable (e.g. legacy notifications with no `meta.type`).
 */
export function notificationRoute(
  notification: INotification
): NotificationRoute | null {
  const meta = notification.meta;

  switch (meta?.type) {
    case 'result': {
      const id = resultId(notification.relatedResult);
      if (!id || !meta.status) return null;
      return {
        commands: ['/result-management/edit-results'],
        queryParams: { resultId: id, status: meta.status },
      };
    }
    case 'moderation': {
      if (!meta.moderationId) return null;
      return { commands: ['/moderation', meta.moderationId] };
    }
    default:
      return null;
  }
}

export interface INotification {
  id: string;
  title: string;
  message: string;
  createdAt: Date;
  status: 'READ' | 'UNREAD';
  /** The result this notification is about (when result-related). */
  relatedResult?: string | { _id: string } | null;
  /** Deep-link context set by the backend. */
  meta?: INotificationMeta;
}

/** Routing context the backend attaches so a notification/activity can deep-link. */
export interface INotificationMeta {
  /** What the notification points at. Absent → not navigable (legacy). */
  type?: 'result' | 'moderation';
  /** For `result` — the result's status at the time (drives the target page). */
  status?: string;
  /** For `moderation` — the moderation id to open. */
  moderationId?: string;
  [key: string]: unknown;
}

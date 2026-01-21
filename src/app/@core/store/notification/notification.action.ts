import { createAction, props } from '@ngrx/store';
import { INotification } from '../../../@features/notifications/models/notification.model';

export const loadNotification = createAction(
  '[Notification] Get system notifications'
);
export const saveNotification = createAction(
  '[Notification] Save system notifications successfully',
  props<{ notifications: INotification[] }>()
);
export const saveNotificationError = createAction(
  '[Notification] Save system notifications failed',
  props<{ error: string }>()
);

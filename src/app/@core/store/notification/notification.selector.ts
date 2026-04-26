import { createSelector } from '@ngrx/store';
import { AppState } from '../app.state';
import { NotificationState } from './notification.reducer';

export const selectProfile = (state: AppState) => state.notification;

export const notificationLoadingSelector = createSelector(
  selectProfile,
  (state: NotificationState) => state.isLoading
);

export const notificationSelector = createSelector(
  selectProfile,
  (state: NotificationState) => state.notifications
);

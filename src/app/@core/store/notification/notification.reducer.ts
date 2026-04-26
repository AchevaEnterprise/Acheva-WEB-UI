import { createReducer, on } from '@ngrx/store';
import { INotification } from '../../../@features/notifications/models/notification.model';
import {
  loadNotification,
  saveNotification,
  saveNotificationError,
} from './notification.action';

export interface NotificationState {
  notifications: INotification[];
  error: string | null;
  isLoading: boolean;
}

export const initialState: NotificationState = {
  notifications: [],
  error: null,
  isLoading: false,
};

export const notificationReducer = createReducer(
  initialState,

  on(loadNotification, (state) => ({
    ...state,
    isLoading: true,
  })),
  on(saveNotification, (state, { notifications }) => ({
    ...state,
    notifications,
    isLoading: false,
  })),
  on(saveNotificationError, (state, { error }) => ({
    ...state,
    isLoading: false,
    error,
  }))
);

export type AppNotificationType = 'success' | 'warning' | 'error';

export interface IAppNotification {
  type: AppNotificationType;
  title: string;
  message: string;
}

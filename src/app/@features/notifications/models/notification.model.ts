export interface INotification {
  id: string;
  message: string;
  status: 'READ' | 'UNREAD';
}

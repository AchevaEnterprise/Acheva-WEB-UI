export interface INotification {
  id: string;
  title: string;
  message: string;
  createdAt: Date;
  status: 'READ' | 'UNREAD';
}

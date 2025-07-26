export interface IAPIResponse<T> {
  status: boolean;
  statusCode: string;
  data: T;
}

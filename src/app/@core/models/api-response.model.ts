export interface IAPIResponse<T> {
  status: boolean;
  statusCode: string;
  data: T;
  message: string;
}

export interface IAPIPaginatedResponse<T> {
  status: boolean;
  statusCode: string;
  data: {
    page: number;
    limit: number;
    total: number;
  } & Record<string, T>;
}

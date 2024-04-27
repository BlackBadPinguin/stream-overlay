export type AccessToken = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string[];
  obtainmentTimestamp?: number;
  token_type?: 'bearer' | string;
};

export type DataWithError<T> = [T | null, Error | null];

export * from './Request.types';

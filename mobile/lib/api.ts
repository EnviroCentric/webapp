import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.1.237:8000';
console.log('API_BASE_URL', API_BASE_URL);

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  method?: HttpMethod;
  path: string;
  body?: any;
  headers?: Record<string, string>;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export async function setTokens(tokens: AuthTokens) {
  await AsyncStorage.multiSet([
    [ACCESS_TOKEN_KEY, tokens.accessToken],
    [REFRESH_TOKEN_KEY, tokens.refreshToken],
  ]);
}

export async function clearTokens() {
  await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
}

export async function getTokens(): Promise<AuthTokens | null> {
  const [[, accessToken], [, refreshToken]] = await AsyncStorage.multiGet([
    ACCESS_TOKEN_KEY,
    REFRESH_TOKEN_KEY,
  ]);
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

async function authFetch(options: RequestOptions): Promise<Response> {
  const tokens = await getTokens();
  const url = API_BASE_URL.replace(/\/$/, '') + options.path;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers ?? {}),
  };

  if (tokens?.accessToken) {
    headers.Authorization = `Bearer ${tokens.accessToken}`;
  }

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  return response;
}

export async function request<T = any>(options: RequestOptions): Promise<T> {
  const response = await authFetch(options);

  if (response.ok) {
    if (response.status === 204) return undefined as unknown as T;
    return (await response.json()) as T;
  }

  // TODO: add 401/refresh handling later
  const text = await response.text();
  throw new Error(`API error ${response.status}: ${text}`);
}

export async function login(email: string, password: string): Promise<AuthTokens> {
  const form = new FormData();
  form.append('username', email);
  form.append('password', password);

  const url = API_BASE_URL.replace(/\/$/, '') + '/api/v1/auth/login';
  const res = await fetch(url, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Login failed: ${text}`);
  }

  const data = await res.json();
  const tokens: AuthTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
  };
  await setTokens(tokens);
  return tokens;
}

export async function getCurrentUser<T = any>(): Promise<T> {
  return request<T>({ path: '/api/v1/auth/me' });
}

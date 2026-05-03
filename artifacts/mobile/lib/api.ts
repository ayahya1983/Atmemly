import AsyncStorage from "@react-native-async-storage/async-storage";

const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN;
export const BASE_URL = DOMAIN ? `https://${DOMAIN}` : "";

const TOKEN_KEY = "khidma.token";
const USER_KEY = "khidma.user";
const LANG_KEY = "khidma.lang";

let currentToken: string | null = null;

export async function loadToken(): Promise<string | null> {
  if (currentToken) return currentToken;
  try {
    const t = await AsyncStorage.getItem(TOKEN_KEY);
    currentToken = t;
    return t;
  } catch {
    return null;
  }
}

export async function setToken(token: string | null): Promise<void> {
  currentToken = token;
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function setStoredUser(user: unknown): Promise<void> {
  if (user) await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  else await AsyncStorage.removeItem(USER_KEY);
}

export async function getStoredUser<T = unknown>(): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function getStoredLang(): Promise<"ar" | "en" | null> {
  try {
    const v = await AsyncStorage.getItem(LANG_KEY);
    return v === "ar" || v === "en" ? v : null;
  } catch {
    return null;
  }
}

export async function setStoredLang(lang: "ar" | "en"): Promise<void> {
  await AsyncStorage.setItem(LANG_KEY, lang);
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export async function api<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const token = options.auth !== false ? await loadToken() : null;
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}/api${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    if (res.status === 401 && token) {
      await setToken(null);
      await setStoredUser(null);
    }
    const msg =
      (data && typeof data === "object" && "message" in data
        ? String((data as { message: unknown }).message)
        : null) ?? res.statusText ?? "Request failed";
    throw new ApiError(res.status, msg, data);
  }

  return data as T;
}

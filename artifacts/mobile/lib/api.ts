import AsyncStorage from "@react-native-async-storage/async-storage";

const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN;
export const BASE_URL = DOMAIN ? `https://${DOMAIN}` : "";

const TOKEN_KEY = "atmemly.token";
const USER_KEY = "atmemly.user";
const LANG_KEY = "atmemly.lang";

const LEGACY_TOKEN_KEY = "khidma.token";
const LEGACY_USER_KEY = "khidma.user";
const LEGACY_LANG_KEY = "khidma.lang";
const MIGRATION_FLAG_KEY = "atmemly.storageMigrated.v1";

let currentToken: string | null = null;
let migrationPromise: Promise<void> | null = null;

async function migrateLegacyKeysOnce(): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = (async () => {
      try {
        const done = await AsyncStorage.getItem(MIGRATION_FLAG_KEY);
        if (done) return;
        const [legacyToken, legacyUser, legacyLang] = await Promise.all([
          AsyncStorage.getItem(LEGACY_TOKEN_KEY),
          AsyncStorage.getItem(LEGACY_USER_KEY),
          AsyncStorage.getItem(LEGACY_LANG_KEY),
        ]);
        if (legacyToken !== null) {
          const existing = await AsyncStorage.getItem(TOKEN_KEY);
          if (existing === null) await AsyncStorage.setItem(TOKEN_KEY, legacyToken);
          await AsyncStorage.removeItem(LEGACY_TOKEN_KEY);
        }
        if (legacyUser !== null) {
          const existing = await AsyncStorage.getItem(USER_KEY);
          if (existing === null) await AsyncStorage.setItem(USER_KEY, legacyUser);
          await AsyncStorage.removeItem(LEGACY_USER_KEY);
        }
        if (legacyLang !== null) {
          const existing = await AsyncStorage.getItem(LANG_KEY);
          if (existing === null) await AsyncStorage.setItem(LANG_KEY, legacyLang);
          await AsyncStorage.removeItem(LEGACY_LANG_KEY);
        }
        await AsyncStorage.setItem(MIGRATION_FLAG_KEY, "1");
      } catch {
        migrationPromise = null;
      }
    })();
  }
  return migrationPromise;
}

export async function loadToken(): Promise<string | null> {
  if (currentToken) return currentToken;
  try {
    await migrateLegacyKeysOnce();
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
    await migrateLegacyKeysOnce();
    const raw = await AsyncStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function getStoredLang(): Promise<"ar" | "en" | null> {
  try {
    await migrateLegacyKeysOnce();
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

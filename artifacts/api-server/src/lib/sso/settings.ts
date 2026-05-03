import { eq } from "drizzle-orm";
import { db, platformSettingsTable } from "@workspace/db";

export const SSO_SETTINGS_KEY = "sso.global";

export interface SsoGlobalSettings {
  allowLocalPassword: boolean;
  defaultLoginMethod: "password" | "sso";
  forceSsoForOrganizations: boolean;
}

export const SSO_DEFAULT_SETTINGS: SsoGlobalSettings = {
  allowLocalPassword: true,
  defaultLoginMethod: "password",
  forceSsoForOrganizations: false,
};

export async function loadSsoSettings(): Promise<SsoGlobalSettings> {
  const [row] = await db
    .select()
    .from(platformSettingsTable)
    .where(eq(platformSettingsTable.key, SSO_SETTINGS_KEY));
  if (!row || !row.value || typeof row.value !== "object") {
    return SSO_DEFAULT_SETTINGS;
  }
  return { ...SSO_DEFAULT_SETTINGS, ...(row.value as Partial<SsoGlobalSettings>) };
}

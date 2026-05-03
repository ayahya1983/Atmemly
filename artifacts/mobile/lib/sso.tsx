import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";

import {
  listSsoProviders,
  type SsoProviderPublic,
} from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";
import { useI18n } from "@/lib/i18n";
import { BASE_URL } from "@/lib/api";

const PROVIDER_LABEL: Record<string, string> = {
  google: "Google",
  microsoft: "Microsoft",
  linkedin: "LinkedIn",
  keycloak: "Keycloak",
  oidc: "SSO",
};

const PROVIDER_GLYPH: Record<string, string> = {
  google: "G",
  microsoft: "M",
  linkedin: "in",
  keycloak: "K",
  oidc: "O",
};

/**
 * Lists configured SSO providers and opens the marketplace web sign-in flow
 * inside an in-app browser. The web SPA owns the OIDC dance (PKCE, browser
 * binding cookie, link challenge UI). Once the user finishes signing in on
 * the web, they return to the app; the existing email/password fallback is
 * still available for the same account.
 *
 * Full mobile token hand-off would require a dedicated mobile SSO callback
 * on the API server (out of scope for this task).
 */
export function SsoButtons() {
  const c = useColors();
  const { isRTL } = useI18n();
  const [providers, setProviders] = useState<SsoProviderPublic[] | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listSsoProviders()
      .then((rows) => {
        if (!cancelled) setProviders(rows);
      })
      .catch(() => {
        if (!cancelled) setProviders([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!providers || providers.length === 0) return null;

  const onPress = async (slug: string) => {
    setPending(slug);
    try {
      const url = `${BASE_URL}/login?sso=${encodeURIComponent(slug)}`;
      // Opens a system-managed browser session; cookies + localStorage
      // belong to the web origin so the SPA can complete the OIDC flow.
      const result = await WebBrowser.openAuthSessionAsync(url, "atmemly://");
      if (result.type === "success" || result.type === "dismiss") {
        Alert.alert(
          "ATMEMLY",
          "Finish signing in on the web tab, then return and sign in below using your ATMEMLY email and password to continue on mobile.",
        );
      }
    } catch (err) {
      Alert.alert(
        "ATMEMLY SSO",
        err instanceof Error ? err.message : "Could not start SSO sign-in.",
      );
    } finally {
      setPending(null);
    }
  };

  return (
    <View style={{ marginTop: 18, gap: 10 }}>
      <View
        style={{
          flexDirection: isRTL ? "row-reverse" : "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
        <Text
          style={{
            color: c.mutedForeground,
            fontFamily: "Inter_500Medium",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Or continue with
        </Text>
        <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
      </View>
      {providers.map((p) => {
        const isPending = pending === p.slug;
        const label =
          p.displayName || PROVIDER_LABEL[p.type] || p.type.toUpperCase();
        return (
          <Pressable
            key={p.id}
            disabled={pending !== null}
            onPress={() => onPress(p.slug)}
            style={({ pressed }) => ({
              flexDirection: isRTL ? "row-reverse" : "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              paddingVertical: 12,
              borderRadius: c.radius,
              borderWidth: 1,
              borderColor: c.border,
              backgroundColor: c.card,
              opacity: pressed || pending !== null ? 0.7 : 1,
            })}
          >
            {isPending ? (
              <ActivityIndicator size="small" color={c.primary} />
            ) : (
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 4,
                  backgroundColor: c.muted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    color: c.foreground,
                    fontFamily: "Inter_700Bold",
                    fontSize: 11,
                  }}
                >
                  {PROVIDER_GLYPH[p.type] ?? p.type.slice(0, 1).toUpperCase()}
                </Text>
              </View>
            )}
            <Text
              style={{
                color: c.foreground,
                fontFamily: "Inter_600SemiBold",
                fontSize: 14,
              }}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

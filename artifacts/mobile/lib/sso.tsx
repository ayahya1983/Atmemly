import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";

import {
  listSsoProviders,
  type SsoProviderPublic,
} from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";
import { useI18n } from "@/lib/i18n";
import { api, setStoredUser, setToken } from "@/lib/api";
import { useAuth } from "@/lib/auth";

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

const MOBILE_REDIRECT_URI = "atmemly://sso-callback";

type SsoMobileStartResponse = {
  authorizationUrl: string;
  state: string;
  mobileSessionToken: string;
};

type SsoCallbackResponse = {
  outcome: "signed_in" | "needs_linking" | "denied" | "error";
  token?: string | null;
  refreshToken?: string | null;
  user?: Record<string, unknown> | null;
  candidateEmail?: string | null;
  provider?: string | null;
  message?: string | null;
};

/**
 * Parse `?code=…&state=…` (or `error=…`) out of the URL the in-app browser
 * captured when the IdP returned to our `atmemly://sso-callback` scheme.
 */
function parseCallbackUrl(url: string): {
  code?: string;
  state?: string;
  error?: string;
} {
  const out: { code?: string; state?: string; error?: string } = {};
  const q = url.indexOf("?");
  if (q < 0) return out;
  const params = new URLSearchParams(url.slice(q + 1));
  const code = params.get("code");
  const state = params.get("state");
  const error = params.get("error");
  if (code) out.code = code;
  if (state) out.state = state;
  if (error) out.error = error;
  return out;
}

/**
 * Lists configured SSO providers and runs the full native SSO flow:
 *  1. POST /auth/sso/{slug}/mobile-start to get the IdP authorization URL
 *     plus an opaque mobileSessionToken.
 *  2. Open the URL in `expo-web-browser` so the user signs in with Google,
 *     Microsoft, LinkedIn, or Keycloak.
 *  3. The IdP redirects to our `/mobile-bridge` HTTPS endpoint, which 302s
 *     back into the app via the `atmemly://sso-callback` scheme.
 *  4. POST /auth/sso/{slug}/mobile-callback with `{code, state, mobileSessionToken}`
 *     and persist the returned bearer token + user.
 */
export function SsoButtons() {
  const c = useColors();
  const { isRTL } = useI18n();
  const { refresh } = useAuth();
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
      const start = await api<SsoMobileStartResponse>(
        `/auth/sso/${encodeURIComponent(slug)}/mobile-start`,
        { method: "POST", auth: false },
      );

      const result = await WebBrowser.openAuthSessionAsync(
        start.authorizationUrl,
        MOBILE_REDIRECT_URI,
      );

      if (result.type !== "success" || !result.url) {
        // User dismissed or system cancelled — silently abort. The button
        // becomes pressable again.
        return;
      }

      const { code, state, error } = parseCallbackUrl(result.url);
      if (error) {
        Alert.alert("ATMEMLY", `Sign-in was cancelled: ${error}`);
        return;
      }
      if (!code || !state) {
        Alert.alert("ATMEMLY", "Sign-in did not complete. Please try again.");
        return;
      }

      const cb = await api<SsoCallbackResponse>(
        `/auth/sso/${encodeURIComponent(slug)}/mobile-callback`,
        {
          method: "POST",
          auth: false,
          body: { code, state, mobileSessionToken: start.mobileSessionToken },
        },
      );

      if (cb.outcome === "signed_in" && cb.token) {
        await setToken(cb.token);
        if (cb.user) await setStoredUser(cb.user);
        await refresh();
        return;
      }

      if (cb.outcome === "needs_linking") {
        Alert.alert(
          "ATMEMLY",
          cb.message ||
            `An ATMEMLY account already exists for ${cb.candidateEmail ?? "this email"}. Sign in below with your password to link it.`,
        );
        return;
      }

      Alert.alert("ATMEMLY", cb.message || "ATMEMLY SSO sign-in was not completed.");
    } catch (err) {
      Alert.alert(
        "ATMEMLY SSO",
        err instanceof Error ? err.message : "Could not complete SSO sign-in.",
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

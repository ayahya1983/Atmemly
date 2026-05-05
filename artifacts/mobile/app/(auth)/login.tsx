import { Ionicons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Input } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { SsoButtons } from "@/lib/sso";

export default function LoginScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useI18n();
  const { login, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (overrideEmail?: string, overridePassword?: string) => {
    setError(null);
    const e = (overrideEmail ?? email).trim();
    const p = overridePassword ?? password;
    if (!e || !p) {
      setError(t("required"));
      return;
    }
    try {
      await login(e, p);
      router.replace("/(tabs)");
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : "Login failed";
      setError(msg);
    }
  };

  const demoAccounts: Array<{
    email: string;
    password: string;
    labelKey: "demoClient" | "demoFreelancer";
    icon: keyof typeof Ionicons.glyphMap;
  }> = [
    {
      email: "noor@atmemly.com",
      password: "client1234",
      labelKey: "demoClient",
      icon: "briefcase-outline",
    },
    {
      email: "layla@atmemly.com",
      password: "freelancer1234",
      labelKey: "demoFreelancer",
      icon: "color-palette-outline",
    },
  ];

  const fillDemo = (acc: { email: string; password: string }) => {
    setEmail(acc.email);
    setPassword(acc.password);
    setError(null);
    void onSubmit(acc.email, acc.password);
  };

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        flexGrow: 1,
        backgroundColor: c.background,
        padding: 24,
        paddingTop: insets.top + 24,
        paddingBottom: insets.bottom + 24,
      }}
    >
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        style={{
          alignSelf: isRTL ? "flex-end" : "flex-start",
          marginBottom: 24,
        }}
      >
        <Ionicons
          name={isRTL ? "arrow-forward" : "arrow-back"}
          size={24}
          color={c.foreground}
        />
      </Pressable>
      <Text
        style={{
          color: c.foreground,
          fontFamily: "Inter_700Bold",
          fontSize: 28,
          textAlign: isRTL ? "right" : "left",
        }}
      >
        {t("login")}
      </Text>
      <Text
        style={{
          color: c.mutedForeground,
          fontFamily: "Inter_400Regular",
          fontSize: 14,
          marginTop: 6,
          marginBottom: 32,
          textAlign: isRTL ? "right" : "left",
        }}
      >
        {t("appName")} · {t("tagline")}
      </Text>
      <View style={{ gap: 14 }}>
        <Input
          label={t("email")}
          icon="mail-outline"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <Input
          label={t("password")}
          icon="lock-closed-outline"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        {error ? (
          <Text
            style={{
              color: c.destructive,
              fontFamily: "Inter_500Medium",
              fontSize: 13,
              textAlign: isRTL ? "right" : "left",
            }}
          >
            {error}
          </Text>
        ) : null}
        <Pressable onPress={() => router.push("/(auth)/forgot")} hitSlop={8}>
          <Text
            style={{
              color: c.primary,
              fontFamily: "Inter_500Medium",
              fontSize: 13,
              textAlign: isRTL ? "right" : "left",
              marginTop: 4,
            }}
          >
            {t("forgotPassword")}
          </Text>
        </Pressable>
        <View style={{ marginTop: 16 }}>
          <Button
            label={t("login")}
            onPress={() => void onSubmit()}
            loading={loading}
          />
        </View>

        {/* Demo accounts quick-fill */}
        <View
          style={{
            marginTop: 16,
            padding: 14,
            borderRadius: c.radius,
            borderWidth: 1,
            borderColor: c.border,
            backgroundColor: c.surface,
            gap: 10,
          }}
        >
          <View>
            <Text
              style={{
                color: c.foreground,
                fontFamily: "Inter_700Bold",
                fontSize: 13,
                textAlign: isRTL ? "right" : "left",
              }}
            >
              {t("demoAccounts")}
            </Text>
            <Text
              style={{
                color: c.mutedForeground,
                fontFamily: "Inter_400Regular",
                fontSize: 12,
                marginTop: 2,
                textAlign: isRTL ? "right" : "left",
              }}
            >
              {t("demoAccountsHint")}
            </Text>
          </View>
          {demoAccounts.map((acc) => (
            <Pressable
              key={acc.email}
              onPress={() => fillDemo(acc)}
              disabled={loading}
              style={({ pressed }) => ({
                flexDirection: isRTL ? "row-reverse" : "row",
                alignItems: "center",
                gap: 10,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: c.radius,
                backgroundColor: pressed ? c.accent : c.background,
                borderWidth: 1,
                borderColor: c.border,
                opacity: loading ? 0.6 : 1,
              })}
            >
              <Ionicons name={acc.icon} size={18} color={c.primary} />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: c.foreground,
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 13,
                    textAlign: isRTL ? "right" : "left",
                  }}
                >
                  {t(acc.labelKey)}
                </Text>
                <Text
                  style={{
                    color: c.mutedForeground,
                    fontFamily: "Inter_400Regular",
                    fontSize: 11,
                    marginTop: 1,
                    textAlign: isRTL ? "right" : "left",
                  }}
                >
                  {acc.email}
                </Text>
              </View>
              <Ionicons
                name={isRTL ? "chevron-back" : "chevron-forward"}
                size={16}
                color={c.mutedForeground}
              />
            </Pressable>
          ))}
        </View>

        <SsoButtons />
        <View
          style={{
            flexDirection: isRTL ? "row-reverse" : "row",
            justifyContent: "center",
            marginTop: 12,
            gap: 6,
          }}
        >
          <Text
            style={{
              color: c.mutedForeground,
              fontSize: 13,
              fontFamily: "Inter_400Regular",
            }}
          >
            {t("noAccount")}
          </Text>
          <Link href="/(auth)/register" asChild>
            <Pressable hitSlop={8}>
              <Text
                style={{
                  color: c.primary,
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 13,
                }}
              >
                {t("register")}
              </Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </ScrollView>
  );
}

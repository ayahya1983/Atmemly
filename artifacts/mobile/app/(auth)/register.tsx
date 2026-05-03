import { Ionicons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Input } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { ApiError } from "@/lib/api";
import { useAuth, type Role } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { SsoButtons } from "@/lib/sso";

export default function RegisterScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useI18n();
  const { register, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("client");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    if (!email || !password || !fullName) {
      setError(t("required"));
      return;
    }
    if (password.length < 6) {
      setError(t("passwordTooShort"));
      return;
    }
    try {
      await register({ email: email.trim(), password, fullName, role });
      router.replace("/(tabs)");
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
          ? e.message
          : "Register failed";
      setError(msg);
    }
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
        {t("register")}
      </Text>
      <Text
        style={{
          color: c.mutedForeground,
          fontFamily: "Inter_400Regular",
          fontSize: 14,
          marginTop: 6,
          marginBottom: 24,
          textAlign: isRTL ? "right" : "left",
        }}
      >
        {t("tagline")}
      </Text>
      <Text
        style={{
          color: c.foreground,
          fontFamily: "Inter_500Medium",
          fontSize: 13,
          marginBottom: 8,
          textAlign: isRTL ? "right" : "left",
        }}
      >
        {t("role")}
      </Text>
      <View
        style={{
          flexDirection: isRTL ? "row-reverse" : "row",
          gap: 10,
          marginBottom: 16,
        }}
      >
        {(["client", "freelancer"] as const).map((r) => {
          const active = role === r;
          return (
            <Pressable
              key={r}
              onPress={() => setRole(r)}
              style={{
                flex: 1,
                paddingVertical: 14,
                borderRadius: c.radius,
                borderWidth: 1,
                borderColor: active ? c.primary : c.border,
                backgroundColor: active ? c.accent : c.surface,
                alignItems: "center",
              }}
            >
              <Ionicons
                name={r === "client" ? "briefcase-outline" : "person-outline"}
                size={20}
                color={active ? c.primary : c.mutedForeground}
              />
              <Text
                style={{
                  color: active ? c.primary : c.foreground,
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 13,
                  marginTop: 4,
                }}
              >
                {t(r)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={{ gap: 14 }}>
        <Input
          label={t("fullName")}
          icon="person-outline"
          value={fullName}
          onChangeText={setFullName}
        />
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
        <View style={{ marginTop: 16 }}>
          <Button label={t("register")} onPress={onSubmit} loading={loading} />
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
            {t("haveAccount")}
          </Text>
          <Link href="/(auth)/login" asChild>
            <Pressable hitSlop={8}>
              <Text
                style={{
                  color: c.primary,
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 13,
                }}
              >
                {t("login")}
              </Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </ScrollView>
  );
}

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

export default function LoginScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useI18n();
  const { login, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    if (!email || !password) {
      setError(t("required"));
      return;
    }
    try {
      await login(email.trim(), password);
      router.replace("/(tabs)");
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
          ? e.message
          : "Login failed";
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
          <Button label={t("login")} onPress={onSubmit} loading={loading} />
        </View>
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

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Input } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { api, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function ForgotScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useI18n();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (!email) {
      setError(t("required"));
      return;
    }
    setLoading(true);
    try {
      await api("/auth/forgot-password", {
        method: "POST",
        body: { email: email.trim() },
        auth: false,
      });
      setSent(true);
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
          ? e.message
          : "Failed";
      setError(msg);
    } finally {
      setLoading(false);
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
          marginBottom: 24,
        }}
      >
        {t("forgotPassword")}
      </Text>
      <View style={{ gap: 14 }}>
        <Input
          label={t("email")}
          icon="mail-outline"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
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
        {sent ? (
          <Text
            style={{
              color: c.success,
              fontFamily: "Inter_500Medium",
              fontSize: 13,
              textAlign: isRTL ? "right" : "left",
            }}
          >
            {t("resetEmailSent")}
          </Text>
        ) : null}
        <View style={{ marginTop: 16 }}>
          <Button label={t("submit")} onPress={onSubmit} loading={loading} />
        </View>
      </View>
    </ScrollView>
  );
}

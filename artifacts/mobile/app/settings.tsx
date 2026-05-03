import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Card } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { useI18n, type Lang } from "@/lib/i18n";

export default function SettingsScreen() {
  const c = useColors();
  const { t, lang, setLang, isRTL } = useI18n();
  const [note, setNote] = useState<string | null>(null);

  const change = async (next: Lang) => {
    if (next === lang) return;
    await setLang(next);
    setNote(t("switchedLangNote"));
  };

  return (
    <>
      <Stack.Screen options={{ title: t("settings") }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: c.background }}
        contentContainerStyle={{ padding: 20, gap: 16 }}
      >
        <Card style={{ gap: 10 }}>
          <Text
            style={{
              color: c.mutedForeground,
              fontFamily: "Inter_500Medium",
              fontSize: 12,
              textAlign: isRTL ? "right" : "left",
            }}
          >
            {t("language")}
          </Text>
          {(["ar", "en"] as const).map((code) => {
            const active = lang === code;
            return (
              <Pressable
                key={code}
                onPress={() => change(code)}
                style={{
                  flexDirection: isRTL ? "row-reverse" : "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: 12,
                  borderTopWidth: 1,
                  borderTopColor: c.border,
                }}
              >
                <Text
                  style={{
                    color: c.foreground,
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 15,
                  }}
                >
                  {t(code === "ar" ? "arabic" : "english")}
                </Text>
                {active ? (
                  <Ionicons name="checkmark-circle" size={22} color={c.primary} />
                ) : (
                  <Ionicons
                    name="ellipse-outline"
                    size={22}
                    color={c.mutedForeground}
                  />
                )}
              </Pressable>
            );
          })}
        </Card>
        {note ? (
          <Text
            style={{
              color: c.mutedForeground,
              fontFamily: "Inter_400Regular",
              fontSize: 12,
              textAlign: "center",
            }}
          >
            {note}
          </Text>
        ) : null}
      </ScrollView>
    </>
  );
}

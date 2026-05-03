import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Avatar,
  Badge,
  Button,
  Card,
  ErrorState,
  LoadingState,
} from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useFreelancer } from "@/lib/queries";

export default function FreelancerDetailScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { t, lang, isRTL } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const fl = useFreelancer(id);
  const { user } = useAuth();

  const onMessage = async () => {
    if (!user) {
      router.push("/(auth)/login");
      return;
    }
    try {
      const conv = await api<{ id: number }>("/conversations", {
        method: "POST",
        body: { recipientId: Number(id) },
      });
      router.push(`/conversations/${conv.id}`);
    } catch {
      // no-op
    }
  };

  if (fl.isLoading) return <LoadingState />;
  if (fl.isError || !fl.data) {
    return <ErrorState onRetry={() => void fl.refetch()} />;
  }

  const f = fl.data;
  const name = f.fullName ?? f.name ?? "—";
  return (
    <>
      <Stack.Screen options={{ title: t("details") }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: c.background }}
        contentContainerStyle={{
          padding: 20,
          paddingBottom: insets.bottom + 100,
          gap: 16,
        }}
      >
        <View style={{ alignItems: "center", gap: 10 }}>
          <Avatar name={name} size={84} />
          <Text
            style={{
              color: c.foreground,
              fontFamily: "Inter_700Bold",
              fontSize: 22,
            }}
          >
            {name}
          </Text>
          {f.title ? (
            <Text
              style={{
                color: c.mutedForeground,
                fontFamily: "Inter_400Regular",
                fontSize: 14,
              }}
            >
              {f.title}
            </Text>
          ) : null}
          <View
            style={{
              flexDirection: isRTL ? "row-reverse" : "row",
              gap: 16,
              marginTop: 6,
            }}
          >
            <Stat
              icon="star"
              value={(f.rating ?? 0).toFixed(1)}
              label={t("rating")}
            />
            {f.hourlyRate != null ? (
              <Stat
                icon="cash-outline"
                value={formatCurrency(f.hourlyRate, lang)}
                label={t("rate")}
              />
            ) : null}
            <Stat
              icon="chatbubble-outline"
              value={String(f.reviewsCount ?? 0)}
              label={t("reviews")}
            />
          </View>
        </View>

        {f.bio ? (
          <Card>
            <Text
              style={{
                color: c.foreground,
                fontFamily: "Inter_700Bold",
                fontSize: 15,
                marginBottom: 8,
                textAlign: isRTL ? "right" : "left",
              }}
            >
              {t("about")}
            </Text>
            <Text
              style={{
                color: c.foreground,
                fontFamily: "Inter_400Regular",
                fontSize: 14,
                lineHeight: 22,
                textAlign: isRTL ? "right" : "left",
              }}
            >
              {f.bio}
            </Text>
          </Card>
        ) : null}

        {f.skills && f.skills.length > 0 ? (
          <Card>
            <Text
              style={{
                color: c.foreground,
                fontFamily: "Inter_700Bold",
                fontSize: 15,
                marginBottom: 10,
                textAlign: isRTL ? "right" : "left",
              }}
            >
              {t("skills")}
            </Text>
            <View
              style={{
                flexDirection: isRTL ? "row-reverse" : "row",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              {f.skills.map((s) => (
                <Badge key={s} label={s} />
              ))}
            </View>
          </Card>
        ) : null}
      </ScrollView>

      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: insets.bottom + 12,
          backgroundColor: c.background,
          borderTopWidth: 1,
          borderTopColor: c.border,
        }}
      >
        <Button label={t("contact")} icon="chatbubble-outline" onPress={onMessage} />
      </View>
    </>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
}) {
  const c = useColors();
  return (
    <View style={{ alignItems: "center", gap: 2, minWidth: 80 }}>
      <Ionicons name={icon} size={16} color={c.primary} />
      <Text
        style={{
          color: c.foreground,
          fontFamily: "Inter_700Bold",
          fontSize: 14,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          color: c.mutedForeground,
          fontFamily: "Inter_500Medium",
          fontSize: 11,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

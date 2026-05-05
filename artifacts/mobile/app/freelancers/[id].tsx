import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React from "react";
import { Image, Linking, Pressable, ScrollView, Text, View } from "react-native";
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
import { ApiError, api } from "@/lib/api";
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
  const [contactError, setContactError] = React.useState<string | null>(null);
  const [contactBusy, setContactBusy] = React.useState(false);

  const isClient = user?.role === "client";
  const isOwnProfile = user?.id === Number(id);

  const onMessage = async () => {
    setContactError(null);
    if (!user) {
      router.push("/(auth)/login");
      return;
    }
    if (!isClient) {
      setContactError(t("onlyClientsCanMessage"));
      return;
    }
    setContactBusy(true);
    try {
      const conv = await api<{ id: number }>("/conversations", {
        method: "POST",
        body: { otherUserId: Number(id) },
      });
      router.push(`/conversations/${conv.id}`);
    } catch (e) {
      setContactError(
        e instanceof ApiError ? e.message : (e as Error).message,
      );
    } finally {
      setContactBusy(false);
    }
  };

  if (fl.isLoading) return <LoadingState />;
  if (fl.isError || !fl.data) {
    return <ErrorState onRetry={() => void fl.refetch()} />;
  }

  const f = fl.data;
  const name = f.fullName ?? "—";
  const showCta = !isOwnProfile;
  return (
    <>
      <Stack.Screen options={{ title: t("details") }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: c.background }}
        contentContainerStyle={{
          paddingBottom: insets.bottom + (showCta ? 100 : 24),
        }}
      >
        {f.coverUrl ? (
          <View
            style={{
              width: "100%",
              aspectRatio: 16 / 6,
              backgroundColor: c.surface,
            }}
          >
            <Image
              source={{ uri: f.coverUrl }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            />
          </View>
        ) : null}

        <View style={{ padding: 20, gap: 16 }}>
          <View style={{ alignItems: "center", gap: 10 }}>
            <Avatar name={name} size={84} uri={f.avatarUrl} />
            <Text
              style={{
                color: c.foreground,
                fontFamily: "Inter_700Bold",
                fontSize: 22,
                textAlign: "center",
              }}
            >
              {name}
            </Text>
            {f.headline ? (
              <Text
                style={{
                  color: c.mutedForeground,
                  fontFamily: "Inter_400Regular",
                  fontSize: 14,
                  textAlign: "center",
                }}
              >
                {f.headline}
              </Text>
            ) : null}
            <View
              style={{
                flexDirection: isRTL ? "row-reverse" : "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Ionicons name="location-outline" size={14} color={c.mutedForeground} />
              <Text
                style={{
                  color: c.mutedForeground,
                  fontFamily: "Inter_500Medium",
                  fontSize: 13,
                }}
              >
                {f.location || t("remote")}
              </Text>
            </View>
            <View
              style={{
                flexDirection: isRTL ? "row-reverse" : "row",
                gap: 16,
                marginTop: 6,
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              <Stat
                icon="star"
                value={(f.ratingAvg ?? 0).toFixed(1)}
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
                value={String(f.ratingCount ?? 0)}
                label={t("reviews")}
              />
              {f.completedJobs != null ? (
                <Stat
                  icon="checkmark-done-outline"
                  value={String(f.completedJobs)}
                  label={t("completedJobs")}
                />
              ) : null}
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
                {t("aboutMe")}
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

          {f.portfolio && f.portfolio.length > 0 ? (
            <Card>
              <Text
                style={{
                  color: c.foreground,
                  fontFamily: "Inter_700Bold",
                  fontSize: 15,
                  marginBottom: 12,
                  textAlign: isRTL ? "right" : "left",
                }}
              >
                {t("portfolio")}
              </Text>
              <View style={{ gap: 10 }}>
                {f.portfolio.map((item, i) => (
                  <Pressable
                    key={i}
                    onPress={() =>
                      Linking.openURL(item.url).catch(() => undefined)
                    }
                    style={({ pressed }) => ({
                      borderWidth: 1,
                      borderColor: c.border,
                      borderRadius: c.radius,
                      padding: 12,
                      opacity: pressed ? 0.75 : 1,
                    })}
                  >
                    <View
                      style={{
                        flexDirection: isRTL ? "row-reverse" : "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Text
                        style={{
                          color: c.primary,
                          fontFamily: "Inter_600SemiBold",
                          fontSize: 14,
                          flex: 1,
                          textAlign: isRTL ? "right" : "left",
                        }}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                      <Ionicons name="open-outline" size={14} color={c.primary} />
                    </View>
                    {item.description ? (
                      <Text
                        numberOfLines={2}
                        style={{
                          color: c.mutedForeground,
                          fontFamily: "Inter_400Regular",
                          fontSize: 12,
                          marginTop: 4,
                          textAlign: isRTL ? "right" : "left",
                        }}
                      >
                        {item.description}
                      </Text>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            </Card>
          ) : null}
        </View>
      </ScrollView>

      {showCta ? (
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
            gap: 8,
          }}
        >
          {contactError ? (
            <Text
              style={{
                color: c.destructive,
                fontSize: 12,
                fontFamily: "Inter_500Medium",
                textAlign: isRTL ? "right" : "left",
              }}
            >
              {contactError}
            </Text>
          ) : null}
          <Button
            label={t("contact")}
            icon="chatbubble-outline"
            onPress={onMessage}
            loading={contactBusy}
          />
        </View>
      ) : null}
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

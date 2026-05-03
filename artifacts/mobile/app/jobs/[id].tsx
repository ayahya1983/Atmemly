import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Badge,
  Button,
  Card,
  ErrorState,
  Input,
  LoadingState,
} from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatCurrency, timeAgo } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useCreateProposal, useJob } from "@/lib/queries";

export default function JobDetailScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { t, lang, isRTL } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const job = useJob(id);
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [bid, setBid] = useState("");
  const [cover, setCover] = useState("");
  const [error, setError] = useState<string | null>(null);
  const createProposal = useCreateProposal();

  const onSubmit = async () => {
    setError(null);
    const amount = Number(bid);
    if (!amount || !cover) {
      setError(t("required"));
      return;
    }
    try {
      await createProposal.mutateAsync({
        jobId: Number(id),
        bidAmount: amount,
        coverLetter: cover,
      });
      setOpen(false);
      setBid("");
      setCover("");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message;
      setError(msg);
    }
  };

  const onMessage = async () => {
    if (!user) {
      router.push("/(auth)/login");
      return;
    }
    if (!job.data?.client?.id) return;
    try {
      const conv = await api<{ id: number }>("/conversations", {
        method: "POST",
        body: { recipientId: job.data.client.id, jobId: Number(id) },
      });
      router.push(`/conversations/${conv.id}`);
    } catch {
      // no-op
    }
  };

  if (job.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <LoadingState />
      </View>
    );
  }
  if (job.isError || !job.data) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <ErrorState onRetry={() => void job.refetch()} />
      </View>
    );
  }

  const j = job.data;
  const budgetText =
    j.budget != null
      ? formatCurrency(j.budget, lang)
      : j.budgetMax != null
      ? `${formatCurrency(j.budgetMin ?? 0, lang)} – ${formatCurrency(j.budgetMax, lang)}`
      : "—";

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
        <View>
          <Text
            style={{
              color: c.foreground,
              fontFamily: "Inter_700Bold",
              fontSize: 22,
              textAlign: isRTL ? "right" : "left",
            }}
          >
            {j.title}
          </Text>
          <View
            style={{
              flexDirection: isRTL ? "row-reverse" : "row",
              gap: 8,
              marginTop: 10,
              flexWrap: "wrap",
            }}
          >
            <Badge label={j.budgetType === "hourly" ? t("hourly") : t("fixed")} tone="primary" />
            {j.status ? <Badge label={t((j.status as never)) ?? j.status} /> : null}
            {j.category ? <Badge label={j.category} /> : null}
          </View>
        </View>

        <Card style={{ gap: 8 }}>
          <Row icon="cash-outline" label={t("budget")} value={budgetText} />
          {j.proposalsCount != null ? (
            <Row
              icon="document-text-outline"
              label={t("proposals")}
              value={String(j.proposalsCount)}
            />
          ) : null}
          {j.createdAt ? (
            <Row
              icon="time-outline"
              label={t("details")}
              value={timeAgo(j.createdAt, lang)}
            />
          ) : null}
        </Card>

        {j.description ? (
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
              {j.fullDescription ?? j.description}
            </Text>
          </Card>
        ) : null}

        {j.skills && j.skills.length > 0 ? (
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
              {j.skills.map((s) => (
                <Badge key={s} label={s} />
              ))}
            </View>
          </Card>
        ) : null}
      </ScrollView>

      {/* Sticky CTA */}
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
          flexDirection: isRTL ? "row-reverse" : "row",
          gap: 10,
        }}
      >
        <Pressable
          onPress={onMessage}
          style={{
            width: 48,
            height: 48,
            borderRadius: c.radius,
            borderWidth: 1,
            borderColor: c.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="chatbubble-outline" size={20} color={c.primary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Button
            label={t("applyNow")}
            onPress={() => {
              if (!user) {
                router.push("/(auth)/login");
                return;
              }
              setOpen(true);
            }}
          />
        </View>
      </View>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: c.overlay,
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: c.background,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 20,
              paddingBottom: insets.bottom + 20,
              gap: 14,
            }}
          >
            <View
              style={{
                flexDirection: isRTL ? "row-reverse" : "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: c.foreground,
                  fontFamily: "Inter_700Bold",
                  fontSize: 18,
                }}
              >
                {t("applyNow")}
              </Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color={c.mutedForeground} />
              </Pressable>
            </View>
            <Input
              label={t("bidAmount")}
              icon="cash-outline"
              value={bid}
              onChangeText={setBid}
              keyboardType="numeric"
            />
            <Input
              label={t("coverLetter")}
              value={cover}
              onChangeText={setCover}
              multiline
              numberOfLines={4}
              style={{ minHeight: 100, paddingVertical: 8 }}
            />
            {error ? (
              <Text
                style={{
                  color: c.destructive,
                  fontSize: 13,
                  fontFamily: "Inter_500Medium",
                  textAlign: isRTL ? "right" : "left",
                }}
              >
                {error}
              </Text>
            ) : null}
            <Button
              label={t("submit")}
              onPress={onSubmit}
              loading={createProposal.isPending}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  const c = useColors();
  const { isRTL } = useI18n();
  return (
    <View
      style={{
        flexDirection: isRTL ? "row-reverse" : "row",
        alignItems: "center",
        gap: 10,
      }}
    >
      <Ionicons name={icon} size={16} color={c.primary} />
      <Text
        style={{
          color: c.mutedForeground,
          fontSize: 13,
          fontFamily: "Inter_400Regular",
          flex: 1,
          textAlign: isRTL ? "right" : "left",
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: c.foreground,
          fontSize: 13,
          fontFamily: "Inter_600SemiBold",
        }}
      >
        {value}
      </Text>
    </View>
  );
}

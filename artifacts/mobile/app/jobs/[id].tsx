import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Avatar,
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
import {
  useCreateProposal,
  useJob,
  useSaveJob,
  useUnsaveJob,
} from "@/lib/queries";

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
  const [days, setDays] = useState("7");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const createProposal = useCreateProposal();
  const saveJob = useSaveJob();
  const unsaveJob = useUnsaveJob();

  const isFreelancer = user?.role === "freelancer";
  const isClient = user?.role === "client";
  const isOwner = !!user && user.id === job.data?.clientId;

  const onSubmit = async () => {
    setError(null);
    const amount = Number(bid);
    const deliveryDays = Number(days);
    if (!amount || !cover || !deliveryDays) {
      setError(t("required"));
      return;
    }
    try {
      await createProposal.mutateAsync({
        data: {
          jobId: Number(id),
          expectedRate: amount,
          deliveryDays,
          coverLetter: cover,
        },
      });
      setOpen(false);
      setBid("");
      setCover("");
      setSuccess(t("proposalSent"));
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message;
      setError(msg);
    }
  };

  const onMessage = async () => {
    setActionError(null);
    if (!user) {
      router.push("/(auth)/login");
      return;
    }
    if (!job.data?.clientId) return;
    if (isOwner) return;
    try {
      const conv = await api<{ id: number }>("/conversations", {
        method: "POST",
        body: { otherUserId: job.data.clientId, jobId: Number(id) },
      });
      router.push(`/conversations/${conv.id}`);
    } catch (e) {
      setActionError((e as Error).message);
    }
  };

  const onToggleSave = async () => {
    setActionError(null);
    if (!user) {
      router.push("/(auth)/login");
      return;
    }
    if (!isFreelancer) {
      setActionError(t("onlyFreelancersCanApply"));
      return;
    }
    const numId = Number(id);
    try {
      if (job.data?.saved) {
        await unsaveJob.mutateAsync({ jobId: numId });
      } else {
        await saveJob.mutateAsync({ jobId: numId });
      }
      void job.refetch();
    } catch (e) {
      setActionError((e as Error).message);
    }
  };

  const onApply = () => {
    setActionError(null);
    if (!user) {
      router.push("/(auth)/login");
      return;
    }
    if (!isFreelancer) {
      setActionError(t("onlyFreelancersCanApply"));
      return;
    }
    setOpen(true);
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
    j.budgetMin === j.budgetMax
      ? formatCurrency(j.budgetMin, lang)
      : `${formatCurrency(j.budgetMin, lang)} – ${formatCurrency(j.budgetMax, lang)}`;
  const categoryName =
    lang === "ar" && j.categoryNameAr ? j.categoryNameAr : j.categoryNameEn;
  const showApply = isFreelancer && !isOwner;
  const showMessage = !!user && !isOwner && (isFreelancer || isClient);
  const showApplicants = isOwner;
  const proposalCount = j.proposalCount ?? 0;

  return (
    <>
      <Stack.Screen options={{ title: t("details") }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: c.background }}
        contentContainerStyle={{
          padding: 20,
          paddingBottom:
            insets.bottom +
            (showApply || showMessage || showApplicants ? 100 : 24),
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
            <Badge
              label={j.budgetType === "hourly" ? t("hourly") : t("fixed")}
              tone="primary"
            />
            {j.status ? <Badge label={t(j.status as never)} /> : null}
            {categoryName ? <Badge label={categoryName} /> : null}
          </View>
        </View>

        <Card style={{ gap: 8 }}>
          <Text
            style={{
              color: c.foreground,
              fontFamily: "Inter_700Bold",
              fontSize: 15,
              marginBottom: 4,
              textAlign: isRTL ? "right" : "left",
            }}
          >
            {t("jobDetails")}
          </Text>
          <Row icon="cash-outline" label={t("budget")} value={budgetText} />
          {j.proposalCount != null ? (
            <Row
              icon="document-text-outline"
              label={t("proposals")}
              value={String(j.proposalCount)}
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
              {j.description}
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
              {t("skillsRequired")}
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

        {j.clientName ? (
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
              {t("aboutClient")}
            </Text>
            <View
              style={{
                flexDirection: isRTL ? "row-reverse" : "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              {j.clientLogoUrl ? (
                <Image
                  source={{ uri: j.clientLogoUrl }}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 8,
                    backgroundColor: c.surface,
                  }}
                />
              ) : (
                <Avatar name={j.clientCompany ?? j.clientName} size={48} />
              )}
              <View style={{ flex: 1 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    color: c.foreground,
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 14,
                    textAlign: isRTL ? "right" : "left",
                  }}
                >
                  {j.clientCompany ?? j.clientName}
                </Text>
                {j.clientCompany && j.clientCompany !== j.clientName ? (
                  <Text
                    numberOfLines={1}
                    style={{
                      color: c.mutedForeground,
                      fontFamily: "Inter_400Regular",
                      fontSize: 12,
                      marginTop: 2,
                      textAlign: isRTL ? "right" : "left",
                    }}
                  >
                    {j.clientName}
                  </Text>
                ) : null}
              </View>
            </View>
          </Card>
        ) : null}

        {success ? (
          <View
            style={{
              backgroundColor: "#DCFCE7",
              borderRadius: c.radius,
              padding: 12,
              flexDirection: isRTL ? "row-reverse" : "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Ionicons name="checkmark-circle" size={18} color="#166534" />
            <Text
              style={{
                color: "#166534",
                fontFamily: "Inter_600SemiBold",
                fontSize: 13,
                flex: 1,
                textAlign: isRTL ? "right" : "left",
              }}
            >
              {success}
            </Text>
          </View>
        ) : null}

        {actionError ? (
          <Text
            style={{
              color: c.destructive,
              fontSize: 12,
              fontFamily: "Inter_500Medium",
              textAlign: isRTL ? "right" : "left",
            }}
          >
            {actionError}
          </Text>
        ) : null}
      </ScrollView>

      {/* Sticky CTA */}
      {showApply || showMessage || showApplicants ? (
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
          {showMessage ? (
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
          ) : null}
          {showApply ? (
            <Pressable
              onPress={onToggleSave}
              disabled={saveJob.isPending || unsaveJob.isPending}
              style={{
                width: 48,
                height: 48,
                borderRadius: c.radius,
                borderWidth: 1,
                borderColor: j.saved ? c.primary : c.border,
                backgroundColor: j.saved ? c.accent : "transparent",
                alignItems: "center",
                justifyContent: "center",
                opacity: saveJob.isPending || unsaveJob.isPending ? 0.6 : 1,
              }}
            >
              <Ionicons
                name={j.saved ? "bookmark" : "bookmark-outline"}
                size={20}
                color={c.primary}
              />
            </Pressable>
          ) : null}
          {showApply ? (
            <View style={{ flex: 1 }}>
              <Button label={t("applyNow")} onPress={onApply} />
            </View>
          ) : null}
          {showApplicants ? (
            <View style={{ flex: 1 }}>
              <Button
                label={`${t("viewApplicants")}${proposalCount ? ` (${proposalCount})` : ""}`}
                icon="people-outline"
                onPress={() => router.push(`/jobs/${id}/applicants`)}
              />
            </View>
          ) : null}
        </View>
      ) : null}

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
              label={t("days")}
              icon="time-outline"
              value={days}
              onChangeText={setDays}
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

import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
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
  useCompleteJob,
  useCreatePaymentIntent,
  useCreateReview,
  useJob,
  useJobProposals,
  useUpdateProposalStatus,
  type ProposalDetail,
} from "@/lib/queries";

type ProposalStatus =
  | "pending"
  | "shortlisted"
  | "accepted"
  | "rejected"
  | "withdrawn";

export default function JobApplicantsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { t, lang, isRTL } = useI18n();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const jobId = Number(id);
  const job = useJob(jobId);
  const proposals = useJobProposals(jobId);
  const updateStatus = useUpdateProposalStatus();
  const completeJob = useCompleteJob();
  const createPayment = useCreatePaymentIntent();
  const createReview = useCreateReview();

  const isOwner =
    !!user &&
    user.role === "client" &&
    job.data != null &&
    job.data.clientId === user.id;

  const [paymentTarget, setPaymentTarget] = useState<ProposalDetail | null>(
    null,
  );
  const [reviewTarget, setReviewTarget] = useState<ProposalDetail | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [card, setCard] = useState("");
  const [exp, setExp] = useState("");
  const [cvc, setCvc] = useState("");

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const setStatus = async (id: number, status: ProposalStatus) => {
    setActionError(null);
    try {
      await updateStatus.mutateAsync({ id, data: { status } });
      void proposals.refetch();
      if (status === "accepted") {
        const target = proposals.data?.find((p) => p.id === id);
        if (target) setPaymentTarget(target);
      }
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : (e as Error).message);
    }
  };

  const onMessage = async (p: ProposalDetail) => {
    setActionError(null);
    try {
      const conv = await api<{ id: number }>("/conversations", {
        method: "POST",
        body: { otherUserId: p.freelancerId, jobId },
      });
      router.push(`/conversations/${conv.id}`);
    } catch (e) {
      setActionError((e as Error).message);
    }
  };

  const onPay = async () => {
    if (!paymentTarget) return;
    try {
      const currency = paymentTarget.jobCurrency || "AED";
      await createPayment.mutateAsync({
        data: {
          jobId,
          proposalId: paymentTarget.id,
          amount: paymentTarget.expectedRate,
          currency,
        },
      });
      await completeJob.mutateAsync({ id: jobId });
      const target = paymentTarget;
      setPaymentTarget(null);
      setCard("");
      setExp("");
      setCvc("");
      void job.refetch();
      void proposals.refetch();
      Alert.alert(t("paymentSuccess"));
      setReviewTarget(target);
    } catch (e) {
      Alert.alert(
        t("paymentFailed"),
        e instanceof ApiError ? e.message : (e as Error).message,
      );
    }
  };

  const onSubmitReview = async () => {
    if (!reviewTarget) return;
    if (!comment.trim()) return;
    try {
      await createReview.mutateAsync({
        data: {
          jobId,
          toUserId: reviewTarget.freelancerId,
          rating,
          comment: comment.trim(),
        },
      });
      setReviewTarget(null);
      setComment("");
      setRating(5);
      Alert.alert(t("reviewSubmitted"));
    } catch (e) {
      Alert.alert(t("error"), (e as Error).message);
    }
  };

  if (proposals.isLoading || job.isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: t("applicants") }} />
        <View style={{ flex: 1, backgroundColor: c.background }}>
          <LoadingState />
        </View>
      </>
    );
  }
  if (proposals.isError) {
    return (
      <>
        <Stack.Screen options={{ title: t("applicants") }} />
        <View style={{ flex: 1, backgroundColor: c.background }}>
          <ErrorState onRetry={() => void proposals.refetch()} />
        </View>
      </>
    );
  }
  if (!isOwner) {
    return (
      <>
        <Stack.Screen options={{ title: t("applicants") }} />
        <View
          style={{
            flex: 1,
            backgroundColor: c.background,
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            gap: 12,
          }}
        >
          <Ionicons name="lock-closed-outline" size={40} color={c.mutedForeground} />
          <Text
            style={{
              color: c.foreground,
              fontFamily: "Inter_700Bold",
              fontSize: 16,
              textAlign: "center",
            }}
          >
            {t("forbidden")}
          </Text>
          <Button
            label={t("back")}
            variant="ghost"
            onPress={() => router.back()}
          />
        </View>
      </>
    );
  }

  const data = (proposals.data ?? []) as ProposalDetail[];

  return (
    <>
      <Stack.Screen options={{ title: t("applicants") }} />
      <View style={{ flex: 1, backgroundColor: c.background }}>
        {actionError ? (
          <View
            style={{
              backgroundColor: "#FEE2E2",
              paddingHorizontal: 16,
              paddingVertical: 10,
            }}
          >
            <Text
              style={{
                color: "#991B1B",
                fontSize: 12,
                fontFamily: "Inter_500Medium",
                textAlign: isRTL ? "right" : "left",
              }}
            >
              {actionError}
            </Text>
          </View>
        ) : null}
        <FlatList
          data={data}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={{
            padding: 20,
            paddingBottom: insets.bottom + 24,
            gap: 12,
          }}
          ListHeaderComponent={
            job.data?.title ? (
              <Text
                style={{
                  color: c.foreground,
                  fontFamily: "Inter_700Bold",
                  fontSize: 20,
                  textAlign: isRTL ? "right" : "left",
                  marginBottom: 8,
                }}
              >
                {job.data.title}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              title={t("noApplicants")}
              icon="document-text-outline"
            />
          }
          refreshControl={
            <RefreshControl
              refreshing={proposals.isFetching && !proposals.isLoading}
              onRefresh={() => void proposals.refetch()}
              tintColor={c.primary}
            />
          }
          renderItem={({ item: p }) => {
            const tone =
              p.status === "accepted"
                ? "success"
                : p.status === "rejected"
                  ? "danger"
                  : p.status === "shortlisted"
                    ? "primary"
                    : "warning";
            const currency = p.jobCurrency || "AED";
            return (
              <Card style={{ gap: 12 }}>
                <View
                  style={{
                    flexDirection: isRTL ? "row-reverse" : "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <Avatar
                    name={p.freelancerName}
                    uri={p.freelancerAvatarUrl}
                    size={40}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        color: c.foreground,
                        fontFamily: "Inter_700Bold",
                        fontSize: 14,
                        textAlign: isRTL ? "right" : "left",
                      }}
                    >
                      {p.freelancerName}
                    </Text>
                    {p.freelancerRatingAvg != null ? (
                      <View
                        style={{
                          flexDirection: isRTL ? "row-reverse" : "row",
                          alignItems: "center",
                          gap: 4,
                          marginTop: 2,
                        }}
                      >
                        <Ionicons name="star" size={11} color="#F59E0B" />
                        <Text
                          style={{
                            color: c.mutedForeground,
                            fontSize: 11,
                            fontFamily: "Inter_400Regular",
                          }}
                        >
                          {(p.freelancerRatingAvg ?? 0).toFixed(1)}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Badge label={t(p.status)} tone={tone} />
                </View>
                {p.coverLetter ? (
                  <Text
                    numberOfLines={4}
                    style={{
                      color: c.foreground,
                      fontSize: 13,
                      lineHeight: 19,
                      fontFamily: "Inter_400Regular",
                      textAlign: isRTL ? "right" : "left",
                    }}
                  >
                    {p.coverLetter}
                  </Text>
                ) : null}
                <View
                  style={{
                    flexDirection: isRTL ? "row-reverse" : "row",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <View>
                    <Text
                      style={{
                        color: c.mutedForeground,
                        fontSize: 11,
                        fontFamily: "Inter_400Regular",
                      }}
                    >
                      {t("proposalRate")}
                    </Text>
                    <Text
                      style={{
                        color: c.primary,
                        fontFamily: "Inter_700Bold",
                        fontSize: 14,
                      }}
                    >
                      {formatCurrency(p.expectedRate, lang, currency)}
                    </Text>
                  </View>
                  <View>
                    <Text
                      style={{
                        color: c.mutedForeground,
                        fontSize: 11,
                        fontFamily: "Inter_400Regular",
                      }}
                    >
                      {t("deliveryDays")}
                    </Text>
                    <Text
                      style={{
                        color: c.foreground,
                        fontFamily: "Inter_600SemiBold",
                        fontSize: 14,
                      }}
                    >
                      {p.deliveryDays}
                    </Text>
                  </View>
                  <View style={{ flex: 1, alignItems: "flex-end" }}>
                    <Text
                      style={{
                        color: c.mutedForeground,
                        fontSize: 11,
                        fontFamily: "Inter_400Regular",
                      }}
                    >
                      {timeAgo(p.createdAt, lang)}
                    </Text>
                  </View>
                </View>
                <View
                  style={{
                    flexDirection: isRTL ? "row-reverse" : "row",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  {p.status === "pending" ? (
                    <>
                      <View style={{ flex: 1, minWidth: 100 }}>
                        <Button
                          label={t("shortlist")}
                          variant="secondary"
                          size="sm"
                          onPress={() => setStatus(p.id, "shortlisted")}
                        />
                      </View>
                      <View style={{ flex: 1, minWidth: 100 }}>
                        <Button
                          label={t("accept")}
                          size="sm"
                          onPress={() => setStatus(p.id, "accepted")}
                        />
                      </View>
                      <View style={{ flex: 1, minWidth: 100 }}>
                        <Button
                          label={t("reject")}
                          variant="ghost"
                          size="sm"
                          onPress={() => setStatus(p.id, "rejected")}
                        />
                      </View>
                    </>
                  ) : null}
                  {p.status === "shortlisted" ? (
                    <>
                      <View style={{ flex: 1, minWidth: 100 }}>
                        <Button
                          label={t("accept")}
                          size="sm"
                          onPress={() => setStatus(p.id, "accepted")}
                        />
                      </View>
                      <View style={{ flex: 1, minWidth: 100 }}>
                        <Button
                          label={t("reject")}
                          variant="ghost"
                          size="sm"
                          onPress={() => setStatus(p.id, "rejected")}
                        />
                      </View>
                    </>
                  ) : null}
                  {p.status === "accepted" ? (
                    <>
                      <View style={{ flex: 1, minWidth: 100 }}>
                        <Button
                          label={t("message")}
                          icon="chatbubble-outline"
                          variant="ghost"
                          size="sm"
                          onPress={() => onMessage(p)}
                        />
                      </View>
                      <View style={{ flex: 1, minWidth: 100 }}>
                        <Button
                          label={t("payNow")}
                          icon="card-outline"
                          size="sm"
                          onPress={() => setPaymentTarget(p)}
                        />
                      </View>
                    </>
                  ) : null}
                </View>
              </Card>
            );
          }}
        />
      </View>

      {/* Payment modal */}
      <Modal
        visible={!!paymentTarget}
        transparent
        animationType="slide"
        onRequestClose={() => setPaymentTarget(null)}
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
                {t("securePayment")}
              </Text>
              <Pressable onPress={() => setPaymentTarget(null)} hitSlop={8}>
                <Ionicons name="close" size={24} color={c.mutedForeground} />
              </Pressable>
            </View>
            <Input
              label={t("cardNumber")}
              icon="card-outline"
              value={card}
              onChangeText={setCard}
              keyboardType="numeric"
              placeholder="**** **** **** ****"
            />
            <View
              style={{
                flexDirection: isRTL ? "row-reverse" : "row",
                gap: 10,
              }}
            >
              <View style={{ flex: 1 }}>
                <Input
                  label={t("expiry")}
                  value={exp}
                  onChangeText={setExp}
                  placeholder="MM/YY"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label={t("cvc")}
                  value={cvc}
                  onChangeText={setCvc}
                  keyboardType="numeric"
                  secureTextEntry
                  placeholder="***"
                />
              </View>
            </View>
            <Button
              label={
                paymentTarget
                  ? `${t("pay")} ${formatCurrency(
                      paymentTarget.expectedRate,
                      lang,
                      paymentTarget.jobCurrency || "AED",
                    )}`
                  : t("pay")
              }
              loading={createPayment.isPending || completeJob.isPending}
              onPress={onPay}
            />
          </View>
        </View>
      </Modal>

      {/* Review modal */}
      <Modal
        visible={!!reviewTarget}
        transparent
        animationType="slide"
        onRequestClose={() => setReviewTarget(null)}
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
                {t("leaveReview")}
              </Text>
              <Pressable onPress={() => setReviewTarget(null)} hitSlop={8}>
                <Ionicons name="close" size={24} color={c.mutedForeground} />
              </Pressable>
            </View>
            <View>
              <Text
                style={{
                  color: c.foreground,
                  fontFamily: "Inter_500Medium",
                  fontSize: 13,
                  marginBottom: 8,
                  textAlign: isRTL ? "right" : "left",
                }}
              >
                {t("ratingLabel")}
              </Text>
              <View
                style={{
                  flexDirection: isRTL ? "row-reverse" : "row",
                  gap: 8,
                }}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable key={n} onPress={() => setRating(n)} hitSlop={6}>
                    <Ionicons
                      name={n <= rating ? "star" : "star-outline"}
                      size={32}
                      color="#F59E0B"
                    />
                  </Pressable>
                ))}
              </View>
            </View>
            <Input
              label={t("comment")}
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={4}
              style={{ minHeight: 100, paddingVertical: 8 }}
            />
            <Button
              label={t("submitReview")}
              loading={createReview.isPending}
              onPress={onSubmitReview}
              disabled={!comment.trim()}
            />
          </View>
        </View>
      </Modal>

      {(updateStatus.isPending ||
        createPayment.isPending ||
        completeJob.isPending) ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
          }}
        >
          <ActivityIndicator size="small" color={c.primary} />
        </View>
      ) : null}
    </>
  );
}

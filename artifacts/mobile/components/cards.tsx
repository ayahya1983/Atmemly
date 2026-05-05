import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { formatCurrency, timeAgo } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import type {
  ConversationSummary,
  FreelancerCard as FCard,
  JobCard as JCard,
  Notification,
  ProposalDetail,
} from "@/lib/queries";

import { Avatar, Badge, Card } from "./ui";

function rowStyle(isRTL: boolean) {
  return {
    flexDirection: isRTL ? ("row-reverse" as const) : ("row" as const),
    alignItems: "center" as const,
    gap: 10,
  };
}

export function JobCard({ job, onPress }: { job: JCard; onPress?: () => void }) {
  const c = useColors();
  const { lang, isRTL, t } = useI18n();
  const budget =
    job.budgetMin === job.budgetMax
      ? formatCurrency(job.budgetMin, lang)
      : `${formatCurrency(job.budgetMin, lang)} – ${formatCurrency(job.budgetMax, lang)}`;
  const clientName = job.clientName ?? "";
  return (
    <Card onPress={onPress} style={{ gap: 10 }}>
      <View style={rowStyle(isRTL)}>
        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={2}
            style={{
              color: c.foreground,
              fontFamily: "Inter_700Bold",
              fontSize: 15,
              textAlign: isRTL ? "right" : "left",
            }}
          >
            {job.title}
          </Text>
          {clientName ? (
            <Text
              style={{
                color: c.mutedForeground,
                fontSize: 12,
                marginTop: 2,
                fontFamily: "Inter_400Regular",
                textAlign: isRTL ? "right" : "left",
              }}
            >
              {clientName}
            </Text>
          ) : null}
        </View>
        <Badge
          label={job.budgetType === "hourly" ? t("hourly") : t("fixed")}
          tone="primary"
        />
      </View>
      {job.descriptionShort ? (
        <Text
          numberOfLines={2}
          style={{
            color: c.mutedForeground,
            fontSize: 13,
            fontFamily: "Inter_400Regular",
            textAlign: isRTL ? "right" : "left",
          }}
        >
          {job.descriptionShort}
        </Text>
      ) : null}
      <View style={[rowStyle(isRTL), { justifyContent: "space-between" }]}>
        <View style={rowStyle(isRTL)}>
          <Ionicons name="cash-outline" size={14} color={c.primary} />
          <Text
            style={{
              color: c.foreground,
              fontFamily: "Inter_600SemiBold",
              fontSize: 13,
            }}
          >
            {budget}
          </Text>
        </View>
        <Text
          style={{
            color: c.mutedForeground,
            fontSize: 11,
            fontFamily: "Inter_400Regular",
          }}
        >
          {timeAgo(job.createdAt, lang)}
        </Text>
      </View>
    </Card>
  );
}

export function FreelancerCard({
  freelancer,
  onPress,
}: {
  freelancer: FCard;
  onPress?: () => void;
}) {
  const c = useColors();
  const { lang, isRTL, t } = useI18n();
  const name = freelancer.fullName ?? "—";
  return (
    <Card onPress={onPress} style={{ gap: 10 }}>
      <View style={rowStyle(isRTL)}>
        <Avatar name={name} uri={freelancer.avatarUrl} />
        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={1}
            style={{
              color: c.foreground,
              fontFamily: "Inter_700Bold",
              fontSize: 15,
              textAlign: isRTL ? "right" : "left",
            }}
          >
            {name}
          </Text>
          {freelancer.headline ? (
            <Text
              numberOfLines={1}
              style={{
                color: c.mutedForeground,
                fontSize: 12,
                fontFamily: "Inter_400Regular",
                textAlign: isRTL ? "right" : "left",
              }}
            >
              {freelancer.headline}
            </Text>
          ) : null}
          {freelancer.location ? (
            <View
              style={{
                flexDirection: isRTL ? "row-reverse" : "row",
                alignItems: "center",
                gap: 4,
                marginTop: 2,
              }}
            >
              <Ionicons name="location-outline" size={11} color={c.mutedForeground} />
              <Text
                numberOfLines={1}
                style={{
                  color: c.mutedForeground,
                  fontSize: 11,
                  fontFamily: "Inter_400Regular",
                }}
              >
                {freelancer.location}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={[rowStyle(isRTL), { justifyContent: "space-between" }]}>
        <View style={rowStyle(isRTL)}>
          <Ionicons name="star" size={14} color="#F59E0B" />
          <Text
            style={{
              color: c.foreground,
              fontFamily: "Inter_600SemiBold",
              fontSize: 12,
            }}
          >
            {(freelancer.ratingAvg ?? 0).toFixed(1)}
          </Text>
          {freelancer.ratingCount != null ? (
            <Text
              style={{
                color: c.mutedForeground,
                fontSize: 11,
                fontFamily: "Inter_400Regular",
              }}
            >
              ({freelancer.ratingCount})
            </Text>
          ) : null}
        </View>
        {freelancer.hourlyRate != null ? (
          <Text
            style={{
              color: c.primary,
              fontFamily: "Inter_700Bold",
              fontSize: 13,
            }}
          >
            {formatCurrency(freelancer.hourlyRate, lang)}/{t("rate")}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

export function ConversationCard({
  conv,
  onPress,
}: {
  conv: ConversationSummary;
  onPress?: () => void;
}) {
  const c = useColors();
  const { lang, isRTL } = useI18n();
  const name = conv.otherUserName ?? "—";
  return (
    <Card onPress={onPress}>
      <View style={rowStyle(isRTL)}>
        <Avatar name={name} />
        <View style={{ flex: 1 }}>
          <View style={[rowStyle(isRTL), { justifyContent: "space-between" }]}>
            <Text
              numberOfLines={1}
              style={{
                color: c.foreground,
                fontFamily: "Inter_600SemiBold",
                fontSize: 14,
                flex: 1,
                textAlign: isRTL ? "right" : "left",
              }}
            >
              {name}
            </Text>
            {conv.lastMessageAt ? (
              <Text
                style={{
                  color: c.mutedForeground,
                  fontSize: 11,
                  fontFamily: "Inter_400Regular",
                }}
              >
                {timeAgo(conv.lastMessageAt, lang)}
              </Text>
            ) : null}
          </View>
          {conv.lastMessage ? (
            <Text
              numberOfLines={1}
              style={{
                color: c.mutedForeground,
                fontSize: 13,
                marginTop: 2,
                fontFamily: "Inter_400Regular",
                textAlign: isRTL ? "right" : "left",
              }}
            >
              {conv.lastMessage}
            </Text>
          ) : null}
        </View>
        {conv.unreadCount && conv.unreadCount > 0 ? (
          <View
            style={{
              minWidth: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: c.primary,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 6,
            }}
          >
            <Text
              style={{
                color: c.primaryForeground,
                fontSize: 11,
                fontFamily: "Inter_700Bold",
              }}
            >
              {conv.unreadCount}
            </Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

export function NotificationItem({ n }: { n: Notification }) {
  const c = useColors();
  const { lang, isRTL } = useI18n();
  const body = n.body ?? "";
  return (
    <Card style={{ opacity: n.read ? 0.7 : 1 }}>
      <View style={rowStyle(isRTL)}>
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: n.read ? c.border : c.primary,
          }}
        />
        <View style={{ flex: 1 }}>
          {n.title ? (
            <Text
              style={{
                color: c.foreground,
                fontFamily: "Inter_600SemiBold",
                fontSize: 14,
                textAlign: isRTL ? "right" : "left",
              }}
            >
              {n.title}
            </Text>
          ) : null}
          {body ? (
            <Text
              style={{
                color: c.mutedForeground,
                fontSize: 13,
                marginTop: 2,
                fontFamily: "Inter_400Regular",
                textAlign: isRTL ? "right" : "left",
              }}
            >
              {body}
            </Text>
          ) : null}
          <Text
            style={{
              color: c.mutedForeground,
              fontSize: 11,
              marginTop: 4,
              fontFamily: "Inter_400Regular",
              textAlign: isRTL ? "right" : "left",
            }}
          >
            {timeAgo(n.createdAt, lang)}
          </Text>
        </View>
      </View>
    </Card>
  );
}

export function ProposalCard({ p }: { p: ProposalDetail }) {
  const c = useColors();
  const { lang, isRTL, t } = useI18n();
  const tone =
    p.status === "accepted"
      ? "success"
      : p.status === "rejected"
      ? "danger"
      : "warning";
  return (
    <Card style={{ gap: 8 }}>
      <View style={[rowStyle(isRTL), { justifyContent: "space-between" }]}>
        <Text
          numberOfLines={2}
          style={{
            color: c.foreground,
            fontFamily: "Inter_700Bold",
            fontSize: 14,
            flex: 1,
            textAlign: isRTL ? "right" : "left",
          }}
        >
          {p.jobTitle ?? `#${p.jobId}`}
        </Text>
        <Badge label={t(p.status)} tone={tone} />
      </View>
      <View style={[rowStyle(isRTL), { justifyContent: "space-between" }]}>
        <Text
          style={{
            color: c.primary,
            fontFamily: "Inter_700Bold",
            fontSize: 14,
          }}
        >
          {formatCurrency(p.expectedRate, lang)}
        </Text>
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
    </Card>
  );
}

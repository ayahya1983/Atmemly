import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FreelancerCard, JobCard } from "@/components/cards";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  SectionTitle,
} from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import {
  useCategories,
  useFreelancers,
  useJobs,
  useStats,
} from "@/lib/queries";

export default function HomeScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { t, lang, isRTL } = useI18n();
  const { user } = useAuth();
  const stats = useStats();
  const categories = useCategories();
  const jobs = useJobs();
  const freelancers = useFreelancers();

  const refreshing =
    stats.isFetching ||
    categories.isFetching ||
    jobs.isFetching ||
    freelancers.isFetching;
  const onRefresh = () => {
    void stats.refetch();
    void categories.refetch();
    void jobs.refetch();
    void freelancers.refetch();
  };

  const greeting =
    user
      ? lang === "ar"
        ? `مرحبًا، ${user.fullName ?? user.name ?? ""}`
        : `Hello, ${user.fullName ?? user.name ?? ""}`
      : t("appName");

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingBottom: 24,
      }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />
      }
    >
      {/* Header */}
      <View
        style={{
          paddingHorizontal: 20,
          flexDirection: isRTL ? "row-reverse" : "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View>
          <Text
            style={{
              color: c.mutedForeground,
              fontFamily: "Inter_500Medium",
              fontSize: 12,
              textAlign: isRTL ? "right" : "left",
            }}
          >
            {t("appName")}
          </Text>
          <Text
            style={{
              color: c.foreground,
              fontFamily: "Inter_700Bold",
              fontSize: 20,
              marginTop: 2,
              textAlign: isRTL ? "right" : "left",
            }}
          >
            {greeting}
          </Text>
        </View>
        <View
          style={{
            flexDirection: isRTL ? "row-reverse" : "row",
            gap: 12,
          }}
        >
          <Pressable
            onPress={() => router.push("/notifications")}
            hitSlop={8}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: c.surface,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="notifications-outline" size={20} color={c.foreground} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/settings")}
            hitSlop={8}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: c.surface,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="settings-outline" size={20} color={c.foreground} />
          </Pressable>
        </View>
      </View>

      {/* Hero */}
      <View style={{ paddingHorizontal: 20, marginTop: 18 }}>
        <View
          style={{
            backgroundColor: c.primary,
            borderRadius: c.radius + 4,
            padding: 22,
            overflow: "hidden",
          }}
        >
          <Text
            style={{
              color: c.primaryForeground,
              fontFamily: "Inter_700Bold",
              fontSize: 22,
              lineHeight: 28,
              textAlign: isRTL ? "right" : "left",
            }}
          >
            {t("heroTitle")}
          </Text>
          <Text
            style={{
              color: c.primaryForeground,
              opacity: 0.9,
              fontFamily: "Inter_400Regular",
              fontSize: 13,
              marginTop: 6,
              marginBottom: 18,
              textAlign: isRTL ? "right" : "left",
            }}
          >
            {t("heroSubtitle")}
          </Text>
          <View
            style={{
              flexDirection: isRTL ? "row-reverse" : "row",
              gap: 10,
            }}
          >
            <Pressable
              onPress={() =>
                user
                  ? router.push("/post-job")
                  : router.push("/(auth)/login")
              }
              style={{
                backgroundColor: c.primaryForeground,
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderRadius: c.radius,
              }}
            >
              <Text
                style={{
                  color: c.primary,
                  fontFamily: "Inter_700Bold",
                  fontSize: 13,
                }}
              >
                {t("postJob")}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/(tabs)/jobs")}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderRadius: c.radius,
                borderWidth: 1,
                borderColor: c.primaryForeground,
              }}
            >
              <Text
                style={{
                  color: c.primaryForeground,
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 13,
                }}
              >
                {t("browseJobs")}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Stats */}
      <View
        style={{
          paddingHorizontal: 20,
          marginTop: 18,
          flexDirection: isRTL ? "row-reverse" : "row",
          gap: 10,
        }}
      >
        <StatTile
          icon="briefcase"
          value={stats.data?.jobsPosted ?? 0}
          label={t("jobs")}
        />
        <StatTile
          icon="people"
          value={stats.data?.freelancersCount ?? 0}
          label={t("freelancers")}
        />
        <StatTile
          icon="business"
          value={stats.data?.clientsCount ?? 0}
          label={t("client") + "s"}
        />
      </View>

      {/* Categories */}
      <View style={{ paddingHorizontal: 20 }}>
        <SectionTitle title={t("topCategories")} />
        {categories.isLoading ? (
          <LoadingState />
        ) : categories.isError ? (
          <ErrorState onRetry={() => void categories.refetch()} />
        ) : (categories.data ?? []).length === 0 ? (
          <EmptyState title={t("emptyTitle")} icon="folder-open-outline" />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingVertical: 4 }}
          >
            {(categories.data ?? []).slice(0, 12).map((cat) => (
              <Pressable
                key={cat.id}
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/jobs",
                    params: { category: cat.slug },
                  })
                }
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: c.radius,
                  backgroundColor: c.surface,
                  borderWidth: 1,
                  borderColor: c.border,
                }}
              >
                <Text
                  style={{
                    color: c.foreground,
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 13,
                  }}
                >
                  {lang === "ar" && cat.nameAr ? cat.nameAr : cat.nameEn}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Featured Jobs */}
      <View style={{ paddingHorizontal: 20 }}>
        <SectionTitle
          title={t("featuredJobs")}
          action={t("viewAll")}
          onAction={() => router.push("/(tabs)/jobs")}
        />
        {jobs.isLoading ? (
          <LoadingState />
        ) : jobs.isError ? (
          <ErrorState onRetry={() => void jobs.refetch()} />
        ) : (jobs.data ?? []).length === 0 ? (
          <EmptyState title={t("emptyTitle")} icon="briefcase-outline" />
        ) : (
          <View style={{ gap: 12 }}>
            {(jobs.data ?? []).slice(0, 4).map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onPress={() => router.push(`/jobs/${job.id}`)}
              />
            ))}
          </View>
        )}
      </View>

      {/* Top Freelancers */}
      <View style={{ paddingHorizontal: 20 }}>
        <SectionTitle
          title={t("topFreelancers")}
          action={t("viewAll")}
          onAction={() => router.push("/(tabs)/freelancers")}
        />
        {freelancers.isLoading ? (
          <LoadingState />
        ) : freelancers.isError ? (
          <ErrorState onRetry={() => void freelancers.refetch()} />
        ) : (freelancers.data ?? []).length === 0 ? (
          <EmptyState title={t("emptyTitle")} icon="people-outline" />
        ) : (
          <View style={{ gap: 12 }}>
            {(freelancers.data ?? []).slice(0, 4).map((f) => (
              <FreelancerCard
                key={f.id}
                freelancer={f}
                onPress={() => router.push(`/freelancers/${f.id}`)}
              />
            ))}
          </View>
        )}
      </View>

      {!user ? (
        <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
          <Card style={{ gap: 12, alignItems: "center" }}>
            <Ionicons name="log-in-outline" size={36} color={c.primary} />
            <Text
              style={{
                color: c.foreground,
                fontFamily: "Inter_700Bold",
                fontSize: 16,
                textAlign: "center",
              }}
            >
              {t("login")}
            </Text>
            <Button
              label={t("login")}
              onPress={() => router.push("/(auth)/login")}
            />
            <Button
              label={t("register")}
              variant="ghost"
              onPress={() => router.push("/(auth)/register")}
            />
          </Card>
        </View>
      ) : null}
    </ScrollView>
  );
}

function StatTile({
  icon,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
}) {
  const c = useColors();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: c.surface,
        borderRadius: c.radius,
        padding: 14,
        alignItems: "center",
        borderWidth: 1,
        borderColor: c.border,
      }}
    >
      <Ionicons name={icon} size={18} color={c.primary} />
      <Text
        style={{
          color: c.foreground,
          fontFamily: "Inter_700Bold",
          fontSize: 18,
          marginTop: 4,
        }}
      >
        {value.toLocaleString()}
      </Text>
      <Text
        style={{
          color: c.mutedForeground,
          fontSize: 11,
          fontFamily: "Inter_500Medium",
        }}
      >
        {label}
      </Text>
    </View>
  );
}

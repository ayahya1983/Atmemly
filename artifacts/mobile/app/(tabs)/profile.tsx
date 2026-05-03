import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import {
  updateClientProfile,
  updateFreelancerProfile,
} from "@workspace/api-client-react";
import React, { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar, Button, Card } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { uploadFile } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

type Row = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
};

export default function ProfileScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useI18n();
  const { user, logout, refresh } = useAuth();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const onChangeAvatar = async () => {
    if (!user) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t("settings"), "Permission required to access photos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setUploadingAvatar(true);
    try {
      const uploaded = await uploadFile({
        uri: asset.uri,
        name: asset.fileName ?? `avatar-${Date.now()}.jpg`,
        mimeType: asset.mimeType ?? "image/jpeg",
        kind: "avatar",
      });
      if (user.role === "freelancer") {
        await updateFreelancerProfile({ avatarUrl: uploaded.url });
      } else if (user.role === "client") {
        await updateClientProfile({ avatarUrl: uploaded.url });
      }
      await refresh();
    } catch (e) {
      Alert.alert(t("error") ?? "Error", (e as Error).message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  if (!user) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: c.background,
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
        }}
      >
        <Ionicons name="person-circle-outline" size={64} color={c.mutedForeground} />
        <Text
          style={{
            color: c.foreground,
            fontFamily: "Inter_700Bold",
            fontSize: 18,
          }}
        >
          {t("appName")}
        </Text>
        <View style={{ width: "100%", gap: 10 }}>
          <Button label={t("login")} onPress={() => router.push("/(auth)/login")} />
          <Button
            label={t("register")}
            variant="ghost"
            onPress={() => router.push("/(auth)/register")}
          />
        </View>
        <Pressable onPress={() => router.push("/settings")} hitSlop={8}>
          <Text
            style={{
              color: c.primary,
              fontFamily: "Inter_500Medium",
              fontSize: 13,
              marginTop: 8,
            }}
          >
            {t("settings")}
          </Text>
        </Pressable>
      </View>
    );
  }

  const isFreelancer = user.role === "freelancer";
  const isClient = user.role === "client";

  const rows: Row[] = [
    ...(isClient
      ? ([
          {
            icon: "add-circle-outline",
            label: t("postJob"),
            onPress: () => router.push("/post-job"),
          },
          {
            icon: "briefcase-outline",
            label: t("myJobs"),
            onPress: () =>
              router.push({ pathname: "/(tabs)/jobs", params: { mine: "1" } }),
          },
        ] as Row[])
      : []),
    ...(isFreelancer
      ? ([
          {
            icon: "document-text-outline",
            label: t("myProposals"),
            onPress: () => router.push("/proposals"),
          },
        ] as Row[])
      : []),
    {
      icon: "card-outline",
      label: t("payments"),
      onPress: () => router.push("/payments"),
    },
    {
      icon: "notifications-outline",
      label: t("notifications"),
      onPress: () => router.push("/notifications"),
    },
    {
      icon: "settings-outline",
      label: t("settings"),
      onPress: () => router.push("/settings"),
    },
    {
      icon: "log-out-outline",
      label: t("logout"),
      onPress: async () => {
        await logout();
        router.replace("/(tabs)");
      },
      danger: true,
    },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingHorizontal: 20,
        paddingBottom: 24,
        gap: 16,
      }}
    >
      <Card>
        <View
          style={{
            flexDirection: isRTL ? "row-reverse" : "row",
            alignItems: "center",
            gap: 14,
          }}
        >
          <Pressable onPress={onChangeAvatar} disabled={uploadingAvatar}>
            <View>
              <Avatar name={user.fullName ?? user.name} size={56} />
              <View
                style={{
                  position: "absolute",
                  right: -2,
                  bottom: -2,
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: c.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 2,
                  borderColor: c.background,
                }}
              >
                {uploadingAvatar ? (
                  <ActivityIndicator size="small" color={c.primaryForeground} />
                ) : (
                  <Ionicons name="camera" size={12} color={c.primaryForeground} />
                )}
              </View>
            </View>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text
              numberOfLines={1}
              style={{
                color: c.foreground,
                fontFamily: "Inter_700Bold",
                fontSize: 17,
                textAlign: isRTL ? "right" : "left",
              }}
            >
              {user.fullName ?? user.name ?? user.email}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                color: c.mutedForeground,
                fontFamily: "Inter_400Regular",
                fontSize: 13,
                marginTop: 2,
                textAlign: isRTL ? "right" : "left",
              }}
            >
              {user.email}
            </Text>
            <View
              style={{
                marginTop: 6,
                alignSelf: isRTL ? "flex-end" : "flex-start",
                backgroundColor: c.accent,
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 999,
              }}
            >
              <Text
                style={{
                  color: c.accentForeground,
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 11,
                }}
              >
                {t(user.role)}
              </Text>
            </View>
          </View>
        </View>
      </Card>

      <View style={{ gap: 8 }}>
        {rows.map((r, i) => (
          <Pressable
            key={i}
            onPress={r.onPress}
            style={({ pressed }) => ({
              backgroundColor: c.card,
              borderWidth: 1,
              borderColor: c.border,
              borderRadius: c.radius,
              paddingHorizontal: 16,
              paddingVertical: 14,
              flexDirection: isRTL ? "row-reverse" : "row",
              alignItems: "center",
              gap: 12,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Ionicons
              name={r.icon}
              size={20}
              color={r.danger ? c.destructive : c.primary}
            />
            <Text
              style={{
                color: r.danger ? c.destructive : c.foreground,
                fontFamily: "Inter_500Medium",
                fontSize: 14,
                flex: 1,
                textAlign: isRTL ? "right" : "left",
              }}
            >
              {r.label}
            </Text>
            <Ionicons
              name={isRTL ? "chevron-back" : "chevron-forward"}
              size={18}
              color={c.mutedForeground}
            />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

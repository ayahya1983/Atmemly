import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Stack } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
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
import { ApiError, uploadFile } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import {
  useClient,
  useFreelancer,
  useUpdateClientProfile,
  useUpdateFreelancerProfile,
} from "@/lib/queries";

type PortfolioItem = { title: string; url: string; description: string };

export default function EditProfileScreen() {
  const c = useColors();
  const { t } = useI18n();
  const { user, refresh } = useAuth();

  if (!user) {
    return (
      <>
        <Stack.Screen options={{ title: t("editProfile") }} />
        <View style={{ flex: 1, backgroundColor: c.background }}>
          <ErrorState />
        </View>
      </>
    );
  }
  if (user.role === "freelancer") {
    return <FreelancerForm userId={user.id} onSaved={refresh} />;
  }
  if (user.role === "client") {
    return <ClientForm userId={user.id} onSaved={refresh} />;
  }
  return (
    <>
      <Stack.Screen options={{ title: t("editProfile") }} />
      <View style={{ flex: 1, backgroundColor: c.background }} />
    </>
  );
}

// ============ Freelancer ============

function FreelancerForm({
  userId,
  onSaved,
}: {
  userId: number;
  onSaved: () => Promise<void>;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useI18n();
  const detail = useFreelancer(userId);
  const update = useUpdateFreelancerProfile();

  const [fullName, setFullName] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [location, setLocation] = useState("");
  const [skillsInput, setSkillsInput] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!detail.data) return;
    const d = detail.data;
    setFullName(d.fullName ?? "");
    setHeadline(d.headline ?? "");
    setBio(d.bio ?? "");
    setHourlyRate(d.hourlyRate != null ? String(d.hourlyRate) : "");
    setLocation(d.location ?? "");
    setSkills(Array.isArray(d.skills) ? d.skills : []);
    setPortfolio(
      Array.isArray(d.portfolio)
        ? d.portfolio.map((p) => ({
            title: p.title ?? "",
            url: p.url ?? "",
            description: p.description ?? "",
          }))
        : [],
    );
    setCoverUrl(d.coverUrl ?? null);
  }, [detail.data]);

  const addSkill = () => {
    const v = skillsInput.trim();
    if (!v) return;
    if (!skills.includes(v)) setSkills([...skills, v]);
    setSkillsInput("");
  };

  const removeSkill = (s: string) => setSkills(skills.filter((x) => x !== s));

  const addPortfolioItem = () =>
    setPortfolio([...portfolio, { title: "", url: "", description: "" }]);

  const removePortfolioItem = (i: number) =>
    setPortfolio(portfolio.filter((_, idx) => idx !== i));

  const updatePortfolioItem = (
    i: number,
    field: keyof PortfolioItem,
    value: string,
  ) => {
    const next = [...portfolio];
    next[i] = { ...next[i], [field]: value };
    setPortfolio(next);
  };

  const onPickCover = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t("editProfile"), "Permission required to access photos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setCoverUploading(true);
    try {
      const uploaded = await uploadFile({
        uri: asset.uri,
        name: asset.fileName ?? `cover-${Date.now()}.jpg`,
        mimeType: asset.mimeType ?? "image/jpeg",
        kind: "freelancer_cover",
      });
      setCoverUrl(uploaded.url);
      await update.mutateAsync({ data: { coverUrl: uploaded.url } });
      void detail.refetch();
    } catch (e) {
      Alert.alert(t("error"), (e as Error).message);
    } finally {
      setCoverUploading(false);
    }
  };

  const onRemoveCover = async () => {
    setCoverUrl(null);
    try {
      await update.mutateAsync({ data: { coverUrl: null } });
      void detail.refetch();
    } catch (e) {
      Alert.alert(t("error"), (e as Error).message);
    }
  };

  const onSubmit = async () => {
    setError(null);
    setSuccess(null);
    if (fullName.trim().length < 2) {
      setError(t("required"));
      return;
    }
    const rate = Number(hourlyRate);
    if (!Number.isFinite(rate) || rate <= 0) {
      setError(t("required"));
      return;
    }
    try {
      await update.mutateAsync({
        data: {
          fullName: fullName.trim(),
          headline: headline.trim() || undefined,
          bio: bio.trim() || undefined,
          hourlyRate: rate,
          location: location.trim() || undefined,
          skills,
          portfolio: portfolio
            .filter((p) => p.title.trim() && p.url.trim())
            .map((p) => ({
              title: p.title.trim(),
              url: p.url.trim(),
              description: p.description.trim() || undefined,
            })),
        },
      });
      await onSaved();
      void detail.refetch();
      setSuccess(t("profileUpdated"));
      setTimeout(() => setSuccess(null), 2500);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    }
  };

  if (detail.isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: t("editProfile") }} />
        <View style={{ flex: 1, backgroundColor: c.background }}>
          <LoadingState />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t("editProfile") }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, backgroundColor: c.background }}
      >
        <ScrollView
          contentContainerStyle={{
            padding: 20,
            paddingBottom: insets.bottom + 32,
            gap: 16,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Cover */}
          <Card style={{ gap: 12 }}>
            <Text
              style={{
                color: c.foreground,
                fontFamily: "Inter_700Bold",
                fontSize: 15,
                textAlign: isRTL ? "right" : "left",
              }}
            >
              {t("serviceCover")}
            </Text>
            <View
              style={{
                aspectRatio: 4 / 3,
                width: "100%",
                borderRadius: c.radius,
                backgroundColor: c.surface,
                borderWidth: 1,
                borderColor: c.border,
                overflow: "hidden",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {coverUrl ? (
                <Image
                  source={{ uri: coverUrl }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                />
              ) : (
                <View style={{ alignItems: "center", gap: 6 }}>
                  <Ionicons
                    name="image-outline"
                    size={36}
                    color={c.mutedForeground}
                  />
                  <Text
                    style={{
                      color: c.mutedForeground,
                      fontSize: 12,
                      fontFamily: "Inter_400Regular",
                    }}
                  >
                    {t("noPortfolio")}
                  </Text>
                </View>
              )}
            </View>
            <View
              style={{
                flexDirection: isRTL ? "row-reverse" : "row",
                gap: 8,
              }}
            >
              <View style={{ flex: 1 }}>
                <Button
                  label={
                    coverUploading
                      ? t("uploading")
                      : coverUrl
                        ? t("replaceCover")
                        : t("uploadCover")
                  }
                  icon="cloud-upload-outline"
                  variant="ghost"
                  onPress={onPickCover}
                  loading={coverUploading}
                />
              </View>
              {coverUrl ? (
                <View style={{ flex: 1 }}>
                  <Button
                    label={t("removeCover")}
                    icon="trash-outline"
                    variant="ghost"
                    onPress={onRemoveCover}
                  />
                </View>
              ) : null}
            </View>
          </Card>

          {/* Basic info */}
          <Card style={{ gap: 14 }}>
            <Input
              label={t("fullName")}
              value={fullName}
              onChangeText={setFullName}
              icon="person-outline"
            />
            <Input
              label={t("headline")}
              value={headline}
              onChangeText={setHeadline}
              placeholder={t("headlineHint")}
              icon="pricetag-outline"
            />
            <Input
              label={t("hourlyRate")}
              value={hourlyRate}
              onChangeText={setHourlyRate}
              keyboardType="numeric"
              icon="cash-outline"
            />
            <Input
              label={t("location")}
              value={location}
              onChangeText={setLocation}
              icon="location-outline"
            />
            <Input
              label={t("bio")}
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={5}
              style={{ minHeight: 110, paddingVertical: 8 }}
            />
          </Card>

          {/* Skills */}
          <Card style={{ gap: 12 }}>
            <Text
              style={{
                color: c.foreground,
                fontFamily: "Inter_700Bold",
                fontSize: 15,
                textAlign: isRTL ? "right" : "left",
              }}
            >
              {t("skills")}
            </Text>
            <View
              style={{
                flexDirection: isRTL ? "row-reverse" : "row",
                gap: 8,
                alignItems: "flex-end",
              }}
            >
              <View style={{ flex: 1 }}>
                <Input
                  value={skillsInput}
                  onChangeText={setSkillsInput}
                  placeholder={t("skills")}
                  onSubmitEditing={addSkill}
                  returnKeyType="done"
                />
              </View>
              <Pressable
                onPress={addSkill}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: c.radius,
                  backgroundColor: c.primary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="add" size={22} color={c.primaryForeground} />
              </Pressable>
            </View>
            {skills.length > 0 ? (
              <View
                style={{
                  flexDirection: isRTL ? "row-reverse" : "row",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                {skills.map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => removeSkill(s)}
                    style={{
                      flexDirection: isRTL ? "row-reverse" : "row",
                      alignItems: "center",
                      backgroundColor: c.accent,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 999,
                      gap: 4,
                    }}
                  >
                    <Text
                      style={{
                        color: c.accentForeground,
                        fontFamily: "Inter_600SemiBold",
                        fontSize: 12,
                      }}
                    >
                      {s}
                    </Text>
                    <Ionicons
                      name="close"
                      size={14}
                      color={c.accentForeground}
                    />
                  </Pressable>
                ))}
              </View>
            ) : null}
          </Card>

          {/* Portfolio */}
          <Card style={{ gap: 12 }}>
            <View
              style={{
                flexDirection: isRTL ? "row-reverse" : "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{
                  color: c.foreground,
                  fontFamily: "Inter_700Bold",
                  fontSize: 15,
                }}
              >
                {t("portfolio")}
              </Text>
              <Pressable onPress={addPortfolioItem} hitSlop={8}>
                <View
                  style={{
                    flexDirection: isRTL ? "row-reverse" : "row",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Ionicons name="add-circle" size={20} color={c.primary} />
                  <Text
                    style={{
                      color: c.primary,
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 13,
                    }}
                  >
                    {t("addPortfolioItem")}
                  </Text>
                </View>
              </Pressable>
            </View>
            {portfolio.length === 0 ? (
              <View
                style={{
                  borderWidth: 1,
                  borderStyle: "dashed",
                  borderColor: c.border,
                  borderRadius: c.radius,
                  padding: 16,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: c.mutedForeground,
                    fontSize: 13,
                    fontFamily: "Inter_400Regular",
                  }}
                >
                  {t("noPortfolio")}
                </Text>
              </View>
            ) : (
              portfolio.map((item, i) => (
                <View
                  key={i}
                  style={{
                    borderWidth: 1,
                    borderColor: c.border,
                    borderRadius: c.radius,
                    padding: 12,
                    gap: 8,
                  }}
                >
                  <View
                    style={{
                      flexDirection: isRTL ? "row-reverse" : "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Badge label={`#${i + 1}`} />
                    <Pressable
                      onPress={() => removePortfolioItem(i)}
                      hitSlop={8}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color={c.destructive}
                      />
                    </Pressable>
                  </View>
                  <Input
                    placeholder={t("projectTitle")}
                    value={item.title}
                    onChangeText={(v) => updatePortfolioItem(i, "title", v)}
                  />
                  <Input
                    placeholder={t("projectUrl")}
                    value={item.url}
                    onChangeText={(v) => updatePortfolioItem(i, "url", v)}
                    autoCapitalize="none"
                    keyboardType="url"
                  />
                  <Input
                    placeholder={t("projectDescription")}
                    value={item.description}
                    onChangeText={(v) =>
                      updatePortfolioItem(i, "description", v)
                    }
                    multiline
                    numberOfLines={2}
                    style={{ minHeight: 60, paddingVertical: 8 }}
                  />
                </View>
              ))
            )}
          </Card>

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

          <Button
            label={t("save")}
            icon="checkmark"
            onPress={onSubmit}
            loading={update.isPending}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

// ============ Client ============

function ClientForm({
  userId,
  onSaved,
}: {
  userId: number;
  onSaved: () => Promise<void>;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useI18n();
  const detail = useClient(userId);
  const update = useUpdateClientProfile();

  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [overview, setOverview] = useState("");
  const [location, setLocation] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!detail.data) return;
    const d = detail.data;
    setFullName(d.fullName ?? "");
    setCompanyName(d.companyName ?? "");
    setOverview(d.overview ?? "");
    setLocation(d.location ?? "");
    setLogoUrl(d.logoUrl ?? null);
  }, [detail.data]);

  const onPickLogo = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t("editProfile"), "Permission required to access photos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setLogoUploading(true);
    try {
      const uploaded = await uploadFile({
        uri: asset.uri,
        name: asset.fileName ?? `logo-${Date.now()}.jpg`,
        mimeType: asset.mimeType ?? "image/jpeg",
        kind: "client_logo",
      });
      setLogoUrl(uploaded.url);
      await update.mutateAsync({ data: { logoUrl: uploaded.url } });
      void detail.refetch();
    } catch (e) {
      Alert.alert(t("error"), (e as Error).message);
    } finally {
      setLogoUploading(false);
    }
  };

  const onSubmit = async () => {
    setError(null);
    setSuccess(null);
    if (fullName.trim().length < 2 || companyName.trim().length < 2) {
      setError(t("required"));
      return;
    }
    try {
      await update.mutateAsync({
        data: {
          fullName: fullName.trim(),
          companyName: companyName.trim(),
          overview: overview.trim() || undefined,
          location: location.trim() || undefined,
        },
      });
      await onSaved();
      void detail.refetch();
      setSuccess(t("profileUpdated"));
      setTimeout(() => setSuccess(null), 2500);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t("editProfile") }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, backgroundColor: c.background }}
      >
        <ScrollView
          contentContainerStyle={{
            padding: 20,
            paddingBottom: insets.bottom + 32,
            gap: 16,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <Card style={{ gap: 12, alignItems: "center" }}>
            <Pressable onPress={onPickLogo} disabled={logoUploading}>
              <View
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: c.radius,
                  backgroundColor: c.surface,
                  borderWidth: 1,
                  borderColor: c.border,
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                {logoUrl ? (
                  <Image
                    source={{ uri: logoUrl }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="cover"
                  />
                ) : (
                  <Ionicons
                    name="business-outline"
                    size={36}
                    color={c.mutedForeground}
                  />
                )}
                <View
                  style={{
                    position: "absolute",
                    right: -2,
                    bottom: -2,
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: c.primary,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 2,
                    borderColor: c.background,
                  }}
                >
                  {logoUploading ? (
                    <ActivityIndicator
                      size="small"
                      color={c.primaryForeground}
                    />
                  ) : (
                    <Ionicons
                      name="camera"
                      size={14}
                      color={c.primaryForeground}
                    />
                  )}
                </View>
              </View>
            </Pressable>
          </Card>

          <Card style={{ gap: 14 }}>
            <Input
              label={t("fullName")}
              value={fullName}
              onChangeText={setFullName}
              icon="person-outline"
            />
            <Input
              label={t("companyName")}
              value={companyName}
              onChangeText={setCompanyName}
              icon="business-outline"
            />
            <Input
              label={t("location")}
              value={location}
              onChangeText={setLocation}
              icon="location-outline"
            />
            <Input
              label={t("overview")}
              value={overview}
              onChangeText={setOverview}
              multiline
              numberOfLines={5}
              style={{ minHeight: 110, paddingVertical: 8 }}
            />
          </Card>

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

          <Button
            label={t("save")}
            icon="checkmark"
            onPress={onSubmit}
            loading={update.isPending}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}


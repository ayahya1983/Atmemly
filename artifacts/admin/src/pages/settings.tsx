import { useEffect, useMemo, useState } from "react";
import { useAdminGet, useAdminMutation, adminApi, AdminApiError } from "@/lib/api-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/lib/permissions";
import { format } from "date-fns";
import { Loader2, Pencil, Save } from "lucide-react";
import { BRAND } from "@workspace/branding";
import {
  DataTable, type Column, PageHeader, FilterBar, FormDialog,
} from "@/components/admin";

interface SettingRow {
  key: string;
  value: unknown;
  isPublic: boolean;
  description: string | null;
  updatedAt: string;
}

/**
 * Well-known settings surfaced as structured editors. Anything not in
 * this list still appears under the "All settings" tab and uses the
 * raw JSON editor as a fallback.
 */
const STRUCTURED_KEYS = {
  brand: ["brand.name", "brand.name_ar", "brand.tagline", "brand.tagline_ar", "brand.logoUrl"],
  contact: ["contact.email", "contact.support_email", "contact.phone", "contact.address", "domain"],
  features: [
    "features.signupsEnabled",
    "features.escrowEnabled",
    "features.publicJobs",
    "features.kycRequired",
    "features.maintenanceMode",
  ],
} as const;

type StructuredGroup = keyof typeof STRUCTURED_KEYS;

const GROUP_LABELS: Record<StructuredGroup, { en: string; ar: string }> = {
  brand: { en: "Brand", ar: "الهوية" },
  contact: { en: "Contact & domain", ar: "التواصل والنطاق" },
  features: { en: "Feature flags", ar: "الميزات" },
};

function isBoolKey(k: string) {
  return k.startsWith("features.") || k.endsWith("Enabled") || k.endsWith("Required") || k.endsWith("Mode");
}
function asString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}
function asBool(v: unknown): boolean {
  return v === true || v === "true" || v === 1;
}

export default function AdminSettings() {
  const { lang } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const canWrite = hasPermission(user, "settings", "write");

  const queryKey = ["admin-settings"];
  const { data, isLoading } = useAdminGet<SettingRow[]>(queryKey, "/admin/settings");

  const [search, setSearch] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [editing, setEditing] = useState<SettingRow | null>(null);
  const [valueText, setValueText] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [description, setDescription] = useState("");

  const updateMutation = useAdminMutation<{ key: string; body: { value: unknown; isPublic?: boolean; description?: string } }>(
    ({ key, body }) => adminApi.put(`/admin/settings/${key}`, body), [queryKey],
  );

  const startEdit = (s: SettingRow) => {
    setEditing(s);
    setValueText(JSON.stringify(s.value, null, 2));
    setIsPublic(s.isPublic);
    setDescription(s.description ?? "");
  };

  const save = async () => {
    if (!editing) return;
    let parsed: unknown;
    try { parsed = JSON.parse(valueText); }
    catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ variant: "destructive", title: lang === "ar" ? "JSON غير صالح" : "Invalid JSON", description: msg });
      throw e;
    }
    await updateMutation.mutateAsync({
      key: editing.key,
      body: { value: parsed, isPublic, description },
    });
  };

  const filtered = (data ?? []).filter((s) =>
    visibilityFilter === "all" || (visibilityFilter === "public" ? s.isPublic : !s.isPublic),
  );

  const columns: Column<SettingRow>[] = [
    {
      key: "key",
      header: lang === "ar" ? "المفتاح" : "Key",
      cell: (s) => <span className="font-mono text-sm">{s.key}</span>,
      sortValue: (s) => s.key,
      searchValue: (s) => s.key,
    },
    {
      key: "value",
      header: lang === "ar" ? "القيمة" : "Value",
      cell: (s) => <code className="text-xs bg-muted px-1.5 py-0.5 rounded max-w-xs truncate inline-block">{JSON.stringify(s.value)}</code>,
      searchValue: (s) => JSON.stringify(s.value),
    },
    {
      key: "isPublic",
      header: lang === "ar" ? "عام" : "Public",
      cell: (s) => s.isPublic ? <Badge>Public</Badge> : <Badge variant="outline">Private</Badge>,
      sortValue: (s) => (s.isPublic ? 1 : 0),
    },
    {
      key: "description",
      header: lang === "ar" ? "الوصف" : "Description",
      cell: (s) => <span className="text-sm text-muted-foreground max-w-xs truncate inline-block">{s.description ?? "—"}</span>,
      searchValue: (s) => s.description ?? "",
    },
    {
      key: "updatedAt",
      header: lang === "ar" ? "محدّث" : "Updated",
      cell: (s) => <span className="text-xs text-muted-foreground">{format(new Date(s.updatedAt), "yyyy-MM-dd HH:mm")}</span>,
      sortValue: (s) => new Date(s.updatedAt).getTime(),
    },
    {
      key: "actions",
      header: "",
      align: "end",
      cell: (s) => canWrite ? (
        <Button size="sm" variant="outline" onClick={() => startEdit(s)} data-testid={`button-edit-${s.key}`}>
          <Pencil className="w-3 h-3" />
        </Button>
      ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title={lang === "ar" ? "إعدادات المنصة" : "Platform Settings"}
        description={lang === "ar"
          ? `يتحكم في سلوك ${BRAND.name} (${BRAND.domain}).`
          : `Controls runtime behavior of ${BRAND.name} (${BRAND.domain}).`}
      />

      <Tabs defaultValue="structured">
        <TabsList>
          <TabsTrigger value="structured" data-testid="tab-settings-structured">
            {lang === "ar" ? "الإعدادات الشائعة" : "Common settings"}
          </TabsTrigger>
          <TabsTrigger value="all" data-testid="tab-settings-all">
            {lang === "ar" ? "كل الإعدادات (متقدم)" : "All settings (advanced)"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="structured" className="space-y-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
              <Loader2 className="w-4 h-4 animate-spin" />
              {lang === "ar" ? "جاري التحميل..." : "Loading…"}
            </div>
          ) : (
            (Object.keys(STRUCTURED_KEYS) as StructuredGroup[]).map((group) => (
              <StructuredCard
                key={group}
                group={group}
                rows={data ?? []}
                canWrite={canWrite}
                lang={lang}
                onSave={async (key, value, isPublicFlag, descriptionText) => {
                  await updateMutation.mutateAsync({
                    key,
                    body: {
                      value,
                      ...(isPublicFlag !== undefined ? { isPublic: isPublicFlag } : {}),
                      ...(descriptionText !== undefined ? { description: descriptionText } : {}),
                    },
                  });
                }}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder={lang === "ar" ? "بحث بالمفتاح أو القيمة" : "Search key or value"}
            onReset={() => { setSearch(""); setVisibilityFilter("all"); }}
          >
            <select value={visibilityFilter} onChange={(e) => setVisibilityFilter(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
              <option value="all">{lang === "ar" ? "الكل" : "All visibility"}</option>
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          </FilterBar>
          <DataTable
            data={filtered}
            columns={columns}
            rowKey={(s) => s.key}
            isLoading={isLoading}
            search={search}
            emptyTitle={lang === "ar" ? "لا إعدادات" : "No settings"}
            csvFilename="settings.csv"
          />
        </TabsContent>
      </Tabs>

      <FormDialog
        open={!!editing}
        onOpenChange={(o) => { if (!o) setEditing(null); }}
        title={`${lang === "ar" ? "تعديل" : "Edit"}: ${editing?.key ?? ""}`}
        successMessage={lang === "ar" ? "تم الحفظ" : "Saved"}
        onSubmit={save}
      >
        <div>
          <Label>{lang === "ar" ? "القيمة (JSON)" : "Value (JSON)"}</Label>
          <Textarea value={valueText} onChange={(e) => setValueText(e.target.value)} rows={6} className="font-mono text-sm" />
        </div>
        <div>
          <Label>{lang === "ar" ? "الوصف" : "Description"}</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={isPublic} onCheckedChange={setIsPublic} id="pub" />
          <Label htmlFor="pub">{lang === "ar" ? "متاح للعامة (API: /settings/public)" : "Public (exposed via /settings/public)"}</Label>
        </div>
      </FormDialog>
    </div>
  );
}

interface StructuredCardProps {
  group: StructuredGroup;
  rows: SettingRow[];
  canWrite: boolean;
  lang: "en" | "ar";
  onSave: (key: string, value: unknown, isPublic?: boolean, description?: string) => Promise<void>;
}

function StructuredCard({ group, rows, canWrite, lang, onSave }: StructuredCardProps) {
  const keys = STRUCTURED_KEYS[group];
  const byKey = useMemo(() => {
    const m = new Map<string, SettingRow>();
    rows.forEach((r) => m.set(r.key, r));
    return m;
  }, [rows]);

  const initial = useMemo(() => {
    const o: Record<string, unknown> = {};
    keys.forEach((k) => { o[k] = byKey.get(k)?.value ?? (isBoolKey(k) ? false : ""); });
    return o;
  }, [byKey, keys]);

  const [draft, setDraft] = useState<Record<string, unknown>>(initial);
  const [pending, setPending] = useState<string | null>(null);
  const { toast } = useToast();

  // Keep draft in sync if remote data changes (e.g. another tab saved).
  useEffect(() => { setDraft(initial); }, [initial]);

  const dirty = (k: string) => JSON.stringify(draft[k]) !== JSON.stringify(initial[k]);

  const saveOne = async (k: string) => {
    setPending(k);
    try {
      await onSave(k, draft[k]);
      toast({ title: lang === "ar" ? "تم الحفظ" : "Saved" });
    } catch (e) {
      const isLimited = e instanceof AdminApiError && e.status === 429;
      const seconds = isLimited ? (e as AdminApiError).retryAfterSeconds ?? 30 : null;
      toast({
        variant: "destructive",
        title: isLimited
          ? (lang === "ar" ? "محاولات كثيرة" : "Rate limited")
          : (lang === "ar" ? "فشل الحفظ" : "Save failed"),
        description: isLimited && seconds !== null
          ? (lang === "ar" ? `أعد بعد ${seconds} ثانية` : `Retry in ${seconds}s`)
          : (e instanceof Error ? e.message : String(e)),
      });
    } finally {
      setPending(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{GROUP_LABELS[group][lang]}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {keys.map((k) => {
          const row = byKey.get(k);
          if (isBoolKey(k)) {
            return (
              <div key={k} className="flex items-center justify-between gap-3">
                <div>
                  <Label className="font-mono text-xs">{k}</Label>
                  {row?.description && (
                    <div className="text-xs text-muted-foreground">{row.description}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={asBool(draft[k])}
                    onCheckedChange={(c) => setDraft({ ...draft, [k]: c })}
                    disabled={!canWrite}
                    id={`switch-${k}`}
                    data-testid={`switch-${k}`}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => saveOne(k)}
                    disabled={!canWrite || !dirty(k) || pending === k}
                    data-testid={`button-save-${k}`}
                  >
                    {pending === k
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <Save className="w-3 h-3" />}
                  </Button>
                </div>
              </div>
            );
          }
          return (
            <div key={k} className="space-y-1">
              <Label className="font-mono text-xs">{k}</Label>
              <div className="flex gap-2">
                <Input
                  value={asString(draft[k])}
                  onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
                  disabled={!canWrite}
                  data-testid={`input-${k}`}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => saveOne(k)}
                  disabled={!canWrite || !dirty(k) || pending === k}
                  data-testid={`button-save-${k}`}
                >
                  {pending === k
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Save className="w-3 h-3" />}
                </Button>
              </div>
              {row?.description && (
                <div className="text-xs text-muted-foreground">{row.description}</div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

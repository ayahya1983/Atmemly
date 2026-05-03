// Admin: localization strings (i18n) editor.
import { useEffect, useState } from "react";
import { useAdminGet, useAdminMutation, adminApi } from "@/lib/api-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/lib/permissions";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { DataTable, type Column, PageHeader, FilterBar, FormDialog } from "@/components/admin";

interface LocSettings {
  id: number;
  defaultLocale: string;
  enabledLocales: string[];
  rtlLocales: string[];
  fallbackLocale: string;
  isRtlByDefault: boolean;
}

function LocalizationSettingsCard() {
  const { lang } = useTranslation();
  const { user } = useAuth();
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const canWrite = hasPermission(user, "localization", "write");
  const settingsKey = ["admin-localization-settings"];
  const { data } = useAdminGet<LocSettings>(settingsKey, "/localization/settings");
  const save = useAdminMutation<LocSettings>(
    (input) => adminApi.put("/admin/localization/settings", input),
    [settingsKey, ["public-localization-settings"]],
  );
  const [form, setForm] = useState<LocSettings | null>(null);
  useEffect(() => { if (data && !form) setForm(data); }, [data, form]);
  if (!form) return null;
  const toggleInList = (list: string[], v: string) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3" data-testid="localization-settings-card">
      <div className="font-semibold">{t("إعدادات اللغة الافتراضية و RTL", "Default language & RTL settings")}</div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>{t("اللغة الافتراضية", "Default locale")}</Label>
          <Select value={form.defaultLocale} onValueChange={(v) => setForm({ ...form, defaultLocale: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {form.enabledLocales.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{t("لغة بديلة عند النقص", "Fallback locale")}</Label>
          <Select value={form.fallbackLocale} onValueChange={(v) => setForm({ ...form, fallbackLocale: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {form.enabledLocales.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>{t("اللغات المفعّلة", "Enabled locales")}</Label>
        <div className="flex gap-3 mt-1">
          {["ar", "en"].map((l) => (
            <label key={l} className="flex items-center gap-1 text-sm">
              <input type="checkbox" checked={form.enabledLocales.includes(l)}
                onChange={() => setForm({ ...form, enabledLocales: toggleInList(form.enabledLocales, l) })} />
              {l}
            </label>
          ))}
        </div>
      </div>
      <div>
        <Label>{t("لغات RTL (من اليمين لليسار)", "RTL locales")}</Label>
        <div className="flex gap-3 mt-1">
          {["ar", "en"].map((l) => (
            <label key={l} className="flex items-center gap-1 text-sm">
              <input type="checkbox" checked={form.rtlLocales.includes(l)}
                onChange={() => setForm({ ...form, rtlLocales: toggleInList(form.rtlLocales, l) })} />
              {l}
            </label>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Switch id="rtl-default" checked={form.isRtlByDefault}
          onCheckedChange={(c) => setForm({ ...form, isRtlByDefault: c })} />
        <Label htmlFor="rtl-default">{t("RTL افتراضياً", "RTL by default")}</Label>
      </div>
      {canWrite && (
        <Button onClick={() => save.mutateAsync(form)} data-testid="button-save-localization-settings">
          {t("حفظ الإعدادات", "Save settings")}
        </Button>
      )}
    </div>
  );
}

interface Row {
  id: number;
  key: string;
  locale: "ar" | "en";
  namespace: string;
  value: string;
  isMissing: boolean;
  updatedAt: string;
}
interface Form { key: string; locale: "ar" | "en"; namespace: string; value: string; isMissing: boolean }
const empty: Form = { key: "", locale: "ar", namespace: "common", value: "", isMissing: false };

export default function AdminCmsLocalization() {
  const { lang } = useTranslation();
  const { user } = useAuth();
  const canWrite = hasPermission(user, "localization", "write");
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);

  const [missingOnly, setMissingOnly] = useState(false);
  const queryKey = ["admin-localization", missingOnly];
  const { data, isLoading } = useAdminGet<Row[]>(queryKey, `/admin/localization${missingOnly ? "?missing=1" : ""}`);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [search, setSearch] = useState("");
  const [nsFilter, setNsFilter] = useState("all");

  const upsert = useAdminMutation<Form>(
    (input) => adminApi.put("/admin/localization", input),
    [queryKey, ["public-localization"]],
  );
  const del = useAdminMutation<number>((id) => adminApi.del(`/admin/localization/${id}`), [queryKey]);

  const startEdit = (r?: Row) => {
    if (r) { setEditing(r); setForm({ key: r.key, locale: r.locale, namespace: r.namespace, value: r.value, isMissing: r.isMissing }); }
    else { setEditing(null); setForm(empty); }
    setOpen(true);
  };
  const onDelete = async (id: number) => {
    if (!confirm(t("حذف هذه السلسلة؟", "Delete this string?"))) return;
    await del.mutateAsync(id);
  };

  const namespaces = Array.from(new Set((data ?? []).map((r) => r.namespace))).sort();
  const filtered = (data ?? []).filter((r) => {
    if (nsFilter !== "all" && r.namespace !== nsFilter) return false;
    if (search && !`${r.key} ${r.value}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const columns: Column<Row>[] = [
    { key: "namespace", header: t("النطاق", "Namespace"), cell: (r) => <code className="text-xs">{r.namespace}</code>, sortValue: (r) => r.namespace, searchValue: (r) => r.namespace },
    { key: "key", header: t("المفتاح", "Key"), cell: (r) => <code className="text-xs">{r.key}</code>, sortValue: (r) => r.key, searchValue: (r) => r.key },
    { key: "locale", header: t("اللغة", "Locale"), cell: (r) => <Badge variant="outline">{r.locale}</Badge>, sortValue: (r) => r.locale },
    { key: "value", header: t("القيمة", "Value"), cell: (r) => <span className="text-sm" dir={r.locale === "ar" ? "rtl" : "ltr"}>{r.isMissing ? <span className="text-muted-foreground italic">— {t("مفقود", "missing")} —</span> : r.value}</span>, searchValue: (r) => r.value },
    { key: "actions", header: "", cell: (r) => (
      <div className="flex gap-2 justify-end">
        {canWrite && <Button size="sm" variant="ghost" onClick={() => startEdit(r)}><Pencil className="w-4 h-4" /></Button>}
        {canWrite && <Button size="sm" variant="ghost" onClick={() => onDelete(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>}
      </div>
    ) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("الترجمات", "Localization")} description={t("سلاسل الواجهة بالعربية والإنجليزية", "UI strings in Arabic & English")}
        actions={canWrite ? <Button onClick={() => startEdit()} data-testid="button-add-localization"><Plus className="w-4 h-4" /><span className="mx-2">{t("إضافة", "Add")}</span></Button> : null}
      />
      <LocalizationSettingsCard />
      <FilterBar>
        <Input placeholder={t("بحث", "Search")} value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
        <Select value={nsFilter} onValueChange={setNsFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("كل النطاقات", "All namespaces")}</SelectItem>
            {namespaces.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={missingOnly} onChange={(e) => setMissingOnly(e.target.checked)} />
          {t("المفقودة فقط", "Missing only")}
        </label>
      </FilterBar>
      <DataTable data={filtered} columns={columns} isLoading={isLoading} rowKey={(r) => r.id}  />

      <FormDialog open={open} onOpenChange={setOpen}
        title={editing ? t("تعديل ترجمة", "Edit string") : t("ترجمة جديدة", "New string")}
        onSubmit={async () => { await upsert.mutateAsync(form); }}
      >
        <div className="grid gap-3">
          <div><Label>{t("النطاق", "Namespace")}</Label><Input value={form.namespace} onChange={(e) => setForm({ ...form, namespace: e.target.value })} placeholder="common" /></div>
          <div><Label>{t("المفتاح", "Key")}</Label><Input value={form.key} disabled={!!editing} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="hero.title" data-testid="input-loc-key" /></div>
          <div><Label>{t("اللغة", "Locale")}</Label>
            <Select value={form.locale} onValueChange={(v) => setForm({ ...form, locale: v as "ar" | "en" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="ar">ar</SelectItem><SelectItem value="en">en</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label>{t("القيمة", "Value")}</Label>
            <Textarea rows={3} dir={form.locale === "ar" ? "rtl" : "ltr"} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value, isMissing: false })} data-testid="input-loc-value" />
          </div>
        </div>
      </FormDialog>
    </div>
  );
}

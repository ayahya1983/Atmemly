// Admin: global SEO settings (super_admin / admin only).
import { useEffect, useState } from "react";
import { useAdminGet, useAdminMutation, adminApi } from "@/lib/api-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/lib/permissions";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, ImageUploadField } from "@/components/admin";
import { Loader2, Save } from "lucide-react";

interface Seo {
  id?: number;
  siteTitleAr: string; siteTitleEn: string;
  siteDescriptionAr: string; siteDescriptionEn: string;
  ogImageUrl: string | null;
  twitterHandle: string | null;
  defaultLocale: "ar" | "en";
}
const empty: Seo = { siteTitleAr: "", siteTitleEn: "", siteDescriptionAr: "", siteDescriptionEn: "", ogImageUrl: null, twitterHandle: null, defaultLocale: "ar" };

export default function AdminCmsSeo() {
  const { lang } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const canWrite = hasPermission(user, "seo", "write") && hasPermission(user, "settings", "write");
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);

  const queryKey = ["admin-seo"];
  const { data, isLoading } = useAdminGet<Seo | null>(queryKey, "/admin/seo");
  const [form, setForm] = useState<Seo>(empty);

  useEffect(() => { if (data) setForm({ ...empty, ...data }); }, [data]);

  const save = useAdminMutation<Seo>(
    (input) => adminApi.put("/admin/seo", input),
    [queryKey, ["public-seo"]],
  );

  const onSave = async () => {
    try {
      await save.mutateAsync(form);
      toast({ title: t("تم الحفظ", "Saved") });
    } catch (e) {
      toast({ variant: "destructive", title: t("فشل الحفظ", "Save failed"), description: e instanceof Error ? e.message : String(e) });
    }
  };

  if (isLoading) return <div className="flex items-center justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <PageHeader title={t("تحسين محركات البحث", "Global SEO")}
        description={t("إعدادات SEO على مستوى الموقع", "Site-wide SEO defaults")}
        actions={canWrite ? <Button onClick={onSave} disabled={save.isPending} data-testid="button-save-seo">
          {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span className="mx-2">{t("حفظ", "Save")}</span>
        </Button> : null}
      />
      <section className="rounded-lg border bg-card p-6 grid gap-4 md:grid-cols-2">
        <div><Label>{t("عنوان الموقع (عربي)", "Site title (Arabic)")}</Label>
          <Input dir="rtl" value={form.siteTitleAr} disabled={!canWrite} onChange={(e) => setForm({ ...form, siteTitleAr: e.target.value })} data-testid="input-seo-title-ar" /></div>
        <div><Label>{t("عنوان الموقع (إنجليزي)", "Site title (English)")}</Label>
          <Input value={form.siteTitleEn} disabled={!canWrite} onChange={(e) => setForm({ ...form, siteTitleEn: e.target.value })} data-testid="input-seo-title-en" /></div>
        <div><Label>{t("الوصف (عربي)", "Description (Arabic)")}</Label>
          <Textarea dir="rtl" rows={3} value={form.siteDescriptionAr} disabled={!canWrite} onChange={(e) => setForm({ ...form, siteDescriptionAr: e.target.value })} /></div>
        <div><Label>{t("الوصف (إنجليزي)", "Description (English)")}</Label>
          <Textarea rows={3} value={form.siteDescriptionEn} disabled={!canWrite} onChange={(e) => setForm({ ...form, siteDescriptionEn: e.target.value })} /></div>
        <div className="md:col-span-2"><Label>{t("صورة OG", "Open Graph image")}</Label>
          <ImageUploadField value={form.ogImageUrl ?? ""} onChange={(u) => setForm({ ...form, ogImageUrl: u || null })} kind="cms" disabled={!canWrite} /></div>
        <div><Label>{t("معرف تويتر", "Twitter handle")}</Label>
          <Input value={form.twitterHandle ?? ""} disabled={!canWrite} placeholder="@atmemly" onChange={(e) => setForm({ ...form, twitterHandle: e.target.value || null })} /></div>
        <div><Label>{t("اللغة الافتراضية", "Default locale")}</Label>
          <Select value={form.defaultLocale} onValueChange={(v) => setForm({ ...form, defaultLocale: v as "ar" | "en" })} disabled={!canWrite}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="ar">ar</SelectItem><SelectItem value="en">en</SelectItem></SelectContent>
          </Select>
        </div>
      </section>
    </div>
  );
}

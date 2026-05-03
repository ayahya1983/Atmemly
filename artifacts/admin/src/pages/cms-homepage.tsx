// Admin CMS: homepage hero & section toggles.
import { useEffect, useState } from "react";
import { useAdminGet, useAdminMutation, adminApi } from "@/lib/api-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/lib/permissions";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, ImageUploadField } from "@/components/admin";
import { Loader2, Save, ArrowUp, ArrowDown } from "lucide-react";

interface HomepageHero {
  titleAr: string; titleEn: string;
  subtitleAr: string; subtitleEn: string;
  searchPlaceholderAr: string; searchPlaceholderEn: string;
  imageUrl: string;
  ctaPrimaryLabelAr: string; ctaPrimaryLabelEn: string; ctaPrimaryHref: string;
  ctaSecondaryLabelAr: string; ctaSecondaryLabelEn: string; ctaSecondaryHref: string;
}
interface HomepageSection {
  key: string;
  titleAr: string; titleEn: string;
  subtitleAr: string; subtitleEn: string;
  isVisible: boolean;
  sortOrder: number;
}
interface HomepageData { hero: HomepageHero; sections: HomepageSection[]; }

const DEFAULT_SECTIONS = [
  { key: "categories", labelAr: "الفئات", labelEn: "Categories" },
  { key: "featured_services", labelAr: "الخدمات المميزة", labelEn: "Featured services" },
  { key: "featured_freelancers", labelAr: "المستقلون المميزون", labelEn: "Featured freelancers" },
  { key: "featured_jobs", labelAr: "الوظائف المميزة", labelEn: "Featured jobs" },
  { key: "how_it_works", labelAr: "كيف يعمل", labelEn: "How it works" },
  { key: "testimonials", labelAr: "آراء العملاء", labelEn: "Testimonials" },
  { key: "blog", labelAr: "المدونة", labelEn: "Blog" },
  { key: "faq", labelAr: "الأسئلة الشائعة", labelEn: "FAQ" },
  { key: "mobile_app", labelAr: "تطبيق الجوال", labelEn: "Mobile app" },
  { key: "cta", labelAr: "نداء العمل", labelEn: "Call to action" },
  { key: "footer_cta", labelAr: "نداء التذييل", labelEn: "Footer CTA" },
];

export default function AdminCmsHomepage() {
  const { lang } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const canWrite = hasPermission(user, "cms", "write");
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);

  const queryKey = ["admin-cms-homepage"];
  const { data, isLoading } = useAdminGet<HomepageData>(queryKey, "/admin/cms/homepage");
  const [form, setForm] = useState<HomepageData | null>(null);

  useEffect(() => {
    if (!data) return;
    // Hydrate sections to ensure all defaults appear in the editor.
    const existing = new Map(data.sections.map((s) => [s.key, s]));
    const sections: HomepageSection[] = DEFAULT_SECTIONS.map((d, i) => {
      const cur = existing.get(d.key);
      return cur ?? {
        key: d.key,
        titleAr: d.labelAr, titleEn: d.labelEn,
        subtitleAr: "", subtitleEn: "",
        isVisible: true, sortOrder: i,
      };
    });
    setForm({ hero: data.hero, sections });
  }, [data]);

  const save = useAdminMutation<HomepageData>(
    (input) => adminApi.put("/admin/cms/homepage", input),
    [queryKey, ["public-cms-homepage"]],
  );

  if (isLoading || !form) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  const updateHero = (k: keyof HomepageHero, v: string) =>
    setForm((f) => (f ? { ...f, hero: { ...f.hero, [k]: v } } : f));
  const updateSection = (i: number, patch: Partial<HomepageSection>) =>
    setForm((f) => {
      if (!f) return f;
      const sections = f.sections.slice();
      sections[i] = { ...sections[i]!, ...patch };
      return { ...f, sections };
    });
  const moveSection = (i: number, dir: -1 | 1) =>
    setForm((f) => {
      if (!f) return f;
      const j = i + dir;
      if (j < 0 || j >= f.sections.length) return f;
      const sections = f.sections.slice();
      [sections[i], sections[j]] = [sections[j]!, sections[i]!];
      return { ...f, sections: sections.map((s, idx) => ({ ...s, sortOrder: idx })) };
    });

  const onSave = async () => {
    if (!form) return;
    try {
      await save.mutateAsync(form);
      toast({ title: t("تم الحفظ", "Saved") });
    } catch (e) {
      toast({ variant: "destructive", title: t("فشل الحفظ", "Save failed"), description: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("الصفحة الرئيسية", "Homepage")}
        description={t("تحرير محتوى الصفحة الرئيسية للسوق", "Edit marketplace homepage content")}
        actions={
          canWrite ? (
            <Button onClick={onSave} disabled={save.isPending} data-testid="button-save-homepage">
              {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span className="mx-2">{t("حفظ", "Save")}</span>
            </Button>
          ) : null
        }
      />

      <section className="rounded-lg border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold">{t("القسم البطل", "Hero")}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div><Label>{t("العنوان (عربي)", "Title (Arabic)")}</Label>
            <Input dir="rtl" value={form.hero.titleAr} disabled={!canWrite} onChange={(e) => updateHero("titleAr", e.target.value)} data-testid="input-hero-title-ar" /></div>
          <div><Label>{t("العنوان (إنجليزي)", "Title (English)")}</Label>
            <Input value={form.hero.titleEn} disabled={!canWrite} onChange={(e) => updateHero("titleEn", e.target.value)} data-testid="input-hero-title-en" /></div>
          <div><Label>{t("العنوان الفرعي (عربي)", "Subtitle (Arabic)")}</Label>
            <Textarea dir="rtl" rows={3} value={form.hero.subtitleAr} disabled={!canWrite} onChange={(e) => updateHero("subtitleAr", e.target.value)} /></div>
          <div><Label>{t("العنوان الفرعي (إنجليزي)", "Subtitle (English)")}</Label>
            <Textarea rows={3} value={form.hero.subtitleEn} disabled={!canWrite} onChange={(e) => updateHero("subtitleEn", e.target.value)} /></div>
          <div><Label>{t("نص البحث (عربي)", "Search placeholder (Arabic)")}</Label>
            <Input dir="rtl" value={form.hero.searchPlaceholderAr} disabled={!canWrite} onChange={(e) => updateHero("searchPlaceholderAr", e.target.value)} /></div>
          <div><Label>{t("نص البحث (إنجليزي)", "Search placeholder (English)")}</Label>
            <Input value={form.hero.searchPlaceholderEn} disabled={!canWrite} onChange={(e) => updateHero("searchPlaceholderEn", e.target.value)} /></div>
        </div>
        <div>
          <Label>{t("صورة الخلفية", "Background image")}</Label>
          <ImageUploadField value={form.hero.imageUrl} onChange={(u) => updateHero("imageUrl", u)} kind="cms" disabled={!canWrite} />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div><Label>{t("زر رئيسي - نص (عربي)", "Primary CTA label (Arabic)")}</Label>
            <Input dir="rtl" value={form.hero.ctaPrimaryLabelAr} disabled={!canWrite} onChange={(e) => updateHero("ctaPrimaryLabelAr", e.target.value)} /></div>
          <div><Label>{t("زر رئيسي - نص (إنجليزي)", "Primary CTA label (English)")}</Label>
            <Input value={form.hero.ctaPrimaryLabelEn} disabled={!canWrite} onChange={(e) => updateHero("ctaPrimaryLabelEn", e.target.value)} /></div>
          <div><Label>{t("زر رئيسي - رابط", "Primary CTA href")}</Label>
            <Input value={form.hero.ctaPrimaryHref} disabled={!canWrite} onChange={(e) => updateHero("ctaPrimaryHref", e.target.value)} placeholder="/post-job" /></div>
          <div><Label>{t("زر ثانوي - نص (عربي)", "Secondary CTA label (Arabic)")}</Label>
            <Input dir="rtl" value={form.hero.ctaSecondaryLabelAr} disabled={!canWrite} onChange={(e) => updateHero("ctaSecondaryLabelAr", e.target.value)} /></div>
          <div><Label>{t("زر ثانوي - نص (إنجليزي)", "Secondary CTA label (English)")}</Label>
            <Input value={form.hero.ctaSecondaryLabelEn} disabled={!canWrite} onChange={(e) => updateHero("ctaSecondaryLabelEn", e.target.value)} /></div>
          <div><Label>{t("زر ثانوي - رابط", "Secondary CTA href")}</Label>
            <Input value={form.hero.ctaSecondaryHref} disabled={!canWrite} onChange={(e) => updateHero("ctaSecondaryHref", e.target.value)} placeholder="/freelancers" /></div>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold">{t("الأقسام", "Sections")}</h2>
        <div className="space-y-3">
          {form.sections.map((s, i) => (
            <div key={s.key} className="flex items-start gap-4 p-4 border rounded-md">
              <div className="flex-1 grid gap-3 md:grid-cols-2">
                <div className="md:col-span-2 flex items-center gap-3">
                  <code className="text-xs bg-muted px-2 py-1 rounded">{s.key}</code>
                  <span className="text-xs text-muted-foreground">#{i + 1}</span>
                  <div className="ms-auto flex items-center gap-1">
                    <Button type="button" size="icon" variant="ghost" disabled={!canWrite || i === 0}
                      onClick={() => moveSection(i, -1)} data-testid={`button-up-section-${s.key}`} title={t("أعلى", "Up")}>
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" disabled={!canWrite || i === form.sections.length - 1}
                      onClick={() => moveSection(i, 1)} data-testid={`button-down-section-${s.key}`} title={t("أسفل", "Down")}>
                      <ArrowDown className="w-4 h-4" />
                    </Button>
                    <Label htmlFor={`vis-${s.key}`} className="text-sm ms-3">{t("ظاهر", "Visible")}</Label>
                    <Switch id={`vis-${s.key}`} checked={s.isVisible} disabled={!canWrite}
                      onCheckedChange={(v) => updateSection(i, { isVisible: v })}
                      data-testid={`switch-section-${s.key}`} />
                  </div>
                </div>
                <Input dir="rtl" placeholder={t("العنوان (عربي)", "Title (Arabic)")} value={s.titleAr} disabled={!canWrite} onChange={(e) => updateSection(i, { titleAr: e.target.value })} />
                <Input placeholder={t("العنوان (إنجليزي)", "Title (English)")} value={s.titleEn} disabled={!canWrite} onChange={(e) => updateSection(i, { titleEn: e.target.value })} />
                <Input dir="rtl" placeholder={t("الوصف (عربي)", "Subtitle (Arabic)")} value={s.subtitleAr} disabled={!canWrite} onChange={(e) => updateSection(i, { subtitleAr: e.target.value })} />
                <Input placeholder={t("الوصف (إنجليزي)", "Subtitle (English)")} value={s.subtitleEn} disabled={!canWrite} onChange={(e) => updateSection(i, { subtitleEn: e.target.value })} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

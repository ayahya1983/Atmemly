import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useAdminGet, useAdminMutation, adminApi } from "@/lib/api-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/lib/permissions";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ExternalLink, Loader2, Save, Trash2 } from "lucide-react";
import {
  PageHeader, ImageUploadField, ConfirmActionDialog,
} from "@/components/admin";

type Status = "draft" | "published" | "archived";

interface BlogRow {
  id: number; slug: string; locale: string; title: string;
  excerpt: string | null; body: string; coverUrl: string | null;
  category: string | null; categoryId: number | null;
  tags: string[] | null;
  isPublished: boolean; isFeatured: boolean; status: Status;
  seoTitle: string | null; seoDescription: string | null;
  publishedAt: string | null; updatedAt: string;
}
interface BlogCategory { id: number; slug: string; nameEn: string; nameAr: string; isActive: boolean }

interface Form {
  slug: string; locale: "ar" | "en"; title: string; excerpt: string; body: string;
  coverUrl: string; categoryId: number | null; tags: string;
  status: Status; isFeatured: boolean;
  seoTitle: string; seoDescription: string;
  publishedAt: string;
}

const empty: Form = {
  slug: "", locale: "ar", title: "", excerpt: "", body: "",
  coverUrl: "", categoryId: null, tags: "",
  status: "draft", isFeatured: false,
  seoTitle: "", seoDescription: "",
  publishedAt: "",
};

function fromRow(row: BlogRow): Form {
  return {
    slug: row.slug,
    locale: (row.locale as "ar" | "en") ?? "ar",
    title: row.title,
    excerpt: row.excerpt ?? "",
    body: row.body ?? "",
    coverUrl: row.coverUrl ?? "",
    categoryId: row.categoryId,
    tags: (row.tags ?? []).join(", "),
    status: row.status ?? (row.isPublished ? "published" : "draft"),
    isFeatured: !!row.isFeatured,
    seoTitle: row.seoTitle ?? "",
    seoDescription: row.seoDescription ?? "",
    publishedAt: row.publishedAt ? new Date(row.publishedAt).toISOString().slice(0, 16) : "",
  };
}

function toBody(f: Form) {
  let publishedAt: string | null | undefined;
  if (f.publishedAt) {
    const d = new Date(f.publishedAt);
    publishedAt = Number.isFinite(d.getTime()) ? d.toISOString() : undefined;
  } else {
    publishedAt = null;
  }
  return {
    slug: f.slug.trim(),
    locale: f.locale,
    title: f.title,
    excerpt: f.excerpt,
    body: f.body,
    coverUrl: f.coverUrl ? f.coverUrl : null,
    categoryId: f.categoryId,
    category: null,
    tags: f.tags ? f.tags.split(",").map((s) => s.trim()).filter(Boolean) : [],
    seoTitle: f.seoTitle ? f.seoTitle : null,
    seoDescription: f.seoDescription ? f.seoDescription : null,
    isFeatured: f.isFeatured,
    status: f.status,
    isPublished: f.status === "published",
    publishedAt,
  };
}

function previewUrl(slug: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.protocol}//${window.location.host}/blog/${slug}`;
}

export default function AdminCmsBlogEdit() {
  const { lang } = useTranslation();
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const { user } = useAuth();
  const { toast } = useToast();
  const canWrite = hasPermission(user, "blog", "write");
  const canDelete = hasPermission(user, "blog", "delete");
  const [, setLocation] = useLocation();
  const params = useParams<{ id?: string }>();
  const isNew = !params.id || params.id === "new";
  const id = isNew ? null : Number(params.id);

  // The list endpoint returns all rows; pick the one we need by id.
  const { data: rows, isLoading } = useAdminGet<BlogRow[]>(["admin-blog"], "/admin/blog");
  const current = useMemo<BlogRow | undefined>(() => {
    if (isNew || !id) return undefined;
    return rows?.find((r) => r.id === id);
  }, [rows, id, isNew]);

  const { data: cats } = useAdminGet<BlogCategory[]>(["admin-blog-categories"], "/admin/blog/categories");

  const [form, setForm] = useState<Form>(empty);
  // Track which row id we last hydrated for so navigating between
  // /cms/blog/:id records (without remount) reseeds the form.
  const [hydratedFor, setHydratedFor] = useState<number | "new" | null>(null);

  useEffect(() => {
    if (isNew) {
      if (hydratedFor !== "new") {
        setForm(empty);
        setHydratedFor("new");
      }
      return;
    }
    if (current && hydratedFor !== current.id) {
      setForm(fromRow(current));
      setHydratedFor(current.id);
    }
  }, [current, isNew, hydratedFor]);

  const create = useAdminMutation<Form, BlogRow>(
    (f) => adminApi.post<BlogRow>("/admin/blog", toBody(f)),
    [["admin-blog"], ["public-blog"], ["public-blog-post"]],
  );
  const update = useAdminMutation<{ id: number; data: Form }, BlogRow>(
    ({ id, data }) => adminApi.patch<BlogRow>(`/admin/blog/${id}`, toBody(data)),
    [["admin-blog"], ["public-blog"], ["public-blog-post"]],
  );
  const del = useAdminMutation<{ id: number }>(
    ({ id }) => adminApi.del(`/admin/blog/${id}`),
    [["admin-blog"], ["public-blog"], ["public-blog-post"]],
  );

  const save = async (publish?: "publish" | "unpublish") => {
    const f: Form = publish === "publish"
      ? { ...form, status: "published" }
      : publish === "unpublish"
        ? { ...form, status: "draft" }
        : form;
    if (!f.title.trim() || !f.slug.trim()) {
      toast({
        variant: "destructive",
        title: t("بيانات ناقصة", "Missing fields"),
        description: t("العنوان والمعرف مطلوبان", "Title and slug are required"),
      });
      return;
    }
    try {
      if (isNew) {
        const created = await create.mutateAsync(f);
        toast({ title: t("تم الإنشاء", "Created") });
        setLocation(`/cms/blog/${created.id}`);
      } else if (id) {
        await update.mutateAsync({ id, data: f });
        setForm(f);
        toast({ title: t("تم الحفظ", "Saved") });
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: t("فشل الحفظ", "Save failed"),
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const dirInput = form.locale === "ar" ? "rtl" : "ltr";
  const pending = create.isPending || update.isPending;

  if (!isNew && isLoading && !current) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!canWrite) {
    return (
      <div className="text-sm text-muted-foreground">{t("ليس لديك صلاحية الكتابة.", "You do not have write permission.")}</div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={isNew ? t("مقال جديد", "New Post") : t("تعديل المقال", "Edit Post")}
        description={
          current
            ? t(`آخر تحديث: ${new Date(current.updatedAt).toLocaleString("ar-AE")}`, `Last updated ${new Date(current.updatedAt).toLocaleString()}`)
            : undefined
        }
        actions={
          <div className="flex items-center gap-2">
            <Link href="/cms/blog">
              <Button variant="outline" size="sm" data-testid="button-back">
                <ArrowLeft className="w-4 h-4 ltr:mr-1 rtl:ml-1" />{t("رجوع", "Back")}
              </Button>
            </Link>
            {!isNew && current?.isPublished && (
              <a href={previewUrl(current.slug)} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" data-testid="button-preview-live">
                  <ExternalLink className="w-4 h-4 ltr:mr-1 rtl:ml-1" />{t("معاينة على الموقع", "Live preview")}
                </Button>
              </a>
            )}
            {!isNew && id && canDelete && (
              <ConfirmActionDialog
                trigger={
                  <Button variant="destructive" size="sm" data-testid="button-delete">
                    <Trash2 className="w-4 h-4 ltr:mr-1 rtl:ml-1" />{t("حذف", "Delete")}
                  </Button>
                }
                title={t("حذف المقال؟", "Delete post?")}
                description={form.title}
                destructive
                successMessage={t("تم الحذف", "Deleted")}
                onConfirm={async () => { await del.mutateAsync({ id }); setLocation("/cms/blog"); }}
              />
            )}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <Label>{t("العنوان", "Title")}</Label>
                <Input
                  value={form.title}
                  dir={dirInput}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  data-testid="input-title"
                />
              </div>
              <div>
                <Label>{t("اللغة", "Locale")}</Label>
                <Select value={form.locale} onValueChange={(v) => setForm({ ...form, locale: v as "ar" | "en" })}>
                  <SelectTrigger data-testid="select-locale"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ar">العربية (RTL)</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>{t("المعرف (Slug)", "Slug")}</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-") })}
                  placeholder="how-to-hire"
                  data-testid="input-slug"
                />
                <p className="text-[11px] text-muted-foreground mt-1">{t("لاتيني صغير، فواصل (-) فقط.", "Lowercase letters, numbers, and dashes only.")}</p>
              </div>
              <div>
                <Label>{t("الفئة", "Category")}</Label>
                <Select
                  value={form.categoryId == null ? "_none" : String(form.categoryId)}
                  onValueChange={(v) => setForm({ ...form, categoryId: v === "_none" ? null : Number(v) })}
                >
                  <SelectTrigger data-testid="select-category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">{t("بدون", "None")}</SelectItem>
                    {(cats ?? []).filter((c) => c.isActive).map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{lang === "ar" ? c.nameAr : c.nameEn}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{t("المقتطف", "Excerpt")}</Label>
              <Textarea
                value={form.excerpt}
                dir={dirInput}
                rows={2}
                onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
                data-testid="input-excerpt"
              />
            </div>
            <div>
              <Label>{t("المحتوى (HTML)", "Body (HTML)")}</Label>
              <Textarea
                value={form.body}
                dir={dirInput}
                rows={18}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                className="font-mono text-sm"
                data-testid="input-body"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                {t("يدعم HTML آمن: العناوين، الفقرات، الروابط، الصور، القوائم، والجداول.", "Sanitized HTML: headings, paragraphs, links, images, lists, and tables.")}
              </p>
            </div>
            <div>
              <Label>{t("الوسوم (مفصولة بفواصل)", "Tags (comma separated)")}</Label>
              <Input
                value={form.tags}
                dir={dirInput}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                data-testid="input-tags"
              />
            </div>

            <div className="border-t pt-4 space-y-3">
              <div className="text-sm font-semibold">{t("بيانات SEO", "SEO")}</div>
              <div>
                <Label>SEO title</Label>
                <Input
                  value={form.seoTitle}
                  dir={dirInput}
                  onChange={(e) => setForm({ ...form, seoTitle: e.target.value })}
                  data-testid="input-seo-title"
                />
              </div>
              <div>
                <Label>SEO description</Label>
                <Textarea
                  value={form.seoDescription}
                  dir={dirInput}
                  rows={2}
                  onChange={(e) => setForm({ ...form, seoDescription: e.target.value })}
                  data-testid="input-seo-description"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">{t("النشر", "Publish")}</div>
                <Badge variant={form.status === "published" ? "default" : "outline"} className="capitalize">
                  {form.status}
                </Badge>
              </div>
              <div>
                <Label>{t("الحالة", "Status")}</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Status })}>
                  <SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("تاريخ النشر", "Publish date")}</Label>
                <Input
                  type="datetime-local"
                  value={form.publishedAt}
                  onChange={(e) => setForm({ ...form, publishedAt: e.target.value })}
                  data-testid="input-published-at"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  {t(
                    "اتركه فارغاً للنشر الفوري، أو حدد تاريخاً مستقبلياً للجدولة.",
                    "Leave blank to publish now, or set a future time to schedule.",
                  )}
                </p>
                {form.publishedAt && new Date(form.publishedAt).getTime() > Date.now() && (
                  <p className="text-[11px] text-amber-600 mt-1">
                    {t("مجدول للنشر مستقبلاً.", "Scheduled for future publish.")}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="featured"
                  checked={form.isFeatured}
                  onCheckedChange={(c) => setForm({ ...form, isFeatured: c })}
                  data-testid="switch-featured"
                />
                <Label htmlFor="featured">{t("مقال مميّز", "Featured")}</Label>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <Button onClick={() => save()} disabled={pending} data-testid="button-save">
                  {pending ? <Loader2 className="w-4 h-4 animate-spin ltr:mr-1 rtl:ml-1" /> : <Save className="w-4 h-4 ltr:mr-1 rtl:ml-1" />}
                  {t("حفظ", "Save draft")}
                </Button>
                {form.status !== "published" ? (
                  <Button
                    variant="default"
                    onClick={() => save("publish")}
                    disabled={pending}
                    data-testid="button-publish"
                  >
                    {t("نشر الآن", "Publish now")}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => save("unpublish")}
                    disabled={pending}
                    data-testid="button-unpublish"
                  >
                    {t("إلغاء النشر", "Unpublish")}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-3">
              <div className="text-sm font-semibold">{t("صورة الغلاف", "Cover image")}</div>
              <ImageUploadField
                value={form.coverUrl}
                onChange={(url) => setForm({ ...form, coverUrl: url })}
                kind="blog-cover"
                testId="cover"
              />
              <p className="text-[11px] text-muted-foreground">
                {t("يمكنك الرفع أو لصق رابط من مكتبة الوسائط.", "Upload, or paste a URL from the media library.")}
              </p>
              <Link href="/cms-media">
                <Button variant="ghost" size="sm" data-testid="button-open-media">
                  {t("فتح مكتبة الوسائط", "Open media library")}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

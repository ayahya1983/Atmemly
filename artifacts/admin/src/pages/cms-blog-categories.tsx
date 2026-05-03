import { useState } from "react";
import { useAdminGet, useAdminMutation, adminApi } from "@/lib/api-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/lib/permissions";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  DataTable, type Column, PageHeader, FilterBar, ConfirmActionDialog, FormDialog,
  ImageUploadField,
} from "@/components/admin";

interface CatRow {
  id: number; slug: string; nameAr: string; nameEn: string;
  sortOrder: number; isActive: boolean;
  seoTitleAr: string | null; seoTitleEn: string | null;
  seoDescriptionAr: string | null; seoDescriptionEn: string | null;
  seoImageUrl: string | null;
}
interface CatForm {
  slug: string; nameAr: string; nameEn: string;
  sortOrder: number; isActive: boolean;
  seoTitleAr: string; seoTitleEn: string;
  seoDescriptionAr: string; seoDescriptionEn: string;
  seoImageUrl: string;
}
const empty: CatForm = {
  slug: "", nameAr: "", nameEn: "", sortOrder: 0, isActive: true,
  seoTitleAr: "", seoTitleEn: "", seoDescriptionAr: "", seoDescriptionEn: "", seoImageUrl: "",
};

export default function AdminCmsBlogCategories() {
  const { lang } = useTranslation();
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const { user } = useAuth();
  const canWrite = hasPermission(user, "blog", "write");
  const canDelete = hasPermission(user, "blog", "delete");

  const key = ["admin-blog-categories-full"];
  const { data, isLoading } = useAdminGet<CatRow[]>(key, "/admin/blog/categories");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CatRow | null>(null);
  const [form, setForm] = useState<CatForm>(empty);

  const toBody = (f: CatForm) => ({
    ...f,
    seoTitleAr: f.seoTitleAr || null, seoTitleEn: f.seoTitleEn || null,
    seoDescriptionAr: f.seoDescriptionAr || null, seoDescriptionEn: f.seoDescriptionEn || null,
    seoImageUrl: f.seoImageUrl || null,
  });
  const create = useAdminMutation<CatForm>((f) => adminApi.post("/admin/blog/categories", toBody(f)), [key, ["public-blog-categories"]]);
  const update = useAdminMutation<{ id: number; data: CatForm }>(({ id, data }) => adminApi.patch(`/admin/blog/categories/${id}`, toBody(data)), [key, ["public-blog-categories"]]);
  const del = useAdminMutation<{ id: number }>(({ id }) => adminApi.del(`/admin/blog/categories/${id}`), [key, ["public-blog-categories"]]);

  const startCreate = () => { setEditing(null); setForm(empty); setOpen(true); };
  const startEdit = (r: CatRow) => {
    setEditing(r);
    setForm({
      slug: r.slug, nameAr: r.nameAr, nameEn: r.nameEn,
      sortOrder: r.sortOrder, isActive: r.isActive,
      seoTitleAr: r.seoTitleAr ?? "", seoTitleEn: r.seoTitleEn ?? "",
      seoDescriptionAr: r.seoDescriptionAr ?? "", seoDescriptionEn: r.seoDescriptionEn ?? "",
      seoImageUrl: r.seoImageUrl ?? "",
    });
    setOpen(true);
  };
  const save = async () => {
    if (editing) await update.mutateAsync({ id: editing.id, data: form });
    else await create.mutateAsync(form);
  };

  const columns: Column<CatRow>[] = [
    { key: "name", header: t("الاسم", "Name"), cell: (r) => <span className="font-medium">{lang === "ar" ? r.nameAr : r.nameEn}</span>, sortValue: (r) => r.nameEn, searchValue: (r) => `${r.nameAr} ${r.nameEn} ${r.slug}` },
    { key: "slug", header: "Slug", cell: (r) => <code className="text-xs">{r.slug}</code>, sortValue: (r) => r.slug },
    { key: "sortOrder", header: t("الترتيب", "Order"), cell: (r) => r.sortOrder, sortValue: (r) => r.sortOrder },
    { key: "isActive", header: t("نشط", "Active"), cell: (r) => <Badge variant={r.isActive ? "default" : "secondary"}>{r.isActive ? "✓" : "—"}</Badge> },
    { key: "seo", header: "SEO", cell: (r) => (
      <span className="text-xs text-muted-foreground">{(r.seoTitleEn || r.seoTitleAr) ? "✓" : "—"}</span>
    ) },
    { key: "actions", header: "", align: "end", cell: (r) => (
      <div className="flex gap-1 justify-end">
        {canWrite && <Button size="sm" variant="outline" onClick={() => startEdit(r)} data-testid={`button-edit-cat-${r.id}`}><Pencil className="w-3 h-3" /></Button>}
        {canDelete && (
          <ConfirmActionDialog
            trigger={<Button size="sm" variant="destructive"><Trash2 className="w-3 h-3" /></Button>}
            title={t("حذف الفئة؟", "Delete category?")}
            description={lang === "ar" ? r.nameAr : r.nameEn}
            destructive
            successMessage={t("تم الحذف", "Deleted")}
            onConfirm={() => del.mutateAsync({ id: r.id })}
          />
        )}
      </div>
    ) },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("فئات المدونة", "Blog Categories")}
        description={t("الاسم وSEO لكل فئة مدونة", "Name & SEO for each blog category")}
        actions={canWrite ? <Button onClick={startCreate} data-testid="button-new-blog-category"><Plus className="w-4 h-4 ltr:mr-1 rtl:ml-1" />{t("جديد", "New")}</Button> : undefined}
      />
      <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder={t("بحث", "Search")} onReset={() => setSearch("")} />
      <DataTable data={data ?? []} columns={columns} rowKey={(r) => r.id} isLoading={isLoading} search={search} csvFilename="blog-categories.csv" />

      <FormDialog open={open} onOpenChange={setOpen} title={editing ? t("تعديل فئة", "Edit category") : t("فئة جديدة", "New category")} size="lg" onSubmit={save} successMessage={t("تم الحفظ", "Saved")}>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="design" data-testid="input-cat-slug" /></div>
          <div><Label>{t("الترتيب", "Sort order")}</Label><Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} /></div>
          <div><Label>{t("الاسم بالعربية", "Name (Arabic)")}</Label><Input dir="rtl" value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} /></div>
          <div><Label>{t("الاسم بالإنجليزية", "Name (English)")}</Label><Input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} /></div>
        </div>
        <div className="border-t pt-3 mt-1">
          <div className="font-semibold text-sm mb-2">{t("بيانات SEO الافتراضية للفئة", "Category fallback SEO")}</div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>SEO Title (AR)</Label><Input dir="rtl" value={form.seoTitleAr} onChange={(e) => setForm({ ...form, seoTitleAr: e.target.value })} data-testid="input-cat-seo-title-ar" /></div>
            <div><Label>SEO Title (EN)</Label><Input value={form.seoTitleEn} onChange={(e) => setForm({ ...form, seoTitleEn: e.target.value })} data-testid="input-cat-seo-title-en" /></div>
            <div><Label>SEO Description (AR)</Label><Textarea dir="rtl" rows={2} value={form.seoDescriptionAr} onChange={(e) => setForm({ ...form, seoDescriptionAr: e.target.value })} /></div>
            <div><Label>SEO Description (EN)</Label><Textarea rows={2} value={form.seoDescriptionEn} onChange={(e) => setForm({ ...form, seoDescriptionEn: e.target.value })} /></div>
          </div>
          <div className="mt-2">
            <ImageUploadField label="OG Image" value={form.seoImageUrl} onChange={(url) => setForm({ ...form, seoImageUrl: url })} kind="cms-page" testId="cat-seo-image" />
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Switch checked={form.isActive} onCheckedChange={(c) => setForm({ ...form, isActive: c })} id="cat-active" />
          <Label htmlFor="cat-active">{t("نشط", "Active")}</Label>
        </div>
      </FormDialog>
    </div>
  );
}

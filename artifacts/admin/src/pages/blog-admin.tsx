import { useState } from "react";
import { useAdminGet, useAdminMutation, adminApi } from "@/lib/api-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/lib/permissions";
import { Plus, Pencil, Trash2, Star } from "lucide-react";
import {
  DataTable, type Column, StatusBadge, PageHeader, FilterBar, ConfirmActionDialog, FormDialog,
  ImageUploadField,
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

interface BlogForm {
  slug: string; locale: "en" | "ar"; title: string; excerpt: string; body: string;
  coverUrl: string; category: string; categoryId: number | null; tags: string;
  status: Status; isFeatured: boolean;
  seoTitle: string; seoDescription: string;
}
const emptyForm: BlogForm = {
  slug: "", locale: "en", title: "", excerpt: "", body: "", coverUrl: "",
  category: "", categoryId: null, tags: "",
  status: "draft", isFeatured: false, seoTitle: "", seoDescription: "",
};

interface BlogCategory { id: number; slug: string; nameEn: string; nameAr: string; isActive: boolean }

export default function AdminBlog() {
  const { lang } = useTranslation();
  const { user } = useAuth();
  const canWrite = hasPermission(user, "blog", "write");
  const canDelete = hasPermission(user, "blog", "delete");

  const key = ["admin-blog"];
  const { data, isLoading } = useAdminGet<BlogRow[]>(key, "/admin/blog");
  const { data: cats } = useAdminGet<BlogCategory[]>(["admin-blog-categories"], "/admin/blog/categories");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [localeFilter, setLocaleFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BlogRow | null>(null);
  const [form, setForm] = useState<BlogForm>(emptyForm);

  const formToBody = (f: BlogForm) => ({
    slug: f.slug, locale: f.locale, title: f.title, excerpt: f.excerpt, body: f.body,
    coverUrl: f.coverUrl || null, category: f.category || null,
    categoryId: f.categoryId,
    tags: f.tags ? f.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
    status: f.status, isFeatured: f.isFeatured,
    isPublished: f.status === "published",
    seoTitle: f.seoTitle || null, seoDescription: f.seoDescription || null,
  });

  const createMutation = useAdminMutation<BlogForm>((f) => adminApi.post("/admin/blog", formToBody(f)), [key, ["public-blog"], ["public-blog-post"]]);
  const updateMutation = useAdminMutation<{ id: number; data: BlogForm }>(
    ({ id, data }) => adminApi.patch(`/admin/blog/${id}`, formToBody(data)), [key, ["public-blog"], ["public-blog-post"]],
  );
  const deleteMutation = useAdminMutation<{ id: number }>(({ id }) => adminApi.del(`/admin/blog/${id}`), [key, ["public-blog"], ["public-blog-post"]]);

  const startCreate = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const startEdit = (row: BlogRow) => {
    setEditing(row);
    setForm({
      slug: row.slug, locale: row.locale as "en" | "ar", title: row.title,
      excerpt: row.excerpt ?? "", body: row.body, coverUrl: row.coverUrl ?? "",
      category: row.category ?? "", categoryId: row.categoryId,
      tags: (row.tags ?? []).join(", "),
      status: row.status ?? (row.isPublished ? "published" : "draft"),
      isFeatured: !!row.isFeatured,
      seoTitle: row.seoTitle ?? "", seoDescription: row.seoDescription ?? "",
    });
    setOpen(true);
  };
  const save = async () => {
    if (editing) await updateMutation.mutateAsync({ id: editing.id, data: form });
    else await createMutation.mutateAsync(form);
  };

  const filtered = (data ?? []).filter((p) =>
    (statusFilter === "all" || (p.status ?? (p.isPublished ? "published" : "draft")) === statusFilter) &&
    (localeFilter === "all" || p.locale === localeFilter),
  );

  const columns: Column<BlogRow>[] = [
    {
      key: "title",
      header: lang === "ar" ? "العنوان" : "Title",
      cell: (p) => (
        <span className="font-medium block max-w-md truncate">
          {p.isFeatured && <Star className="inline w-3 h-3 mr-1 text-yellow-500 fill-yellow-500" />}
          {p.title}
        </span>
      ),
      sortValue: (p) => p.title,
      searchValue: (p) => `${p.title} ${p.slug}`,
    },
    {
      key: "category",
      header: lang === "ar" ? "الفئة" : "Category",
      cell: (p) => {
        const cat = cats?.find((c) => c.id === p.categoryId);
        return cat ? (lang === "ar" ? cat.nameAr : cat.nameEn) : (p.category ?? "—");
      },
      sortValue: (p) => p.category ?? "",
      searchValue: (p) => p.category ?? "",
    },
    {
      key: "locale",
      header: lang === "ar" ? "اللغة" : "Locale",
      cell: (p) => <Badge variant="outline" className="uppercase">{p.locale}</Badge>,
      sortValue: (p) => p.locale,
    },
    {
      key: "status",
      header: lang === "ar" ? "الحالة" : "Status",
      cell: (p) => <StatusBadge status={p.status ?? (p.isPublished ? "published" : "draft")} />,
      sortValue: (p) => p.status ?? "",
    },
    {
      key: "updatedAt",
      header: lang === "ar" ? "محدّث" : "Updated",
      cell: (p) => <span className="text-xs text-muted-foreground">{new Date(p.updatedAt).toISOString().slice(0, 10)}</span>,
      sortValue: (p) => new Date(p.updatedAt).getTime(),
    },
    {
      key: "actions",
      header: lang === "ar" ? "إجراءات" : "Actions",
      align: "end",
      cell: (p) => (
        <div className="flex gap-1 justify-end">
          {canWrite && (
            <Button size="sm" variant="outline" onClick={() => startEdit(p)} data-testid={`button-edit-${p.id}`}><Pencil className="w-3 h-3" /></Button>
          )}
          {canDelete && (
            <ConfirmActionDialog
              trigger={<Button size="sm" variant="destructive" data-testid={`button-delete-${p.id}`}><Trash2 className="w-3 h-3" /></Button>}
              title={lang === "ar" ? "حذف المقال؟" : "Delete post?"}
              description={p.title}
              destructive
              successMessage={lang === "ar" ? "تم الحذف" : "Deleted"}
              onConfirm={() => deleteMutation.mutateAsync({ id: p.id })}
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title={lang === "ar" ? "المدونة" : "Blog Posts"}
        actions={canWrite ? (
          <Button onClick={startCreate} data-testid="button-new-post">
            <Plus className="w-4 h-4 ltr:mr-1 rtl:ml-1" />{lang === "ar" ? "مقال جديد" : "New Post"}
          </Button>
        ) : undefined}
      />
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={lang === "ar" ? "بحث بالعنوان أو المعرف" : "Search title or slug"}
        onReset={() => { setSearch(""); setStatusFilter("all"); setLocaleFilter("all"); }}
      >
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | Status)} className="h-9 rounded-md border border-input bg-background px-2 text-sm" data-testid="select-blog-status-filter">
          <option value="all">{lang === "ar" ? "كل الحالات" : "All statuses"}</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
        <select value={localeFilter} onChange={(e) => setLocaleFilter(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="all">{lang === "ar" ? "كل اللغات" : "All locales"}</option>
          <option value="en">English</option>
          <option value="ar">العربية</option>
        </select>
      </FilterBar>
      <DataTable
        data={filtered}
        columns={columns}
        rowKey={(p) => p.id}
        isLoading={isLoading}
        search={search}
        emptyTitle={lang === "ar" ? "لا مقالات" : "No posts"}
        csvFilename="blog-posts.csv"
      />

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? (lang === "ar" ? "تعديل مقال" : "Edit Post") : (lang === "ar" ? "مقال جديد" : "New Post")}
        size="lg"
        successMessage={lang === "ar" ? "تم الحفظ" : "Saved"}
        onSubmit={save}
      >
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} data-testid="input-blog-slug" /></div>
          <div>
            <Label>Locale</Label>
            <Select value={form.locale} onValueChange={(v) => setForm({ ...form, locale: v as "en" | "ar" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ar">العربية</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div><Label>{lang === "ar" ? "العنوان" : "Title"}</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} dir={form.locale === "ar" ? "rtl" : "ltr"} /></div>
        <div><Label>{lang === "ar" ? "المقتطف" : "Excerpt"}</Label><Textarea value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} dir={form.locale === "ar" ? "rtl" : "ltr"} rows={2} /></div>
        <div><Label>{lang === "ar" ? "المحتوى (HTML)" : "Body (HTML)"}</Label><Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} dir={form.locale === "ar" ? "rtl" : "ltr"} rows={10} className="font-mono text-sm" /></div>
        <div className="grid grid-cols-2 gap-3">
          <ImageUploadField
            label={lang === "ar" ? "صورة الغلاف" : "Cover image"}
            value={form.coverUrl}
            onChange={(url) => setForm({ ...form, coverUrl: url })}
            kind="blog-cover"
            testId="blog-cover"
          />
          <div>
            <Label>{lang === "ar" ? "الفئة" : "Category"}</Label>
            <Select
              value={form.categoryId == null ? "_none" : String(form.categoryId)}
              onValueChange={(v) => setForm({ ...form, categoryId: v === "_none" ? null : Number(v) })}
            >
              <SelectTrigger data-testid="select-blog-category"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">{lang === "ar" ? "بدون" : "None"}</SelectItem>
                {(cats ?? []).filter((c) => c.isActive).map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{lang === "ar" ? c.nameAr : c.nameEn}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div><Label>{lang === "ar" ? "العلامات (مفصولة بفواصل)" : "Tags (comma separated)"}</Label><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>SEO Title</Label><Input value={form.seoTitle} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} data-testid="input-blog-seo-title" /></div>
          <div><Label>SEO Description</Label><Input value={form.seoDescription} onChange={(e) => setForm({ ...form, seoDescription: e.target.value })} data-testid="input-blog-seo-description" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>{lang === "ar" ? "الحالة" : "Status"}</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Status })}>
              <SelectTrigger data-testid="select-blog-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Switch checked={form.isFeatured} onCheckedChange={(c) => setForm({ ...form, isFeatured: c })} id="bp-featured" data-testid="switch-blog-featured" />
            <Label htmlFor="bp-featured">{lang === "ar" ? "مميّز" : "Featured"}</Label>
          </div>
        </div>
      </FormDialog>
    </div>
  );
}

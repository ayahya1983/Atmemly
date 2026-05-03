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
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  DataTable, type Column, StatusBadge, PageHeader, FilterBar, ConfirmActionDialog, FormDialog,
  ImageUploadField,
} from "@/components/admin";

interface BlogRow {
  id: number; slug: string; locale: string; title: string;
  excerpt: string | null; body: string; coverUrl: string | null;
  category: string | null; tags: string[] | null; isPublished: boolean;
  publishedAt: string | null; updatedAt: string;
}

interface BlogForm {
  slug: string; locale: "en" | "ar"; title: string; excerpt: string; body: string;
  coverUrl: string; category: string; tags: string; isPublished: boolean;
}
const emptyForm: BlogForm = {
  slug: "", locale: "en", title: "", excerpt: "", body: "", coverUrl: "", category: "", tags: "", isPublished: false,
};

export default function AdminBlog() {
  const { lang } = useTranslation();
  const { user } = useAuth();
  const canWrite = hasPermission(user, "blog", "write");
  const canDelete = hasPermission(user, "blog", "delete");

  const key = ["admin-blog"];
  const { data, isLoading } = useAdminGet<BlogRow[]>(key, "/admin/blog");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [localeFilter, setLocaleFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BlogRow | null>(null);
  const [form, setForm] = useState<BlogForm>(emptyForm);

  const formToBody = (f: BlogForm) => ({
    slug: f.slug, locale: f.locale, title: f.title, excerpt: f.excerpt, body: f.body,
    coverUrl: f.coverUrl || null, category: f.category || null,
    tags: f.tags ? f.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
    isPublished: f.isPublished,
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
      category: row.category ?? "", tags: (row.tags ?? []).join(", "), isPublished: row.isPublished,
    });
    setOpen(true);
  };
  const save = async () => {
    if (editing) await updateMutation.mutateAsync({ id: editing.id, data: form });
    else await createMutation.mutateAsync(form);
  };

  const filtered = (data ?? []).filter((p) =>
    (statusFilter === "all" || (statusFilter === "published" ? p.isPublished : !p.isPublished)) &&
    (localeFilter === "all" || p.locale === localeFilter),
  );

  const columns: Column<BlogRow>[] = [
    {
      key: "title",
      header: lang === "ar" ? "العنوان" : "Title",
      cell: (p) => <span className="font-medium block max-w-md truncate">{p.title}</span>,
      sortValue: (p) => p.title,
      searchValue: (p) => `${p.title} ${p.slug}`,
    },
    {
      key: "category",
      header: lang === "ar" ? "الفئة" : "Category",
      cell: (p) => p.category ?? "—",
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
      key: "isPublished",
      header: lang === "ar" ? "الحالة" : "Status",
      cell: (p) => <StatusBadge status={p.isPublished ? "published" : "draft"} />,
      sortValue: (p) => (p.isPublished ? 1 : 0),
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
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="all">{lang === "ar" ? "كل الحالات" : "All statuses"}</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
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
          <div><Label>Slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
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
        <div><Label>{lang === "ar" ? "العنوان" : "Title"}</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div><Label>{lang === "ar" ? "المقتطف" : "Excerpt"}</Label><Textarea value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} rows={2} /></div>
        <div><Label>{lang === "ar" ? "المحتوى (HTML)" : "Body (HTML)"}</Label><Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={10} className="font-mono text-sm" /></div>
        <div className="grid grid-cols-2 gap-3">
          <ImageUploadField
            label={lang === "ar" ? "صورة الغلاف" : "Cover image"}
            value={form.coverUrl}
            onChange={(url) => setForm({ ...form, coverUrl: url })}
            kind="blog-cover"
            testId="blog-cover"
          />
          <div><Label>{lang === "ar" ? "الفئة" : "Category"}</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
        </div>
        <div><Label>{lang === "ar" ? "العلامات (مفصولة بفواصل)" : "Tags (comma separated)"}</Label><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></div>
        <div className="flex items-center gap-2">
          <Switch checked={form.isPublished} onCheckedChange={(c) => setForm({ ...form, isPublished: c })} id="bp" />
          <Label htmlFor="bp">{lang === "ar" ? "منشور" : "Published"}</Label>
        </div>
      </FormDialog>
    </div>
  );
}

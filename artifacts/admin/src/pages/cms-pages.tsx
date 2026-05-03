import { useState } from "react";
import { useAdminGet, useAdminMutation, adminApi } from "@/lib/api-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

type Status = "draft" | "published" | "archived";

interface CmsPageRow {
  id: number; slug: string; locale: string; title: string;
  body: string; seoTitle: string | null; seoDescription: string | null;
  isPublished: boolean; status: Status; publishedAt: string | null; updatedAt: string;
}

interface PageForm {
  slug: string; locale: "en" | "ar"; title: string; body: string;
  seoTitle: string; seoDescription: string; status: Status;
}

const emptyForm: PageForm = {
  slug: "", locale: "en", title: "", body: "", seoTitle: "", seoDescription: "", status: "draft",
};

export default function AdminCmsPages() {
  const { lang } = useTranslation();
  const { user } = useAuth();
  const canWrite = hasPermission(user, "cms", "write");
  const canDelete = hasPermission(user, "cms", "delete");

  const key = ["admin-cms-pages"];
  const { data, isLoading } = useAdminGet<CmsPageRow[]>(key, "/admin/cms/pages");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [localeFilter, setLocaleFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CmsPageRow | null>(null);
  const [form, setForm] = useState<PageForm>(emptyForm);
  const [pendingImage, setPendingImage] = useState("");
  const [insertedTag, setInsertedTag] = useState<string | null>(null);

  const insertImage = () => {
    const url = pendingImage.trim();
    if (!url) return;
    const newTag = `<img src="${url}" alt="" />`;
    setForm((f) => {
      let body = f.body;
      const idx = insertedTag ? body.indexOf(insertedTag) : -1;
      if (insertedTag && idx >= 0) {
        body = body.slice(0, idx) + newTag + body.slice(idx + insertedTag.length);
      } else {
        body = body ? `${body}\n${newTag}` : newTag;
      }
      return { ...f, body };
    });
    setInsertedTag(newTag);
  };

  const removeInsertedImage = () => {
    if (insertedTag) {
      setForm((f) => {
        const body = f.body;
        const withNewline = `\n${insertedTag}`;
        const nIdx = body.indexOf(withNewline);
        if (nIdx >= 0) {
          return { ...f, body: body.slice(0, nIdx) + body.slice(nIdx + withNewline.length) };
        }
        const idx = body.indexOf(insertedTag);
        if (idx >= 0) {
          return { ...f, body: body.slice(0, idx) + body.slice(idx + insertedTag.length) };
        }
        return f;
      });
    }
    setInsertedTag(null);
    setPendingImage("");
  };

  const formToBody = (f: Partial<PageForm>) => ({
    ...f,
    seoTitle: f.seoTitle ? f.seoTitle : null,
    seoDescription: f.seoDescription ? f.seoDescription : null,
    isPublished: f.status === "published",
  });
  const createMutation = useAdminMutation<PageForm>(
    (input) => adminApi.post("/admin/cms/pages", formToBody(input)),
    [key, ["public-cms-page"]],
  );
  const updateMutation = useAdminMutation<{ id: number; data: Partial<PageForm> }>(
    ({ id, data }) => adminApi.patch(`/admin/cms/pages/${id}`, formToBody(data)),
    [key, ["public-cms-page"]],
  );
  const deleteMutation = useAdminMutation<{ id: number }>(
    ({ id }) => adminApi.del(`/admin/cms/pages/${id}`),
    [key, ["public-cms-page"]],
  );

  const resetImageState = () => { setPendingImage(""); setInsertedTag(null); };
  const startCreate = () => { setEditing(null); setForm(emptyForm); resetImageState(); setOpen(true); };
  const startEdit = (row: CmsPageRow) => {
    setEditing(row);
    setForm({
      slug: row.slug, locale: row.locale as "en" | "ar", title: row.title, body: row.body,
      seoTitle: row.seoTitle ?? "", seoDescription: row.seoDescription ?? "",
      status: row.status ?? (row.isPublished ? "published" : "draft"),
    });
    resetImageState();
    setOpen(true);
  };
  const save = async () => {
    if (editing) await updateMutation.mutateAsync({ id: editing.id, data: form });
    else await createMutation.mutateAsync(form);
  };

  const effectiveStatus = (p: CmsPageRow): Status => p.status ?? (p.isPublished ? "published" : "draft");
  const filtered = (data ?? []).filter((p) =>
    (statusFilter === "all" || effectiveStatus(p) === statusFilter) &&
    (localeFilter === "all" || p.locale === localeFilter),
  );

  const columns: Column<CmsPageRow>[] = [
    {
      key: "title",
      header: lang === "ar" ? "العنوان" : "Title",
      cell: (p) => <span className="font-medium">{p.title}</span>,
      sortValue: (p) => p.title,
      searchValue: (p) => p.title,
    },
    {
      key: "slug",
      header: lang === "ar" ? "المعرف" : "Slug",
      cell: (p) => <span className="font-mono text-xs">{p.slug}</span>,
      sortValue: (p) => p.slug,
      searchValue: (p) => p.slug,
    },
    {
      key: "locale",
      header: lang === "ar" ? "اللغة" : "Locale",
      cell: (p) => <Badge variant="outline" className="uppercase">{p.locale}</Badge>,
      sortValue: (p) => p.locale,
    },
    {
      key: "isPublished",
      header: lang === "ar" ? "النشر" : "Status",
      cell: (p) => <StatusBadge status={effectiveStatus(p)} />,
      sortValue: (p) => effectiveStatus(p),
    },
    {
      key: "publishedAt",
      header: lang === "ar" ? "تاريخ النشر" : "Published",
      cell: (p) => <span className="text-xs text-muted-foreground">{p.publishedAt ? new Date(p.publishedAt).toISOString().slice(0, 10) : "—"}</span>,
      sortValue: (p) => (p.publishedAt ? new Date(p.publishedAt).getTime() : 0),
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
              title={lang === "ar" ? "حذف الصفحة؟" : "Delete page?"}
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
        title={lang === "ar" ? "صفحات المحتوى" : "CMS Pages"}
        actions={canWrite ? (
          <Button onClick={startCreate} data-testid="button-new-page">
            <Plus className="w-4 h-4 ltr:mr-1 rtl:ml-1" />{lang === "ar" ? "إضافة" : "New Page"}
          </Button>
        ) : undefined}
      />
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={lang === "ar" ? "بحث بالعنوان أو المعرف" : "Search title or slug"}
        onReset={() => { setSearch(""); setStatusFilter("all"); setLocaleFilter("all"); }}
      >
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm" data-testid="select-cmspage-status-filter">
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
        emptyTitle={lang === "ar" ? "لا صفحات" : "No pages yet"}
        csvFilename="cms-pages.csv"
      />

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? (lang === "ar" ? "تعديل صفحة" : "Edit Page") : (lang === "ar" ? "صفحة جديدة" : "New Page")}
        size="lg"
        successMessage={lang === "ar" ? "تم الحفظ" : "Saved"}
        onSubmit={save}
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>{lang === "ar" ? "المعرف" : "Slug"}</Label>
            <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="about" />
          </div>
          <div>
            <Label>{lang === "ar" ? "اللغة" : "Locale"}</Label>
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
        <div><Label>{lang === "ar" ? "المحتوى (HTML)" : "Body (HTML)"}</Label><Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={10} className="font-mono text-sm" /></div>
        <div className="space-y-2">
          <ImageUploadField
            label={lang === "ar" ? "صورة للمحتوى" : "Image for body"}
            value={pendingImage}
            onChange={setPendingImage}
            kind="cms-page"
            testId="cms-page-image"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={insertImage}
              disabled={!pendingImage.trim()}
              data-testid="button-cms-page-image-insert"
            >
              {insertedTag
                ? (lang === "ar" ? "استبدال في المحتوى" : "Replace in body")
                : (lang === "ar" ? "إدراج في المحتوى" : "Insert into body")}
            </Button>
            {insertedTag && (
              <Button
                type="button"
                variant="ghost"
                onClick={removeInsertedImage}
                data-testid="button-cms-page-image-remove"
              >
                {lang === "ar" ? "إزالة من المحتوى" : "Remove from body"}
              </Button>
            )}
          </div>
        </div>
        <div><Label>{lang === "ar" ? "عنوان SEO" : "SEO Title"}</Label><Input value={form.seoTitle} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} /></div>
        <div><Label>{lang === "ar" ? "وصف SEO" : "SEO Description"}</Label><Textarea value={form.seoDescription} onChange={(e) => setForm({ ...form, seoDescription: e.target.value })} rows={2} /></div>
        <div>
          <Label>{lang === "ar" ? "الحالة" : "Status"}</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Status })}>
            <SelectTrigger data-testid="select-cmspage-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </FormDialog>
    </div>
  );
}

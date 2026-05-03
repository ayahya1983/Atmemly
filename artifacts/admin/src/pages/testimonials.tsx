import { useState } from "react";
import { useAdminGet, useAdminMutation, adminApi } from "@/lib/api-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/lib/permissions";
import { Plus, Pencil, Trash2, Star } from "lucide-react";
import {
  DataTable, type Column, PageHeader, FilterBar, ConfirmActionDialog, FormDialog,
} from "@/components/admin";

interface TestiRow {
  id: number; locale: string; authorName: string; authorTitle: string | null;
  role: string | null; company: string | null; location: string | null;
  quoteAr: string | null; quoteEn: string | null;
  body: string; rating: number; avatarUrl: string | null; isFeatured: boolean; sortOrder: number;
}
interface TestiForm {
  locale: "en" | "ar"; authorName: string; authorTitle: string;
  role: string; company: string; location: string;
  quoteAr: string; quoteEn: string;
  body: string; rating: number; avatarUrl: string; isFeatured: boolean; sortOrder: number;
}
const emptyForm: TestiForm = {
  locale: "en", authorName: "", authorTitle: "",
  role: "", company: "", location: "",
  quoteAr: "", quoteEn: "",
  body: "",
  rating: 5, avatarUrl: "", isFeatured: false, sortOrder: 0,
};

export default function AdminTestimonials() {
  const { lang } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const canWrite = hasPermission(user, "testimonials", "write");
  const canDelete = hasPermission(user, "testimonials", "delete");

  const key = ["admin-testimonials"];
  const { data, isLoading } = useAdminGet<TestiRow[]>(key, "/admin/testimonials");

  const [search, setSearch] = useState("");
  const [localeFilter, setLocaleFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TestiRow | null>(null);
  const [form, setForm] = useState<TestiForm>(emptyForm);

  const formToBody = (f: TestiForm) => ({
    ...f,
    authorTitle: f.authorTitle || null,
    avatarUrl: f.avatarUrl || null,
    role: f.role || null,
    company: f.company || null,
    location: f.location || null,
    quoteAr: f.quoteAr || null,
    quoteEn: f.quoteEn || null,
    // body is auto-derived from the locale-appropriate quote when bilingual
    // values are supplied; we still send it for back-compat with old readers.
    body: f.body || (f.locale === "ar" ? f.quoteAr : f.quoteEn) || f.quoteEn || f.quoteAr || "",
  });
  const createMutation = useAdminMutation<TestiForm>((f) => adminApi.post("/admin/testimonials", formToBody(f)), [key, ["public-testimonials"]]);
  const updateMutation = useAdminMutation<{ id: number; data: TestiForm }>(
    ({ id, data }) => adminApi.patch(`/admin/testimonials/${id}`, formToBody(data)), [key, ["public-testimonials"]],
  );
  const deleteMutation = useAdminMutation<{ id: number }>(({ id }) => adminApi.del(`/admin/testimonials/${id}`), [key, ["public-testimonials"]]);

  const startCreate = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const startEdit = (r: TestiRow) => {
    setEditing(r);
    setForm({
      locale: r.locale as "en" | "ar", authorName: r.authorName, authorTitle: r.authorTitle ?? "",
      role: r.role ?? "", company: r.company ?? "", location: r.location ?? "",
      quoteAr: r.quoteAr ?? "", quoteEn: r.quoteEn ?? "",
      body: r.body, rating: r.rating, avatarUrl: r.avatarUrl ?? "",
      isFeatured: r.isFeatured, sortOrder: r.sortOrder,
    });
    setOpen(true);
  };
  const save = async () => {
    if (editing) await updateMutation.mutateAsync({ id: editing.id, data: form });
    else await createMutation.mutateAsync(form);
  };

  const filtered = (data ?? []).filter((t) => localeFilter === "all" || t.locale === localeFilter);

  const columns: Column<TestiRow>[] = [
    {
      key: "authorName",
      header: lang === "ar" ? "المؤلف" : "Author",
      cell: (t) => (
        <div>
          <div className="font-medium">{t.authorName}</div>
          {t.authorTitle && <div className="text-xs text-muted-foreground">{t.authorTitle}</div>}
        </div>
      ),
      sortValue: (t) => t.authorName,
      searchValue: (t) => `${t.authorName} ${t.authorTitle ?? ""}`,
    },
    {
      key: "locale",
      header: lang === "ar" ? "اللغة" : "Locale",
      cell: (t) => <Badge variant="outline" className="uppercase">{t.locale}</Badge>,
      sortValue: (t) => t.locale,
    },
    {
      key: "rating",
      header: lang === "ar" ? "التقييم" : "Rating",
      cell: (t) => (
        <div className="flex items-center gap-0.5">
          {Array(t.rating).fill(0).map((_, i) => <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />)}
        </div>
      ),
      sortValue: (t) => t.rating,
    },
    {
      key: "body",
      header: lang === "ar" ? "النص" : "Body",
      cell: (t) => <span className="block max-w-md truncate text-sm text-muted-foreground">{t.body}</span>,
      searchValue: (t) => t.body,
    },
    {
      key: "isFeatured",
      header: lang === "ar" ? "مميز" : "Featured",
      cell: (t) => t.isFeatured ? <Badge>★</Badge> : <span className="text-muted-foreground">—</span>,
      sortValue: (t) => (t.isFeatured ? 1 : 0),
    },
    {
      key: "sortOrder",
      header: lang === "ar" ? "ترتيب" : "Order",
      align: "end",
      cell: (t) => <span className="tabular-nums text-xs">{t.sortOrder}</span>,
      sortValue: (t) => t.sortOrder,
    },
    {
      key: "actions",
      header: lang === "ar" ? "إجراءات" : "Actions",
      align: "end",
      cell: (t) => (
        <div className="flex gap-1 justify-end">
          {canWrite && (
            <Button size="sm" variant="outline" onClick={() => startEdit(t)} data-testid={`button-edit-${t.id}`}>
              <Pencil className="w-3 h-3" />
            </Button>
          )}
          {canDelete && (
            <ConfirmActionDialog
              trigger={<Button size="sm" variant="destructive" data-testid={`button-delete-${t.id}`}><Trash2 className="w-3 h-3" /></Button>}
              title={lang === "ar" ? "حذف الرأي؟" : "Delete testimonial?"}
              description={t.authorName}
              destructive
              successMessage={lang === "ar" ? "تم الحذف" : "Deleted"}
              onConfirm={() => deleteMutation.mutateAsync({ id: t.id })}
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title={lang === "ar" ? "آراء العملاء" : "Testimonials"}
        actions={canWrite ? (
          <Button onClick={startCreate} data-testid="button-new-testimonial">
            <Plus className="w-4 h-4 ltr:mr-1 rtl:ml-1" />{lang === "ar" ? "إضافة" : "New"}
          </Button>
        ) : undefined}
      />
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={lang === "ar" ? "بحث بالمؤلف أو النص" : "Search author or body"}
        onReset={() => { setSearch(""); setLocaleFilter("all"); }}
      >
        <select value={localeFilter} onChange={(e) => setLocaleFilter(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="all">{lang === "ar" ? "كل اللغات" : "All locales"}</option>
          <option value="en">English</option>
          <option value="ar">العربية</option>
        </select>
      </FilterBar>
      <DataTable
        data={filtered}
        columns={columns}
        rowKey={(t) => t.id}
        isLoading={isLoading}
        search={search}
        emptyTitle={lang === "ar" ? "لا آراء" : "No testimonials"}
        csvFilename="testimonials.csv"
      />

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? (lang === "ar" ? "تعديل رأي" : "Edit Testimonial") : (lang === "ar" ? "رأي جديد" : "New Testimonial")}
        size="md"
        successMessage={lang === "ar" ? "تم الحفظ" : "Saved"}
        onSubmit={save}
      >
        <div className="grid grid-cols-2 gap-3">
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
          <div>
            <Label>{lang === "ar" ? "التقييم (1-5)" : "Rating (1-5)"}</Label>
            <Input type="number" min={1} max={5} value={form.rating} onChange={(e) => setForm({ ...form, rating: Math.max(1, Math.min(5, Number(e.target.value) || 5)) })} />
          </div>
        </div>
        <div><Label>{lang === "ar" ? "الاسم" : "Author Name"}</Label><Input value={form.authorName} onChange={(e) => setForm({ ...form, authorName: e.target.value })} /></div>
        <div><Label>{lang === "ar" ? "المسمى الوظيفي (قديم)" : "Author Title (legacy)"}</Label><Input value={form.authorTitle} onChange={(e) => setForm({ ...form, authorTitle: e.target.value })} /></div>
        <div className="grid grid-cols-3 gap-3">
          <div><Label>{lang === "ar" ? "الدور" : "Role"}</Label><Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} /></div>
          <div><Label>{lang === "ar" ? "الشركة" : "Company"}</Label><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
          <div><Label>{lang === "ar" ? "الموقع" : "Location"}</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>{lang === "ar" ? "الاقتباس (عربي)" : "Quote (Arabic)"}</Label><Textarea dir="rtl" value={form.quoteAr} onChange={(e) => setForm({ ...form, quoteAr: e.target.value })} rows={3} /></div>
          <div><Label>{lang === "ar" ? "الاقتباس (إنجليزي)" : "Quote (English)"}</Label><Textarea value={form.quoteEn} onChange={(e) => setForm({ ...form, quoteEn: e.target.value })} rows={3} /></div>
        </div>
        <div><Label>{lang === "ar" ? "النص الموحد (قديم)" : "Body (legacy single-locale)"}</Label><Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={2} /></div>
        <div><Label>{lang === "ar" ? "صورة (URL)" : "Avatar URL"}</Label><Input value={form.avatarUrl} onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3 items-end">
          <div><Label>Sort Order</Label><Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })} /></div>
          <div className="flex items-center gap-2 pb-2">
            <Switch checked={form.isFeatured} onCheckedChange={(c) => setForm({ ...form, isFeatured: c })} id="ft" />
            <Label htmlFor="ft">{lang === "ar" ? "مميز" : "Featured"}</Label>
          </div>
        </div>
      </FormDialog>
    </div>
  );
}

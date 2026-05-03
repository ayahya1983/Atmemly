import { useMemo, useState } from "react";
import { useAdminGet, useAdminMutation, adminApi } from "@/lib/api-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/lib/permissions";
import { Plus, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import {
  DataTable, type Column, PageHeader, FilterBar, ConfirmActionDialog, FormDialog,
} from "@/components/admin";

interface FaqRow {
  id: number; locale: string; category: string; categoryId: number | null;
  question: string; answer: string; sortOrder: number; isActive: boolean;
  updatedAt?: string;
}
interface FaqCatRow { id: number; nameAr: string; nameEn: string; slug: string; isActive: boolean; sortOrder: number }

interface Form {
  locale: "ar" | "en"; categoryId: number | null; category: string;
  question: string; answer: string;
  sortOrder: number; isActive: boolean;
}
const empty: Form = {
  locale: "ar", categoryId: null, category: "general",
  question: "", answer: "", sortOrder: 0, isActive: true,
};

export default function AdminCmsFaq() {
  const { lang } = useTranslation();
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const { user } = useAuth();
  const canWrite = hasPermission(user, "faqs", "write");
  const canDelete = hasPermission(user, "faqs", "delete");

  const key = ["admin-faqs"];
  const { data, isLoading } = useAdminGet<FaqRow[]>(key, "/admin/faqs");
  const { data: faqCats } = useAdminGet<FaqCatRow[]>(["admin-faq-categories"], "/admin/faq/categories");

  const [search, setSearch] = useState("");
  const [localeFilter, setLocaleFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FaqRow | null>(null);
  const [form, setForm] = useState<Form>(empty);

  const create = useAdminMutation<Form>(
    (input) => adminApi.post("/admin/faqs", { ...input, category: input.category || "general" }),
    [key, ["public-faqs"]],
  );
  const update = useAdminMutation<{ id: number; data: Form }>(
    ({ id, data }) => adminApi.patch(`/admin/faqs/${id}`, { ...data, category: data.category || "general" }),
    [key, ["public-faqs"]],
  );
  const toggleActive = useAdminMutation<{ id: number; isActive: boolean }>(
    ({ id, isActive }) => adminApi.patch(`/admin/faqs/${id}`, { isActive }),
    [key, ["public-faqs"]],
  );
  const del = useAdminMutation<{ id: number }>(({ id }) => adminApi.del(`/admin/faqs/${id}`), [key, ["public-faqs"]]);

  const startCreate = () => { setEditing(null); setForm(empty); setOpen(true); };
  const startEdit = (r: FaqRow) => {
    setEditing(r);
    setForm({
      locale: (r.locale as "ar" | "en") ?? "ar",
      categoryId: r.categoryId ?? null,
      category: r.category ?? "general",
      question: r.question,
      answer: r.answer,
      sortOrder: r.sortOrder,
      isActive: r.isActive,
    });
    setOpen(true);
  };
  const save = async () => {
    if (editing) await update.mutateAsync({ id: editing.id, data: form });
    else await create.mutateAsync(form);
  };

  const filtered = useMemo(() => (data ?? []).filter((f) => {
    if (localeFilter !== "all" && f.locale !== localeFilter) return false;
    if (activeFilter !== "all" && (activeFilter === "active" ? !f.isActive : f.isActive)) return false;
    if (categoryFilter !== "all") {
      if (categoryFilter.startsWith("id:")) {
        if (String(f.categoryId ?? "") !== categoryFilter.slice(3)) return false;
      } else if (f.category !== categoryFilter) return false;
    }
    return true;
  }), [data, localeFilter, activeFilter, categoryFilter]);

  const categoryLabel = (f: FaqRow): string => {
    if (f.categoryId) {
      const c = faqCats?.find((x) => x.id === f.categoryId);
      if (c) return lang === "ar" ? c.nameAr : c.nameEn;
    }
    return f.category;
  };

  const dirInput = form.locale === "ar" ? "rtl" : "ltr";

  const columns: Column<FaqRow>[] = [
    {
      key: "question",
      header: t("السؤال", "Question"),
      cell: (f) => (
        <div className="min-w-0">
          <div className="font-medium truncate max-w-md" dir={f.locale === "ar" ? "rtl" : "ltr"}>{f.question}</div>
          <div className="text-xs text-muted-foreground truncate max-w-md" dir={f.locale === "ar" ? "rtl" : "ltr"}>{f.answer}</div>
        </div>
      ),
      sortValue: (f) => f.question,
      searchValue: (f) => `${f.question} ${f.answer}`,
    },
    {
      key: "category",
      header: t("الفئة", "Category"),
      cell: (f) => <Badge variant="outline" className="capitalize">{categoryLabel(f)}</Badge>,
      sortValue: (f) => categoryLabel(f),
    },
    {
      key: "locale",
      header: t("اللغة", "Locale"),
      cell: (f) => <Badge variant="outline" className="uppercase">{f.locale}</Badge>,
      sortValue: (f) => f.locale,
    },
    {
      key: "sortOrder",
      header: t("الترتيب", "Order"),
      align: "end",
      cell: (f) => <span className="tabular-nums text-xs">{f.sortOrder}</span>,
      sortValue: (f) => f.sortOrder,
    },
    {
      key: "isActive",
      header: t("الحالة", "Active"),
      cell: (f) => f.isActive ? <Badge>Active</Badge> : <Badge variant="outline">Off</Badge>,
      sortValue: (f) => (f.isActive ? 1 : 0),
    },
    {
      key: "actions",
      header: t("إجراءات", "Actions"),
      align: "end",
      cell: (f) => (
        <div className="flex gap-1 justify-end">
          {canWrite && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => toggleActive.mutateAsync({ id: f.id, isActive: !f.isActive })}
              title={f.isActive ? t("إلغاء التفعيل", "Disable") : t("تفعيل", "Enable")}
              data-testid={`button-toggle-active-${f.id}`}
            >
              {f.isActive ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            </Button>
          )}
          {canWrite && (
            <Button size="sm" variant="outline" onClick={() => startEdit(f)} data-testid={`button-edit-${f.id}`}>
              <Pencil className="w-3 h-3" />
            </Button>
          )}
          {canDelete && (
            <ConfirmActionDialog
              trigger={<Button size="sm" variant="destructive" data-testid={`button-delete-${f.id}`}><Trash2 className="w-3 h-3" /></Button>}
              title={t("حذف السؤال؟", "Delete FAQ?")}
              description={f.question}
              destructive
              successMessage={t("تم الحذف", "Deleted")}
              onConfirm={() => del.mutateAsync({ id: f.id })}
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("الأسئلة الشائعة", "FAQ items")}
        description={t("إدارة الأسئلة الشائعة بكلتا اللغتين، تفعيلها أو حذفها.", "Manage bilingual FAQ items, toggle visibility, soft-delete.")}
        actions={canWrite ? (
          <Button onClick={startCreate} data-testid="button-new-faq">
            <Plus className="w-4 h-4 ltr:mr-1 rtl:ml-1" />{t("سؤال جديد", "New FAQ")}
          </Button>
        ) : undefined}
      />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={t("بحث في السؤال أو الإجابة", "Search question or answer")}
        onReset={() => { setSearch(""); setLocaleFilter("all"); setActiveFilter("all"); setCategoryFilter("all"); }}
      >
        <select
          value={localeFilter}
          onChange={(e) => setLocaleFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          data-testid="select-faq-locale-filter"
        >
          <option value="all">{t("كل اللغات", "All locales")}</option>
          <option value="ar">العربية</option>
          <option value="en">English</option>
        </select>
        <select
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          data-testid="select-faq-active-filter"
        >
          <option value="all">{t("الكل", "All")}</option>
          <option value="active">Active</option>
          <option value="off">Off</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          data-testid="select-faq-category-filter"
        >
          <option value="all">{t("كل الفئات", "All categories")}</option>
          {(faqCats ?? []).filter((c) => c.isActive).map((c) => (
            <option key={c.id} value={`id:${c.id}`}>{lang === "ar" ? c.nameAr : c.nameEn}</option>
          ))}
        </select>
      </FilterBar>

      <DataTable
        data={filtered}
        columns={columns}
        rowKey={(f) => f.id}
        isLoading={isLoading}
        search={search}
        emptyTitle={t("لا أسئلة", "No FAQs")}
        csvFilename="faqs.csv"
      />

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? t("تعديل سؤال", "Edit FAQ") : t("سؤال جديد", "New FAQ")}
        size="lg"
        successMessage={t("تم الحفظ", "Saved")}
        onSubmit={save}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
          <div>
            <Label>{t("الفئة", "Category")}</Label>
            <Select
              value={form.categoryId ? `id:${form.categoryId}` : "__legacy__"}
              onValueChange={(v) => {
                if (v === "__legacy__") {
                  setForm({ ...form, categoryId: null });
                } else {
                  const cid = Number(v.slice(3));
                  const cat = (faqCats ?? []).find((c) => c.id === cid);
                  setForm({ ...form, categoryId: cid, category: cat?.slug ?? form.category });
                }
              }}
            >
              <SelectTrigger data-testid="select-category"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__legacy__">{t(`(نص حر: ${form.category})`, `(legacy text: ${form.category})`)}</SelectItem>
                {(faqCats ?? []).filter((c) => c.isActive).sort((a, b) => a.sortOrder - b.sortOrder).map((c) => (
                  <SelectItem key={c.id} value={`id:${c.id}`}>{lang === "ar" ? c.nameAr : c.nameEn}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.categoryId === null && (
              <Input
                className="mt-1"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder={t("نص الفئة", "category text")}
                data-testid="input-category-text"
              />
            )}
          </div>
        </div>
        <div>
          <Label>{t("السؤال", "Question")}</Label>
          <Input
            value={form.question}
            dir={dirInput}
            onChange={(e) => setForm({ ...form, question: e.target.value })}
            data-testid="input-question"
          />
        </div>
        <div>
          <Label>{t("الإجابة", "Answer")}</Label>
          <Textarea
            value={form.answer}
            dir={dirInput}
            rows={6}
            onChange={(e) => setForm({ ...form, answer: e.target.value })}
            data-testid="input-answer"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            {t("يدعم HTML آمن أو نص عادي.", "Sanitized HTML or plain text.")}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 items-end">
          <div>
            <Label>{t("الترتيب", "Sort order")}</Label>
            <Input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })}
              data-testid="input-sort-order"
            />
          </div>
          <div className="flex items-center gap-2 pb-2">
            <Switch
              id="faq-active"
              checked={form.isActive}
              onCheckedChange={(c) => setForm({ ...form, isActive: c })}
              data-testid="switch-active"
            />
            <Label htmlFor="faq-active">{t("نشط", "Active")}</Label>
          </div>
        </div>
      </FormDialog>
    </div>
  );
}

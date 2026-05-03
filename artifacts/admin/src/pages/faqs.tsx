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
  DataTable, type Column, PageHeader, FilterBar, ConfirmActionDialog, FormDialog,
} from "@/components/admin";

interface FaqRow {
  id: number; locale: string; category: string;
  question: string; answer: string; sortOrder: number; isActive: boolean;
}
interface FaqForm {
  locale: "en" | "ar"; category: string; question: string; answer: string;
  sortOrder: number; isActive: boolean;
}
const emptyForm: FaqForm = { locale: "en", category: "general", question: "", answer: "", sortOrder: 0, isActive: true };

export default function AdminFaqs() {
  const { lang } = useTranslation();
  const { user } = useAuth();
  const canWrite = hasPermission(user, "faqs", "write");
  const canDelete = hasPermission(user, "faqs", "delete");

  const key = ["admin-faqs"];
  const { data, isLoading } = useAdminGet<FaqRow[]>(key, "/admin/faqs");

  const [search, setSearch] = useState("");
  const [localeFilter, setLocaleFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FaqRow | null>(null);
  const [form, setForm] = useState<FaqForm>(emptyForm);

  const createMutation = useAdminMutation<FaqForm>((input) => adminApi.post("/admin/faqs", input), [key, ["public-faqs"]]);
  const updateMutation = useAdminMutation<{ id: number; data: FaqForm }>(
    ({ id, data }) => adminApi.patch(`/admin/faqs/${id}`, data), [key, ["public-faqs"]],
  );
  const deleteMutation = useAdminMutation<{ id: number }>(({ id }) => adminApi.del(`/admin/faqs/${id}`), [key, ["public-faqs"]]);

  const startCreate = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const startEdit = (r: FaqRow) => {
    setEditing(r);
    setForm({ locale: r.locale as "en" | "ar", category: r.category, question: r.question, answer: r.answer, sortOrder: r.sortOrder, isActive: r.isActive });
    setOpen(true);
  };
  const save = async () => {
    if (editing) await updateMutation.mutateAsync({ id: editing.id, data: form });
    else await createMutation.mutateAsync(form);
  };

  const filtered = (data ?? []).filter((f) =>
    (localeFilter === "all" || f.locale === localeFilter) &&
    (activeFilter === "all" || (activeFilter === "active" ? f.isActive : !f.isActive)),
  );

  const columns: Column<FaqRow>[] = [
    {
      key: "question",
      header: lang === "ar" ? "السؤال" : "Question",
      cell: (f) => <span className="font-medium block max-w-md truncate">{f.question}</span>,
      sortValue: (f) => f.question,
      searchValue: (f) => `${f.question} ${f.answer}`,
    },
    {
      key: "category",
      header: lang === "ar" ? "الفئة" : "Category",
      cell: (f) => <Badge variant="outline" className="capitalize">{f.category}</Badge>,
      sortValue: (f) => f.category,
      searchValue: (f) => f.category,
    },
    {
      key: "locale",
      header: lang === "ar" ? "اللغة" : "Locale",
      cell: (f) => <Badge variant="outline" className="uppercase">{f.locale}</Badge>,
      sortValue: (f) => f.locale,
    },
    {
      key: "sortOrder",
      header: lang === "ar" ? "ترتيب" : "Order",
      align: "end",
      cell: (f) => <span className="tabular-nums text-xs">{f.sortOrder}</span>,
      sortValue: (f) => f.sortOrder,
    },
    {
      key: "isActive",
      header: lang === "ar" ? "الحالة" : "Active",
      cell: (f) => f.isActive ? <Badge>Active</Badge> : <Badge variant="outline">Off</Badge>,
      sortValue: (f) => (f.isActive ? 1 : 0),
    },
    {
      key: "actions",
      header: lang === "ar" ? "إجراءات" : "Actions",
      align: "end",
      cell: (f) => (
        <div className="flex gap-1 justify-end">
          {canWrite && (
            <Button size="sm" variant="outline" onClick={() => startEdit(f)} data-testid={`button-edit-${f.id}`}><Pencil className="w-3 h-3" /></Button>
          )}
          {canDelete && (
            <ConfirmActionDialog
              trigger={<Button size="sm" variant="destructive" data-testid={`button-delete-${f.id}`}><Trash2 className="w-3 h-3" /></Button>}
              title={lang === "ar" ? "حذف السؤال؟" : "Delete FAQ?"}
              description={f.question}
              destructive
              successMessage={lang === "ar" ? "تم الحذف" : "Deleted"}
              onConfirm={() => deleteMutation.mutateAsync({ id: f.id })}
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title={lang === "ar" ? "الأسئلة الشائعة" : "FAQs"}
        actions={canWrite ? (
          <Button onClick={startCreate} data-testid="button-new-faq">
            <Plus className="w-4 h-4 ltr:mr-1 rtl:ml-1" />{lang === "ar" ? "سؤال جديد" : "New FAQ"}
          </Button>
        ) : undefined}
      />
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={lang === "ar" ? "بحث في السؤال أو الإجابة" : "Search question or answer"}
        onReset={() => { setSearch(""); setLocaleFilter("all"); setActiveFilter("all"); }}
      >
        <select value={localeFilter} onChange={(e) => setLocaleFilter(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="all">{lang === "ar" ? "كل اللغات" : "All locales"}</option>
          <option value="en">English</option>
          <option value="ar">العربية</option>
        </select>
        <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="all">{lang === "ar" ? "الكل" : "All states"}</option>
          <option value="active">Active</option>
          <option value="off">Off</option>
        </select>
      </FilterBar>
      <DataTable
        data={filtered}
        columns={columns}
        rowKey={(f) => f.id}
        isLoading={isLoading}
        search={search}
        emptyTitle={lang === "ar" ? "لا أسئلة" : "No FAQs"}
        csvFilename="faqs.csv"
      />

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? (lang === "ar" ? "تعديل سؤال" : "Edit FAQ") : (lang === "ar" ? "سؤال جديد" : "New FAQ")}
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
          <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
        </div>
        <div><Label>{lang === "ar" ? "السؤال" : "Question"}</Label><Input value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} /></div>
        <div><Label>{lang === "ar" ? "الإجابة" : "Answer"}</Label><Textarea value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} rows={5} /></div>
        <div className="grid grid-cols-2 gap-3 items-end">
          <div><Label>Sort Order</Label><Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })} /></div>
          <div className="flex items-center gap-2 pb-2">
            <Switch checked={form.isActive} onCheckedChange={(c) => setForm({ ...form, isActive: c })} id="fa" />
            <Label htmlFor="fa">{lang === "ar" ? "نشط" : "Active"}</Label>
          </div>
        </div>
      </FormDialog>
    </div>
  );
}

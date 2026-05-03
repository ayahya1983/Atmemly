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
import { Plus, Pencil } from "lucide-react";
import {
  DataTable, type Column, PageHeader, FilterBar, FormDialog,
} from "@/components/admin";

interface CmsBlockRow {
  id: number; key: string; locale: string;
  title: string | null; body: string; updatedAt: string;
}

interface BlockForm { key: string; locale: "en" | "ar"; title: string; body: string; }
const emptyForm: BlockForm = { key: "", locale: "en", title: "", body: "" };

export default function AdminCmsBlocks() {
  const { lang } = useTranslation();
  const { user } = useAuth();
  const canWrite = hasPermission(user, "cms", "write");

  const queryKey = ["admin-cms-blocks"];
  const { data, isLoading } = useAdminGet<CmsBlockRow[]>(queryKey, "/admin/cms/blocks");

  const [search, setSearch] = useState("");
  const [localeFilter, setLocaleFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<BlockForm>(emptyForm);

  const upsertMutation = useAdminMutation<BlockForm>(
    (input) => adminApi.put("/admin/cms/blocks", { ...input, title: input.title || null }),
    [queryKey, ["public-cms-block"]],
  );

  const startEdit = (b?: CmsBlockRow) => {
    if (b) setForm({ key: b.key, locale: b.locale as "en" | "ar", title: b.title ?? "", body: b.body });
    else setForm(emptyForm);
    setOpen(true);
  };
  const save = async () => { await upsertMutation.mutateAsync(form); };

  const filtered = (data ?? []).filter((b) => localeFilter === "all" || b.locale === localeFilter);

  const columns: Column<CmsBlockRow>[] = [
    {
      key: "key",
      header: lang === "ar" ? "المفتاح" : "Key",
      cell: (b) => <span className="font-mono text-sm">{b.key}</span>,
      sortValue: (b) => b.key,
      searchValue: (b) => b.key,
    },
    {
      key: "locale",
      header: lang === "ar" ? "اللغة" : "Locale",
      cell: (b) => <Badge variant="outline" className="uppercase">{b.locale}</Badge>,
      sortValue: (b) => b.locale,
    },
    {
      key: "title",
      header: lang === "ar" ? "العنوان" : "Title",
      cell: (b) => b.title ?? "—",
      sortValue: (b) => b.title ?? "",
      searchValue: (b) => b.title ?? "",
    },
    {
      key: "updatedAt",
      header: lang === "ar" ? "محدّث" : "Updated",
      cell: (b) => <span className="text-xs text-muted-foreground">{new Date(b.updatedAt).toISOString().slice(0, 10)}</span>,
      sortValue: (b) => new Date(b.updatedAt).getTime(),
    },
    {
      key: "actions",
      header: lang === "ar" ? "إجراءات" : "Actions",
      align: "end",
      cell: (b) => canWrite ? (
        <Button size="sm" variant="outline" onClick={() => startEdit(b)} data-testid={`button-edit-${b.id}`}>
          <Pencil className="w-3 h-3" />
        </Button>
      ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title={lang === "ar" ? "كتل المحتوى" : "CMS Blocks"}
        actions={canWrite ? (
          <Button onClick={() => startEdit()} data-testid="button-new-block">
            <Plus className="w-4 h-4 ltr:mr-1 rtl:ml-1" />{lang === "ar" ? "إضافة" : "New Block"}
          </Button>
        ) : undefined}
      />
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={lang === "ar" ? "بحث المفتاح أو العنوان" : "Search key or title"}
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
        rowKey={(b) => b.id}
        isLoading={isLoading}
        search={search}
        emptyTitle={lang === "ar" ? "لا كتل" : "No blocks"}
        csvFilename="cms-blocks.csv"
      />

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={lang === "ar" ? "كتلة محتوى" : "Content Block"}
        successMessage={lang === "ar" ? "تم الحفظ" : "Saved"}
        onSubmit={save}
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>{lang === "ar" ? "المفتاح" : "Key"}</Label>
            <Input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="hero_title" />
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
        <div><Label>{lang === "ar" ? "المحتوى" : "Body"}</Label><Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={6} /></div>
      </FormDialog>
    </div>
  );
}

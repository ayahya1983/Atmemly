// Admin: header & footer navigation menus.
import { useState } from "react";
import { useAdminGet, useAdminMutation, adminApi } from "@/lib/api-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/lib/permissions";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { DataTable, type Column, PageHeader, FormDialog } from "@/components/admin";

interface NavItem {
  id: number;
  location: "HEADER" | "FOOTER";
  parentId: number | null;
  labelAr: string; labelEn: string;
  href: string;
  sortOrder: number;
  isActive: boolean;
}
interface Form {
  location: "HEADER" | "FOOTER";
  labelAr: string; labelEn: string;
  href: string;
  sortOrder: number;
  isActive: boolean;
}
const empty: Form = { location: "HEADER", labelAr: "", labelEn: "", href: "", sortOrder: 0, isActive: true };

export default function AdminCmsNavigation() {
  const { lang } = useTranslation();
  const { user } = useAuth();
  // Restricted to admin/super_admin (settings:write)
  const canWrite = hasPermission(user, "cms", "write") && hasPermission(user, "settings", "write");
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);

  const queryKey = ["admin-navigation"];
  const { data, isLoading } = useAdminGet<NavItem[]>(queryKey, "/admin/navigation");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<NavItem | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const onDelete = async (id: number) => {
    if (!confirm(t('هل أنت متأكد من الحذف؟', 'Delete this item?'))) return;
    await delMut.mutateAsync(id);
  };

  const mut = useAdminMutation<{ form: Form; id?: number }>(
    ({ form, id }) => id != null
      ? adminApi.patch(`/admin/navigation/${id}`, form)
      : adminApi.post("/admin/navigation", form),
    [queryKey, ["public-navigation"]],
  );
  const delMut = useAdminMutation<number>(
    (id) => adminApi.del(`/admin/navigation/${id}`),
    [queryKey, ["public-navigation"]],
  );

  const startEdit = (n?: NavItem) => {
    if (n) {
      setEditing(n);
      setForm({ location: n.location, labelAr: n.labelAr, labelEn: n.labelEn, href: n.href, sortOrder: n.sortOrder, isActive: n.isActive });
    } else {
      setEditing(null);
      setForm(empty);
    }
    setOpen(true);
  };

  const columns: Column<NavItem>[] = [
    { key: "location", header: t("الموقع", "Location"), cell: (n) => <Badge variant="outline">{n.location}</Badge>, sortValue: (n) => n.location },
    { key: "labelAr", header: t("التسمية (عربي)", "Label (AR)"), cell: (n) => <span dir="rtl">{n.labelAr}</span>, searchValue: (n) => n.labelAr },
    { key: "labelEn", header: t("التسمية (إنجليزي)", "Label (EN)"), cell: (n) => n.labelEn, searchValue: (n) => n.labelEn },
    { key: "href", header: t("الرابط", "Href"), cell: (n) => <code className="text-xs">{n.href}</code>, searchValue: (n) => n.href },
    { key: "sortOrder", header: t("الترتيب", "Order"), cell: (n) => n.sortOrder, sortValue: (n) => n.sortOrder },
    { key: "isActive", header: t("نشط", "Active"), cell: (n) => n.isActive ? "✓" : "—" },
    { key: "actions", header: "", cell: (n) => (
      <div className="flex gap-2 justify-end">
        {canWrite && <Button size="sm" variant="ghost" onClick={() => startEdit(n)} data-testid={`button-edit-nav-${n.id}`}><Pencil className="w-4 h-4" /></Button>}
        {canWrite && <Button size="sm" variant="ghost" onClick={() => onDelete(n.id)} data-testid={`button-delete-nav-${n.id}`}><Trash2 className="w-4 h-4 text-destructive" /></Button>}
      </div>
    ) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("التنقل", "Navigation")}
        description={t("قوائم الرأس والتذييل للسوق", "Header & footer menus")}
        actions={canWrite ? <Button onClick={() => startEdit()} data-testid="button-add-nav"><Plus className="w-4 h-4" /><span className="mx-2">{t("إضافة", "Add")}</span></Button> : null}
      />
      <DataTable data={data ?? []} columns={columns} isLoading={isLoading} rowKey={(n) => n.id}  />

      <FormDialog
        open={open} onOpenChange={setOpen}
        title={editing ? t("تعديل عنصر", "Edit item") : t("عنصر جديد", "New item")}
        onSubmit={async () => { await mut.mutateAsync({ form, id: editing?.id }); }}
        successMessage={t("تم الحفظ", "Saved")}
      >
        <div className="grid gap-3">
          <div><Label>{t("الموقع", "Location")}</Label>
            <Select value={form.location} onValueChange={(v) => setForm({ ...form, location: v as "HEADER" | "FOOTER" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="HEADER">HEADER</SelectItem>
                <SelectItem value="FOOTER">FOOTER</SelectItem>
              </SelectContent>
            </Select></div>
          <div><Label>{t("التسمية (عربي)", "Label (Arabic)")}</Label>
            <Input dir="rtl" value={form.labelAr} onChange={(e) => setForm({ ...form, labelAr: e.target.value })} data-testid="input-nav-label-ar" /></div>
          <div><Label>{t("التسمية (إنجليزي)", "Label (English)")}</Label>
            <Input value={form.labelEn} onChange={(e) => setForm({ ...form, labelEn: e.target.value })} data-testid="input-nav-label-en" /></div>
          <div><Label>{t("الرابط", "Href")}</Label>
            <Input value={form.href} onChange={(e) => setForm({ ...form, href: e.target.value })} placeholder="/services" data-testid="input-nav-href" /></div>
          <div><Label>{t("الترتيب", "Sort order")}</Label>
            <Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })} /></div>
          <div className="flex items-center gap-2">
            <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
            <Label>{t("نشط", "Active")}</Label>
          </div>
        </div>
      </FormDialog>

    </div>
  );
}

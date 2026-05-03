import { useState } from "react";
import { useAdminGet, useAdminMutation, adminApi } from "@/lib/api-admin";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/lib/permissions";
import { format } from "date-fns";
import { Pencil } from "lucide-react";
import {
  DataTable, type Column, PageHeader, FilterBar, FormDialog,
} from "@/components/admin";

interface SettingRow {
  key: string;
  value: unknown;
  isPublic: boolean;
  description: string | null;
  updatedAt: string;
}

export default function AdminSettings() {
  const { lang } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const canWrite = hasPermission(user, "settings", "write");

  const queryKey = ["admin-settings"];
  const { data, isLoading } = useAdminGet<SettingRow[]>(queryKey, "/admin/settings");

  const [search, setSearch] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [editing, setEditing] = useState<SettingRow | null>(null);
  const [valueText, setValueText] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [description, setDescription] = useState("");

  const updateMutation = useAdminMutation<{ key: string; body: { value: unknown; isPublic?: boolean; description?: string } }>(
    ({ key, body }) => adminApi.put(`/admin/settings/${key}`, body), [queryKey],
  );

  const startEdit = (s: SettingRow) => {
    setEditing(s);
    setValueText(JSON.stringify(s.value, null, 2));
    setIsPublic(s.isPublic);
    setDescription(s.description ?? "");
  };

  const save = async () => {
    if (!editing) return;
    let parsed: unknown;
    try { parsed = JSON.parse(valueText); }
    catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ variant: "destructive", title: lang === "ar" ? "JSON غير صالح" : "Invalid JSON", description: msg });
      throw e;
    }
    await updateMutation.mutateAsync({
      key: editing.key,
      body: { value: parsed, isPublic, description },
    });
  };

  const filtered = (data ?? []).filter((s) =>
    visibilityFilter === "all" || (visibilityFilter === "public" ? s.isPublic : !s.isPublic),
  );

  const columns: Column<SettingRow>[] = [
    {
      key: "key",
      header: lang === "ar" ? "المفتاح" : "Key",
      cell: (s) => <span className="font-mono text-sm">{s.key}</span>,
      sortValue: (s) => s.key,
      searchValue: (s) => s.key,
    },
    {
      key: "value",
      header: lang === "ar" ? "القيمة" : "Value",
      cell: (s) => <code className="text-xs bg-muted px-1.5 py-0.5 rounded max-w-xs truncate inline-block">{JSON.stringify(s.value)}</code>,
      searchValue: (s) => JSON.stringify(s.value),
    },
    {
      key: "isPublic",
      header: lang === "ar" ? "عام" : "Public",
      cell: (s) => s.isPublic ? <Badge>Public</Badge> : <Badge variant="outline">Private</Badge>,
      sortValue: (s) => (s.isPublic ? 1 : 0),
    },
    {
      key: "description",
      header: lang === "ar" ? "الوصف" : "Description",
      cell: (s) => <span className="text-sm text-muted-foreground max-w-xs truncate inline-block">{s.description ?? "—"}</span>,
      searchValue: (s) => s.description ?? "",
    },
    {
      key: "updatedAt",
      header: lang === "ar" ? "محدّث" : "Updated",
      cell: (s) => <span className="text-xs text-muted-foreground">{format(new Date(s.updatedAt), "yyyy-MM-dd HH:mm")}</span>,
      sortValue: (s) => new Date(s.updatedAt).getTime(),
    },
    {
      key: "actions",
      header: "",
      align: "end",
      cell: (s) => canWrite ? (
        <Button size="sm" variant="outline" onClick={() => startEdit(s)} data-testid={`button-edit-${s.key}`}>
          <Pencil className="w-3 h-3" />
        </Button>
      ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title={lang === "ar" ? "إعدادات المنصة" : "Platform Settings"} />
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={lang === "ar" ? "بحث بالمفتاح أو القيمة" : "Search key or value"}
        onReset={() => { setSearch(""); setVisibilityFilter("all"); }}
      >
        <select value={visibilityFilter} onChange={(e) => setVisibilityFilter(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="all">{lang === "ar" ? "الكل" : "All visibility"}</option>
          <option value="public">Public</option>
          <option value="private">Private</option>
        </select>
      </FilterBar>
      <DataTable
        data={filtered}
        columns={columns}
        rowKey={(s) => s.key}
        isLoading={isLoading}
        search={search}
        emptyTitle={lang === "ar" ? "لا إعدادات" : "No settings"}
        csvFilename="settings.csv"
      />

      <FormDialog
        open={!!editing}
        onOpenChange={(o) => { if (!o) setEditing(null); }}
        title={`${lang === "ar" ? "تعديل" : "Edit"}: ${editing?.key ?? ""}`}
        successMessage={lang === "ar" ? "تم الحفظ" : "Saved"}
        onSubmit={save}
      >
        <div>
          <Label>{lang === "ar" ? "القيمة (JSON)" : "Value (JSON)"}</Label>
          <Textarea value={valueText} onChange={(e) => setValueText(e.target.value)} rows={6} className="font-mono text-sm" />
        </div>
        <div>
          <Label>{lang === "ar" ? "الوصف" : "Description"}</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={isPublic} onCheckedChange={setIsPublic} id="pub" />
          <Label htmlFor="pub">{lang === "ar" ? "متاح للعامة (API: /settings/public)" : "Public (exposed via /settings/public)"}</Label>
        </div>
      </FormDialog>
    </div>
  );
}

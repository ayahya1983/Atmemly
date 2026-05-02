import { useState } from "react";
import { useAdminGet, useAdminMutation, adminApi } from "@/lib/api-admin";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";
import { format } from "date-fns";
import { Pencil } from "lucide-react";

interface SettingRow {
  key: string;
  value: unknown;
  isPublic: boolean;
  description: string | null;
  updatedAt: string;
}

export default function AdminSettings() {
  const { lang } = useTranslation();
  const { toast } = useToast();
  const queryKey = ["admin-settings"];
  const { data, isLoading } = useAdminGet<SettingRow[]>(queryKey, "/admin/settings");

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

  const save = () => {
    if (!editing) return;
    let parsed: unknown;
    try { parsed = JSON.parse(valueText); }
    catch (e: any) { toast({ variant: "destructive", title: lang === "ar" ? "JSON غير صالح" : "Invalid JSON", description: e.message }); return; }
    updateMutation.mutate({
      key: editing.key,
      body: { value: parsed, isPublic, description },
    }, {
      onSuccess: () => { toast({ title: lang === "ar" ? "تم الحفظ" : "Saved" }); setEditing(null); },
      onError: (e) => toast({ variant: "destructive", title: "Error", description: e.message }),
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{lang === "ar" ? "إعدادات المنصة" : "Platform Settings"}</h1>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{lang === "ar" ? "المفتاح" : "Key"}</TableHead>
              <TableHead>{lang === "ar" ? "القيمة" : "Value"}</TableHead>
              <TableHead>{lang === "ar" ? "عام" : "Public"}</TableHead>
              <TableHead>{lang === "ar" ? "الوصف" : "Description"}</TableHead>
              <TableHead>{lang === "ar" ? "محدّث" : "Updated"}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={6}><Skeleton className="h-8" /></TableCell></TableRow>
              : !data?.length ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{lang === "ar" ? "لا إعدادات" : "No settings"}</TableCell></TableRow>
              : data.map((s) => (
                <TableRow key={s.key}>
                  <TableCell className="font-mono text-sm">{s.key}</TableCell>
                  <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded max-w-xs truncate inline-block">{JSON.stringify(s.value)}</code></TableCell>
                  <TableCell>{s.isPublic ? <Badge>Public</Badge> : <Badge variant="outline">Private</Badge>}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{s.description ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(s.updatedAt), "yyyy-MM-dd HH:mm")}</TableCell>
                  <TableCell><Button size="sm" variant="outline" onClick={() => startEdit(s)}><Pencil className="w-3 h-3" /></Button></TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{lang === "ar" ? "تعديل" : "Edit"} <code className="text-sm">{editing?.key}</code></DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>{lang === "ar" ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={save} disabled={updateMutation.isPending}>{lang === "ar" ? "حفظ" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState } from "react";
import { PageHeader } from "@/components/admin";
import { useAdminGet, useAdminMutation, adminApi } from "@/lib/api-admin";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";
import { Plus, Pencil } from "lucide-react";

interface CmsBlockRow {
  id: number; key: string; locale: string;
  title: string | null; body: string; updatedAt: string;
}

interface BlockForm { key: string; locale: "en" | "ar"; title: string; body: string; }
const emptyForm: BlockForm = { key: "", locale: "en", title: "", body: "" };

export default function AdminCmsBlocks() {
  const { lang } = useTranslation();
  const { toast } = useToast();
  const queryKey = ["admin-cms-blocks"];
  const { data, isLoading } = useAdminGet<CmsBlockRow[]>(queryKey, "/admin/cms/blocks");

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title={lang === "ar" ? "كتل المحتوى" : "CMS Blocks"} />
        <Button onClick={() => startEdit()}><Plus className="w-4 h-4 mr-1" />{lang === "ar" ? "إضافة" : "New Block"}</Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{lang === "ar" ? "المفتاح" : "Key"}</TableHead>
              <TableHead>{lang === "ar" ? "اللغة" : "Locale"}</TableHead>
              <TableHead>{lang === "ar" ? "العنوان" : "Title"}</TableHead>
              <TableHead>{lang === "ar" ? "إجراءات" : "Actions"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={4}><Skeleton className="h-8" /></TableCell></TableRow>
              : !data?.length ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">{lang === "ar" ? "لا كتل" : "No blocks"}</TableCell></TableRow>
              : data.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono text-sm">{b.key}</TableCell>
                  <TableCell><Badge variant="outline" className="uppercase">{b.locale}</Badge></TableCell>
                  <TableCell>{b.title ?? "—"}</TableCell>
                  <TableCell><Button size="sm" variant="outline" onClick={() => startEdit(b)}><Pencil className="w-3 h-3" /></Button></TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{lang === "ar" ? "كتلة محتوى" : "Content Block"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{lang === "ar" ? "المفتاح" : "Key"}</Label>
                <Input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="hero_title" />
              </div>
              <div>
                <Label>{lang === "ar" ? "اللغة" : "Locale"}</Label>
                <Select value={form.locale} onValueChange={(v) => setForm({ ...form, locale: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ar">العربية</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{lang === "ar" ? "العنوان" : "Title"}</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>{lang === "ar" ? "المحتوى" : "Body"}</Label>
              <Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={6} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{lang === "ar" ? "إلغاء" : "Cancel"}</Button>
            <Button disabled={upsertMutation.isPending} onClick={() => upsertMutation.mutate(form, {
              onSuccess: () => { toast({ title: lang === "ar" ? "تم الحفظ" : "Saved" }); setOpen(false); },
              onError: (e) => toast({ variant: "destructive", title: "Error", description: e.message }),
            })}>{lang === "ar" ? "حفظ" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

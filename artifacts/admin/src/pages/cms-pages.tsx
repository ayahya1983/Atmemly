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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface CmsPageRow {
  id: number; slug: string; locale: string; title: string;
  body: string; seoTitle: string | null; seoDescription: string | null;
  isPublished: boolean; updatedAt: string;
}

interface PageForm {
  slug: string; locale: "en" | "ar"; title: string; body: string;
  seoTitle: string; seoDescription: string; isPublished: boolean;
}

const emptyForm: PageForm = {
  slug: "", locale: "en", title: "", body: "", seoTitle: "", seoDescription: "", isPublished: false,
};

export default function AdminCmsPages() {
  const { lang } = useTranslation();
  const { toast } = useToast();
  const key = ["admin-cms-pages"];
  const { data, isLoading } = useAdminGet<CmsPageRow[]>(key, "/admin/cms/pages");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CmsPageRow | null>(null);
  const [form, setForm] = useState<PageForm>(emptyForm);

  const createMutation = useAdminMutation<PageForm>(
    (input) => adminApi.post("/admin/cms/pages", { ...input, seoTitle: input.seoTitle || null, seoDescription: input.seoDescription || null }),
    [key, ["public-cms-page"]],
  );
  const updateMutation = useAdminMutation<{ id: number; data: Partial<PageForm> }>(
    ({ id, data }) => adminApi.patch(`/admin/cms/pages/${id}`, data),
    [key, ["public-cms-page"]],
  );
  const deleteMutation = useAdminMutation<{ id: number }>(
    ({ id }) => adminApi.del(`/admin/cms/pages/${id}`),
    [key, ["public-cms-page"]],
  );

  const startCreate = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const startEdit = (row: CmsPageRow) => {
    setEditing(row);
    setForm({
      slug: row.slug, locale: row.locale as "en" | "ar", title: row.title, body: row.body,
      seoTitle: row.seoTitle ?? "", seoDescription: row.seoDescription ?? "", isPublished: row.isPublished,
    });
    setOpen(true);
  };
  const handleSave = () => {
    const cb = {
      onSuccess: () => { toast({ title: lang === "ar" ? "تم الحفظ" : "Saved" }); setOpen(false); },
      onError: (e: any) => toast({ variant: "destructive", title: "Error", description: e.message }),
    };
    if (editing) updateMutation.mutate({ id: editing.id, data: form }, cb);
    else createMutation.mutate(form, cb);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title={lang === "ar" ? "صفحات المحتوى" : "CMS Pages"} />
        <Button onClick={startCreate}><Plus className="w-4 h-4 mr-1" />{lang === "ar" ? "إضافة" : "New Page"}</Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{lang === "ar" ? "العنوان" : "Title"}</TableHead>
              <TableHead>{lang === "ar" ? "المعرف" : "Slug"}</TableHead>
              <TableHead>{lang === "ar" ? "اللغة" : "Locale"}</TableHead>
              <TableHead>{lang === "ar" ? "النشر" : "Published"}</TableHead>
              <TableHead>{lang === "ar" ? "إجراءات" : "Actions"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5}><Skeleton className="h-8" /></TableCell></TableRow>
            ) : !data?.length ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{lang === "ar" ? "لا صفحات" : "No pages yet"}</TableCell></TableRow>
            ) : (
              data.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.title}</TableCell>
                  <TableCell className="font-mono text-xs">{p.slug}</TableCell>
                  <TableCell><Badge variant="outline" className="uppercase">{p.locale}</Badge></TableCell>
                  <TableCell>{p.isPublished ? <Badge>Published</Badge> : <Badge variant="outline">Draft</Badge>}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => startEdit(p)}><Pencil className="w-3 h-3" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="destructive"><Trash2 className="w-3 h-3" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{lang === "ar" ? "حذف الصفحة؟" : "Delete page?"}</AlertDialogTitle>
                            <AlertDialogDescription>{p.title}</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{lang === "ar" ? "إلغاء" : "Cancel"}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate({ id: p.id }, {
                              onSuccess: () => toast({ title: lang === "ar" ? "تم الحذف" : "Deleted" }),
                              onError: (e) => toast({ variant: "destructive", title: "Error", description: e.message }),
                            })}>{lang === "ar" ? "حذف" : "Delete"}</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{editing ? (lang === "ar" ? "تعديل صفحة" : "Edit Page") : (lang === "ar" ? "صفحة جديدة" : "New Page")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{lang === "ar" ? "المعرف" : "Slug"}</Label>
                <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="about" />
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
              <Label>{lang === "ar" ? "المحتوى (HTML)" : "Body (HTML)"}</Label>
              <Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={10} className="font-mono text-sm" />
            </div>
            <div>
              <Label>{lang === "ar" ? "عنوان SEO" : "SEO Title"}</Label>
              <Input value={form.seoTitle} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} />
            </div>
            <div>
              <Label>{lang === "ar" ? "وصف SEO" : "SEO Description"}</Label>
              <Textarea value={form.seoDescription} onChange={(e) => setForm({ ...form, seoDescription: e.target.value })} rows={2} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.isPublished} onCheckedChange={(c) => setForm({ ...form, isPublished: c })} id="pub" />
              <Label htmlFor="pub">{lang === "ar" ? "منشور" : "Published"}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{lang === "ar" ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              {lang === "ar" ? "حفظ" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

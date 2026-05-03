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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";
import { Plus, Pencil, Trash2, Star } from "lucide-react";

interface TestiRow {
  id: number; locale: string; authorName: string; authorTitle: string | null;
  body: string; rating: number; avatarUrl: string | null; isFeatured: boolean; sortOrder: number;
}
interface TestiForm {
  locale: "en" | "ar"; authorName: string; authorTitle: string;
  body: string; rating: number; avatarUrl: string; isFeatured: boolean; sortOrder: number;
}
const emptyForm: TestiForm = {
  locale: "en", authorName: "", authorTitle: "", body: "",
  rating: 5, avatarUrl: "", isFeatured: false, sortOrder: 0,
};

export default function AdminTestimonials() {
  const { lang } = useTranslation();
  const { toast } = useToast();
  const key = ["admin-testimonials"];
  const { data, isLoading } = useAdminGet<TestiRow[]>(key, "/admin/testimonials");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TestiRow | null>(null);
  const [form, setForm] = useState<TestiForm>(emptyForm);

  const formToBody = (f: TestiForm) => ({
    ...f, authorTitle: f.authorTitle || null, avatarUrl: f.avatarUrl || null,
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
      locale: r.locale as any, authorName: r.authorName, authorTitle: r.authorTitle ?? "",
      body: r.body, rating: r.rating, avatarUrl: r.avatarUrl ?? "",
      isFeatured: r.isFeatured, sortOrder: r.sortOrder,
    });
    setOpen(true);
  };
  const save = () => {
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
        <PageHeader title={lang === "ar" ? "آراء العملاء" : "Testimonials"} />
        <Button onClick={startCreate}><Plus className="w-4 h-4 mr-1" />{lang === "ar" ? "إضافة" : "New"}</Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{lang === "ar" ? "المؤلف" : "Author"}</TableHead>
              <TableHead>{lang === "ar" ? "اللغة" : "Locale"}</TableHead>
              <TableHead>{lang === "ar" ? "التقييم" : "Rating"}</TableHead>
              <TableHead>{lang === "ar" ? "مميز" : "Featured"}</TableHead>
              <TableHead>{lang === "ar" ? "إجراءات" : "Actions"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={5}><Skeleton className="h-8" /></TableCell></TableRow>
              : !data?.length ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{lang === "ar" ? "لا آراء" : "No testimonials"}</TableCell></TableRow>
              : data.map((t) => (
                <TableRow key={t.id}>
                  <TableCell><div className="font-medium">{t.authorName}</div>{t.authorTitle && <div className="text-xs text-muted-foreground">{t.authorTitle}</div>}</TableCell>
                  <TableCell><Badge variant="outline" className="uppercase">{t.locale}</Badge></TableCell>
                  <TableCell><div className="flex items-center gap-0.5">{Array(t.rating).fill(0).map((_, i) => <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />)}</div></TableCell>
                  <TableCell>{t.isFeatured ? <Badge>Featured</Badge> : <Badge variant="outline">—</Badge>}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => startEdit(t)}><Pencil className="w-3 h-3" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button size="sm" variant="destructive"><Trash2 className="w-3 h-3" /></Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>{lang === "ar" ? "حذف؟" : "Delete?"}</AlertDialogTitle><AlertDialogDescription>{t.authorName}</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{lang === "ar" ? "إلغاء" : "Cancel"}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate({ id: t.id }, {
                              onSuccess: () => toast({ title: lang === "ar" ? "تم الحذف" : "Deleted" }),
                              onError: (e) => toast({ variant: "destructive", title: "Error", description: e.message }),
                            })}>{lang === "ar" ? "حذف" : "Delete"}</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} Testimonial</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Locale</Label>
                <Select value={form.locale} onValueChange={(v) => setForm({ ...form, locale: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="ar">العربية</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>{lang === "ar" ? "التقييم" : "Rating (1-5)"}</Label><Input type="number" min={1} max={5} value={form.rating} onChange={(e) => setForm({ ...form, rating: Math.max(1, Math.min(5, Number(e.target.value) || 5)) })} /></div>
            </div>
            <div><Label>{lang === "ar" ? "الاسم" : "Author Name"}</Label><Input value={form.authorName} onChange={(e) => setForm({ ...form, authorName: e.target.value })} /></div>
            <div><Label>{lang === "ar" ? "المسمى الوظيفي" : "Author Title"}</Label><Input value={form.authorTitle} onChange={(e) => setForm({ ...form, authorTitle: e.target.value })} /></div>
            <div><Label>{lang === "ar" ? "الرأي" : "Body"}</Label><Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={4} /></div>
            <div><Label>{lang === "ar" ? "الصورة (URL)" : "Avatar URL"}</Label><Input value={form.avatarUrl} onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div><Label>Sort Order</Label><Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })} /></div>
              <div className="flex items-center gap-2 pb-2"><Switch checked={form.isFeatured} onCheckedChange={(c) => setForm({ ...form, isFeatured: c })} id="ft" /><Label htmlFor="ft">{lang === "ar" ? "مميز" : "Featured"}</Label></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{lang === "ar" ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={save} disabled={createMutation.isPending || updateMutation.isPending}>{lang === "ar" ? "حفظ" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

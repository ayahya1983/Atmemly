import { useState } from "react";
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
import { Plus, Pencil, Trash2 } from "lucide-react";

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
  const { toast } = useToast();
  const key = ["admin-faqs"];
  const { data, isLoading } = useAdminGet<FaqRow[]>(key, "/admin/faqs");

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
    setForm({ locale: r.locale as any, category: r.category, question: r.question, answer: r.answer, sortOrder: r.sortOrder, isActive: r.isActive });
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
        <h1 className="text-2xl font-bold">{lang === "ar" ? "الأسئلة الشائعة" : "FAQs"}</h1>
        <Button onClick={startCreate}><Plus className="w-4 h-4 mr-1" />{lang === "ar" ? "سؤال جديد" : "New FAQ"}</Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{lang === "ar" ? "السؤال" : "Question"}</TableHead>
              <TableHead>{lang === "ar" ? "الفئة" : "Category"}</TableHead>
              <TableHead>{lang === "ar" ? "اللغة" : "Locale"}</TableHead>
              <TableHead>{lang === "ar" ? "ترتيب" : "Order"}</TableHead>
              <TableHead>{lang === "ar" ? "الحالة" : "Active"}</TableHead>
              <TableHead>{lang === "ar" ? "إجراءات" : "Actions"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={6}><Skeleton className="h-8" /></TableCell></TableRow>
              : !data?.length ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{lang === "ar" ? "لا أسئلة" : "No FAQs"}</TableCell></TableRow>
              : data.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium max-w-md truncate">{f.question}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{f.category}</Badge></TableCell>
                  <TableCell><Badge variant="outline" className="uppercase">{f.locale}</Badge></TableCell>
                  <TableCell>{f.sortOrder}</TableCell>
                  <TableCell>{f.isActive ? <Badge>Active</Badge> : <Badge variant="outline">Off</Badge>}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => startEdit(f)}><Pencil className="w-3 h-3" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button size="sm" variant="destructive"><Trash2 className="w-3 h-3" /></Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>{lang === "ar" ? "حذف؟" : "Delete?"}</AlertDialogTitle><AlertDialogDescription>{f.question}</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{lang === "ar" ? "إلغاء" : "Cancel"}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate({ id: f.id }, {
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
          <DialogHeader><DialogTitle>{editing ? (lang === "ar" ? "تعديل" : "Edit FAQ") : (lang === "ar" ? "سؤال جديد" : "New FAQ")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Locale</Label>
                <Select value={form.locale} onValueChange={(v) => setForm({ ...form, locale: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="ar">العربية</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
            </div>
            <div><Label>{lang === "ar" ? "السؤال" : "Question"}</Label><Input value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} /></div>
            <div><Label>{lang === "ar" ? "الإجابة" : "Answer"}</Label><Textarea value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} rows={5} /></div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div><Label>Sort Order</Label><Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })} /></div>
              <div className="flex items-center gap-2 pb-2"><Switch checked={form.isActive} onCheckedChange={(c) => setForm({ ...form, isActive: c })} id="fa" /><Label htmlFor="fa">{lang === "ar" ? "نشط" : "Active"}</Label></div>
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

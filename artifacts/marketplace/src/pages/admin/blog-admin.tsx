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

interface BlogRow {
  id: number; slug: string; locale: string; title: string;
  excerpt: string | null; body: string; coverUrl: string | null;
  category: string | null; tags: string[] | null; isPublished: boolean;
  publishedAt: string | null; updatedAt: string;
}

interface BlogForm {
  slug: string; locale: "en" | "ar"; title: string; excerpt: string; body: string;
  coverUrl: string; category: string; tags: string; isPublished: boolean;
}
const emptyForm: BlogForm = {
  slug: "", locale: "en", title: "", excerpt: "", body: "", coverUrl: "", category: "", tags: "", isPublished: false,
};

export default function AdminBlog() {
  const { lang } = useTranslation();
  const { toast } = useToast();
  const key = ["admin-blog"];
  const { data, isLoading } = useAdminGet<BlogRow[]>(key, "/admin/blog");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BlogRow | null>(null);
  const [form, setForm] = useState<BlogForm>(emptyForm);

  const formToBody = (f: BlogForm) => ({
    slug: f.slug, locale: f.locale, title: f.title, excerpt: f.excerpt, body: f.body,
    coverUrl: f.coverUrl || null, category: f.category || null,
    tags: f.tags ? f.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
    isPublished: f.isPublished,
  });

  const createMutation = useAdminMutation<BlogForm>((f) => adminApi.post("/admin/blog", formToBody(f)), [key, ["public-blog"], ["public-blog-post"]]);
  const updateMutation = useAdminMutation<{ id: number; data: BlogForm }>(
    ({ id, data }) => adminApi.patch(`/admin/blog/${id}`, formToBody(data)), [key, ["public-blog"], ["public-blog-post"]],
  );
  const deleteMutation = useAdminMutation<{ id: number }>(({ id }) => adminApi.del(`/admin/blog/${id}`), [key, ["public-blog"], ["public-blog-post"]]);

  const startCreate = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const startEdit = (row: BlogRow) => {
    setEditing(row);
    setForm({
      slug: row.slug, locale: row.locale as "en" | "ar", title: row.title,
      excerpt: row.excerpt ?? "", body: row.body, coverUrl: row.coverUrl ?? "",
      category: row.category ?? "", tags: (row.tags ?? []).join(", "), isPublished: row.isPublished,
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
        <h1 className="text-2xl font-bold">{lang === "ar" ? "المدونة" : "Blog Posts"}</h1>
        <Button onClick={startCreate}><Plus className="w-4 h-4 mr-1" />{lang === "ar" ? "مقال جديد" : "New Post"}</Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{lang === "ar" ? "العنوان" : "Title"}</TableHead>
              <TableHead>{lang === "ar" ? "الفئة" : "Category"}</TableHead>
              <TableHead>{lang === "ar" ? "اللغة" : "Locale"}</TableHead>
              <TableHead>{lang === "ar" ? "النشر" : "Status"}</TableHead>
              <TableHead>{lang === "ar" ? "إجراءات" : "Actions"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={5}><Skeleton className="h-8" /></TableCell></TableRow>
              : !data?.length ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{lang === "ar" ? "لا مقالات" : "No posts"}</TableCell></TableRow>
              : data.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium max-w-md truncate">{p.title}</TableCell>
                  <TableCell>{p.category ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="uppercase">{p.locale}</Badge></TableCell>
                  <TableCell>{p.isPublished ? <Badge>Published</Badge> : <Badge variant="outline">Draft</Badge>}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => startEdit(p)}><Pencil className="w-3 h-3" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button size="sm" variant="destructive"><Trash2 className="w-3 h-3" /></Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{lang === "ar" ? "حذف المقال؟" : "Delete post?"}</AlertDialogTitle>
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
              ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
          <DialogHeader><DialogTitle>{editing ? (lang === "ar" ? "تعديل مقال" : "Edit Post") : (lang === "ar" ? "مقال جديد" : "New Post")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
              <div><Label>Locale</Label>
                <Select value={form.locale} onValueChange={(v) => setForm({ ...form, locale: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="ar">العربية</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>{lang === "ar" ? "العنوان" : "Title"}</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>{lang === "ar" ? "المقتطف" : "Excerpt"}</Label><Textarea value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} rows={2} /></div>
            <div><Label>{lang === "ar" ? "المحتوى (HTML)" : "Body (HTML)"}</Label><Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={10} className="font-mono text-sm" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{lang === "ar" ? "صورة الغلاف (URL)" : "Cover URL"}</Label><Input value={form.coverUrl} onChange={(e) => setForm({ ...form, coverUrl: e.target.value })} /></div>
              <div><Label>{lang === "ar" ? "الفئة" : "Category"}</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
            </div>
            <div><Label>{lang === "ar" ? "العلامات (مفصولة بفواصل)" : "Tags (comma separated)"}</Label><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></div>
            <div className="flex items-center gap-2">
              <Switch checked={form.isPublished} onCheckedChange={(c) => setForm({ ...form, isPublished: c })} id="bp" />
              <Label htmlFor="bp">{lang === "ar" ? "منشور" : "Published"}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{lang === "ar" ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>{lang === "ar" ? "حفظ" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

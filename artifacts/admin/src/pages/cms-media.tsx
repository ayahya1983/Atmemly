// Admin: media library (alt text edits + soft delete).
import { useState } from "react";
import { useAdminGet, useAdminMutation, adminApi } from "@/lib/api-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/lib/permissions";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, FormDialog } from "@/components/admin";
import { Pencil, Trash2, Loader2, Copy } from "lucide-react";

interface Media {
  id: number;
  url: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  altAr: string | null;
  altEn: string | null;
  createdAt: string;
}

export default function AdminCmsMedia() {
  const { lang } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const canWrite = hasPermission(user, "cms", "write");
  const canDelete = hasPermission(user, "cms", "delete");
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 50;
  const queryKey = ["admin-media", search, page];
  const params = new URLSearchParams({
    limit: String(pageSize),
    offset: String(page * pageSize),
  });
  if (search) params.set("q", search);
  const { data, isLoading } = useAdminGet<{ items: Media[]; total: number; limit: number; offset: number }>(
    queryKey,
    `/admin/media?${params.toString()}`,
  );
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const [editing, setEditing] = useState<Media | null>(null);
  const [altAr, setAltAr] = useState("");
  const [altEn, setAltEn] = useState("");

  const updateAlt = useAdminMutation<{ id: number; altAr: string; altEn: string }>(
    ({ id, altAr, altEn }) => adminApi.patch(`/admin/media/${id}`, { altAr, altEn }),
    [queryKey],
  );
  const del = useAdminMutation<number>((id) => adminApi.del(`/admin/media/${id}`), [queryKey]);
  const forceDel = useAdminMutation<number>((id) => adminApi.del(`/admin/media/${id}?force=1`), [queryKey]);

  const copyUrl = async (m: Media) => {
    try {
      const absolute = m.url.startsWith("http") ? m.url : `${window.location.origin}${m.url}`;
      await navigator.clipboard.writeText(absolute);
      toast({ title: t("تم نسخ الرابط", "URL copied"), description: absolute });
    } catch {
      toast({ variant: "destructive", title: t("فشل النسخ", "Copy failed"), description: m.url });
    }
  };

  const startEdit = (m: Media) => {
    setEditing(m);
    setAltAr(m.altAr ?? "");
    setAltEn(m.altEn ?? "");
  };
  const onDelete = async (m: Media) => {
    if (!confirm(t("حذف هذا الملف؟", "Delete this asset?"))) return;
    try {
      await del.mutateAsync(m.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("in_use")) {
        if (confirm(t("هذا الأصل قيد الاستخدام. حذف بأي حال؟", "Asset is in use. Delete anyway?"))) {
          try {
            await forceDel.mutateAsync(m.id);
            toast({ title: t("تم الحذف", "Deleted") });
          } catch (err) {
            toast({ variant: "destructive", title: t("فشل الحذف", "Delete failed"), description: err instanceof Error ? err.message : String(err) });
          }
        }
      } else {
        toast({ variant: "destructive", title: t("فشل الحذف", "Delete failed"), description: msg });
      }
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("مكتبة الوسائط", "Media library")} description={t("الصور والملفات المرفوعة", "Uploaded images & files")} />
      <Input
        placeholder={t("بحث بالاسم", "Search by name")}
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(0); }}
        className="max-w-sm"
        data-testid="input-media-search"
      />

      {isLoading && <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}

      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {items.map((m) => (
          <div key={m.id} className="rounded-lg border bg-card overflow-hidden" data-testid={`media-item-${m.id}`}>
            {m.mimeType.startsWith("image/") ? (
              <img src={m.url} alt={m.altEn ?? m.originalName} className="w-full h-40 object-cover bg-muted" />
            ) : (
              <div className="w-full h-40 flex items-center justify-center bg-muted text-muted-foreground text-sm">
                {m.mimeType}
              </div>
            )}
            <div className="p-3 space-y-1">
              <div className="text-xs font-medium truncate" title={m.originalName}>{m.originalName}</div>
              <div className="text-xs text-muted-foreground">{(m.sizeBytes / 1024).toFixed(0)} KB</div>
              {(m.altAr || m.altEn) && (
                <div className="text-xs text-muted-foreground truncate">
                  alt: {lang === "ar" ? (m.altAr ?? m.altEn) : (m.altEn ?? m.altAr)}
                </div>
              )}
              <div className="flex gap-1 pt-1">
                <Button size="sm" variant="ghost" onClick={() => copyUrl(m)} data-testid={`button-copy-media-${m.id}`} title={t("نسخ الرابط", "Copy URL")}><Copy className="w-3 h-3" /></Button>
                {canWrite && <Button size="sm" variant="ghost" onClick={() => startEdit(m)} data-testid={`button-edit-media-${m.id}`}><Pencil className="w-3 h-3" /></Button>}
                {canDelete && <Button size="sm" variant="ghost" onClick={() => onDelete(m)} data-testid={`button-delete-media-${m.id}`}><Trash2 className="w-3 h-3 text-destructive" /></Button>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground" data-testid="media-pagination">
        <div>
          {t(`عرض ${items.length} من ${total}`, `Showing ${items.length} of ${total}`)}
          {total > 0 && ` · ${t(`صفحة ${page + 1} من ${totalPages}`, `Page ${page + 1} of ${totalPages}`)}`}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} data-testid="button-media-prev">
            {t("السابق", "Previous")}
          </Button>
          <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)} data-testid="button-media-next">
            {t("التالي", "Next")}
          </Button>
        </div>
      </div>

      <FormDialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}
        title={t("تعديل النص البديل", "Edit alt text")}
        onSubmit={async () => { if (editing) await updateAlt.mutateAsync({ id: editing.id, altAr, altEn }); }}
      >
        <div className="grid gap-3">
          <div><Label>{t("نص بديل (عربي)", "Alt (Arabic)")}</Label><Input dir="rtl" value={altAr} onChange={(e) => setAltAr(e.target.value)} /></div>
          <div><Label>{t("نص بديل (إنجليزي)", "Alt (English)")}</Label><Input value={altEn} onChange={(e) => setAltEn(e.target.value)} /></div>
        </div>
      </FormDialog>
    </div>
  );
}

// Admin: footer settings, link groups & links.
import { useEffect, useState } from "react";
import { useAdminGet, useAdminMutation, adminApi } from "@/lib/api-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/lib/permissions";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, FormDialog } from "@/components/admin";
import { Loader2, Save, Plus, Pencil, Trash2 } from "lucide-react";

interface SocialLink { platform: string; url: string }
interface FooterSettings {
  id: number;
  descriptionAr: string; descriptionEn: string;
  contactEmail: string; contactPhone: string; whatsapp: string;
  addressAr: string; addressEn: string;
  copyrightAr: string; copyrightEn: string;
  socialLinks: SocialLink[];
}
interface FooterLink { id: number; groupId: number; labelAr: string; labelEn: string; href: string; sortOrder: number; isActive: boolean }
interface FooterGroup { id: number; titleAr: string; titleEn: string; sortOrder: number; isActive: boolean; links: FooterLink[] }
interface Payload { settings: FooterSettings | null; groups: FooterGroup[] }

const emptySettings: Omit<FooterSettings, "id"> = {
  descriptionAr: "", descriptionEn: "",
  contactEmail: "", contactPhone: "", whatsapp: "",
  addressAr: "", addressEn: "",
  copyrightAr: "", copyrightEn: "",
  socialLinks: [],
};

export default function AdminCmsFooter() {
  const { lang } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const canWrite = hasPermission(user, "cms", "write");
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);

  const queryKey = ["admin-footer"];
  const { data, isLoading } = useAdminGet<Payload>(queryKey, "/admin/footer");
  const [settings, setSettings] = useState<Omit<FooterSettings, "id">>(emptySettings);

  useEffect(() => {
    if (data?.settings) {
      const { id: _id, ...rest } = data.settings;
      setSettings(rest);
    }
  }, [data]);

  const saveSettings = useAdminMutation<Omit<FooterSettings, "id">>(
    (input) => adminApi.put("/admin/footer/settings", input),
    [queryKey, ["public-footer"]],
  );

  const onSaveSettings = async () => {
    try {
      await saveSettings.mutateAsync(settings);
      toast({ title: t("تم الحفظ", "Saved") });
    } catch (e) {
      toast({ variant: "destructive", title: t("فشل الحفظ", "Save failed"), description: e instanceof Error ? e.message : String(e) });
    }
  };

  const addSocial = () => setSettings((s) => ({ ...s, socialLinks: [...s.socialLinks, { platform: "", url: "https://" }] }));
  const updateSocial = (i: number, patch: Partial<SocialLink>) =>
    setSettings((s) => ({ ...s, socialLinks: s.socialLinks.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) }));
  const removeSocial = (i: number) =>
    setSettings((s) => ({ ...s, socialLinks: s.socialLinks.filter((_, idx) => idx !== i) }));

  // Group/link management
  const [groupOpen, setGroupOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<FooterGroup | null>(null);
  const [groupForm, setGroupForm] = useState({ titleAr: "", titleEn: "", sortOrder: 0, isActive: true });
  const groupMut = useAdminMutation<{ form: typeof groupForm; id?: number }>(
    ({ form, id }) => id != null ? adminApi.patch(`/admin/footer/groups/${id}`, form) : adminApi.post("/admin/footer/groups", form),
    [queryKey, ["public-footer"]],
  );
  const groupDel = useAdminMutation<number>((id) => adminApi.del(`/admin/footer/groups/${id}`), [queryKey, ["public-footer"]]);

  const [linkOpen, setLinkOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<FooterLink | null>(null);
  const [linkGroupId, setLinkGroupId] = useState<number>(0);
  const [linkForm, setLinkForm] = useState({ labelAr: "", labelEn: "", href: "", sortOrder: 0, isActive: true });
  const linkMut = useAdminMutation<{ form: typeof linkForm & { groupId: number }; id?: number }>(
    ({ form, id }) => id != null ? adminApi.patch(`/admin/footer/links/${id}`, form) : adminApi.post("/admin/footer/links", form),
    [queryKey, ["public-footer"]],
  );
  const linkDel = useAdminMutation<number>((id) => adminApi.del(`/admin/footer/links/${id}`), [queryKey, ["public-footer"]]);

  const startGroupEdit = (g?: FooterGroup) => {
    if (g) { setEditingGroup(g); setGroupForm({ titleAr: g.titleAr, titleEn: g.titleEn, sortOrder: g.sortOrder, isActive: g.isActive }); }
    else { setEditingGroup(null); setGroupForm({ titleAr: "", titleEn: "", sortOrder: 0, isActive: true }); }
    setGroupOpen(true);
  };
  const startLinkEdit = (groupId: number, l?: FooterLink) => {
    setLinkGroupId(groupId);
    if (l) { setEditingLink(l); setLinkForm({ labelAr: l.labelAr, labelEn: l.labelEn, href: l.href, sortOrder: l.sortOrder, isActive: l.isActive }); }
    else { setEditingLink(null); setLinkForm({ labelAr: "", labelEn: "", href: "", sortOrder: 0, isActive: true }); }
    setLinkOpen(true);
  };
  const onDeleteGroup = async (id: number) => {
    if (!confirm(t("حذف هذه المجموعة وروابطها؟", "Delete this group and its links?"))) return;
    await groupDel.mutateAsync(id);
  };
  const onDeleteLink = async (id: number) => {
    if (!confirm(t("حذف هذا الرابط؟", "Delete this link?"))) return;
    await linkDel.mutateAsync(id);
  };

  if (isLoading) return <div className="flex items-center justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <PageHeader title={t("التذييل", "Footer")} description={t("إعدادات تذييل السوق", "Marketplace footer settings")} />

      <section className="rounded-lg border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("المعلومات", "Info")}</h2>
          {canWrite && <Button onClick={onSaveSettings} disabled={saveSettings.isPending} size="sm" data-testid="button-save-footer">
            {saveSettings.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span className="mx-2">{t("حفظ", "Save")}</span>
          </Button>}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div><Label>{t("الوصف (عربي)", "Description (Arabic)")}</Label>
            <Textarea dir="rtl" rows={3} value={settings.descriptionAr} disabled={!canWrite} onChange={(e) => setSettings({ ...settings, descriptionAr: e.target.value })} /></div>
          <div><Label>{t("الوصف (إنجليزي)", "Description (English)")}</Label>
            <Textarea rows={3} value={settings.descriptionEn} disabled={!canWrite} onChange={(e) => setSettings({ ...settings, descriptionEn: e.target.value })} /></div>
          <div><Label>{t("البريد الإلكتروني", "Contact email")}</Label>
            <Input type="email" value={settings.contactEmail} disabled={!canWrite} onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })} /></div>
          <div><Label>{t("الهاتف", "Phone")}</Label>
            <Input value={settings.contactPhone} disabled={!canWrite} onChange={(e) => setSettings({ ...settings, contactPhone: e.target.value })} /></div>
          <div><Label>WhatsApp</Label>
            <Input value={settings.whatsapp} disabled={!canWrite} onChange={(e) => setSettings({ ...settings, whatsapp: e.target.value })} /></div>
          <div><Label>{t("العنوان (عربي)", "Address (Arabic)")}</Label>
            <Input dir="rtl" value={settings.addressAr} disabled={!canWrite} onChange={(e) => setSettings({ ...settings, addressAr: e.target.value })} /></div>
          <div><Label>{t("العنوان (إنجليزي)", "Address (English)")}</Label>
            <Input value={settings.addressEn} disabled={!canWrite} onChange={(e) => setSettings({ ...settings, addressEn: e.target.value })} /></div>
          <div><Label>{t("حقوق النشر (عربي)", "Copyright (Arabic)")}</Label>
            <Input dir="rtl" value={settings.copyrightAr} disabled={!canWrite} onChange={(e) => setSettings({ ...settings, copyrightAr: e.target.value })} /></div>
          <div><Label>{t("حقوق النشر (إنجليزي)", "Copyright (English)")}</Label>
            <Input value={settings.copyrightEn} disabled={!canWrite} onChange={(e) => setSettings({ ...settings, copyrightEn: e.target.value })} /></div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>{t("روابط التواصل الاجتماعي", "Social links")}</Label>
            {canWrite && <Button size="sm" variant="outline" onClick={addSocial}><Plus className="w-4 h-4" /></Button>}
          </div>
          {settings.socialLinks.length === 0 && <p className="text-sm text-muted-foreground">{t("لا توجد روابط", "No links")}</p>}
          {settings.socialLinks.map((s, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <Input placeholder="platform" value={s.platform} disabled={!canWrite} onChange={(e) => updateSocial(i, { platform: e.target.value })} className="w-40" />
              <Input placeholder="https://..." value={s.url} disabled={!canWrite} onChange={(e) => updateSocial(i, { url: e.target.value })} className="flex-1" />
              {canWrite && <Button size="sm" variant="ghost" onClick={() => removeSocial(i)}><Trash2 className="w-4 h-4 text-destructive" /></Button>}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("مجموعات الروابط", "Link groups")}</h2>
          {canWrite && <Button size="sm" onClick={() => startGroupEdit()} data-testid="button-add-footer-group"><Plus className="w-4 h-4" /><span className="mx-2">{t("مجموعة", "Group")}</span></Button>}
        </div>
        {(data?.groups ?? []).length === 0 && <p className="text-sm text-muted-foreground">{t("لا توجد مجموعات", "No groups yet")}</p>}
        {(data?.groups ?? []).map((g) => (
          <div key={g.id} className="border rounded-md p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-semibold">{lang === "ar" ? g.titleAr : g.titleEn}</div>
                <div className="text-xs text-muted-foreground">{g.isActive ? t("نشط", "active") : t("معطّل", "inactive")} · order {g.sortOrder}</div>
              </div>
              <div className="flex gap-2">
                {canWrite && <Button size="sm" variant="outline" onClick={() => startLinkEdit(g.id)} data-testid={`button-add-link-${g.id}`}><Plus className="w-4 h-4" /></Button>}
                {canWrite && <Button size="sm" variant="ghost" onClick={() => startGroupEdit(g)}><Pencil className="w-4 h-4" /></Button>}
                {canWrite && <Button size="sm" variant="ghost" onClick={() => onDeleteGroup(g.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>}
              </div>
            </div>
            <div className="space-y-1">
              {g.links.map((l) => (
                <div key={l.id} className="flex items-center justify-between text-sm py-1 border-t">
                  <div>
                    <span>{lang === "ar" ? l.labelAr : l.labelEn}</span>
                    <code className="text-xs text-muted-foreground mx-2">{l.href}</code>
                    {!l.isActive && <span className="text-xs text-muted-foreground">({t("معطّل", "inactive")})</span>}
                  </div>
                  {canWrite && <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => startLinkEdit(g.id, l)}><Pencil className="w-3 h-3" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => onDeleteLink(l.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                  </div>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <FormDialog
        open={groupOpen} onOpenChange={setGroupOpen}
        title={editingGroup ? t("تعديل مجموعة", "Edit group") : t("مجموعة جديدة", "New group")}
        onSubmit={async () => { await groupMut.mutateAsync({ form: groupForm, id: editingGroup?.id }); }}
      >
        <div className="grid gap-3">
          <div><Label>{t("العنوان (عربي)", "Title (Arabic)")}</Label><Input dir="rtl" value={groupForm.titleAr} onChange={(e) => setGroupForm({ ...groupForm, titleAr: e.target.value })} /></div>
          <div><Label>{t("العنوان (إنجليزي)", "Title (English)")}</Label><Input value={groupForm.titleEn} onChange={(e) => setGroupForm({ ...groupForm, titleEn: e.target.value })} /></div>
          <div><Label>{t("الترتيب", "Sort order")}</Label><Input type="number" value={groupForm.sortOrder} onChange={(e) => setGroupForm({ ...groupForm, sortOrder: Number(e.target.value) || 0 })} /></div>
          <div className="flex items-center gap-2"><Switch checked={groupForm.isActive} onCheckedChange={(v) => setGroupForm({ ...groupForm, isActive: v })} /><Label>{t("نشط", "Active")}</Label></div>
        </div>
      </FormDialog>

      <FormDialog
        open={linkOpen} onOpenChange={setLinkOpen}
        title={editingLink ? t("تعديل رابط", "Edit link") : t("رابط جديد", "New link")}
        onSubmit={async () => { await linkMut.mutateAsync({ form: { ...linkForm, groupId: linkGroupId }, id: editingLink?.id }); }}
      >
        <div className="grid gap-3">
          <div><Label>{t("التسمية (عربي)", "Label (Arabic)")}</Label><Input dir="rtl" value={linkForm.labelAr} onChange={(e) => setLinkForm({ ...linkForm, labelAr: e.target.value })} /></div>
          <div><Label>{t("التسمية (إنجليزي)", "Label (English)")}</Label><Input value={linkForm.labelEn} onChange={(e) => setLinkForm({ ...linkForm, labelEn: e.target.value })} /></div>
          <div><Label>{t("الرابط", "Href")}</Label><Input value={linkForm.href} onChange={(e) => setLinkForm({ ...linkForm, href: e.target.value })} placeholder="/about" /></div>
          <div><Label>{t("الترتيب", "Sort order")}</Label><Input type="number" value={linkForm.sortOrder} onChange={(e) => setLinkForm({ ...linkForm, sortOrder: Number(e.target.value) || 0 })} /></div>
          <div className="flex items-center gap-2"><Switch checked={linkForm.isActive} onCheckedChange={(v) => setLinkForm({ ...linkForm, isActive: v })} /><Label>{t("نشط", "Active")}</Label></div>
        </div>
      </FormDialog>
    </div>
  );
}

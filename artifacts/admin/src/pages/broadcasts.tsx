import { useState } from "react";
import { useAdminMutation, adminApi } from "@/lib/api-admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";
import { Megaphone } from "lucide-react";

interface BroadcastBody {
  audience: "all" | "freelancers" | "clients" | "user_ids";
  userIds?: number[];
  kind: string;
  title: string;
  body: string;
  link?: string | null;
}

export default function AdminBroadcasts() {
  const { lang } = useTranslation();
  const { toast } = useToast();

  const [audience, setAudience] = useState<BroadcastBody["audience"]>("all");
  const [userIdsRaw, setUserIdsRaw] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [kind, setKind] = useState("admin_broadcast");

  const broadcast = useAdminMutation<BroadcastBody, { count: number; audience: string }>(
    (input) => adminApi.post("/admin/notifications/broadcast", input),
  );

  const handleSend = () => {
    if (!title.trim() || !body.trim()) {
      toast({ variant: "destructive", title: lang === "ar" ? "العنوان والمحتوى مطلوبان" : "Title and body required" });
      return;
    }
    const payload: BroadcastBody = {
      audience, kind, title: title.trim(), body: body.trim(),
      link: link.trim() || null,
    };
    if (audience === "user_ids") {
      const ids = userIdsRaw.split(/[,\s]+/).filter(Boolean).map(Number).filter((n) => Number.isFinite(n) && n > 0);
      if (!ids.length) { toast({ variant: "destructive", title: lang === "ar" ? "أدخل معرفات صحيحة" : "Enter valid user IDs" }); return; }
      payload.userIds = ids;
    }
    broadcast.mutate(payload, {
      onSuccess: (r) => {
        toast({ title: lang === "ar" ? `تم الإرسال إلى ${r.count} مستخدم` : `Sent to ${r.count} users` });
        setTitle(""); setBody(""); setLink(""); setUserIdsRaw("");
      },
      onError: (e) => toast({ variant: "destructive", title: "Error", description: e.message }),
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Megaphone className="w-6 h-6" />
        {lang === "ar" ? "الإشعارات الجماعية" : "Broadcast Notifications"}
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>{lang === "ar" ? "إنشاء إشعار جديد" : "New Broadcast"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{lang === "ar" ? "الجمهور" : "Audience"}</Label>
            <Select value={audience} onValueChange={(v) => setAudience(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{lang === "ar" ? "كل المستخدمين" : "All Users"}</SelectItem>
                <SelectItem value="freelancers">{lang === "ar" ? "المستقلون فقط" : "Freelancers Only"}</SelectItem>
                <SelectItem value="clients">{lang === "ar" ? "العملاء فقط" : "Clients Only"}</SelectItem>
                <SelectItem value="user_ids">{lang === "ar" ? "مستخدمون محددون" : "Specific Users"}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {audience === "user_ids" && (
            <div>
              <Label>{lang === "ar" ? "معرفات المستخدمين (مفصولة بفواصل)" : "User IDs (comma separated)"}</Label>
              <Input value={userIdsRaw} onChange={(e) => setUserIdsRaw(e.target.value)} placeholder="1, 2, 3" />
            </div>
          )}

          <div>
            <Label>{lang === "ar" ? "نوع الإشعار" : "Kind"}</Label>
            <Input value={kind} onChange={(e) => setKind(e.target.value)} />
          </div>

          <div>
            <Label>{lang === "ar" ? "العنوان" : "Title"}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div>
            <Label>{lang === "ar" ? "المحتوى" : "Body"}</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
          </div>

          <div>
            <Label>{lang === "ar" ? "رابط (اختياري)" : "Link (optional)"}</Label>
            <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="/jobs" />
          </div>

          <Button onClick={handleSend} disabled={broadcast.isPending} className="w-full">
            <Megaphone className="w-4 h-4 mr-2" />
            {broadcast.isPending ? (lang === "ar" ? "جاري الإرسال..." : "Sending...") : (lang === "ar" ? "إرسال الآن" : "Send Broadcast")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

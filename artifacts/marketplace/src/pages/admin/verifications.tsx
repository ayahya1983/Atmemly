import { useState } from "react";
import { useAdminGet, useAdminMutation, adminApi } from "@/lib/api-admin";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";
import { formatDistanceToNow } from "date-fns";
import { ShieldCheck } from "lucide-react";

interface VerificationRow {
  id: number;
  userId: number;
  userName: string | null;
  userRole: string | null;
  kind: string;
  status: string;
  documentUrls: string[] | null;
  fullLegalName: string | null;
  documentNumber: string | null;
  notes: string | null;
  rejectionReason: string | null;
  submittedAt: string;
  reviewedAt: string | null;
}

export default function AdminVerifications() {
  const { lang } = useTranslation();
  const { toast } = useToast();
  const [filter, setFilter] = useState("pending");
  const path = filter === "all" ? "/admin/verifications" : `/admin/verifications?status=${filter}`;
  const key = ["admin-verifications", filter];
  const { data, isLoading } = useAdminGet<VerificationRow[]>(key, path);

  const decisionMutation = useAdminMutation<{ id: number; decision: "approve" | "reject"; reason?: string }>(
    ({ id, decision, reason }) =>
      adminApi.post(`/admin/verifications/${id}/${decision}`, reason ? { reason } : {}),
    [key, ["admin-dashboard"]],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="w-6 h-6" />
          {lang === "ar" ? "طلبات التحقق KYC" : "KYC Verifications"}
        </h1>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{lang === "ar" ? "كل الحالات" : "All"}</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>{lang === "ar" ? "المستخدم" : "User"}</TableHead>
              <TableHead>{lang === "ar" ? "النوع" : "Kind"}</TableHead>
              <TableHead>{lang === "ar" ? "الاسم القانوني" : "Legal Name"}</TableHead>
              <TableHead>{lang === "ar" ? "الحالة" : "Status"}</TableHead>
              <TableHead>{lang === "ar" ? "تاريخ" : "Submitted"}</TableHead>
              <TableHead>{lang === "ar" ? "إجراءات" : "Actions"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={7}><Skeleton className="h-8" /></TableCell></TableRow>
              : !data?.length ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{lang === "ar" ? "لا طلبات" : "No verifications"}</TableCell></TableRow>
              : data.map((v) => (
                <VerificationRowItem
                  key={v.id} v={v} lang={lang}
                  onDecide={(input, cb) => decisionMutation.mutate(input, {
                    onSuccess: () => { toast({ title: lang === "ar" ? "تم الحفظ" : `Verification ${input.decision}d` }); cb(); },
                    onError: (e) => toast({ variant: "destructive", title: "Error", description: e.message }),
                  })}
                  pending={decisionMutation.isPending}
                />
              ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function VerificationRowItem({
  v, onDecide, pending, lang,
}: {
  v: VerificationRow;
  pending: boolean;
  lang: "ar" | "en";
  onDecide: (input: { id: number; decision: "approve" | "reject"; reason?: string }, cb: () => void) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  return (
    <TableRow>
      <TableCell className="font-mono text-xs">#{v.id}</TableCell>
      <TableCell>
        <div className="font-medium">{v.userName ?? `user#${v.userId}`}</div>
        <div className="text-xs text-muted-foreground capitalize">{v.userRole ?? "—"}</div>
      </TableCell>
      <TableCell><Badge variant="outline" className="capitalize">{v.kind.replace("_", " ")}</Badge></TableCell>
      <TableCell className="text-sm">{v.fullLegalName ?? "—"}</TableCell>
      <TableCell>
        <Badge
          variant={v.status === "approved" ? "default" : v.status === "rejected" ? "destructive" : "outline"}
          className="capitalize"
        >{v.status}</Badge>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(v.submittedAt))} {lang === "ar" ? "مضت" : "ago"}</TableCell>
      <TableCell>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" variant="outline">{lang === "ar" ? "مراجعة" : "Review"}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{lang === "ar" ? "مراجعة طلب التحقق" : "Review Verification"} #{v.id}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div><strong>User:</strong> {v.userName ?? `user#${v.userId}`}</div>
              <div><strong>Kind:</strong> {v.kind}</div>
              <div><strong>Legal Name:</strong> {v.fullLegalName ?? "—"}</div>
              <div><strong>Document #:</strong> {v.documentNumber ?? "—"}</div>
              {v.notes && <div><strong>Notes:</strong> {v.notes}</div>}
              {v.documentUrls && v.documentUrls.length > 0 && (
                <div>
                  <strong>{lang === "ar" ? "المستندات" : "Documents"}:</strong>
                  <div className="space-y-1 mt-1">
                    {v.documentUrls.map((u, i) => (
                      <a key={i} href={u} target="_blank" rel="noopener noreferrer" className="block text-primary text-xs underline truncate">{u}</a>
                    ))}
                  </div>
                </div>
              )}
              {v.status === "pending" && (
                <div>
                  <Label>{lang === "ar" ? "سبب الرفض (إذا لزم)" : "Rejection reason (if rejecting)"}</Label>
                  <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>{lang === "ar" ? "إلغاء" : "Cancel"}</Button>
              {v.status === "pending" && (
                <>
                  <Button variant="destructive" disabled={pending} onClick={() => onDecide({ id: v.id, decision: "reject", reason: reason || undefined }, () => setOpen(false))}>
                    {lang === "ar" ? "رفض" : "Reject"}
                  </Button>
                  <Button disabled={pending} onClick={() => onDecide({ id: v.id, decision: "approve" }, () => setOpen(false))}>
                    {lang === "ar" ? "اعتماد" : "Approve"}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
        {(() => { void Input; return null; })()}
      </TableCell>
    </TableRow>
  );
}

import { useState } from "react";
import { useAdminGet, useAdminMutation, adminApi } from "@/lib/api-admin";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";
import { formatDistanceToNow } from "date-fns";

interface DisputeRow {
  id: number;
  contractId: number;
  raisedById: number;
  raisedAgainstId: number;
  status: string;
  reason: string;
  resolutionNotes?: string | null;
  createdAt: string;
}

export default function AdminDisputes() {
  const { lang } = useTranslation();
  const { toast } = useToast();
  const [filter, setFilter] = useState("all");
  const path = filter === "all" ? "/admin/disputes" : `/admin/disputes?status=${filter}`;
  const key = ["admin-disputes", filter];
  const { data, isLoading } = useAdminGet<DisputeRow[]>(key, path);

  const updateMutation = useAdminMutation<{ id: number; status: string; resolutionNotes?: string }>(
    ({ id, status, resolutionNotes }) =>
      adminApi.patch(`/admin/disputes/${id}`, { status, resolutionNotes }),
    [key],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">{lang === "ar" ? "النزاعات" : "Disputes"}</h1>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{lang === "ar" ? "كل الحالات" : "All"}</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="investigating">Investigating</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>{lang === "ar" ? "العقد" : "Contract"}</TableHead>
              <TableHead>{lang === "ar" ? "السبب" : "Reason"}</TableHead>
              <TableHead>{lang === "ar" ? "الحالة" : "Status"}</TableHead>
              <TableHead>{lang === "ar" ? "تاريخ" : "Created"}</TableHead>
              <TableHead>{lang === "ar" ? "إجراءات" : "Actions"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6}><Skeleton className="h-8" /></TableCell></TableRow>
            ) : !data?.length ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{lang === "ar" ? "لا نزاعات" : "No disputes"}</TableCell></TableRow>
            ) : (
              data.map((d) => (
                <DisputeRowItem key={d.id} dispute={d} onUpdate={(input, cb) => updateMutation.mutate(input, {
                  onSuccess: () => { toast({ title: lang === "ar" ? "تم التحديث" : "Updated" }); cb(); },
                  onError: (e) => toast({ variant: "destructive", title: "Error", description: e.message }),
                })} pending={updateMutation.isPending} lang={lang} />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function DisputeRowItem({
  dispute, onUpdate, pending, lang,
}: {
  dispute: DisputeRow;
  pending: boolean;
  lang: "ar" | "en";
  onUpdate: (input: { id: number; status: string; resolutionNotes?: string }, cb: () => void) => void;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(dispute.status);
  const [notes, setNotes] = useState(dispute.resolutionNotes ?? "");

  return (
    <TableRow>
      <TableCell className="font-mono text-xs">#{dispute.id}</TableCell>
      <TableCell className="font-mono text-xs">#{dispute.contractId}</TableCell>
      <TableCell className="max-w-xs truncate text-sm">{dispute.reason}</TableCell>
      <TableCell><Badge variant={dispute.status === "resolved" ? "default" : dispute.status === "open" ? "destructive" : "outline"} className="capitalize">{dispute.status}</Badge></TableCell>
      <TableCell className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(dispute.createdAt))} {lang === "ar" ? "مضت" : "ago"}</TableCell>
      <TableCell>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" variant="outline">{lang === "ar" ? "إدارة" : "Manage"}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{lang === "ar" ? "إدارة النزاع" : "Manage Dispute"} #{dispute.id}</DialogTitle>
              <DialogDescription>{dispute.reason}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground block mb-1">{lang === "ar" ? "الحالة" : "Status"}</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="investigating">Investigating</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">{lang === "ar" ? "ملاحظات الحل" : "Resolution Notes"}</label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>{lang === "ar" ? "إلغاء" : "Cancel"}</Button>
              <Button disabled={pending} onClick={() => onUpdate({ id: dispute.id, status, resolutionNotes: notes || undefined }, () => setOpen(false))}>
                {lang === "ar" ? "حفظ" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </TableCell>
    </TableRow>
  );
}

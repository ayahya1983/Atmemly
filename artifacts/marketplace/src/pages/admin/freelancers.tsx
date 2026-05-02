import { useState } from "react";
import { useAdminGet, useAdminMutation, adminApi } from "@/lib/api-admin";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";
import { formatDistanceToNow } from "date-fns";

interface FreelancerRow {
  userId: number;
  email: string;
  fullName: string;
  status: string;
  headline: string | null;
  verificationStatus: string;
  trustScore: number;
  createdAt: string;
}
interface ListResp { total: number; items: FreelancerRow[]; }

export default function AdminFreelancers() {
  const { lang } = useTranslation();
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [verification, setVerification] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (verification !== "all") params.set("verificationStatus", verification);
  if (status !== "all") params.set("status", status);
  const qs = params.toString();
  const path = `/admin/freelancers${qs ? `?${qs}` : ""}`;
  const key = ["admin-freelancers", search, verification, status];
  const { data, isLoading } = useAdminGet<ListResp>(key, path);

  const trustMutation = useAdminMutation<{ userId: number; delta: number }>(
    ({ userId, delta }) => adminApi.patch(`/admin/freelancers/${userId}/trust-score`, { delta }),
    [key],
  );
  const visibilityMutation = useAdminMutation<{ userId: number; hidden: boolean }>(
    ({ userId, hidden }) => adminApi.patch(`/admin/freelancers/${userId}/visibility`, { hidden }),
    [key],
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{lang === "ar" ? "المستقلون" : "Freelancers"}</h1>

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder={lang === "ar" ? "بحث بالاسم أو البريد" : "Search name/email"}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") setSearch(q); }}
          className="max-w-xs"
        />
        <Button onClick={() => setSearch(q)} variant="outline">{lang === "ar" ? "بحث" : "Search"}</Button>
        <Select value={verification} onValueChange={setVerification}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{lang === "ar" ? "كل التحقق" : "All Verification"}</SelectItem>
            <SelectItem value="not_submitted">Not Submitted</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{lang === "ar" ? "كل الحالات" : "All Statuses"}</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="banned">Banned</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{lang === "ar" ? "الاسم" : "Name"}</TableHead>
              <TableHead>{lang === "ar" ? "البريد" : "Email"}</TableHead>
              <TableHead>{lang === "ar" ? "العنوان" : "Headline"}</TableHead>
              <TableHead>{lang === "ar" ? "التحقق" : "KYC"}</TableHead>
              <TableHead>{lang === "ar" ? "الثقة" : "Trust"}</TableHead>
              <TableHead>{lang === "ar" ? "الحالة" : "Status"}</TableHead>
              <TableHead>{lang === "ar" ? "إجراءات" : "Actions"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
            ) : !data?.items.length ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{lang === "ar" ? "لا نتائج" : "No results"}</TableCell></TableRow>
            ) : (
              data.items.map((f) => (
                <TableRow key={f.userId}>
                  <TableCell className="font-medium">{f.fullName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{f.email}</TableCell>
                  <TableCell className="text-sm max-w-xs truncate">{f.headline ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{f.verificationStatus.replace("_", " ")}</Badge></TableCell>
                  <TableCell className="font-mono text-sm">{f.trustScore}</TableCell>
                  <TableCell><Badge variant={f.status === "active" ? "default" : "destructive"} className="capitalize">{f.status}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" disabled={trustMutation.isPending} onClick={() => {
                        trustMutation.mutate({ userId: f.userId, delta: 5 }, {
                          onSuccess: () => toast({ title: lang === "ar" ? "تم تعديل الثقة (+5)" : "Trust +5" }),
                          onError: (e) => toast({ variant: "destructive", title: "Error", description: e.message }),
                        });
                      }}>+5</Button>
                      <Button size="sm" variant="outline" disabled={trustMutation.isPending} onClick={() => {
                        trustMutation.mutate({ userId: f.userId, delta: -5 }, {
                          onSuccess: () => toast({ title: lang === "ar" ? "تم تعديل الثقة (-5)" : "Trust -5" }),
                          onError: (e) => toast({ variant: "destructive", title: "Error", description: e.message }),
                        });
                      }}>-5</Button>
                      <Button size="sm" variant={f.status === "active" ? "destructive" : "default"} disabled={visibilityMutation.isPending} onClick={() => {
                        const hidden = f.status === "active";
                        visibilityMutation.mutate({ userId: f.userId, hidden }, {
                          onSuccess: () => toast({ title: hidden ? (lang === "ar" ? "تم الإخفاء" : "Hidden") : (lang === "ar" ? "تم الإظهار" : "Shown") }),
                          onError: (e) => toast({ variant: "destructive", title: "Error", description: e.message }),
                        });
                      }}>{f.status === "active" ? (lang === "ar" ? "إخفاء" : "Hide") : (lang === "ar" ? "إظهار" : "Show")}</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {data && (
        <p className="text-sm text-muted-foreground">
          {lang === "ar" ? `إجمالي ${data.total} مستقل` : `${data.total} freelancers total`}
        </p>
      )}
      {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
      {(() => { void formatDistanceToNow; return null; })()}
    </div>
  );
}

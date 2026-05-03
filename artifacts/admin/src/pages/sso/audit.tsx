import { useState } from "react";
import {
  useAdminListSsoAudit,
  useAdminListSsoProviders,
  type AdminListSsoAuditParams,
} from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/admin";
import { format } from "date-fns";
import { BRAND } from "@workspace/branding";

const OUTCOME_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  success: "default",
  provisioned: "default",
  link: "default",
  unlink: "secondary",
  needs_linking: "outline",
  provider_change: "outline",
  failure: "destructive",
  denied: "destructive",
};

export default function AdminSsoAudit() {
  const { data: providers } = useAdminListSsoProviders();
  const [providerId, setProviderId] = useState<string>("all");
  const [outcome, setOutcome] = useState<string>("all");
  const [emailFilter, setEmailFilter] = useState("");
  const [userIdFilter, setUserIdFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const params: AdminListSsoAuditParams = { limit: 200 };
  if (providerId !== "all") params.providerId = Number(providerId);
  if (outcome !== "all") params.outcome = outcome;
  const userIdNum = userIdFilter.trim() ? Number(userIdFilter.trim()) : NaN;
  if (Number.isFinite(userIdNum)) params.userId = userIdNum;
  if (fromDate) params.from = new Date(fromDate).toISOString();
  if (toDate) params.to = new Date(toDate).toISOString();
  const { data, isLoading } = useAdminListSsoAudit(params);

  const filtered = (data ?? []).filter((row) =>
    emailFilter ? (row.email ?? "").toLowerCase().includes(emailFilter.toLowerCase()) : true,
  );

  return (
    <div className="container mx-auto py-8 space-y-6">
      <PageHeader
        title={`${BRAND.name} SSO audit log`}
        description="Every SSO sign-in, link, unlink and admin change."
      />

      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-1">
          <Label>Provider</Label>
          <Select value={providerId} onValueChange={setProviderId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All providers</SelectItem>
              {(providers ?? []).map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>{p.displayName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Outcome</Label>
          <Select value={outcome} onValueChange={setOutcome}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["all", "success", "provisioned", "needs_linking", "link", "unlink", "denied", "failure", "provider_change"].map(
                (o) => <SelectItem key={o} value={o}>{o}</SelectItem>,
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>User ID</Label>
          <Input
            value={userIdFilter}
            onChange={(e) => setUserIdFilter(e.target.value)}
            placeholder="123"
            data-testid="input-audit-userid"
          />
        </div>
        <div className="space-y-1">
          <Label>From</Label>
          <Input
            type="datetime-local"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            data-testid="input-audit-from"
          />
        </div>
        <div className="space-y-1">
          <Label>To</Label>
          <Input
            type="datetime-local"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            data-testid="input-audit-to"
          />
        </div>
        <div className="space-y-1">
          <Label>Email contains</Label>
          <Input
            value={emailFilter}
            onChange={(e) => setEmailFilter(e.target.value)}
            placeholder={`user@${BRAND.domain}`}
          />
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-2">When</th>
              <th className="p-2">Action</th>
              <th className="p-2">Outcome</th>
              <th className="p-2">Provider</th>
              <th className="p-2">User / Email</th>
              <th className="p-2">IP</th>
              <th className="p-2">Reason</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No audit entries.</td></tr>
            )}
            {filtered.map((row) => (
              <tr key={row.id} className="border-t" data-testid={`audit-row-${row.id}`}>
                <td className="p-2 whitespace-nowrap text-xs">
                  {row.createdAt ? format(new Date(row.createdAt), "yyyy-MM-dd HH:mm") : ""}
                </td>
                <td className="p-2 font-mono text-xs">{row.action}</td>
                <td className="p-2">
                  <Badge variant={OUTCOME_VARIANT[row.outcome] ?? "outline"}>{row.outcome}</Badge>
                </td>
                <td className="p-2 text-xs">{row.providerSlug ?? "—"}</td>
                <td className="p-2 text-xs">
                  {row.userId ? `#${row.userId}` : ""} {row.email ? <span className="text-muted-foreground">{row.email}</span> : null}
                </td>
                <td className="p-2 text-xs text-muted-foreground">{row.ip ?? ""}</td>
                <td className="p-2 text-xs text-muted-foreground">{row.reason ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

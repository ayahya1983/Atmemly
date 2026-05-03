import { Link } from "wouter";
import {
  useAdminListSsoProviders,
  useAdminGetSsoSettings,
  useAdminListSsoAudit,
} from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/admin";
import {
  KeyRound,
  ListChecks,
  SlidersHorizontal,
  ShieldCheck,
  ShieldOff,
  ArrowRight,
} from "lucide-react";
import { BRAND } from "@workspace/branding";

export default function AdminSsoOverview() {
  const { data: providers } = useAdminListSsoProviders();
  const { data: settings } = useAdminGetSsoSettings();
  const { data: recent } = useAdminListSsoAudit({ limit: 5 });

  const total = providers?.length ?? 0;
  const enabled = (providers ?? []).filter((p) => p.enabled).length;
  const defaultProvider = (providers ?? []).find((p) => p.isDefault);

  return (
    <div className="container mx-auto py-8 space-y-6">
      <PageHeader
        title={`${BRAND.name} SSO overview`}
        description="Snapshot of single sign-on configuration, providers, and recent activity."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card data-testid="card-sso-providers-summary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="w-4 h-4" /> Providers
            </CardTitle>
            <CardDescription>{enabled} enabled · {total} total</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {defaultProvider ? (
              <div className="text-sm">
                Default:{" "}
                <Badge variant="secondary">{defaultProvider.displayName}</Badge>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No default provider set.</div>
            )}
            <Link href="/sso/providers">
              <Button variant="outline" size="sm">
                Manage providers <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card data-testid="card-sso-settings-summary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4" /> Login policy
            </CardTitle>
            <CardDescription>Global SSO enforcement</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              {settings?.allowLocalPassword ? (
                <>
                  <ShieldCheck className="w-4 h-4 text-green-600" /> Email/password login
                  allowed
                </>
              ) : (
                <>
                  <ShieldOff className="w-4 h-4 text-amber-600" /> Email/password login
                  disabled
                </>
              )}
            </div>
            <div>
              Default method:{" "}
              <Badge variant="outline">{settings?.defaultLoginMethod ?? "password"}</Badge>
            </div>
            <div>
              SSO enforced for organizations:{" "}
              <Badge variant={settings?.forceSsoForOrganizations ? "default" : "outline"}>
                {settings?.forceSsoForOrganizations ? "yes" : "no"}
              </Badge>
            </div>
            <Link href="/sso/settings">
              <Button variant="outline" size="sm" className="mt-2">
                Edit settings <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card data-testid="card-sso-audit-summary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="w-4 h-4" /> Recent activity
            </CardTitle>
            <CardDescription>Last 5 SSO audit events</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {(recent ?? []).length === 0 ? (
              <div className="text-muted-foreground">No SSO activity yet.</div>
            ) : (
              <ul className="space-y-1">
                {(recent ?? []).slice(0, 5).map((row) => (
                  <li key={row.id} className="flex items-center gap-2 truncate">
                    <Badge
                      variant={
                        row.outcome === "failure" || row.outcome === "denied"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {row.outcome}
                    </Badge>
                    <span className="truncate">{row.action}</span>
                    <span className="ml-auto text-muted-foreground shrink-0">
                      {new Date(row.createdAt).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/sso/audit">
              <Button variant="outline" size="sm" className="mt-2">
                View full audit <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { Link, useLocation } from "wouter";
import {
  useAdminListSsoProviders,
  useAdminEnableSsoProvider,
  useAdminDisableSsoProvider,
  useAdminDeleteSsoProvider,
  useAdminTestSsoProvider,
  getAdminListSsoProvidersQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/admin";
import { Plus, ShieldCheck, ShieldOff, Trash2, FlaskConical } from "lucide-react";
import { useState } from "react";
import { BRAND } from "@workspace/branding";

export default function AdminSsoProviders() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useAdminListSsoProviders();
  const enableMut = useAdminEnableSsoProvider();
  const disableMut = useAdminDisableSsoProvider();
  const deleteMut = useAdminDeleteSsoProvider();
  const testMut = useAdminTestSsoProvider();
  const [testing, setTesting] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{
    id: number;
    ok: boolean;
    detail: string;
  } | null>(null);

  const refresh = () =>
    qc.invalidateQueries({ queryKey: getAdminListSsoProvidersQueryKey() });

  const onTest = async (id: number) => {
    setTesting(id);
    setTestResult(null);
    try {
      const r = await testMut.mutateAsync({ id });
      setTestResult({
        id,
        ok: !!r.ok,
        detail: r.ok
          ? `${r.issuer ?? ""} — ${r.jwksKeys ?? 0} JWKS keys`
          : r.error ?? "Unknown error",
      });
    } catch (err: unknown) {
      setTestResult({ id, ok: false, detail: err instanceof Error ? err.message : "test failed" });
    } finally {
      setTesting(null);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <PageHeader
        title={`${BRAND.name} SSO Providers`}
        description={`Configure enterprise sign-in for ${BRAND.name}. Add Google, Microsoft, LinkedIn, Keycloak or any OIDC provider.`}
        actions={
          <Button onClick={() => setLocation("/sso/providers/new")} data-testid="button-add-provider">
            <Plus className="w-4 h-4 mr-2" /> Add provider
          </Button>
        }
      />

      {isLoading && <p className="text-muted-foreground">Loading providers…</p>}
      {!isLoading && (data?.length ?? 0) === 0 && (
        <div className="border rounded-lg p-12 text-center text-muted-foreground">
          No SSO providers configured yet for {BRAND.name}.
        </div>
      )}

      <div className="grid gap-3">
        {(data ?? []).map((p) => (
          <div
            key={p.id}
            className="border rounded-lg p-4 flex flex-wrap items-center gap-3"
            data-testid={`row-provider-${p.id}`}
          >
            <div className="flex-1 min-w-[220px]">
              <div className="flex items-center gap-2 flex-wrap">
                <Link href={`/sso/providers/${p.id}`} className="font-semibold hover:underline">
                  {p.displayName}
                </Link>
                <Badge variant="outline">{p.type}</Badge>
                <code className="text-xs text-muted-foreground">{p.slug}</code>
                {p.isDefault && <Badge>Default</Badge>}
                {p.enabled ? (
                  <Badge variant="default">Enabled</Badge>
                ) : (
                  <Badge variant="secondary">Disabled</Badge>
                )}
                {p.secretConfigured ? (
                  <Badge variant="outline">Secret OK</Badge>
                ) : (
                  <Badge variant="destructive">Secret missing</Badge>
                )}
              </div>
              {p.issuerUrl && (
                <div className="text-xs text-muted-foreground mt-1 truncate">{p.issuerUrl}</div>
              )}
              {testResult?.id === p.id && (
                <div
                  className={`text-xs mt-1 ${testResult.ok ? "text-emerald-600" : "text-destructive"}`}
                >
                  {testResult.ok ? "✓ " : "✗ "}
                  {testResult.detail}
                </div>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onTest(p.id)}
              disabled={testing === p.id}
            >
              <FlaskConical className="w-4 h-4 mr-1" />
              {testing === p.id ? "Testing…" : "Test"}
            </Button>
            {p.enabled ? (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await disableMut.mutateAsync({ id: p.id });
                  await refresh();
                  toast({ title: "Provider disabled" });
                }}
              >
                <ShieldOff className="w-4 h-4 mr-1" /> Disable
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await enableMut.mutateAsync({ id: p.id });
                  await refresh();
                  toast({ title: "Provider enabled" });
                }}
              >
                <ShieldCheck className="w-4 h-4 mr-1" /> Enable
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                if (!confirm(`Delete ${BRAND.name} SSO provider "${p.displayName}"?`)) return;
                await deleteMut.mutateAsync({ id: p.id });
                await refresh();
                toast({ title: "Provider deleted" });
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

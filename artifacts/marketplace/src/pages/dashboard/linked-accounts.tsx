import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useListMyIdentities,
  useSsoUnlink,
  useListSsoProviders,
  getListMyIdentitiesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Link2, Link2Off } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SsoButtons } from "@/components/SsoButtons";

export default function LinkedAccountsPage() {
  const { data: identities, isLoading } = useListMyIdentities();
  const { data: providersResp } = useListSsoProviders();
  const unlinkMut = useSsoUnlink();
  const { user } = useAuth();
  const dashboardBase = user?.role === "freelancer" ? "/dashboard/freelancer" : "/dashboard/client";
  const qc = useQueryClient();
  const { toast } = useToast();

  const linkedSlugs = useMemo(
    () => new Set((identities ?? []).map((i) => i.providerSlug)),
    [identities],
  );
  const availableToLink = useMemo(
    () => (providersResp ?? []).filter((p) => !linkedSlugs.has(p.slug)),
    [providersResp, linkedSlugs],
  );

  const onUnlink = async (identityId: number) => {
    try {
      await unlinkMut.mutateAsync({ data: { identityId } });
      toast({ title: "ATMEMLY identity unlinked" });
      await qc.invalidateQueries({ queryKey: getListMyIdentitiesQueryKey() });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Could not unlink this identity.";
      toast({ title: "Unlink failed", description: message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Linked sign-in accounts</CardTitle>
          <CardDescription>
            ATMEMLY accounts that you can use to sign in. You can keep your email/password
            and add or remove single sign-on providers at any time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : (identities ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You have no SSO providers linked yet. Use the buttons below to link one.
            </p>
          ) : (
            <ul className="divide-y">
              {(identities ?? []).map((id) => (
                <li
                  key={id.id}
                  className="flex items-center justify-between py-3 gap-4"
                  data-testid={`linked-identity-${id.providerSlug}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Link2 className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {id.providerDisplayName}{" "}
                        <Badge variant="secondary" className="ml-2 align-middle">
                          {id.providerSlug}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {id.email ?? id.externalId}
                        {id.lastLoginAt
                          ? ` · last used ${new Date(id.lastLoginAt).toLocaleString()}`
                          : ""}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onUnlink(id.id)}
                    disabled={unlinkMut.isPending}
                    data-testid={`button-unlink-${id.providerSlug}`}
                  >
                    <Link2Off className="w-4 h-4 mr-2" /> Unlink
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {availableToLink.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Add another sign-in method</CardTitle>
            <CardDescription>
              Link an additional provider to your ATMEMLY account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SsoButtons link returnTo={`${dashboardBase}/linked-accounts`} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

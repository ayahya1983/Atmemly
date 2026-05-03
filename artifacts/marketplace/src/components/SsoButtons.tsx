import { useListSsoProviders, ssoStart } from "@workspace/api-client-react";
import { BRAND } from "@workspace/branding";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  returnTo?: string;
  link?: boolean;
}

const ICONS: Record<string, string> = {
  google: "G",
  microsoft: "M",
  linkedin: "in",
  keycloak: "K",
  oidc: "O",
};

export function SsoButtons({ returnTo, link = false }: Props) {
  const { data, isLoading } = useListSsoProviders();
  const { toast } = useToast();
  const [pending, setPending] = useState<string | null>(null);

  if (isLoading) return null;
  if (!data || data.length === 0) return null;

  const onClick = async (slug: string) => {
    setPending(slug);
    try {
      const params: Record<string, string> = {};
      if (returnTo) params["returnTo"] = returnTo;
      if (link) params["link"] = "true";
      const r = await ssoStart(slug, params);
      window.location.href = r.authorizationUrl;
    } catch (err) {
      toast({
        variant: "destructive",
        title: `${BRAND.name} SSO unavailable`,
        description: err instanceof Error ? err.message : "Could not start SSO sign-in.",
      });
      setPending(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative my-2">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card text-muted-foreground px-2">
            {link ? "Link a workspace account" : "Or continue with"}
          </span>
        </div>
      </div>
      <div className="grid gap-2">
        {data.map((p) => (
          <Button
            key={p.id}
            type="button"
            variant="outline"
            className="w-full h-11 font-medium"
            onClick={() => onClick(p.slug)}
            disabled={pending !== null}
            data-testid={`button-sso-${p.slug}`}
          >
            {pending === p.slug ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <span className="inline-flex w-5 h-5 mr-2 items-center justify-center rounded-sm bg-muted text-[10px] font-bold">
                {ICONS[p.type] ?? p.type.slice(0, 1).toUpperCase()}
              </span>
            )}
            {p.displayName}
          </Button>
        ))}
      </div>
    </div>
  );
}

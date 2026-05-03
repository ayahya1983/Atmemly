import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { ssoCallback, useSsoLink } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { effectiveAdminRole } from "@/lib/permissions";
import { BRAND } from "@workspace/branding";
import type { Me } from "@workspace/api-client-react";

type Phase =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | {
      kind: "needs_linking";
      candidateEmail: string;
      provider: string;
      linkChallengeToken: string;
    };

export default function AdminSsoCallback() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });

  useEffect(() => {
    const m = window.location.pathname.match(/\/auth\/sso\/([^/]+)\/callback/);
    if (!m) {
      setPhase({ kind: "error", message: "Invalid callback URL" });
      return;
    }
    const slug = decodeURIComponent(m[1]!);
    const u = new URL(window.location.href);
    const code = u.searchParams.get("code") ?? "";
    const state = u.searchParams.get("state") ?? "";
    ssoCallback(slug, { code, state })
      .then((res) => {
        if (res.outcome === "signed_in" && res.token && res.user) {
          if (!effectiveAdminRole(res.user as Me)) {
            setPhase({
              kind: "error",
              message: `This ${BRAND.name} account does not have admin access.`,
            });
            return;
          }
          login(res.token, res.user as Me);
          if (res.refreshToken) localStorage.setItem("refresh_token", res.refreshToken);
          setLocation("/");
        } else if (res.outcome === "needs_linking") {
          setPhase({
            kind: "needs_linking",
            candidateEmail: res.candidateEmail ?? "",
            provider: res.provider ?? slug,
            linkChallengeToken: res.linkChallengeToken ?? "",
          });
        } else {
          setPhase({
            kind: "error",
            message: res.message ?? `${BRAND.name} SSO sign-in failed.`,
          });
        }
      })
      .catch((err) =>
        setPhase({
          kind: "error",
          message: err instanceof Error ? err.message : "Unexpected error",
        }),
      );
  }, [login, setLocation]);

  const linkMutation = useSsoLink({
    mutation: {
      onSuccess: (data) => {
        if (!effectiveAdminRole(data.user as Me)) {
          toast({
            variant: "destructive",
            title: "Not authorized",
            description: `This account is not an ${BRAND.name} admin.`,
          });
          return;
        }
        login(data.token, data.user as Me);
        if (data.refreshToken) localStorage.setItem("refresh_token", data.refreshToken);
        toast({ title: `${BRAND.name} admin account linked` });
        setLocation("/");
      },
      onError: (err: unknown) =>
        toast({
          variant: "destructive",
          title: "Linking failed",
          description: err instanceof Error ? err.message : "Wrong password or already linked.",
        }),
    },
  });

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        {phase.kind === "loading" && (
          <CardContent className="py-16 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground">{`Completing ${BRAND.name} admin sign-in…`}</p>
          </CardContent>
        )}
        {phase.kind === "error" && (
          <CardContent className="py-12 text-center space-y-4">
            <CardTitle>Sign-in problem</CardTitle>
            <p className="text-muted-foreground text-sm">{phase.message}</p>
            <Button onClick={() => setLocation("/login")}>Back to login</Button>
          </CardContent>
        )}
        {phase.kind === "needs_linking" && (
          <LinkForm
            phase={phase}
            isPending={linkMutation.isPending}
            onSubmit={(password) =>
              linkMutation.mutate({
                data: {
                  linkChallengeToken: phase.linkChallengeToken,
                  password,
                },
              })
            }
          />
        )}
      </Card>
    </div>
  );
}

function LinkForm(props: {
  phase: Extract<Phase, { kind: "needs_linking" }>;
  isPending: boolean;
  onSubmit: (password: string) => void;
}) {
  const form = useForm<{ password: string }>({ defaultValues: { password: "" } });
  return (
    <>
      <CardHeader>
        <CardTitle>{`Link your ${BRAND.name} admin account`}</CardTitle>
        <CardDescription>
          An admin account already exists for <b>{props.phase.candidateEmail}</b>. Enter your
          {BRAND.name} password to link <b>{props.phase.provider}</b> sign-in.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((d) => props.onSubmit(d.password))}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="password"
              rules={{ required: true }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{`${BRAND.name} password`}</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={props.isPending}>
              {props.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Link & sign in"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </>
  );
}

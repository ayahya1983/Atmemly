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
import type { Me } from "@workspace/api-client-react";

type Phase =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | {
      kind: "needs_linking";
      candidateEmail: string;
      provider: string;
      linkChallengeToken: string;
      returnTo: string | null;
    };

export default function SsoCallback() {
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
    const errParam = u.searchParams.get("error");
    if (errParam) {
      setPhase({ kind: "error", message: errParam });
      return;
    }
    ssoCallback(slug, { code, state })
      .then((res) => {
        if (res.outcome === "signed_in" && res.token && res.user) {
          login(res.token, res.user as Me);
          if (res.refreshToken) localStorage.setItem("refresh_token", res.refreshToken);
          const target =
            res.returnTo ||
            (res.user.role === "client" ? "/dashboard/client" : "/dashboard/freelancer");
          setLocation(target);
        } else if (res.outcome === "needs_linking") {
          setPhase({
            kind: "needs_linking",
            candidateEmail: res.candidateEmail ?? "",
            provider: res.provider ?? slug,
            linkChallengeToken: res.linkChallengeToken ?? "",
            returnTo: res.returnTo ?? null,
          });
        } else {
          setPhase({
            kind: "error",
            message: res.message ?? "ATMEMLY SSO sign-in failed.",
          });
        }
      })
      .catch((err) => {
        setPhase({
          kind: "error",
          message: err instanceof Error ? err.message : "Unexpected error",
        });
      });
  }, [login, setLocation]);

  const linkMutation = useSsoLink({
    mutation: {
      onSuccess: (data) => {
        login(data.token, data.user as Me);
        if (data.refreshToken) localStorage.setItem("refresh_token", data.refreshToken);
        toast({ title: "ATMEMLY account linked" });
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
    <div className="min-h-[100dvh] flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        {phase.kind === "loading" && (
          <CardContent className="py-16 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Completing ATMEMLY sign-in…</p>
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
        <CardTitle>Link your ATMEMLY account</CardTitle>
        <CardDescription>
          An account already exists for <b>{props.phase.candidateEmail}</b>. Enter your
          ATMEMLY password to link <b>{props.phase.provider}</b> sign-in.
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
                  <FormLabel>ATMEMLY password</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={props.isPending}>
              {props.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Link & sign in"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </>
  );
}

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLogin, LoginBody } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation, Link } from "wouter";
import { useTranslation } from "@/lib/i18n";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/ui/logo";
import { Loader2 } from "lucide-react";
import { SsoButtons } from "@/components/SsoButtons";


export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { t } = useTranslation();
  const { toast } = useToast();

  const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  });

  const form = useForm<LoginBody>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data) => {
        login(data.token, data.user);
        toast({
          title: t("auth.login.welcomeToast"),
          description: t("auth.login.welcomeBody"),
        });
        const u = data.user as { role?: string; adminRole?: string | null };
        if (u.role === "admin" || (u.adminRole && u.adminRole.length > 0)) {
          window.location.href = "/admin/";
          return;
        }
        if (data.user.role === "client") setLocation("/dashboard/client");
        else setLocation("/dashboard/freelancer");
      },
      onError: (error: any) => {
        toast({
          variant: "destructive",
          title: t("auth.login.failedTitle"),
          description: error.message || t("auth.login.failedBody"),
        });
      },
    },
  });

  const onSubmit = (data: LoginBody) => {
    loginMutation.mutate({ data });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-muted/30 p-4">
      <div className="mb-8 flex items-center justify-center">
        <Logo />
      </div>
      <Card className="w-full max-w-md shadow-xl border-border/50">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-2xl font-bold">{t("auth.login.title")}</CardTitle>
          <CardDescription>{t("auth.login.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("auth.login.email")}</FormLabel>
                    <FormControl>
                      <Input placeholder="name@example.com" type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("auth.login.password")}</FormLabel>
                    <FormControl>
                      <Input placeholder="••••••••" type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full h-12 text-base font-medium" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : t("auth.login.submit")}
              </Button>
            </form>
          </Form>
          <div className="mt-6"><SsoButtons /></div>
        </CardContent>
        <CardFooter className="flex justify-center border-t p-6">
          <p className="text-sm text-muted-foreground">
            {t("auth.login.noAccount")}{" "}
            <Link href="/register" className="text-primary font-semibold hover:underline">
              {t("auth.login.signupLink")}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

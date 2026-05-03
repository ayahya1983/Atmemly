import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLogin, type LoginBody } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useTranslation } from "@/lib/i18n";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/ui/logo";
import { Loader2 } from "lucide-react";
import { effectiveAdminRole } from "@/lib/permissions";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { lang } = useTranslation();
  const { toast } = useToast();

  const form = useForm<LoginBody>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data) => {
        const role = effectiveAdminRole(data.user);
        if (!role) {
          toast({
            variant: "destructive",
            title: lang === "ar" ? "غير مصرح" : "Not authorized",
            description: lang === "ar"
              ? "هذا الحساب لا يملك صلاحيات الإدارة."
              : "This account does not have admin access.",
          });
          return;
        }
        login(data.token, data.user);
        toast({
          title: lang === "ar" ? "أهلاً بعودتك" : "Welcome back",
        });
        setLocation("/");
      },
      onError: (error: any) => {
        toast({
          variant: "destructive",
          title: lang === "ar" ? "فشل تسجيل الدخول" : "Login failed",
          description: error?.message || (lang === "ar" ? "بيانات غير صحيحة" : "Invalid credentials"),
        });
      },
    },
  });

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background p-4">
      <div className="mb-8">
        <Logo />
      </div>
      <Card className="w-full max-w-md shadow-2xl border-border">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-2xl font-bold">
            {lang === "ar" ? "تسجيل دخول الإدارة" : "Admin Sign In"}
          </CardTitle>
          <CardDescription>
            {lang === "ar"
              ? "هذه المنطقة مخصّصة لطاقم الإدارة فقط."
              : "This area is restricted to staff accounts."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((d) => loginMutation.mutate({ data: d }))} className="space-y-5">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{lang === "ar" ? "البريد الإلكتروني" : "Email"}</FormLabel>
                    <FormControl>
                      <Input placeholder="admin@atmemly.ae" type="email" {...field} data-testid="input-email" />
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
                    <FormLabel>{lang === "ar" ? "كلمة المرور" : "Password"}</FormLabel>
                    <FormControl>
                      <Input placeholder="••••••••" type="password" {...field} data-testid="input-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full h-11" disabled={loginMutation.isPending} data-testid="button-submit">
                {loginMutation.isPending
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : (lang === "ar" ? "دخول" : "Sign in")}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

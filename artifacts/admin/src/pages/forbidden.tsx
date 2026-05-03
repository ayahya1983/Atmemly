import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";

export default function Forbidden() {
  const { lang } = useTranslation();
  const { logout } = useAuth();
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center gap-4 px-4">
      <div className="w-16 h-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <h1 className="text-2xl font-bold">
        {lang === "ar" ? "ليست لديك صلاحية الوصول" : "You don't have access"}
      </h1>
      <p className="text-muted-foreground max-w-md">
        {lang === "ar"
          ? "هذه الصفحة مخصصة لأدوار إدارية معينة. تواصل مع المدير العام إذا كنت تعتقد أن هذا خطأ."
          : "This page is restricted to specific admin roles. Contact a super admin if you think this is a mistake."}
      </p>
      <Button onClick={logout} variant="outline">{lang === "ar" ? "تسجيل الخروج" : "Sign out"}</Button>
    </div>
  );
}

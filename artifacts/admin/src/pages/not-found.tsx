import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

export default function NotFound() {
  const { lang } = useTranslation();
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center gap-4">
      <div className="text-7xl font-bold text-muted-foreground">404</div>
      <p className="text-muted-foreground">
        {lang === "ar" ? "الصفحة غير موجودة" : "Page not found"}
      </p>
      <Link href="/"><Button variant="outline">{lang === "ar" ? "الرئيسية" : "Go home"}</Button></Link>
    </div>
  );
}

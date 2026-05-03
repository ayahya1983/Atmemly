import { useTranslation } from "@/lib/i18n";
import { StaticCmsPage } from "@/components/StaticCmsPage";

export default function Help() {
  const { lang } = useTranslation();
  const fallbackTitle = lang === "ar" ? "مركز المساعدة" : "Help Center";
  const fallbackBody =
    lang === "ar"
      ? "مرحباً بك في مركز المساعدة. تواصل معنا في أي وقت للحصول على دعم سريع، أو تصفح الأسئلة الشائعة للحصول على إجابات فورية."
      : "Welcome to the Help Center. Reach out any time for quick support, or browse the FAQ for instant answers.";
  return <StaticCmsPage slug="help" fallbackTitle={fallbackTitle} fallbackBody={fallbackBody} />;
}

import { useTranslation } from "@/lib/i18n";
import { StaticCmsPage } from "@/components/StaticCmsPage";

export default function Terms() {
  const { lang } = useTranslation();
  const fallbackTitle = lang === "ar" ? "الشروط والأحكام" : "Terms of Service";
  const fallbackBody =
    lang === "ar"
      ? "آخر تحديث: " + new Date().toLocaleDateString("ar-AE") + "\n\nباستخدامك خِدمة، فإنك توافق على هذه الشروط. يرجى مراجعتها بعناية."
      : "Last updated: " + new Date().toLocaleDateString() + "\n\nBy using Atmemly, you agree to these terms. Please review them carefully.";
  return <StaticCmsPage slug="terms" fallbackTitle={fallbackTitle} fallbackBody={fallbackBody} />;
}

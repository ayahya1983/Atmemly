import { useTranslation } from "@/lib/i18n";
import { StaticCmsPage } from "@/components/StaticCmsPage";

export default function Privacy() {
  const { lang } = useTranslation();
  const fallbackTitle = lang === "ar" ? "سياسة الخصوصية" : "Privacy Policy";
  const fallbackBody =
    lang === "ar"
      ? "آخر تحديث: " + new Date().toLocaleDateString("ar-AE") + "\n\nنحن نحترم خصوصيتك ونحمي بياناتك وفقاً لقوانين دولة الإمارات العربية المتحدة."
      : "Last updated: " + new Date().toLocaleDateString() + "\n\nWe respect your privacy and protect your data in accordance with UAE law.";
  return <StaticCmsPage slug="privacy" fallbackTitle={fallbackTitle} fallbackBody={fallbackBody} />;
}

import { useTranslation } from "@/lib/i18n";
import { StaticCmsPage } from "@/components/StaticCmsPage";

export default function HowItWorks() {
  const { lang } = useTranslation();
  const fallbackTitle = lang === "ar" ? "كيف تعمل المنصة" : "How it works";
  const fallbackBody =
    lang === "ar"
      ? "اعثر على الموهبة المناسبة، ابدأ مشروعاً بثقة، وادفع بأمان عبر نظام الضمان."
      : "Find the right talent, kick off a project with confidence, and pay safely via escrow.";
  return <StaticCmsPage slug="how-it-works" fallbackTitle={fallbackTitle} fallbackBody={fallbackBody} />;
}

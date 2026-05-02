import { useTranslation } from "@/lib/i18n";
import { StaticCmsPage } from "@/components/StaticCmsPage";

export default function Cancellation() {
  const { lang } = useTranslation();
  const fallbackTitle = lang === "ar" ? "سياسة الإلغاء والاسترداد" : "Cancellation & Refund Policy";
  const fallbackBody =
    lang === "ar"
      ? "آخر تحديث: " + new Date().toLocaleDateString("ar-AE") + "\n\nيمكن إلغاء الوظائف قبل اكتمال المراحل. يتم استرداد المبالغ المحجوزة وفقاً لشروط العقد."
      : "Last updated: " + new Date().toLocaleDateString() + "\n\nJobs can be cancelled before milestones are completed. Escrowed funds are refunded according to the contract terms.";
  return <StaticCmsPage slug="cancellation" fallbackTitle={fallbackTitle} fallbackBody={fallbackBody} />;
}

import { useTranslation } from "@/lib/i18n";
import { StaticCmsPage } from "@/components/StaticCmsPage";
import { BRAND } from "@workspace/branding";

export default function About() {
  const { lang } = useTranslation();
  const fallbackTitle = lang === "ar" ? `عن ${BRAND.nameAr}` : `About ${BRAND.name}`;
  const fallbackBody =
    lang === "ar"
      ? `${BRAND.nameAr} هي المنصة الرائدة التي تربط بين العملاء وأمهر المستقلين في دول الخليج. مبنية خصيصاً للسوق الإقليمي، نفهم خصوصية الأعمال في الإمارات والشرق الأوسط.\n\nمهمتنا هي تمكين المحترفين من العمل بمرونة، وتوفير الوصول إلى خبرات موثوقة وعالية الجودة للشركات.`
      : `${BRAND.name} is the premier platform connecting visionary clients with the finest freelance talent across the GCC. Built specifically for the regional market, we understand the nuances of business in the UAE and the wider Middle East.\n\nOur mission is to empower professionals to work flexibly while providing businesses access to vetted, high-quality expertise.`;
  return <StaticCmsPage slug="about-us" fallbackTitle={fallbackTitle} fallbackBody={fallbackBody} />;
}

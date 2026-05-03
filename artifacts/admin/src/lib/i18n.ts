import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type ReactNode, useEffect } from "react";

type Language = "en" | "ar";
type Currency = "AED" | "USD";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const lang = useI18nStore((s) => s.lang);
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
      document.documentElement.lang = lang;
    }
  }, [lang]);
  return children as never;
}

interface I18nStore {
  lang: Language;
  currency: Currency;
  setLang: (lang: Language) => void;
  setCurrency: (c: Currency) => void;
}

export const useI18nStore = create<I18nStore>()(
  persist(
    (set) => ({
      lang: "ar",
      currency: "AED",
      setLang: (lang) => {
        set({ lang });
        if (typeof document !== "undefined") {
          document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
          document.documentElement.lang = lang;
        }
      },
      setCurrency: (currency) => set({ currency }),
    }),
    {
      name: "atmemly-lang",
      onRehydrateStorage: () => (state) => {
        if (state && typeof document !== "undefined") {
          document.documentElement.dir = state.lang === "ar" ? "rtl" : "ltr";
          document.documentElement.lang = state.lang;
        }
      },
    },
  ),
);

const translations: Record<Language, Record<string, string>> = {
  en: {
    "nav.services": "Services",
    "nav.projects": "Projects",
    "nav.works": "Works",
    "nav.freelancers": "Freelancers",
    "nav.community": "Community",
    "nav.blog": "Blog",
    "nav.help": "Help Center",
    "nav.jobs": "Find Jobs",
    "nav.login": "Log In",
    "nav.register": "Sign Up",
    "nav.dashboard": "Dashboard",
    "nav.admin": "Admin",
    "nav.logout": "Log out",
    "hero.eyebrow": "Save time and work with the best freelancers for any task",
    "hero.title": "Atmemly Platform",
    "hero.body":
      "Connecting business owners who need specific services with professional service providers across many fields. The platform simplifies operations between clients and providers.",
    "hero.search.placeholder": "Search for any service…",
    "hero.search.button": "Search",
    "hero.tab.services": "Services",
    "hero.tab.projects": "Projects",
    "hero.tab.works": "Works",
    "hero.tab.freelancers": "Freelancers",
    "section.bestServices.title": "Our Best Services",
    "section.bestServices.viewAll": "View all",
    "section.categories.title": "Browse Categories",
    "section.categories.subtitle": "Find the right expertise for your project",
    "section.recommended.title": "Recommended Services",
    "section.recommended.subtitle": "Hand-picked services from our top-rated freelancers",
    "section.bestFreelancers.title": "Best Freelancers",
    "section.bestFreelancers.subtitle": "Work with vetted professionals across the GCC",
    "section.latestProjects.title": "Latest Projects",
    "section.latestProjects.subtitle": "Browse the newest opportunities posted by clients",
    "section.cta.title": "Join the largest freelance marketplace in the region",
    "section.cta.body": "Whether you're hiring or offering services, your next opportunity is one click away.",
    "section.cta.primary": "Create an account",
    "section.cta.secondary": "Sign in",
    "section.testimonials.title": "What our community says",
    "section.testimonials.subtitle": "Real stories from clients and freelancers",
    "section.blog.title": "From the Atmemly Blog",
    "section.blog.subtitle": "Tips, guides and stories for freelancers and clients",
    "section.faq.title": "Frequently Asked Questions",
    "section.faq.subtitle": "Everything you need to know about Atmemly",
    "section.app.title": "Get the Atmemly mobile app",
    "section.app.body": "Manage your projects, chat with clients and receive payments — anywhere.",
    "section.app.appStore": "App Store",
    "section.app.googlePlay": "Google Play",
    "card.startingFrom": "Starting from",
    "card.byFreelancer": "by",
    "card.viewProfile": "View profile",
    "card.viewService": "View service",
    "card.viewProject": "View project",
    "card.posted": "Posted",
    "card.budget": "Budget",
    "card.proposals": "proposals",
    "card.success": "success rate",
    "common.loading": "Loading…",
    "common.error": "An error occurred.",
    "common.viewAll": "View all",
    "common.readMore": "Read more",
    "footer.about":
      "Atmemly is a bilingual freelance marketplace for the UAE and the wider GCC region, connecting clients with the best Arab talent.",
    "footer.platform": "Platform",
    "footer.company": "Company",
    "footer.legal": "Legal",
    "footer.contact": "Contact us",
    "footer.contactCta": "Send us a message",
    "footer.rights": "All rights reserved.",
    "footer.terms": "Terms of Service",
    "footer.privacy": "Privacy Policy",
    "footer.cancellation": "Cancellation Policy",
    "footer.about_us": "About us",
  },
  ar: {
    "nav.services": "الخدمات",
    "nav.projects": "المشاريع",
    "nav.works": "الأعمال",
    "nav.freelancers": "المستقلين",
    "nav.community": "مجتمع أتمملي",
    "nav.blog": "مدونة أتمملي",
    "nav.help": "مركز المساعدة",
    "nav.jobs": "تصفح الوظائف",
    "nav.login": "دخول",
    "nav.register": "حساب جديد",
    "nav.dashboard": "لوحة التحكم",
    "nav.admin": "الإدارة",
    "nav.logout": "تسجيل الخروج",
    "hero.eyebrow": "وفّر وقتك وتعامل مع أفضل المستقلين لأي وظيفة",
    "hero.title": "منصة أتمملي",
    "hero.body":
      "تربط أصحاب الأعمال والذين يحتاجون إلى خدمات معيّنة مع مقدمي خدمات محترفين في مختلف المجالات. تعتمد المنصة على فكرة تبسيط العمليات بين العملاء ومقدمي الخدمات.",
    "hero.search.placeholder": "ابحث عن أي أتمملي…",
    "hero.search.button": "بحث",
    "hero.tab.services": "الخدمات",
    "hero.tab.projects": "المشاريع",
    "hero.tab.works": "الأعمال",
    "hero.tab.freelancers": "المستقلون",
    "section.bestServices.title": "أفضل خدماتنا",
    "section.bestServices.viewAll": "عرض الكل",
    "section.categories.title": "تصفح التصنيفات",
    "section.categories.subtitle": "اعثر على الخبرة المناسبة لمشروعك",
    "section.recommended.title": "خدمات موصى بها",
    "section.recommended.subtitle": "خدمات مختارة من أفضل المستقلين لدينا",
    "section.bestFreelancers.title": "أفضل المستقلين",
    "section.bestFreelancers.subtitle": "تعامل مع مستقلين موثوقين من مختلف دول الخليج",
    "section.latestProjects.title": "أحدث المشاريع",
    "section.latestProjects.subtitle": "تصفح أحدث الفرص المنشورة من قبل العملاء",
    "section.cta.title": "انضم إلى أكبر سوق للمستقلين في المنطقة",
    "section.cta.body": "سواء كنت تبحث عن مستقلين أو تقدّم خدماتك، فرصتك القادمة على بُعد نقرة واحدة.",
    "section.cta.primary": "إنشاء حساب",
    "section.cta.secondary": "تسجيل الدخول",
    "section.testimonials.title": "ماذا يقول مجتمعنا",
    "section.testimonials.subtitle": "قصص حقيقية من عملاء ومستقلين",
    "section.blog.title": "من مدونة أتمملي",
    "section.blog.subtitle": "نصائح وأدلة وقصص للمستقلين والعملاء",
    "section.faq.title": "الأسئلة الشائعة",
    "section.faq.subtitle": "كل ما تحتاج معرفته عن منصة أتمملي",
    "section.app.title": "حمّل تطبيق أتمملي للجوال",
    "section.app.body": "أدر مشاريعك وتواصل مع عملائك واستلم مدفوعاتك من أي مكان.",
    "section.app.appStore": "App Store",
    "section.app.googlePlay": "Google Play",
    "card.startingFrom": "يبدأ من",
    "card.byFreelancer": "بواسطة",
    "card.viewProfile": "عرض الملف",
    "card.viewService": "عرض الأتمملي",
    "card.viewProject": "عرض المشروع",
    "card.posted": "نشر",
    "card.budget": "الميزانية",
    "card.proposals": "عرض",
    "card.success": "نسبة النجاح",
    "common.loading": "جاري التحميل…",
    "common.error": "حدث خطأ.",
    "common.viewAll": "عرض الكل",
    "common.readMore": "اقرأ المزيد",
    "footer.about":
      "أتمملي هي منصة مستقلين ثنائية اللغة للإمارات ودول الخليج، تربط العملاء بأفضل الكفاءات العربية.",
    "footer.platform": "المنصة",
    "footer.company": "عن الشركة",
    "footer.legal": "قانوني",
    "footer.contact": "تواصل معنا",
    "footer.contactCta": "أرسل لنا رسالة",
    "footer.rights": "جميع الحقوق محفوظة.",
    "footer.terms": "شروط الاستخدام",
    "footer.privacy": "سياسة الخصوصية",
    "footer.cancellation": "سياسة الإلغاء",
    "footer.about_us": "من نحن",
  },
};

export function useTranslation() {
  const { lang, setLang, currency, setCurrency } = useI18nStore();

  const t = (key: string): string => {
    return translations[lang]?.[key] || key;
  };

  const isRtl = lang === "ar";

  return { t, lang, setLang, isRtl, currency, setCurrency };
}

const FX: Record<Currency, number> = { AED: 1, USD: 0.272 };

export function convertFromAED(amount: number, currency: Currency): number {
  return amount * FX[currency];
}

function convertToAED(amount: number, sourceCurrency: Currency): number {
  const rate = FX[sourceCurrency];
  if (!rate) return amount;
  return amount / rate;
}

export function formatCurrency(
  amount: number,
  currency: string = "AED",
  lang: string = "ar",
) {
  const code = currency.toUpperCase();
  if (lang === "ar") {
    if (code === "AED") return `${amount.toLocaleString("ar-AE")} د.إ`;
    if (code === "USD") return `${amount.toLocaleString("ar-AE")} $`;
    return `${amount.toLocaleString("ar-AE")} ${code}`;
  }
  if (code === "AED") return `AED ${amount.toLocaleString("en-AE")}`;
  if (code === "USD") return `$${amount.toLocaleString("en-US")}`;
  return `${code} ${amount.toLocaleString("en-AE")}`;
}

// Display amount in user's selected currency. The platform is AED-native;
// FX is approximate and meant for display, not for transactions.
export function formatPriceDisplay(amount: number, sourceCurrency: string, lang: Language, displayCurrency: Currency): string {
  const src = sourceCurrency.toUpperCase() as Currency;
  if (src === displayCurrency) {
    return formatCurrency(Math.round(amount), displayCurrency, lang);
  }
  const knownSource: Currency = FX[src] ? src : "AED";
  const aed = convertToAED(amount, knownSource);
  const native = convertFromAED(aed, displayCurrency);
  return formatCurrency(Math.round(native), displayCurrency, lang);
}

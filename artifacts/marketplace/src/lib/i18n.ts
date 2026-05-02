import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type ReactNode, useEffect } from "react";

type Language = "en" | "ar";

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
  setLang: (lang: Language) => void;
}

export const useI18nStore = create<I18nStore>()(
  persist(
    (set) => ({
      lang: "en",
      setLang: (lang) => {
        set({ lang });
        if (typeof document !== "undefined") {
          document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
          document.documentElement.lang = lang;
        }
      },
    }),
    {
      name: "khidma-lang",
      onRehydrateStorage: () => (state) => {
        if (state && typeof document !== "undefined") {
          document.documentElement.dir = state.lang === "ar" ? "rtl" : "ltr";
          document.documentElement.lang = state.lang;
        }
      },
    }
  )
);

const translations: Record<Language, Record<string, string>> = {
  en: {
    "nav.jobs": "Find Jobs",
    "nav.freelancers": "Hire Freelancers",
    "nav.login": "Log In",
    "nav.register": "Sign Up",
    "nav.dashboard": "Dashboard",
    "nav.admin": "Admin",
    "hero.title": "The Premium Marketplace for GCC Talent",
    "hero.subtitle": "Connect with vetted freelancers across the Arab world. Elevate your business with regional expertise.",
    "hero.cta": "Post a Job",
    "hero.secondary_cta": "Find Work",
    "common.loading": "Loading...",
    "common.error": "An error occurred.",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "job.budget": "Budget",
    "job.posted": "Posted",
    "job.apply": "Apply Now",
    "freelancer.rate": "Hourly Rate",
    "freelancer.hire": "Hire Me",
  },
  ar: {
    "nav.jobs": "البحث عن وظائف",
    "nav.freelancers": "وظف مستقلين",
    "nav.login": "تسجيل الدخول",
    "nav.register": "حساب جديد",
    "nav.dashboard": "لوحة التحكم",
    "nav.admin": "الإدارة",
    "hero.title": "المنصة الرائدة للمستقلين في الخليج",
    "hero.subtitle": "تواصل مع أفضل المستقلين المعتمدين في العالم العربي. ارتقِ بأعمالك مع خبرات إقليمية.",
    "hero.cta": "أضف وظيفة",
    "hero.secondary_cta": "ابحث عن عمل",
    "common.loading": "جاري التحميل...",
    "common.error": "حدث خطأ.",
    "common.save": "حفظ",
    "common.cancel": "إلغاء",
    "job.budget": "الميزانية",
    "job.posted": "تاريخ النشر",
    "job.apply": "قدم الآن",
    "freelancer.rate": "السعر للساعة",
    "freelancer.hire": "وظفني",
  },
};

export function useTranslation() {
  const { lang, setLang } = useI18nStore();

  const t = (key: string): string => {
    return translations[lang]?.[key] || key;
  };

  const isRtl = lang === "ar";

  return { t, lang, setLang, isRtl };
}

export function formatCurrency(amount: number, currency: string = "AED", lang: string = "en") {
  if (lang === "ar") {
    return `${amount.toLocaleString("ar-AE")} ${currency === "AED" ? "د.إ" : currency}`;
  }
  return `${currency} ${amount.toLocaleString("en-AE")}`;
}

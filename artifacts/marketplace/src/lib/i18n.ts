import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type ReactNode, useEffect } from "react";
import { useLocalizationStrings, useLocalizationSettings, reportMissingLocalizationKeys } from "./api-public";

// Buffer + debounce for missing key reporting so we batch POSTs to the
// /admin/localization/missing endpoint instead of hammering it on every
// render. Keys exceeding the per-request batch size remain in the pending
// queue and are flushed in subsequent ticks (no silent drops).
const reportedMissing = new Set<string>();
const pendingMissing = new Map<string, { key: string; locale: "ar" | "en"; namespace: string }>();
const REPORT_BATCH_SIZE = 50;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    const items = Array.from(pendingMissing.values());
    if (items.length === 0) return;
    const batch = items.slice(0, REPORT_BATCH_SIZE);
    for (const item of batch) {
      const id = `${item.locale}::${item.key}`;
      pendingMissing.delete(id);
      reportedMissing.add(id);
    }
    void reportMissingLocalizationKeys(batch);
    // If there are leftover items beyond the batch size, schedule another
    // flush so nothing is dropped.
    if (pendingMissing.size > 0) scheduleFlush();
  }, 2000);
}

function queueMissing(key: string, locale: "ar" | "en") {
  const id = `${locale}::${key}`;
  if (reportedMissing.has(id) || pendingMissing.has(id)) return;
  const namespace = key.includes(".") ? key.split(".")[0]! : "common";
  pendingMissing.set(id, { key, locale, namespace });
  scheduleFlush();
}

type Language = "en" | "ar";
type Currency = "AED" | "USD";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const lang = useI18nStore((s) => s.lang);
  const setLang = useI18nStore((s) => s.setLang);
  const { data: locSettings } = useLocalizationSettings();

  useEffect(() => {
    if (!locSettings) return;
    const enabled = locSettings.enabledLocales ?? ["ar", "en"];
    if (!enabled.includes(lang)) {
      const fallback = (locSettings.defaultLocale as Language) ?? "ar";
      if (fallback === "ar" || fallback === "en") setLang(fallback);
    }
  }, [locSettings, lang, setLang]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const rtlList = locSettings?.rtlLocales ?? ["ar"];
    const isRtl = rtlList.includes(lang) || (locSettings?.isRtlByDefault === true && lang === locSettings.defaultLocale);
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  }, [lang, locSettings]);
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
    "hero.eyebrow": "The Arabic-first freelance marketplace for the UAE & GCC",
    "hero.title": "Hire trusted GCC talent — in Arabic & English",
    "hero.body":
      "From Dubai to Riyadh, ATMEMLY connects businesses with verified Arab freelancers across design, development, marketing and more. Secure escrow, fast delivery, and bilingual support every step of the way.",
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
    "section.blog.title": "From the ATMEMLY Blog",
    "section.blog.subtitle": "Tips, guides and stories for freelancers and clients",
    "section.faq.title": "Frequently Asked Questions",
    "section.faq.subtitle": "Everything you need to know about ATMEMLY",
    "page.blog.title": "Blog",
    "page.blog.subtitle": "Latest insights and tips for freelance work in the GCC.",
    "section.app.title": "Get the ATMEMLY mobile app",
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
      "ATMEMLY is an Arabic-first freelance marketplace connecting clients with trusted talent across the UAE and GCC.",
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
    "jobs.title": "Find Jobs",
    "jobs.subtitle": "Discover freelance opportunities across the GCC.",
    "jobs.filters.heading": "Filters",
    "jobs.filters.searchLabel": "Search",
    "jobs.filters.searchPlaceholder": "Search jobs…",
    "jobs.filters.categoryLabel": "Category",
    "jobs.filters.allCategories": "All Categories",
    "jobs.empty.title": "No jobs found",
    "jobs.empty.body": "Try adjusting your filters or search query.",
    "jobs.empty.clear": "Clear Filters",
    "jobs.budget.suffix": "Budget",
    "jobs.proposals": "proposals",
    "auth.login.title": "Welcome back",
    "auth.login.subtitle": "Enter your credentials to access your account",
    "auth.login.email": "Email",
    "auth.login.password": "Password",
    "auth.login.submit": "Log In",
    "auth.login.noAccount": "Don't have an account?",
    "auth.login.signupLink": "Sign up",
    "auth.login.welcomeToast": "Welcome back!",
    "auth.login.welcomeBody": "You have successfully logged in.",
    "auth.login.failedTitle": "Login Failed",
    "auth.login.failedBody": "Invalid credentials. Please try again.",
    "auth.register.title": "Create an Account",
    "auth.register.subtitle": "Join {brand} to hire or find work across the GCC.",
    "auth.register.roleLabel": "I want to…",
    "auth.register.roleClient": "Hire Talent",
    "auth.register.roleFreelancer": "Find Work",
    "auth.register.fullName": "Full Name",
    "auth.register.companyName": "Company Name",
    "auth.register.email": "Email",
    "auth.register.password": "Password",
    "auth.register.submit": "Sign Up",
    "auth.register.haveAccount": "Already have an account?",
    "auth.register.loginLink": "Log in",
    "auth.register.successTitle": "Account created!",
    "auth.register.successBody": "Welcome to {brand}.",
    "auth.register.failedTitle": "Registration Failed",
    "auth.register.failedBody": "An error occurred during registration.",
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
    "hero.eyebrow": "منصة العمل الحر العربية الأولى للإمارات ودول الخليج",
    "hero.title": "وظّف أفضل الكفاءات العربية الموثوقة في الخليج",
    "hero.body":
      "من دبي إلى الرياض، تربط أتمملي أصحاب الأعمال بمستقلين عرب موثقين في التصميم والتطوير والتسويق والمزيد. مدفوعات آمنة عبر نظام الضمان، وتسليم سريع، ودعم ثنائي اللغة في كل خطوة.",
    "hero.search.placeholder": "ابحث هنا…",
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
    "page.blog.title": "المدونة",
    "page.blog.subtitle": "أحدث الرؤى والنصائح حول العمل الحر في منطقة الخليج.",
    "section.app.title": "حمّل تطبيق أتمملي للجوال",
    "section.app.body": "أدر مشاريعك وتواصل مع عملائك واستلم مدفوعاتك من أي مكان.",
    "section.app.appStore": "App Store",
    "section.app.googlePlay": "Google Play",
    "card.startingFrom": "يبدأ من",
    "card.byFreelancer": "بواسطة",
    "card.viewProfile": "عرض الملف",
    "card.viewService": "عرض التفاصيل",
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
      "أتمملي هي منصة عمل حر عربية أولاً تربط العملاء بأفضل الكفاءات الموثوقة في الإمارات ودول الخليج.",
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
    "jobs.title": "تصفح الوظائف",
    "jobs.subtitle": "اكتشف فرص العمل الحر في منطقة الخليج.",
    "jobs.filters.heading": "تصفية النتائج",
    "jobs.filters.searchLabel": "بحث",
    "jobs.filters.searchPlaceholder": "ابحث عن وظائف…",
    "jobs.filters.categoryLabel": "التصنيف",
    "jobs.filters.allCategories": "كل التصنيفات",
    "jobs.empty.title": "لا توجد وظائف",
    "jobs.empty.body": "حاول تعديل التصفية أو كلمات البحث.",
    "jobs.empty.clear": "إعادة ضبط التصفية",
    "jobs.budget.suffix": "الميزانية",
    "jobs.proposals": "عرض",
    "auth.login.title": "مرحباً بعودتك",
    "auth.login.subtitle": "أدخل بياناتك للوصول إلى حسابك",
    "auth.login.email": "البريد الإلكتروني",
    "auth.login.password": "كلمة المرور",
    "auth.login.submit": "تسجيل الدخول",
    "auth.login.noAccount": "لا تملك حساباً؟",
    "auth.login.signupLink": "إنشاء حساب",
    "auth.login.welcomeToast": "مرحباً بعودتك!",
    "auth.login.welcomeBody": "تم تسجيل دخولك بنجاح.",
    "auth.login.failedTitle": "فشل تسجيل الدخول",
    "auth.login.failedBody": "بيانات الاعتماد غير صحيحة. حاول مرة أخرى.",
    "auth.register.title": "إنشاء حساب جديد",
    "auth.register.subtitle": "انضم إلى {brand} للتوظيف أو العمل عن بُعد في منطقة الخليج.",
    "auth.register.roleLabel": "أريد أن…",
    "auth.register.roleClient": "أوظّف كفاءات",
    "auth.register.roleFreelancer": "أبحث عن عمل",
    "auth.register.fullName": "الاسم الكامل",
    "auth.register.companyName": "اسم الشركة",
    "auth.register.email": "البريد الإلكتروني",
    "auth.register.password": "كلمة المرور",
    "auth.register.submit": "إنشاء حساب",
    "auth.register.haveAccount": "لديك حساب بالفعل؟",
    "auth.register.loginLink": "تسجيل الدخول",
    "auth.register.successTitle": "تم إنشاء الحساب!",
    "auth.register.successBody": "مرحباً بك في {brand}.",
    "auth.register.failedTitle": "فشل إنشاء الحساب",
    "auth.register.failedBody": "حدث خطأ أثناء إنشاء الحساب.",
  },
};

export function useTranslation() {
  const { lang, setLang, currency, setCurrency } = useI18nStore();
  const { data: locSettings } = useLocalizationSettings();
  const fallbackLocale = (locSettings?.fallbackLocale as Language | undefined) ?? "en";
  const { data: cmsStrings } = useLocalizationStrings(lang);
  const { data: cmsFallbackStrings } = useLocalizationStrings(fallbackLocale);

  // Once the CMS strings have been fetched, we know whether each key has
  // been customized by an admin. Any key referenced by the UI that has no
  // CMS entry for the active locale should be surfaced to the admin
  // editor — even if a bundled default exists — so admins get full
  // visibility of every translatable string.
  const cmsLoadedForLang = !!cmsStrings;

  const t = (key: string, vars?: Record<string, string | number>): string => {
    const interpolate = (s: string): string =>
      vars ? s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`)) : s;

    if (cmsLoadedForLang) {
      const has = cmsStrings && Object.prototype.hasOwnProperty.call(cmsStrings, key);
      if (!has) queueMissing(key, lang);
    }

    const cmsValue = cmsStrings?.[key];
    if (typeof cmsValue === "string" && cmsValue.length > 0) return interpolate(cmsValue);
    if (fallbackLocale !== lang) {
      const cmsFb = cmsFallbackStrings?.[key];
      if (typeof cmsFb === "string" && cmsFb.length > 0) return interpolate(cmsFb);
    }
    const own = translations[lang]?.[key];
    if (own) return interpolate(own);
    if (fallbackLocale !== lang) {
      const fb = translations[fallbackLocale]?.[key];
      if (fb) return interpolate(fb);
    }
    return key;
  };

  const rtlList = locSettings?.rtlLocales ?? ["ar"];
  const isRtl = rtlList.includes(lang);

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

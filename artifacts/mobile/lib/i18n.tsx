import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { I18nManager } from "react-native";

import { BRAND } from "@workspace/branding";
import { getStoredLang, setStoredLang } from "./api";

export type Lang = "ar" | "en";

type Dict = Record<string, { ar: string; en: string }>;

const dict: Dict = {
  appName: { ar: BRAND.nameAr, en: BRAND.name },
  tagline: {
    ar: "سوق المستقلين الأول في الإمارات",
    en: "The UAE's leading freelance marketplace",
  },
  // Tabs
  home: { ar: "الرئيسية", en: "Home" },
  jobs: { ar: "المشاريع", en: "Jobs" },
  freelancers: { ar: "المستقلون", en: "Freelancers" },
  messages: { ar: "الرسائل", en: "Messages" },
  profile: { ar: "الحساب", en: "Profile" },
  // Auth
  login: { ar: "تسجيل الدخول", en: "Sign in" },
  register: { ar: "إنشاء حساب", en: "Create account" },
  logout: { ar: "تسجيل الخروج", en: "Sign out" },
  email: { ar: "البريد الإلكتروني", en: "Email" },
  password: { ar: "كلمة المرور", en: "Password" },
  fullName: { ar: "الاسم الكامل", en: "Full name" },
  role: { ar: "أنا", en: "I am a" },
  client: { ar: "عميل", en: "Client" },
  freelancer: { ar: "مستقل", en: "Freelancer" },
  forgotPassword: { ar: "نسيت كلمة المرور؟", en: "Forgot password?" },
  noAccount: { ar: "ليس لديك حساب؟", en: "No account?" },
  haveAccount: { ar: "لديك حساب؟", en: "Have an account?" },
  resetEmailSent: {
    ar: "إذا كان البريد مسجلاً، ستصلك تعليمات إعادة التعيين.",
    en: "If the email is registered, reset instructions are on the way.",
  },
  // Generic
  search: { ar: "بحث...", en: "Search..." },
  apply: { ar: "تطبيق", en: "Apply" },
  cancel: { ar: "إلغاء", en: "Cancel" },
  save: { ar: "حفظ", en: "Save" },
  send: { ar: "إرسال", en: "Send" },
  submit: { ar: "إرسال", en: "Submit" },
  retry: { ar: "إعادة المحاولة", en: "Retry" },
  loading: { ar: "جاري التحميل...", en: "Loading..." },
  errorTitle: { ar: "حدث خطأ", en: "Something went wrong" },
  emptyTitle: { ar: "لا توجد نتائج", en: "No results" },
  viewAll: { ar: "عرض الكل", en: "View all" },
  back: { ar: "رجوع", en: "Back" },
  details: { ar: "التفاصيل", en: "Details" },
  // Home
  heroTitle: {
    ar: "وظّف أفضل المواهب في الإمارات",
    en: "Hire the UAE's top talent",
  },
  heroSubtitle: {
    ar: "آلاف المستقلين الموثّقين جاهزون لإنجاز مشروعك",
    en: "Thousands of verified freelancers ready to deliver",
  },
  postJob: { ar: "انشر مشروعك", en: "Post a job" },
  browseJobs: { ar: "تصفّح المشاريع", en: "Browse jobs" },
  browseFreelancers: { ar: "تصفّح المستقلين", en: "Browse freelancers" },
  topCategories: { ar: "أهم التصنيفات", en: "Top categories" },
  featuredJobs: { ar: "وظائف مميزة", en: "Featured jobs" },
  topFreelancers: { ar: "أبرز المستقلين", en: "Top freelancers" },
  stats: { ar: "إحصائيات السوق", en: "Marketplace stats" },
  // Job
  budget: { ar: "الميزانية", en: "Budget" },
  fixed: { ar: "ثابتة", en: "Fixed" },
  hourly: { ar: "بالساعة", en: "Hourly" },
  proposals: { ar: "العروض", en: "Proposals" },
  applyNow: { ar: "قدّم عرضك", en: "Submit a proposal" },
  bidAmount: { ar: "قيمة عرضك (د.إ)", en: "Your bid (AED)" },
  coverLetter: { ar: "رسالة التغطية", en: "Cover letter" },
  // Freelancer
  rate: { ar: "السعر/ساعة", en: "Rate/hr" },
  rating: { ar: "التقييم", en: "Rating" },
  reviews: { ar: "تقييمات", en: "Reviews" },
  skills: { ar: "المهارات", en: "Skills" },
  about: { ar: "نبذة", en: "About" },
  contact: { ar: "تواصل", en: "Message" },
  // Post job
  jobTitle: { ar: "عنوان المشروع", en: "Job title" },
  jobDescription: { ar: "وصف المشروع", en: "Description" },
  category: { ar: "التصنيف", en: "Category" },
  budgetType: { ar: "نوع الميزانية", en: "Budget type" },
  // Messages
  noConversations: {
    ar: "لا توجد محادثات بعد",
    en: "No conversations yet",
  },
  typeMessage: { ar: "اكتب رسالة...", en: "Type a message..." },
  // Notifications
  notifications: { ar: "الإشعارات", en: "Notifications" },
  markAllRead: { ar: "تحديد الكل كمقروء", en: "Mark all read" },
  // Settings
  settings: { ar: "الإعدادات", en: "Settings" },
  language: { ar: "اللغة", en: "Language" },
  arabic: { ar: "العربية", en: "Arabic" },
  english: { ar: "الإنجليزية", en: "English" },
  switchedLangNote: {
    ar: "أعد تشغيل التطبيق لتفعيل الاتجاه الجديد بالكامل.",
    en: "Restart the app to fully apply the new direction.",
  },
  // Dashboards
  dashboard: { ar: "لوحة التحكم", en: "Dashboard" },
  myJobs: { ar: "مشاريعي", en: "My jobs" },
  myProposals: { ar: "عروضي", en: "My proposals" },
  myEarnings: { ar: "أرباحي", en: "Earnings" },
  payments: { ar: "المدفوعات", en: "Payments" },
  totalEarnings: { ar: "إجمالي الأرباح", en: "Total earnings" },
  pendingPayments: { ar: "مدفوعات معلّقة", en: "Pending payments" },
  activeJobs: { ar: "مشاريع نشطة", en: "Active jobs" },
  proposalsSent: { ar: "عروض مُرسلة", en: "Proposals sent" },
  // Statuses
  open: { ar: "مفتوح", en: "Open" },
  inProgress: { ar: "قيد التنفيذ", en: "In progress" },
  completed: { ar: "مكتمل", en: "Completed" },
  cancelled: { ar: "ملغى", en: "Cancelled" },
  pending: { ar: "بانتظار الموافقة", en: "Pending" },
  accepted: { ar: "مقبول", en: "Accepted" },
  rejected: { ar: "مرفوض", en: "Rejected" },
  // Validation
  required: { ar: "هذا الحقل مطلوب", en: "This field is required" },
  invalidEmail: { ar: "بريد إلكتروني غير صالح", en: "Invalid email" },
  passwordTooShort: {
    ar: "كلمة المرور قصيرة جدًا",
    en: "Password is too short",
  },
};

type I18nContextValue = {
  lang: Lang;
  isRTL: boolean;
  setLang: (lang: Lang) => Promise<void>;
  t: (key: keyof typeof dict) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");

  useEffect(() => {
    void (async () => {
      const stored = await getStoredLang();
      if (stored) setLangState(stored);
    })();
  }, []);

  useEffect(() => {
    const wantRTL = lang === "ar";
    if (I18nManager.isRTL !== wantRTL) {
      try {
        I18nManager.allowRTL(wantRTL);
        I18nManager.forceRTL(wantRTL);
      } catch {
        // no-op
      }
    }
  }, [lang]);

  const setLang = useCallback(async (next: Lang) => {
    setLangState(next);
    await setStoredLang(next);
    const wantRTL = next === "ar";
    try {
      I18nManager.allowRTL(wantRTL);
      I18nManager.forceRTL(wantRTL);
    } catch {
      // no-op
    }
  }, []);

  const t = useCallback(
    (key: keyof typeof dict) => dict[key]?.[lang] ?? String(key),
    [lang],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ lang, isRTL: lang === "ar", setLang, t }),
    [lang, setLang, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

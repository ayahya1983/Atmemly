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
  skillsRequired: { ar: "المهارات المطلوبة", en: "Skills required" },
  about: { ar: "نبذة", en: "About" },
  aboutMe: { ar: "نبذة عني", en: "About me" },
  aboutClient: { ar: "عن العميل", en: "About the client" },
  contact: { ar: "تواصل", en: "Message" },
  location: { ar: "الموقع", en: "Location" },
  portfolio: { ar: "أعمال سابقة", en: "Portfolio" },
  completedJobs: { ar: "مشاريع مكتملة", en: "Completed jobs" },
  remote: { ar: "عن بُعد", en: "Remote" },
  jobDetails: { ar: "تفاصيل المشروع", en: "Job details" },
  saved: { ar: "تم الحفظ", en: "Saved" },
  unsaved: { ar: "تمت الإزالة", en: "Removed" },
  saveJobAction: { ar: "حفظ المشروع", en: "Save job" },
  unsaveJobAction: { ar: "إزالة من المحفوظات", en: "Remove from saved" },
  proposalSent: { ar: "تم إرسال عرضك بنجاح", en: "Proposal submitted" },
  days: { ar: "أيام التسليم", en: "Delivery days" },
  error: { ar: "خطأ", en: "Error" },
  onlyClientsCanMessage: {
    ar: "يجب تسجيل الدخول كعميل للتواصل مع المستقلين",
    en: "Sign in as a client to contact freelancers",
  },
  onlyFreelancersCanApply: {
    ar: "يجب تسجيل الدخول كمستقل لتقديم عرض",
    en: "Sign in as a freelancer to submit a proposal",
  },
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
  in_progress: { ar: "قيد التنفيذ", en: "In progress" },
  completed: { ar: "مكتمل", en: "Completed" },
  cancelled: { ar: "ملغى", en: "Cancelled" },
  closed: { ar: "مغلق", en: "Closed" },
  pending: { ar: "بانتظار الموافقة", en: "Pending" },
  shortlisted: { ar: "في القائمة المختصرة", en: "Shortlisted" },
  accepted: { ar: "مقبول", en: "Accepted" },
  rejected: { ar: "مرفوض", en: "Rejected" },
  withdrawn: { ar: "مسحوب", en: "Withdrawn" },
  // Validation
  required: { ar: "هذا الحقل مطلوب", en: "This field is required" },
  invalidEmail: { ar: "بريد إلكتروني غير صالح", en: "Invalid email" },
  passwordTooShort: {
    ar: "كلمة المرور قصيرة جدًا",
    en: "Password is too short",
  },
  // Profile editing
  editProfile: { ar: "تعديل الملف", en: "Edit profile" },
  headline: { ar: "العنوان المهني", en: "Headline" },
  headlineHint: {
    ar: "مثال: مصمم تجربة المستخدم الأول",
    en: "e.g. Senior UX Designer",
  },
  bio: { ar: "نبذة شخصية", en: "Bio" },
  hourlyRate: { ar: "السعر بالساعة (د.إ)", en: "Hourly rate (AED)" },
  companyName: { ar: "اسم الشركة", en: "Company name" },
  overview: { ar: "نبذة عن الشركة", en: "Overview" },
  addPortfolioItem: { ar: "إضافة عمل", en: "Add portfolio item" },
  noPortfolio: {
    ar: "لم تضف أي أعمال بعد.",
    en: "No portfolio items added yet.",
  },
  projectTitle: { ar: "عنوان المشروع", en: "Project title" },
  projectUrl: { ar: "رابط المشروع", en: "Project URL" },
  projectDescription: { ar: "وصف قصير", en: "Short description" },
  remove: { ar: "حذف", en: "Remove" },
  profileUpdated: { ar: "تم تحديث الملف", en: "Profile updated" },
  serviceCover: { ar: "صورة غلاف الخدمة", en: "Service cover image" },
  uploadCover: { ar: "رفع غلاف", en: "Upload cover" },
  replaceCover: { ar: "استبدال الغلاف", en: "Replace cover" },
  removeCover: { ar: "إزالة الغلاف", en: "Remove cover" },
  uploading: { ar: "جاري الرفع...", en: "Uploading..." },
  // Saved jobs
  savedJobs: { ar: "المشاريع المحفوظة", en: "Saved jobs" },
  noSavedJobs: { ar: "لا توجد مشاريع محفوظة", en: "No saved jobs yet" },
  // Job applicants
  applicants: { ar: "المتقدمون", en: "Applicants" },
  viewApplicants: { ar: "عرض العروض", en: "View proposals" },
  noApplicants: { ar: "لا توجد عروض بعد.", en: "No proposals yet." },
  shortlist: { ar: "قائمة مختصرة", en: "Shortlist" },
  accept: { ar: "قبول", en: "Accept" },
  reject: { ar: "رفض", en: "Reject" },
  payNow: { ar: "ادفع الآن", en: "Pay now" },
  securePayment: { ar: "دفع آمن", en: "Secure payment" },
  cardNumber: { ar: "رقم البطاقة", en: "Card number" },
  expiry: { ar: "تاريخ الانتهاء", en: "Expiry" },
  cvc: { ar: "CVC", en: "CVC" },
  pay: { ar: "ادفع", en: "Pay" },
  paymentSuccess: {
    ar: "تم الدفع وإغلاق المشروع.",
    en: "Payment received. Job marked complete.",
  },
  paymentFailed: { ar: "فشل الدفع", en: "Payment failed" },
  leaveReview: { ar: "أضف تقييمًا", en: "Leave a review" },
  ratingLabel: { ar: "التقييم (1-5)", en: "Rating (1-5)" },
  comment: { ar: "تعليق", en: "Comment" },
  submitReview: { ar: "إرسال التقييم", en: "Submit review" },
  reviewSubmitted: { ar: "تم إرسال التقييم", en: "Review submitted" },
  message: { ar: "مراسلة", en: "Message" },
  deliveryDays: { ar: "أيام التسليم", en: "Delivery days" },
  proposalRate: { ar: "السعر المقترح", en: "Proposed rate" },
  forbidden: {
    ar: "غير مصرح لك بعرض هذه الصفحة.",
    en: "You don't have access to this page.",
  },
  demoAccounts: { ar: "حسابات تجريبية", en: "Demo accounts" },
  demoAccountsHint: {
    ar: "اضغط لتعبئة بيانات الدخول التلقائي",
    en: "Tap to autofill credentials",
  },
  demoClient: { ar: "تجربة كعميل", en: "Sign in as client" },
  demoFreelancer: { ar: "تجربة كمستقل", en: "Sign in as freelancer" },
  // Common
  comma: { ar: "،", en: "," },
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

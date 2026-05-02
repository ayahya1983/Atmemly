import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Language = 'en' | 'ar';

interface Translations {
  [key: string]: {
    en: string;
    ar: string;
  };
}

const translations: Translations = {
  // Navigation
  "nav.jobs": { en: "Find Jobs", ar: "تصفح الوظائف" },
  "nav.freelancers": { en: "Freelancers", ar: "المستقلين" },
  "nav.login": { en: "Log In", ar: "تسجيل الدخول" },
  "nav.register": { en: "Sign Up", ar: "إنشاء حساب" },
  "nav.dashboard": { en: "Dashboard", ar: "لوحة التحكم" },
  "nav.admin": { en: "Admin", ar: "الإدارة" },
  "nav.logout": { en: "Log Out", ar: "تسجيل الخروج" },
  "nav.profile": { en: "Profile", ar: "الملف الشخصي" },
  
  // Roles
  "role.client": { en: "Client", ar: "عميل" },
  "role.freelancer": { en: "Freelancer", ar: "مستقل" },
  
  // Home
  "home.hero.title": { en: "Find the Best Freelancers in the GCC", ar: "ابحث عن أفضل المستقلين في الخليج" },
  "home.hero.subtitle": { en: "Connect with vetted professionals for your next big project.", ar: "تواصل مع محترفين موثوقين لمشروعك الكبير القادم." },
  "home.hero.cta": { en: "Post a Job", ar: "أضف وظيفة" },
  "home.stats.freelancers": { en: "Freelancers", ar: "المستقلين" },
  "home.stats.jobs": { en: "Active Jobs", ar: "وظائف نشطة" },
  "home.stats.completed": { en: "Completed Projects", ar: "مشاريع مكتملة" },
  
  // Common
  "common.loading": { en: "Loading...", ar: "جاري التحميل..." },
  "common.error": { en: "An error occurred", ar: "حدث خطأ" },
  "common.save": { en: "Save", ar: "حفظ" },
  "common.cancel": { en: "Cancel", ar: "إلغاء" },
  "common.search": { en: "Search...", ar: "بحث..." },
  
  // Auth
  "auth.email": { en: "Email Address", ar: "البريد الإلكتروني" },
  "auth.password": { en: "Password", ar: "كلمة المرور" },
  "auth.fullName": { en: "Full Name", ar: "الاسم الكامل" },
  "auth.companyName": { en: "Company Name", ar: "اسم الشركة" },
  "auth.login.title": { en: "Welcome Back", ar: "مرحباً بعودتك" },
  "auth.register.title": { en: "Create an Account", ar: "إنشاء حساب جديد" },
};

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
  formatCurrency: (amount: number, currency?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Language>(() => {
    const stored = localStorage.getItem('lang');
    return (stored === 'ar' || stored === 'en') ? stored : 'en';
  });

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem('lang', newLang);
  };

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  const t = (key: string) => {
    return translations[key]?.[lang] || key;
  };

  const formatCurrency = (amount: number, currency: string = 'AED') => {
    if (lang === 'ar' && currency === 'AED') {
      return `${amount.toLocaleString('ar-AE')} د.إ`;
    }
    return `${currency} ${amount.toLocaleString('en-AE')}`;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, formatCurrency }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
};

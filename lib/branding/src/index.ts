/**
 * Single source of truth for ATMEMLY brand strings.
 * Update values here and every artifact picks them up on rebuild.
 */
export const BRAND = {
  name: "ATMEMLY",
  nameAr: "أتمملي",
  platformName: "ATMEMLY Platform",
  platformNameAr: "منصة أتمملي",
  email: "hello@atmemly.com",
  supportEmail: "support@atmemly.com",
  companyName: "ATMEMLY Marketplace LLC",
  domain: "atmemly.com",
  currency: "AED",
  seoTitle: "ATMEMLY | UAE Freelance Marketplace",
  seoDescription:
    "ATMEMLY is the UAE's bilingual freelance marketplace connecting clients with the best Arab talent across the GCC.",
  seoTitleAr: "أتمملي | سوق المستقلين في الإمارات",
  seoDescriptionAr:
    "أتمملي هي منصة العمل الحر ثنائية اللغة في الإمارات، تربط العملاء بأفضل الكفاءات العربية في الخليج.",
} as const;

export type Brand = typeof BRAND;

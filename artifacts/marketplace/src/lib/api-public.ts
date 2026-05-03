import { useQuery } from "@tanstack/react-query";

const BASE = `${import.meta.env.BASE_URL}api`.replace(/\/+/g, "/");

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export interface BlogPost {
  id: number;
  slug: string;
  locale: string;
  title: string;
  excerpt: string | null;
  body: string;
  coverUrl: string | null;
  category: string | null;
  categoryId: number | null;
  tags: string[] | null;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: string | null;
}

export interface FaqItem {
  id: number;
  locale: string;
  category: string;
  question: string;
  answer: string;
  sortOrder: number;
  isActive: boolean;
}

export interface Testimonial {
  id: number;
  locale: string;
  authorName: string;
  authorTitle: string | null;
  body: string;
  rating: number;
  avatarUrl: string | null;
  isFeatured: boolean;
  sortOrder: number;
}

export interface FeaturedListing {
  id: number;
  kind: string;
  targetId: number;
  endsAt: string;
}

export function useBlogPosts(locale: "ar" | "en") {
  return useQuery({
    queryKey: ["public-blog", locale],
    queryFn: () => getJson<BlogPost[]>(`/blog?locale=${locale}`),
    staleTime: 60_000,
  });
}

export function useFaqs(locale: "ar" | "en") {
  return useQuery({
    queryKey: ["public-faqs", locale],
    queryFn: () => getJson<FaqItem[]>(`/faqs?locale=${locale}`),
    staleTime: 60_000,
  });
}

export function useTestimonials(locale: "ar" | "en") {
  return useQuery({
    queryKey: ["public-testimonials", locale],
    queryFn: () => getJson<Testimonial[]>(`/testimonials?locale=${locale}`),
    staleTime: 60_000,
  });
}

export function useFeaturedListings(kind?: "job" | "freelancer") {
  return useQuery({
    queryKey: ["public-featured", kind ?? "all"],
    queryFn: () => getJson<FeaturedListing[]>(`/featured${kind ? `?kind=${kind}` : ""}`),
    staleTime: 60_000,
  });
}

export interface CmsPage {
  id: number;
  slug: string;
  locale: string;
  title: string;
  body: string;
  seoTitle: string | null;
  seoDescription: string | null;
}

export function useCmsPage(slug: string, locale: "ar" | "en") {
  return useQuery({
    queryKey: ["public-cms-page", slug, locale],
    queryFn: () => getJson<CmsPage>(`/cms/pages/${slug}?locale=${locale}`),
    staleTime: 60_000,
    retry: false,
  });
}

export interface CmsBlock {
  id: number;
  key: string;
  locale: string;
  title: string | null;
  body: string;
}

export function useCmsBlock(key: string, locale: "ar" | "en") {
  return useQuery({
    queryKey: ["public-cms-block", key, locale],
    queryFn: () => getJson<CmsBlock>(`/cms/blocks/${key}?locale=${locale}`),
    staleTime: 60_000,
    retry: false,
  });
}

export function useBlogPost(slug: string, locale: "ar" | "en") {
  return useQuery({
    queryKey: ["public-blog-post", slug, locale],
    queryFn: () => getJson<BlogPost>(`/blog/${encodeURIComponent(slug)}?locale=${locale}`),
    staleTime: 60_000,
    retry: false,
    enabled: slug.length > 0,
  });
}

// CMS public hooks (homepage, navigation, footer, SEO, i18n).

export interface CmsHomepageHero {
  titleAr: string; titleEn: string;
  subtitleAr: string; subtitleEn: string;
  searchPlaceholderAr: string; searchPlaceholderEn: string;
  imageUrl: string;
  ctaPrimaryLabelAr: string; ctaPrimaryLabelEn: string; ctaPrimaryHref: string;
  ctaSecondaryLabelAr: string; ctaSecondaryLabelEn: string; ctaSecondaryHref: string;
}
export interface CmsHomepageSection {
  key: string;
  titleAr: string; titleEn: string;
  subtitleAr: string; subtitleEn: string;
  isVisible: boolean;
  sortOrder: number;
}
export interface CmsHomepage { hero: CmsHomepageHero; sections: CmsHomepageSection[] }

// Allow only safe in-app or external http(s) hrefs. Blocks `javascript:`,
// `data:`, etc. Returns the safe href or a fallback when invalid.
export function safeHref(href: string | null | undefined, fallback = "/"): string {
  if (!href) return fallback;
  const s = href.trim();
  if (s.startsWith("/") || s.startsWith("#") || s.startsWith("?")) return s;
  if (/^https?:\/\//i.test(s)) return s;
  if (/^mailto:|^tel:/i.test(s)) return s;
  return fallback;
}

export function useCmsHomepage() {
  return useQuery({
    queryKey: ["public-cms-homepage"],
    queryFn: () => getJson<CmsHomepage>("/cms/homepage"),
    staleTime: 60_000,
  });
}

export interface NavigationItem {
  id: number;
  location: "HEADER" | "FOOTER";
  parentId: number | null;
  labelAr: string; labelEn: string;
  href: string;
  sortOrder: number;
  isActive: boolean;
}
export function useNavigation(location: "HEADER" | "FOOTER") {
  return useQuery({
    queryKey: ["public-navigation", location],
    queryFn: () => getJson<NavigationItem[]>(`/navigation?location=${location}`),
    staleTime: 60_000,
  });
}

export interface FooterLink { id: number; groupId: number; labelAr: string; labelEn: string; href: string; sortOrder: number; isActive: boolean }
export interface FooterGroup { id: number; titleAr: string; titleEn: string; sortOrder: number; isActive: boolean; links: FooterLink[] }
export interface FooterSettings {
  id: number;
  descriptionAr: string; descriptionEn: string;
  contactEmail: string; contactPhone: string; whatsapp: string;
  addressAr: string; addressEn: string;
  copyrightAr: string; copyrightEn: string;
  socialLinks: { platform: string; url: string }[];
}
export interface FooterPayload { settings: FooterSettings | null; groups: FooterGroup[] }

export function useFooter() {
  return useQuery({
    queryKey: ["public-footer"],
    queryFn: () => getJson<FooterPayload>("/footer"),
    staleTime: 60_000,
  });
}

export interface SeoSettings {
  id: number;
  siteTitleAr: string; siteTitleEn: string;
  siteDescriptionAr: string; siteDescriptionEn: string;
  ogImageUrl: string | null;
  twitterHandle: string | null;
  defaultLocale: "ar" | "en";
}
export function useSeoSettings() {
  return useQuery({
    queryKey: ["public-seo"],
    queryFn: () => getJson<SeoSettings | null>("/seo"),
    staleTime: 5 * 60_000,
  });
}

export interface BlogCategory {
  id: number;
  slug: string;
  nameAr: string; nameEn: string;
  sortOrder: number; isActive: boolean;
  seoTitleAr: string | null; seoTitleEn: string | null;
  seoDescriptionAr: string | null; seoDescriptionEn: string | null;
  seoImageUrl: string | null;
}
export function useBlogCategories() {
  return useQuery({
    queryKey: ["public-blog-categories"],
    queryFn: () => getJson<BlogCategory[]>("/blog/categories"),
    staleTime: 5 * 60_000,
  });
}

export interface LocalizationSettings {
  id: number;
  defaultLocale: string;
  enabledLocales: string[];
  rtlLocales: string[];
  fallbackLocale: string;
  isRtlByDefault: boolean;
}
export function useLocalizationSettings() {
  return useQuery({
    queryKey: ["public-localization-settings"],
    queryFn: () => getJson<LocalizationSettings>("/localization/settings"),
    staleTime: 5 * 60_000,
  });
}

// External href detector (external,
// mailto, tel, in-page anchor, or query-only). Internal-path hrefs ("/jobs",
// "/blog/x") still go through the wouter router for client-side navigation.
export function isExternalHref(href: string): boolean {
  return /^(https?:|mailto:|tel:)/i.test(href);
}

export function useLocalizationStrings(locale: "ar" | "en") {
  return useQuery({
    queryKey: ["public-localization", locale],
    queryFn: () => getJson<Record<string, string>>(`/localization/${locale}`),
    staleTime: 5 * 60_000,
  });
}

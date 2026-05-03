import { useQuery } from "@tanstack/react-query";

const BASE = `${import.meta.env.BASE_URL}api`.replace(/\/+/g, "/");

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "HttpError";
  }
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new HttpError(res.status, `${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export async function reportMissingLocalizationKeys(
  keys: { key: string; locale: "ar" | "en"; namespace?: string }[],
): Promise<void> {
  if (keys.length === 0) return;
  try {
    await fetch(`${BASE}/admin/localization/missing`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ keys }),
    });
  } catch {
    // Best-effort reporting; never throw from translation paths.
  }
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

// Fetch testimonials in `locale`; if empty, fall back to the localization
// settings' fallbackLocale so the carousel still has content even when the
// admin only published testimonials in one language.
export function useTestimonialsWithFallback(locale: "ar" | "en") {
  const { data: settings } = useLocalizationSettings();
  const primary = useTestimonials(locale);
  const rawFb = (settings?.fallbackLocale ?? "en").toLowerCase();
  const fbLocale: "ar" | "en" = rawFb === "ar" ? "ar" : "en";
  const needsFallback =
    primary.isSuccess && (primary.data?.length ?? 0) === 0 && fbLocale !== locale;
  const fallback = useQuery({
    queryKey: ["public-testimonials", fbLocale, "fallback"],
    queryFn: () => getJson<Testimonial[]>(`/testimonials?locale=${fbLocale}`),
    staleTime: 60_000,
    enabled: needsFallback,
  });
  if (needsFallback && fallback.data) {
    return { ...primary, data: fallback.data } as typeof primary;
  }
  return primary;
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

// Resolve a CMS page in `locale`; if the API returns 404, transparently
// retry against the localization fallback locale. Exposes `isNotFound`
// (true when both lookups 404) so callers can render a 404 page.
export function useCmsPageWithFallback(slug: string, locale: "ar" | "en") {
  const { data: settings } = useLocalizationSettings();
  const rawFb = (settings?.fallbackLocale ?? "en").toLowerCase();
  const fbLocale: "ar" | "en" = rawFb === "ar" ? "ar" : "en";
  const primary = useCmsPage(slug, locale);
  const primary404 =
    primary.isError && primary.error instanceof HttpError && primary.error.status === 404;
  const enableFallback = primary404 && fbLocale !== locale;
  const fallback = useQuery({
    queryKey: ["public-cms-page", slug, fbLocale, "fallback"],
    queryFn: () => getJson<CmsPage>(`/cms/pages/${slug}?locale=${fbLocale}`),
    staleTime: 60_000,
    retry: false,
    enabled: enableFallback,
  });
  const fallback404 =
    fallback.isError && fallback.error instanceof HttpError && fallback.error.status === 404;
  if (primary.data) {
    return { data: primary.data, isLoading: false, isError: false, error: null, isNotFound: false };
  }
  if (enableFallback && fallback.data) {
    return { data: fallback.data, isLoading: false, isError: false, error: null, isNotFound: false };
  }
  if (primary404 && (!enableFallback || fallback404)) {
    return { data: undefined, isLoading: false, isError: true, error: primary.error, isNotFound: true };
  }
  if (primary.isError && !primary404) {
    return { data: undefined, isLoading: false, isError: true, error: primary.error, isNotFound: false };
  }
  // Fallback errored with a non-404 (e.g. 500). Surface the failure so callers
  // don't silently render blank content.
  if (enableFallback && fallback.isError && !fallback404) {
    return { data: undefined, isLoading: false, isError: true, error: fallback.error, isNotFound: false };
  }
  const isLoading = primary.isLoading || (enableFallback && fallback.isLoading);
  return { data: undefined, isLoading, isError: false, error: null, isNotFound: false };
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

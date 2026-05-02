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
  tags: string[] | null;
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
    queryFn: async () => {
      const list = await getJson<BlogPost[]>(`/blog?locale=${locale}`);
      const found = list.find((p) => p.slug === slug);
      if (!found) throw new Error("Blog post not found");
      return found;
    },
    staleTime: 60_000,
    retry: false,
  });
}

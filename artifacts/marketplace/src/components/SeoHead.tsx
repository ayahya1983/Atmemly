import { useEffect } from "react";
import { useTranslation } from "@/lib/i18n";
import { useSeoSettings } from "@/lib/api-public";

function setMeta(name: string, content: string, attr: "name" | "property" = "name") {
  if (!content) return;
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

interface Props {
  title?: string;
  description?: string;
  image?: string;
}

export function SeoHead({ title, description, image }: Props) {
  const { lang } = useTranslation();
  const { data: seo } = useSeoSettings();

  useEffect(() => {
    const siteTitle = seo ? (lang === "ar" ? seo.siteTitleAr : seo.siteTitleEn) : "";
    const siteDesc = seo ? (lang === "ar" ? seo.siteDescriptionAr : seo.siteDescriptionEn) : "";
    const fullTitle = title && siteTitle ? `${title} — ${siteTitle}` : title || siteTitle;
    const fullDesc = description || siteDesc;
    const ogImage = image || seo?.ogImageUrl || "";
    if (fullTitle) document.title = fullTitle;
    if (fullDesc) setMeta("description", fullDesc);
    if (fullTitle) {
      setMeta("og:title", fullTitle, "property");
      setMeta("twitter:title", fullTitle);
    }
    if (fullDesc) {
      setMeta("og:description", fullDesc, "property");
      setMeta("twitter:description", fullDesc);
    }
    if (ogImage) {
      setMeta("og:image", ogImage, "property");
      setMeta("twitter:image", ogImage);
    }
    if (seo?.twitterHandle) setMeta("twitter:site", seo.twitterHandle);
    document.documentElement.setAttribute("lang", lang);
  }, [lang, seo, title, description, image]);

  return null;
}

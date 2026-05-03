import { Logo } from "../ui/logo";
import { useTranslation } from "@/lib/i18n";
import { useFooter, useNavigation, safeHref, isExternalHref } from "@/lib/api-public";
import { Mail, Phone, MapPin, Facebook, Twitter, Instagram, Linkedin, Youtube, MessageCircle, Globe } from "lucide-react";
import { Link } from "wouter";
import { BRAND } from "@workspace/branding";

function SmartLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  if (isExternalHref(href)) {
    const isHttp = /^https?:/i.test(href);
    return (
      <a
        href={href}
        className={className}
        {...(isHttp ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {children}
      </a>
    );
  }
  return <Link href={href} className={className}>{children}</Link>;
}

export function Footer() {
  const { t, isRtl, lang } = useTranslation();
  const year = new Date().getFullYear();
  const { data: footerCms } = useFooter();
  const { data: footerNav } = useNavigation("FOOTER");
  const footerNavItems = (footerNav ?? [])
    .filter((n) => n.parentId === null)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((n) => ({ href: safeHref(n.href), label: lang === "ar" ? n.labelAr : n.labelEn }));

  const fallbackPlatform = [
    { href: "/jobs", label: isRtl ? "الوظائف والمشاريع" : "Jobs & Projects" },
    { href: "/freelancers", label: t("nav.freelancers") },
    { href: "/blog", label: t("nav.blog") },
    { href: "/about", label: isRtl ? "كيف تعمل" : "How it works" },
  ];
  const fallbackCompany = [
    { href: "/about", label: t("footer.about_us") },
    { href: "/contact", label: t("footer.contact") },
  ];
  const fallbackLegal = [
    { href: "/terms", label: t("footer.terms") },
    { href: "/privacy", label: t("footer.privacy") },
    { href: "/cancellation", label: t("footer.cancellation") },
  ];

  const cmsGroups = footerCms?.groups ?? [];
  const groupLinks = (idx: number, fallback: { href: string; label: string }[]) => {
    const g = cmsGroups[idx];
    if (!g || g.links.length === 0) return fallback;
    return g.links.map((l) => ({ href: l.href, label: lang === "ar" ? l.labelAr : l.labelEn }));
  };
  const groupTitle = (idx: number, fallback: string) => {
    const g = cmsGroups[idx];
    if (!g) return fallback;
    return lang === "ar" ? g.titleAr : g.titleEn;
  };
  const platformLinks = groupLinks(0, fallbackPlatform);
  const companyLinks = groupLinks(1, fallbackCompany);
  const legalLinks = groupLinks(2, fallbackLegal);

  const cmsSettings = footerCms?.settings;
  const SOCIAL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    facebook: Facebook, twitter: Twitter, x: Twitter, instagram: Instagram,
    linkedin: Linkedin, youtube: Youtube, whatsapp: MessageCircle,
  };
  const fallbackSocials = [
    { platform: "facebook", url: "#" }, { platform: "twitter", url: "#" },
    { platform: "instagram", url: "#" }, { platform: "linkedin", url: "#" },
  ];
  const socials = (cmsSettings?.socialLinks?.length ? cmsSettings.socialLinks : fallbackSocials)
    .map((s) => ({ ...s, url: safeHref(s.url, "#") }));
  const aboutText = cmsSettings && (lang === "ar" ? cmsSettings.descriptionAr : cmsSettings.descriptionEn) || t("footer.about");
  const emailAddr = cmsSettings?.contactEmail || BRAND.email;
  const phoneNumber = cmsSettings?.contactPhone || "+971 4 000 0000";
  const addressText = cmsSettings && (lang === "ar" ? cmsSettings.addressAr : cmsSettings.addressEn) || (isRtl ? "دبي، الإمارات العربية المتحدة" : "Dubai, United Arab Emirates");
  const copyrightText = cmsSettings && (lang === "ar" ? cmsSettings.copyrightAr : cmsSettings.copyrightEn) || `${isRtl ? BRAND.platformNameAr : BRAND.platformName}. ${t("footer.rights")}`;

  return (
    <footer className="bg-card border-t mt-auto" data-testid="footer">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* About */}
          <div className="space-y-4 lg:col-span-1">
            <div className="flex items-center">
              <Logo />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {aboutText}
            </p>
            <div className="flex items-center gap-3 pt-2" data-testid="footer-socials">
              {socials.map((s) => {
                const Icon = SOCIAL_ICONS[s.platform.toLowerCase()] ?? Globe;
                return (
                  <a key={s.platform} href={s.url} target="_blank" rel="noopener noreferrer"
                    className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
                    aria-label={s.platform} data-testid={`social-${s.platform}`}>
                    <Icon className="w-4 h-4" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Platform */}
          <div>
            <h4 className="font-bold mb-4 text-foreground">{groupTitle(0, t("footer.platform"))}</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              {platformLinks.map((l) => (
                <li key={l.href}>
                  <SmartLink href={safeHref(l.href)} className="hover:text-primary transition-colors">{l.label}</SmartLink>
                </li>
              ))}
            </ul>
          </div>

          {/* CMS-managed FOOTER navigation items, when admins have added any. */}
          {footerNavItems.length > 0 && (
            <div data-testid="footer-nav">
              <h4 className="font-bold mb-4 text-foreground">{isRtl ? "روابط" : "Links"}</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                {footerNavItems.map((l) => (
                  <li key={`${l.href}-${l.label}`}>
                    <SmartLink href={l.href} className="hover:text-primary transition-colors">{l.label}</SmartLink>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Company + Legal */}
          <div>
            <h4 className="font-bold mb-4 text-foreground">{groupTitle(1, t("footer.company"))}</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              {companyLinks.map((l) => (
                <li key={l.href}>
                  <SmartLink href={safeHref(l.href)} className="hover:text-primary transition-colors">{l.label}</SmartLink>
                </li>
              ))}
            </ul>
            <h4 className="font-bold mb-4 mt-6 text-foreground">{groupTitle(2, t("footer.legal"))}</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              {legalLinks.map((l) => (
                <li key={l.href}>
                  <SmartLink href={safeHref(l.href)} className="hover:text-primary transition-colors">{l.label}</SmartLink>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-bold mb-4 text-foreground">{t("footer.contact")}</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Mail className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                <a href={`mailto:${emailAddr}`} className="hover:text-primary transition-colors">{emailAddr}</a>
              </li>
              <li className="flex items-start gap-2">
                <Phone className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                <a href={`tel:${phoneNumber.replace(/\s+/g, "")}`} dir="ltr" className="hover:text-primary transition-colors">{phoneNumber}</a>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                <span>{addressText}</span>
              </li>
            </ul>
            <Link href="/contact">
              <button className="mt-5 w-full inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors">
                {t("footer.contactCta")}
              </button>
            </Link>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-sm text-muted-foreground">
          <div>&copy; {year} {copyrightText}</div>
          <div className="flex items-center gap-4">
            {legalLinks.map((l) => (
              <SmartLink key={l.href} href={safeHref(l.href)} className="hover:text-primary transition-colors">{l.label}</SmartLink>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

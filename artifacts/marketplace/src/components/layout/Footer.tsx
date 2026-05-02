import { Logo } from "../ui/logo";
import { useTranslation } from "@/lib/i18n";
import { Mail, Phone, MapPin, Facebook, Twitter, Instagram, Linkedin } from "lucide-react";
import { Link } from "wouter";

export function Footer() {
  const { t, isRtl } = useTranslation();
  const year = new Date().getFullYear();

  const platformLinks = [
    { href: "/jobs", label: isRtl ? "الوظائف والمشاريع" : "Jobs & Projects" },
    { href: "/freelancers", label: t("nav.freelancers") },
    { href: "/blog", label: t("nav.blog") },
    { href: "/about", label: isRtl ? "كيف تعمل" : "How it works" },
  ];

  const companyLinks = [
    { href: "/about", label: t("footer.about_us") },
    { href: "/contact", label: t("footer.contact") },
  ];

  const legalLinks = [
    { href: "/terms", label: t("footer.terms") },
    { href: "/privacy", label: t("footer.privacy") },
    { href: "/cancellation", label: t("footer.cancellation") },
  ];

  return (
    <footer className="bg-card border-t mt-auto" data-testid="footer">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* About */}
          <div className="space-y-4 lg:col-span-1">
            <Logo />
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("footer.about")}
            </p>
            <div className="flex items-center gap-3 pt-2">
              <a href="#" className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors" aria-label="Facebook">
                <Facebook className="w-4 h-4" />
              </a>
              <a href="#" className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors" aria-label="Twitter">
                <Twitter className="w-4 h-4" />
              </a>
              <a href="#" className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors" aria-label="Instagram">
                <Instagram className="w-4 h-4" />
              </a>
              <a href="#" className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors" aria-label="LinkedIn">
                <Linkedin className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Platform */}
          <div>
            <h4 className="font-bold mb-4 text-foreground">{t("footer.platform")}</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              {platformLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-primary transition-colors">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company + Legal */}
          <div>
            <h4 className="font-bold mb-4 text-foreground">{t("footer.company")}</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              {companyLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-primary transition-colors">{l.label}</Link>
                </li>
              ))}
            </ul>
            <h4 className="font-bold mb-4 mt-6 text-foreground">{t("footer.legal")}</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              {legalLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-primary transition-colors">{l.label}</Link>
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
                <a href="mailto:hello@khidma.ae" className="hover:text-primary transition-colors">hello@khidma.ae</a>
              </li>
              <li className="flex items-start gap-2">
                <Phone className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                <a href="tel:+97140000000" dir="ltr" className="hover:text-primary transition-colors">+971 4 000 0000</a>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                <span>{isRtl ? "دبي، الإمارات العربية المتحدة" : "Dubai, United Arab Emirates"}</span>
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
          <div>&copy; {year} {isRtl ? "منصة خدمة" : "Khidma Platform"}. {t("footer.rights")}</div>
          <div className="flex items-center gap-4">
            {legalLinks.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-primary transition-colors">{l.label}</Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

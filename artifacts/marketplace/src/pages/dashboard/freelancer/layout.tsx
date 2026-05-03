import { Link, useLocation } from "wouter";
import { LayoutDashboard, Briefcase, FileText, Bookmark, MessageSquare, CreditCard, UserCircle, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

export function FreelancerDashboardLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { t } = useTranslation();

  const links = [
    { href: "/dashboard/freelancer", label: "Overview", icon: LayoutDashboard },
    { href: "/dashboard/freelancer/jobs", label: "Browse Jobs", icon: Briefcase },
    { href: "/dashboard/freelancer/proposals", label: "My Proposals", icon: FileText },
    { href: "/dashboard/freelancer/saved-jobs", label: "Saved Jobs", icon: Bookmark },
    { href: "/dashboard/freelancer/messages", label: "Messages", icon: MessageSquare },
    { href: "/dashboard/freelancer/earnings", label: "Earnings", icon: CreditCard },
    { href: "/dashboard/freelancer/profile", label: "Profile", icon: UserCircle },
    { href: "/dashboard/freelancer/linked-accounts", label: "Linked Accounts", icon: Link2 },
  ];

  return (
    <div className="container mx-auto px-4 py-8 flex flex-col md:flex-row gap-8">
      <aside className="w-full md:w-64 shrink-0">
        <nav className="flex md:flex-col gap-2 overflow-x-auto pb-4 md:pb-0">
          {links.map(link => {
            const Icon = link.icon;
            const isActive = location === link.href || (link.href !== "/dashboard/freelancer" && location.startsWith(link.href));
            return (
              <Link key={link.href} href={link.href}>
                <Button variant={isActive ? "secondary" : "ghost"} className="w-full justify-start gap-3">
                  <Icon className="w-4 h-4" />
                  <span className="whitespace-nowrap">{link.label}</span>
                </Button>
              </Link>
            )
          })}
        </nav>
      </aside>
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}

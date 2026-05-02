import { Link, useLocation } from "wouter";
import { LayoutDashboard, Briefcase, MessageSquare, CreditCard, UserCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

export function ClientDashboardLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { t } = useTranslation();

  const links = [
    { href: "/dashboard/client", label: "Overview", icon: LayoutDashboard },
    { href: "/dashboard/client/jobs", label: "My Jobs", icon: Briefcase },
    { href: "/dashboard/client/jobs/new", label: "Post Job", icon: Plus },
    { href: "/dashboard/client/messages", label: "Messages", icon: MessageSquare },
    { href: "/dashboard/client/payments", label: "Payments", icon: CreditCard },
    { href: "/dashboard/client/profile", label: "Profile", icon: UserCircle },
  ];

  return (
    <div className="container mx-auto px-4 py-8 flex flex-col md:flex-row gap-8">
      <aside className="w-full md:w-64 shrink-0">
        <nav className="flex md:flex-col gap-2 overflow-x-auto pb-4 md:pb-0">
          {links.map(link => {
            const Icon = link.icon;
            const isActive = location === link.href || (link.href !== "/dashboard/client" && location.startsWith(link.href));
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

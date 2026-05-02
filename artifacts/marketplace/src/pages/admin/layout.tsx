import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, Briefcase, CreditCard, Star, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const links = [
    { href: "/admin", label: "Analytics", icon: LayoutDashboard },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/jobs", label: "Jobs", icon: Briefcase },
    { href: "/admin/payments", label: "Payments", icon: CreditCard },
    { href: "/admin/reviews", label: "Reviews", icon: Star },
    { href: "/admin/complaints", label: "Complaints", icon: AlertTriangle },
  ];

  return (
    <div className="container mx-auto px-4 py-8 flex flex-col md:flex-row gap-8">
      <aside className="w-full md:w-64 shrink-0">
        <nav className="flex md:flex-col gap-2 overflow-x-auto pb-4 md:pb-0">
          {links.map(link => {
            const Icon = link.icon;
            const isActive = location === link.href || (link.href !== "/admin" && location.startsWith(link.href));
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

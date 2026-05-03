import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Search, Loader2, User as UserIcon, Briefcase, FileText, Building2, KeyRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/lib/permissions";
import { adminApi } from "@/lib/api-admin";
import { useAdminListSsoProviders } from "@workspace/api-client-react";

interface UserHit { id: number; fullName: string; email: string; role: string; }
interface JobHit { id: number; title: string; status: string; clientName: string; }
interface ContractHit { id: number; title: string; status: string; }
interface FreelancerHit { userId: number; fullName: string; email: string; headline: string | null; }
interface ClientHit { userId: number; fullName: string; email: string; companyName: string | null; }

interface ResultGroup {
  key: "users" | "jobs" | "contracts" | "freelancers" | "clients" | "sso";
  labelEn: string;
  labelAr: string;
  icon: typeof UserIcon;
  items: SearchItem[];
}

interface SearchItem {
  id: string;
  href: string;
  primary: string;
  secondary?: string;
}

function useDebounce<T>(value: T, delay: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export function GlobalSearch() {
  const { lang } = useTranslation();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<ResultGroup[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const debounced = useDebounce(query.trim(), 250);

  const canUsers = hasPermission(user, "users", "read");
  const canJobs = hasPermission(user, "jobs", "read");
  const canContracts = hasPermission(user, "contracts", "read");
  const canFreelancers = hasPermission(user, "freelancers", "read");
  const canClients = hasPermission(user, "clients", "read");
  // SSO providers are listed via the generated hook; only super admins
  // typically have read access. We also filter the cached list locally.
  const { data: ssoProviders } = useAdminListSsoProviders();

  // Click-outside to close.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Cmd/Ctrl+K to focus.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Fetch results.
  useEffect(() => {
    if (debounced.length < 2) {
      setGroups([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setActiveIndex(0);
    const qs = encodeURIComponent(debounced);

    const tasks: Promise<ResultGroup | null>[] = [];

    if (canUsers) {
      tasks.push(
        adminApi
          .get<{ items: UserHit[] }>(`/admin/users/search?q=${qs}&limit=5`)
          .then((r) => ({
            key: "users" as const,
            labelEn: "Users",
            labelAr: "المستخدمون",
            icon: UserIcon,
            items: (r.items ?? []).map((u) => ({
              id: `u-${u.id}`,
              href: `/users?focus=${u.id}`,
              primary: u.fullName || u.email,
              secondary: `${u.email} · ${u.role}`,
            })),
          }))
          .catch(() => null),
      );
    }
    if (canJobs) {
      tasks.push(
        adminApi
          .get<{ items: JobHit[] }>(`/admin/jobs/search?q=${qs}&limit=5`)
          .then((r) => ({
            key: "jobs" as const,
            labelEn: "Jobs",
            labelAr: "الوظائف",
            icon: Briefcase,
            items: (r.items ?? []).map((j) => ({
              id: `j-${j.id}`,
              href: `/jobs?focus=${j.id}`,
              primary: j.title,
              secondary: `#${j.id} · ${j.status}${j.clientName ? ` · ${j.clientName}` : ""}`,
            })),
          }))
          .catch(() => null),
      );
    }
    if (canContracts) {
      // Contracts: title search + direct id lookup if numeric.
      tasks.push(
        adminApi
          .get<{ items: ContractHit[] }>(`/admin/contracts/search?q=${qs}&limit=5`)
          .then((r) => ({
            key: "contracts" as const,
            labelEn: "Contracts",
            labelAr: "العقود",
            icon: FileText,
            items: (r.items ?? []).map((c) => ({
              id: `c-${c.id}`,
              href: `/contracts?focus=${c.id}`,
              primary: c.title || `Contract #${c.id}`,
              secondary: `#${c.id} · ${c.status}`,
            })),
          }))
          .catch(() => null),
      );
    }
    if (canFreelancers) {
      tasks.push(
        adminApi
          .get<{ items: FreelancerHit[] }>(`/admin/freelancers?q=${qs}&limit=5`)
          .then((r) => ({
            key: "freelancers" as const,
            labelEn: "Freelancers",
            labelAr: "المستقلون",
            icon: UserIcon,
            items: (r.items ?? []).map((f) => ({
              id: `f-${f.userId}`,
              href: `/freelancers?focus=${f.userId}`,
              primary: f.fullName || f.email,
              secondary: f.headline ?? f.email,
            })),
          }))
          .catch(() => null),
      );
    }
    if (canClients) {
      tasks.push(
        adminApi
          .get<{ items: ClientHit[] }>(`/admin/clients?q=${qs}&limit=5`)
          .then((r) => ({
            key: "clients" as const,
            labelEn: "Clients",
            labelAr: "العملاء",
            icon: Building2,
            items: (r.items ?? []).map((c) => ({
              id: `cl-${c.userId}`,
              href: `/clients?focus=${c.userId}`,
              primary: c.fullName || c.email,
              secondary: c.companyName ?? c.email,
            })),
          }))
          .catch(() => null),
      );
    }
    // SSO providers are filtered client-side from the already-cached list.
    if (ssoProviders && ssoProviders.length) {
      const needle = debounced.toLowerCase();
      const matches = ssoProviders.filter((p) =>
        p.slug.toLowerCase().includes(needle) ||
        p.displayName.toLowerCase().includes(needle) ||
        p.type.toLowerCase().includes(needle),
      );
      if (matches.length) {
        tasks.push(
          Promise.resolve({
            key: "sso" as const,
            labelEn: "SSO providers",
            labelAr: "مزوّدو الدخول الموحّد",
            icon: KeyRound,
            items: matches.slice(0, 5).map((p) => ({
              id: `sso-${p.id}`,
              href: `/sso/providers/${p.id}`,
              primary: p.displayName,
              secondary: `${p.slug} · ${p.type}${p.enabled ? "" : " · disabled"}`,
            })),
          }),
        );
      }
    }

    Promise.all(tasks).then((results) => {
      if (cancelled) return;
      setGroups(results.filter((g): g is ResultGroup => !!g && g.items.length > 0));
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [debounced, canUsers, canJobs, canContracts, canFreelancers, canClients, ssoProviders]);

  // Flat list for keyboard navigation.
  const flatItems = useMemo(
    () => groups.flatMap((g) => g.items),
    [groups],
  );

  function go(item: SearchItem) {
    setOpen(false);
    setQuery("");
    setLocation(item.href);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(flatItems.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      const item = flatItems[activeIndex];
      if (item) {
        e.preventDefault();
        go(item);
      }
    }
  }

  const showDropdown = open && debounced.length >= 2;
  const hasAnyPermission =
    canUsers || canJobs || canContracts || canFreelancers || canClients;

  if (!hasAnyPermission) {
    return <div className="flex-1 max-w-xl" />;
  }

  let runningIndex = -1;

  return (
    <div ref={containerRef} className="flex-1 max-w-xl relative">
      <div className="relative">
        <Search className="absolute top-1/2 -translate-y-1/2 ltr:left-3 rtl:right-3 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={lang === "ar" ? "بحث سريع..." : "Quick search users, jobs, contracts, SSO…"}
          className="ltr:pl-9 rtl:pr-9 ltr:pr-12 rtl:pl-12 h-10 bg-muted/40 border-muted"
          data-testid="input-global-search"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          role="combobox"
        />
        <kbd className="hidden md:flex absolute top-1/2 -translate-y-1/2 ltr:right-2 rtl:left-2 items-center gap-1 text-[10px] text-muted-foreground bg-background border border-border rounded px-1.5 py-0.5 pointer-events-none">
          <span>⌘</span>K
        </kbd>
      </div>

      {showDropdown && (
        <div
          className="absolute top-full mt-2 left-0 right-0 bg-popover border border-border rounded-md shadow-lg overflow-hidden z-40"
          data-testid="dropdown-global-search"
        >
          {loading && groups.length === 0 ? (
            <div className="py-6 flex items-center justify-center text-sm text-muted-foreground gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {lang === "ar" ? "جاري البحث..." : "Searching..."}
            </div>
          ) : groups.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {lang === "ar" ? "لا توجد نتائج" : "No results"}
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto py-1">
              {groups.map((group) => {
                const Icon = group.icon;
                return (
                  <div key={group.key}>
                    <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                      {lang === "ar" ? group.labelAr : group.labelEn}
                    </div>
                    {group.items.map((item) => {
                      runningIndex += 1;
                      const isActive = runningIndex === activeIndex;
                      const idx = runningIndex;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onMouseEnter={() => setActiveIndex(idx)}
                          onClick={() => go(item)}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-start hover-elevate ${isActive ? "bg-accent" : ""}`}
                          data-testid={`search-result-${item.id}`}
                        >
                          <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">{item.primary}</div>
                            {item.secondary && (
                              <div className="text-xs text-muted-foreground truncate">{item.secondary}</div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

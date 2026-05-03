import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/lib/i18n";
import { AdminShell } from "@/components/layout/AdminShell";
import { isAdminStaff, hasPermission, effectiveAdminRole, type Resource } from "@/lib/permissions";
import { Loader2 } from "lucide-react";

import AdminLogin from "@/pages/login";
import AdminSsoCallback from "@/pages/sso-callback";
import AdminSsoOverview from "@/pages/sso/overview";
import AdminSsoProviders from "@/pages/sso/providers";
import AdminSsoProviderEdit from "@/pages/sso/provider-edit";
import AdminSsoAudit from "@/pages/sso/audit";
import AdminSsoSettings from "@/pages/sso/settings";
import Forbidden from "@/pages/forbidden";
import NotFound from "@/pages/not-found";

import AdminDashboard from "@/pages/dashboard";
import AdminAnalytics from "@/pages/analytics";
import AdminReports from "@/pages/reports";
import AdminUsers from "@/pages/users";
import AdminFreelancers from "@/pages/freelancers";
import AdminClients from "@/pages/clients";
import AdminVerifications from "@/pages/verifications";
import AdminJobs from "@/pages/jobs";
import AdminContracts from "@/pages/contracts";
import AdminDisputes from "@/pages/disputes";
import AdminComplaints from "@/pages/complaints";
import AdminReviews from "@/pages/reviews";
import AdminPayments from "@/pages/payments";
import AdminPayouts from "@/pages/payouts";
import AdminCmsPages from "@/pages/cms-pages";
import AdminCmsBlocks from "@/pages/cms-blocks";
import AdminCmsHomepage from "@/pages/cms-homepage";
import AdminCmsNavigation from "@/pages/cms-navigation";
import AdminCmsFooter from "@/pages/cms-footer";
import AdminCmsMedia from "@/pages/cms-media";
import AdminCmsSeo from "@/pages/cms-seo";
import AdminCmsLocalization from "@/pages/cms-localization";
import AdminCmsBlogCategories from "@/pages/cms-blog-categories";
import AdminBlog from "@/pages/blog-admin";
import AdminCmsBlog from "@/pages/cms-blog";
import AdminCmsBlogEdit from "@/pages/cms-blog-edit";
import AdminFaqs from "@/pages/faqs";
import AdminCmsFaq from "@/pages/cms-faq";
import AdminTestimonials from "@/pages/testimonials";
import AdminBannedWords from "@/pages/banned-words";
import AdminBroadcasts from "@/pages/broadcasts";
import AdminAuditLogs from "@/pages/audit-logs";
import AdminSettings from "@/pages/settings";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function FullScreenLoader() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );
}

function ProtectedRoute({
  children,
  resource,
  requireSuperAdmin = false,
}: {
  children: ReactNode;
  resource?: Resource;
  requireSuperAdmin?: boolean;
}) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <FullScreenLoader />;
  if (!user) return <Redirect to="/login" />;
  if (!isAdminStaff(user)) {
    if (typeof window !== "undefined") window.location.href = "/login";
    return <FullScreenLoader />;
  }
  if (requireSuperAdmin && effectiveAdminRole(user) !== "super_admin") {
    return <AdminShell><Forbidden /></AdminShell>;
  }
  if (resource && !hasPermission(user, resource, "read")) {
    return <AdminShell><Forbidden /></AdminShell>;
  }
  return <AdminShell>{children}</AdminShell>;
}

function Routes() {
  return (
    <Switch>
      <Route path="/login" component={AdminLogin} />
      <Route path="/auth/sso/:provider/callback" component={AdminSsoCallback} />
      <Route path="/sso"><ProtectedRoute requireSuperAdmin><AdminSsoOverview /></ProtectedRoute></Route>
      <Route path="/sso/providers"><ProtectedRoute requireSuperAdmin><AdminSsoProviders /></ProtectedRoute></Route>
      <Route path="/sso/providers/new"><ProtectedRoute requireSuperAdmin><AdminSsoProviderEdit /></ProtectedRoute></Route>
      <Route path="/sso/providers/:id"><ProtectedRoute requireSuperAdmin><AdminSsoProviderEdit /></ProtectedRoute></Route>
      <Route path="/sso/audit"><ProtectedRoute requireSuperAdmin><AdminSsoAudit /></ProtectedRoute></Route>
      <Route path="/sso/settings"><ProtectedRoute requireSuperAdmin><AdminSsoSettings /></ProtectedRoute></Route>

      <Route path="/"><ProtectedRoute resource="dashboard"><AdminDashboard /></ProtectedRoute></Route>
      <Route path="/analytics"><ProtectedRoute resource="reports"><AdminAnalytics /></ProtectedRoute></Route>
      <Route path="/reports"><ProtectedRoute resource="reports"><AdminReports /></ProtectedRoute></Route>

      <Route path="/users"><ProtectedRoute resource="users"><AdminUsers /></ProtectedRoute></Route>
      <Route path="/freelancers"><ProtectedRoute resource="freelancers"><AdminFreelancers /></ProtectedRoute></Route>
      <Route path="/clients"><ProtectedRoute resource="clients"><AdminClients /></ProtectedRoute></Route>
      <Route path="/verifications"><ProtectedRoute resource="verifications"><AdminVerifications /></ProtectedRoute></Route>

      <Route path="/jobs"><ProtectedRoute resource="jobs"><AdminJobs /></ProtectedRoute></Route>
      <Route path="/contracts"><ProtectedRoute resource="contracts"><AdminContracts /></ProtectedRoute></Route>
      <Route path="/disputes"><ProtectedRoute resource="disputes"><AdminDisputes /></ProtectedRoute></Route>
      <Route path="/complaints"><ProtectedRoute resource="complaints"><AdminComplaints /></ProtectedRoute></Route>
      <Route path="/reviews"><ProtectedRoute resource="reviews"><AdminReviews /></ProtectedRoute></Route>

      <Route path="/payments"><ProtectedRoute resource="payments"><AdminPayments /></ProtectedRoute></Route>
      <Route path="/payouts"><ProtectedRoute resource="payouts"><AdminPayouts /></ProtectedRoute></Route>

      <Route path="/cms-homepage"><ProtectedRoute resource="cms"><AdminCmsHomepage /></ProtectedRoute></Route>
      <Route path="/cms-navigation"><ProtectedRoute resource="cms"><AdminCmsNavigation /></ProtectedRoute></Route>
      <Route path="/cms-footer"><ProtectedRoute resource="cms"><AdminCmsFooter /></ProtectedRoute></Route>
      <Route path="/cms-media"><ProtectedRoute resource="cms"><AdminCmsMedia /></ProtectedRoute></Route>
      <Route path="/cms-seo"><ProtectedRoute resource="seo"><AdminCmsSeo /></ProtectedRoute></Route>
      <Route path="/cms-localization"><ProtectedRoute resource="localization"><AdminCmsLocalization /></ProtectedRoute></Route>
      <Route path="/cms-pages"><ProtectedRoute resource="cms"><AdminCmsPages /></ProtectedRoute></Route>
      <Route path="/cms-blocks"><ProtectedRoute resource="cms"><AdminCmsBlocks /></ProtectedRoute></Route>
      {/* Aliases under /cms/* for the contract-style admin URLs. */}
      <Route path="/cms/homepage"><ProtectedRoute resource="cms"><AdminCmsHomepage /></ProtectedRoute></Route>
      <Route path="/cms/navigation"><ProtectedRoute resource="cms"><AdminCmsNavigation /></ProtectedRoute></Route>
      <Route path="/cms/footer"><ProtectedRoute resource="cms"><AdminCmsFooter /></ProtectedRoute></Route>
      <Route path="/cms/media"><ProtectedRoute resource="cms"><AdminCmsMedia /></ProtectedRoute></Route>
      <Route path="/cms/seo"><ProtectedRoute resource="seo"><AdminCmsSeo /></ProtectedRoute></Route>
      <Route path="/cms/localization"><ProtectedRoute resource="localization"><AdminCmsLocalization /></ProtectedRoute></Route>
      <Route path="/cms/pages"><ProtectedRoute resource="cms"><AdminCmsPages /></ProtectedRoute></Route>
      <Route path="/cms/blocks"><ProtectedRoute resource="cms"><AdminCmsBlocks /></ProtectedRoute></Route>
      <Route path="/cms/blog"><ProtectedRoute resource="blog"><AdminCmsBlog /></ProtectedRoute></Route>
      <Route path="/cms/blog/new"><ProtectedRoute resource="blog"><AdminCmsBlogEdit /></ProtectedRoute></Route>
      <Route path="/cms/blog/:id"><ProtectedRoute resource="blog"><AdminCmsBlogEdit /></ProtectedRoute></Route>
      <Route path="/cms-blog"><ProtectedRoute resource="blog"><AdminCmsBlog /></ProtectedRoute></Route>
      <Route path="/cms-blog/new"><ProtectedRoute resource="blog"><AdminCmsBlogEdit /></ProtectedRoute></Route>
      <Route path="/cms-blog/:id"><ProtectedRoute resource="blog"><AdminCmsBlogEdit /></ProtectedRoute></Route>
      <Route path="/cms/blog-categories"><ProtectedRoute resource="blog"><AdminCmsBlogCategories /></ProtectedRoute></Route>
      <Route path="/cms-blog-categories"><ProtectedRoute resource="blog"><AdminCmsBlogCategories /></ProtectedRoute></Route>
      <Route path="/cms/faqs"><ProtectedRoute resource="faqs"><AdminCmsFaq /></ProtectedRoute></Route>
      <Route path="/cms-faqs"><ProtectedRoute resource="faqs"><AdminCmsFaq /></ProtectedRoute></Route>
      <Route path="/cms/testimonials"><ProtectedRoute resource="testimonials"><AdminTestimonials /></ProtectedRoute></Route>
      <Route path="/blog"><ProtectedRoute resource="blog"><AdminCmsBlog /></ProtectedRoute></Route>
      <Route path="/blog-legacy"><ProtectedRoute resource="blog"><AdminBlog /></ProtectedRoute></Route>
      <Route path="/faqs"><ProtectedRoute resource="faqs"><AdminCmsFaq /></ProtectedRoute></Route>
      <Route path="/faqs-legacy"><ProtectedRoute resource="faqs"><AdminFaqs /></ProtectedRoute></Route>
      <Route path="/testimonials"><ProtectedRoute resource="testimonials"><AdminTestimonials /></ProtectedRoute></Route>

      <Route path="/banned-words"><ProtectedRoute resource="moderation"><AdminBannedWords /></ProtectedRoute></Route>
      <Route path="/broadcasts"><ProtectedRoute resource="notifications"><AdminBroadcasts /></ProtectedRoute></Route>
      <Route path="/audit-logs"><ProtectedRoute resource="audit_logs"><AdminAuditLogs /></ProtectedRoute></Route>
      <Route path="/settings"><ProtectedRoute resource="settings"><AdminSettings /></ProtectedRoute></Route>

      <Route><ProtectedRoute><NotFound /></ProtectedRoute></Route>
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Routes />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/lib/i18n";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import { ErrorBoundary } from "@/components/ErrorBoundary";

import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Jobs from "@/pages/jobs";
import JobDetail from "@/pages/job-detail";
import Freelancers from "@/pages/freelancers";
import FreelancerProfile from "@/pages/freelancer-profile";
import ClientProfile from "@/pages/client-profile";
import Login from "@/pages/login";
import SsoCallback from "@/pages/sso-callback";
import Register from "@/pages/register";
import About from "@/pages/about";
import Contact from "@/pages/contact";
import Terms from "@/pages/terms";
import Privacy from "@/pages/privacy";
import Cancellation from "@/pages/cancellation";
import Blog from "@/pages/blog";
import BlogDetail from "@/pages/blog-detail";
import Faq from "@/pages/faq";

import { ClientDashboardLayout } from "@/pages/dashboard/client/layout";
import ClientOverview from "@/pages/dashboard/client/overview";
import ClientJobs from "@/pages/dashboard/client/jobs";
import NewJob from "@/pages/dashboard/client/new-job";
import JobProposals from "@/pages/dashboard/client/job-proposals";
import ClientMessages from "@/pages/dashboard/client/messages";
import ClientPayments from "@/pages/dashboard/client/payments";
import ClientProfileEdit from "@/pages/dashboard/client/profile";
import LinkedAccountsPage from "@/pages/dashboard/linked-accounts";

import { FreelancerDashboardLayout } from "@/pages/dashboard/freelancer/layout";
import FreelancerOverview from "@/pages/dashboard/freelancer/overview";
import FreelancerJobs from "@/pages/dashboard/freelancer/jobs";
import FreelancerProposals from "@/pages/dashboard/freelancer/proposals";
import FreelancerSavedJobs from "@/pages/dashboard/freelancer/saved-jobs";
import FreelancerMessages from "@/pages/dashboard/freelancer/messages";
import FreelancerEarnings from "@/pages/dashboard/freelancer/earnings";
import FreelancerProfileEdit from "@/pages/dashboard/freelancer/profile";

const queryClient = new QueryClient();

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col w-full">
      <TopNav />
      <main className="flex-1 w-full flex flex-col">{children}</main>
      <Footer />
    </div>
  );
}

const ProtectedClientRoute = ({ component: Component, ...rest }: any) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div>Loading...</div>;
  if (!user || user.role !== "client") return <Redirect to="/login" />;
  return <ClientDashboardLayout><Component {...rest} /></ClientDashboardLayout>;
};

const ProtectedFreelancerRoute = ({ component: Component, ...rest }: any) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div>Loading...</div>;
  if (!user || user.role !== "freelancer") return <Redirect to="/login" />;
  return <FreelancerDashboardLayout><Component {...rest} /></FreelancerDashboardLayout>;
};

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/jobs" component={Jobs} />
      <Route path="/jobs/:id" component={JobDetail} />
      <Route path="/freelancers" component={Freelancers} />
      <Route path="/freelancers/:id" component={FreelancerProfile} />
      <Route path="/clients/:id" component={ClientProfile} />

      <Route path="/about" component={About} />
      <Route path="/contact" component={Contact} />
      <Route path="/terms" component={Terms} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/cancellation" component={Cancellation} />
      <Route path="/blog" component={Blog} />
      <Route path="/blog/:slug" component={BlogDetail} />
      <Route path="/faq" component={Faq} />

      <Route path="/login" component={Login} />
      <Route path="/auth/sso/:provider/callback" component={SsoCallback} />
      <Route path="/register" component={Register} />

      {/* Client Dashboard */}
      <Route path="/dashboard/client"><ProtectedClientRoute component={ClientOverview} /></Route>
      <Route path="/dashboard/client/jobs"><ProtectedClientRoute component={ClientJobs} /></Route>
      <Route path="/dashboard/client/jobs/new"><ProtectedClientRoute component={NewJob} /></Route>
      <Route path="/dashboard/client/jobs/:id/proposals"><ProtectedClientRoute component={JobProposals} /></Route>
      <Route path="/dashboard/client/messages"><ProtectedClientRoute component={ClientMessages} /></Route>
      <Route path="/dashboard/client/payments"><ProtectedClientRoute component={ClientPayments} /></Route>
      <Route path="/dashboard/client/profile"><ProtectedClientRoute component={ClientProfileEdit} /></Route>
      <Route path="/dashboard/client/linked-accounts"><ProtectedClientRoute component={LinkedAccountsPage} /></Route>
      <Route path="/dashboard/freelancer/linked-accounts"><ProtectedFreelancerRoute component={LinkedAccountsPage} /></Route>

      {/* Freelancer Dashboard */}
      <Route path="/dashboard/freelancer"><ProtectedFreelancerRoute component={FreelancerOverview} /></Route>
      <Route path="/dashboard/freelancer/jobs"><ProtectedFreelancerRoute component={FreelancerJobs} /></Route>
      <Route path="/dashboard/freelancer/proposals"><ProtectedFreelancerRoute component={FreelancerProposals} /></Route>
      <Route path="/dashboard/freelancer/saved-jobs"><ProtectedFreelancerRoute component={FreelancerSavedJobs} /></Route>
      <Route path="/dashboard/freelancer/messages"><ProtectedFreelancerRoute component={FreelancerMessages} /></Route>
      <Route path="/dashboard/freelancer/earnings"><ProtectedFreelancerRoute component={FreelancerEarnings} /></Route>
      <Route path="/dashboard/freelancer/profile"><ProtectedFreelancerRoute component={FreelancerProfileEdit} /></Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <TooltipProvider>
            <ErrorBoundary scope="App">
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <Layout>
                  <Router />
                </Layout>
              </WouterRouter>
            </ErrorBoundary>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;

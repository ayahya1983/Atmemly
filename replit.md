# Khidma — UAE/GCC Bilingual Freelance Marketplace

## Overview
Khidma is a bilingual (English/Arabic) freelance marketplace MVP tailored for the UAE and wider GCC region. Inspired by atmemli.com, it aims to connect freelancers with clients, facilitating job postings, proposals, contracts, and payments. The platform supports a full freelance lifecycle including user authentication, profiles, job management, payment processing with escrow, real-time chat, and an administrative panel for platform management. The project emphasizes a robust, scalable architecture with a strong focus on security, performance, and localization for the regional market. Future ambitions include advanced analytics, refined matching algorithms, and comprehensive mobile API support.

## User Preferences
I prefer to work with a coding agent that provides detailed explanations and asks for confirmation before making major architectural changes. I am open to iterative development. I prefer a communication style that is direct and uses clear, precise language. I appreciate it when the agent focuses on delivering solutions that align with the project's high-level goals and business vision.

## System Architecture

Khidma operates as a monorepo utilizing pnpm workspaces, comprising an Express.js TypeScript API, a React.js Vite frontend for the marketplace, and a design preview sandbox. The architecture is built upon shared libraries for database management (Drizzle ORM with PostgreSQL), API specification (OpenAPI), Zod schema validation, and React Query hooks for frontend API interaction.

**Technical Implementations & Design Choices:**
- **Backend:** Express.js, TypeScript, JWT for authentication, bcrypt for password hashing, Drizzle ORM, PostgreSQL, Pino logger.
- **Frontend:** React 18, Vite, wouter for routing, TanStack Query, shadcn/ui for components, Tailwind CSS for styling, zustand for i18n state management (persisted), react-hook-form with Zod for form validation.
- **Bilingual Support:** Arabic-first (default `lang="ar"`, RTL) with full English fallback. Marketplace exposes a combined language + currency switcher (AR/EN × AED/USD) persisted via zustand. `formatPriceDisplay()` normalizes any source currency to AED then to the user's display currency for safe cross-currency rendering.
- **Marketplace Frontend (atmemli-aligned):** Home page rebuilt to mirror atmemli.com's structure — 7-link top nav, RTL hero with image + headline + search + tab pills + stats, categories grid, recommended services, best freelancers, latest projects, CTA, testimonials, blog, FAQ accordion, mobile-app section, and 4-column footer. Public content (blog/FAQs/testimonials/featured/CMS) is fetched via `lib/api-public.ts` (react-query + plain `fetch` against existing GET endpoints — no new backend routes were added).
- **Authentication:** JWT-based with refresh tokens, role-based access control (client, freelancer, admin), and email verification. Authentication middleware (`requireAuth`, `requireActiveAuth`, `requireRole`) enforces access based on user status and role.
- **Verification (KYC):** Workflow for identity and trade license verification, managed by admins.
- **Contracts & Escrow:** Comprehensive contract management with milestones, escrow functionality (held, released, refunded states), and invoice generation including VAT.
- **Wallet & Payouts:** User wallets for managing earnings, with admin-approved payout requests.
- **Audit Logs:** Detailed logging of user and admin actions with IP and user-agent information.
- **Realtime Features:** HTTP polling for chat (Phase 1). Socket.IO for real-time notifications and chat updates (Phase 2).
- **Search & Ranking:** Advanced search capabilities for jobs and freelancers, with relevance scoring based on various factors (e.g., ratings, reviews, recency).
- **File Uploads:** Secure file upload mechanism with size and MIME type restrictions, storing metadata in `attachments` table.
- **Legal & Settings:** Dynamic management of legal documents (Terms, Privacy) with consent tracking. Platform settings are configurable via admin panel.
- **Admin Analytics & Reporting:** Comprehensive dashboard and time-series reports for signups, payments, disputes, revenue, cohorts, and performance metrics. CSV export functionality is available for reports.
- **Security & Hardening:** Helmet-equivalent headers, rate limiting on critical endpoints, Zod-validated environment variables, process-local caching, and graceful shutdown.
- **Mobile API Standards:** New Phase 4 routes adopt a standardized `{ data, meta? }` envelope for responses and `X-API-Version` header.
- **Payment Gateway Abstraction:** A flexible `PaymentGateway` interface allowing integration with various payment providers (mock, Stripe, PayTabs, Telr, manual bank transfer). Supports idempotent transactions, webhook verification, and advanced escrow event logging.
- **Multi-currency Support:** Seeded currencies (AED, USD, EUR, SAR, GBP) with FX rates and conversion utilities.
- **RBAC for Admin Panel:** Granular role-based access control using `admin_role` and `lib/permissions.ts` matrix for all new admin routes. Legacy admin endpoints retain `requireRole('admin')`.
- **Admin Content Management:** Backend for managing CMS pages, blocks, blog posts, FAQs, testimonials, and banned words. Public read endpoints for all content.
- **Admin Broadcasts:** Functionality to send notifications to specific user segments.
- **Admin Frontend (Phase 6 wired):** Comprehensive admin panel UI with 24 routes grouped into Overview (dashboard, analytics, reports), People (users, freelancers, clients, KYC verifications), Operations (jobs, contracts, disputes, complaints, reviews), Finance (payments, payouts), Content (CMS pages, CMS blocks, blog, FAQs, testimonials), and System (banned words, broadcasts, audit logs, settings). Built on `lib/api-admin.ts` (`adminApi`, `useAdminGet`, `useAdminMutation`, `downloadCsv`, `AdminApiError`) which auto-attaches `Bearer ${localStorage.auth_token}` and resolves URLs via `import.meta.env.BASE_URL`. Admin mutations on CMS pages, CMS blocks, and blog posts invalidate both admin and matching public query keys (`public-cms-page`, `public-cms-block`, `public-blog`, `public-blog-post`) so already-mounted public views refresh after edits. Reports page renders Recharts AreaChart + BarChart with CSV export. Destructive actions are gated by AlertDialog confirmations.
- **Public CMS-Driven Pages:** About, Contact, Terms, Privacy, and Cancellation pages are fully driven by `/api/cms/pages/:slug` via the shared `StaticCmsPage` component. Public `/blog`, `/blog/:slug`, and `/faq` pages are wired to `/api/blog` and `/api/faqs`. All public reads use the `public-*` TanStack Query key family for cache coherence with admin invalidations.

## External Dependencies
- **PostgreSQL:** Primary database, accessed via Drizzle ORM.
- **Stripe:** Mocked in earlier phases; real SDK integrated in Phase 5 for payment processing.
- **PayTabs:** Integrated in Phase 5 for payment processing via HTTP API.
- **Telr:** Integrated in Phase 5 for payment processing via HTTP API.
- **Socket.IO:** Used for real-time communication (chat, notifications).
- **pnpm workspaces:** Monorepo management.
- **Vite:** Frontend build tool.
- **Tailwind CSS:** Utility-first CSS framework.
- **shadcn/ui:** UI component library.
- **TanStack Query:** Data fetching and caching library for React.
- **Zod:** Schema validation library.
- **Orval:** OpenAPI client code generation.
- **bcrypt:** Password hashing.
- **jsonwebtoken (JWT):** Authentication tokens.
- **Pino:** Logging library.
- **Express.js:** Web application framework.
- **React:** Frontend library.
- **TypeScript:** Superset of JavaScript.
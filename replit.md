# EatOut Restaurant Management Platform

## Overview
EatOut is a comprehensive SaaS restaurant management platform offering commission-free online ordering and restaurant operations. It features a subscription-based, multi-tenant architecture with a professional admin dashboard and a customizable customer-facing online storefront for each restaurant, accessible via subdomain or custom domain. The platform supports multiple currencies and countries, with ambitions for future integration with delivery apps and mobile marketplaces. Its core purpose is to empower restaurants with efficient online presence and operational tools.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Technology Stack:** React with TypeScript, Vite, Wouter for routing, TanStack Query for server state, Shadcn/ui (Radix UI), Tailwind CSS.
- **Design System:** Hybrid approach with Material Design for the admin dashboard and a custom, standalone storefront design. Features a custom color palette (brand orange), Inter/Outfit typography, dark mode for admin, and component library path aliases. Storefronts are independent, full-width, and brand-agnostic.
- **Key UI Patterns:** Server-side rendering, authentication-guarded routes, role-based routing (admin vs owner), responsive design (mobile-first), toast notifications, sidebar navigation, and sheet/drawer components.

### Backend Architecture
- **Server Framework:** Express.js on Node.js with TypeScript.
- **Authentication & Authorization:** Session-based authentication using Replit Auth (OpenID Connect/Passport strategy) with httpOnly cookies and PostgreSQL session store. Role-based access control (admin/owner) and protected API routes.
- **Multi-Tenant Architecture:** Single database with `restaurant_id` foreign key separation. Hostname-based routing maps custom domains/subdomains to specific restaurants, ensuring data isolation.
- **Admin Panel:** Dedicated platform admin dashboard for MRR tracking, subscription management, and platform-wide analytics, bypassing subscription checks.

### Data Storage
- **Database:** Neon Serverless PostgreSQL with Drizzle ORM.
- **Schema Design:** Multi-tenant with `restaurant_id` across all tables. Core entities include users, restaurants, menu items, orders, reservations, staff, and inventory. Payment infrastructure includes `restaurantPayoutAccounts` (bank details, payout schedule), `earningsLedger` (financial transaction tracking), `payoutRuns` (batch payout execution), `payoutRunLedgerEntries` (join table linking payout runs to ledger entries), and driver-related tables (`driverProfiles`, `driverWalletBalances`, `walletTransactions`). Orders table extended with payment tracking: `paymentProvider`, `paymentIntentId`, `platformCaptureStatus`, `restaurantShare`, `driverShare`, `platformFee`, `assignedDriverId`. Restaurants table includes tax configuration: `taxRate`, `taxIncludedInPrice`, `taxLabel`. Supports custom domains/subdomains, URL slugs, decimal fields for currency, and JSONB for flexible settings.
- **Data Relationships:** Standard one-to-many and many-to-many relationships. Restaurant payout accounts have one-to-one relationship with restaurants. Earnings ledger and wallet transactions link to restaurants and drivers. PayoutRuns link to multiple ledger entries via `payoutRunLedgerEntries` join table.

### System Design Choices
- **UI/UX Decisions:**
    - **Cart Payment UI:** Features 5 distinct payment buttons (Apple Pay, Google Pay, Credit/Debit Card via Stripe; PayPal; Cash on Delivery) which display based on explicit restaurant payment method settings (configured in Online Store → Payment Methods). All payments processed through platform-owned accounts. Mobile responsive design with proper touch targets.
    - **Order Notification System:** Real-time red badge on Orders sidebar for pending orders, audio alerts for new orders, and smart polling every 10 seconds.
    - **Opening Hours Synchronization:** Storefront displays real-time "Open"/"Closed" status badge, customer-friendly 12-hour format hours, and "Closed today" messages, automatically updating with owner changes.
- **Technical Implementations:**
    - **Online Store Customization:** Owners can customize branding (logo, cover photo), opening hours, and menu item images.
    - **Platform-Managed Payments:** Centralized payment model via platform-owned Stripe and PayPal accounts. Platform collects payments, charges a 2% commission, and distributes 98% of subtotal to restaurants (100% of delivery fees to drivers). Financial reconciliation data (payment provider, capture status, shares) stored in orders table. Restaurants configure bank details and payout schedules.
    - **Tax Customization:** Per-restaurant configurable tax rates, labels, and inclusion in menu prices. Storefront calculates and displays tax breakdown.
    - **Subscription & Billing:** $79/month subscription with a 7-day free trial. Stripe webhooks manage subscription lifecycle. Admin dashboard tracks MRR.
    - **Onboarding Flow:** "Get Started Free" and "Login" entry points. Unauthenticated users access feature list. Authenticated users receive an automatic 7-day trial. Subscription page allows early subscription during trial.
    - **Multi-Currency & Regional Settings:** Worldwide support for 170+ currencies and 195+ countries using searchable selectors and locale-aware price formatting (`Intl.NumberFormat`).
    - **Internationalization (i18n):** Full multi-language support using i18next with automatic RTL text support. Separate language settings for admin (`platformLanguage`) and storefront (`storefrontLanguage`).
    - **Comprehensive CRUD Operations:** Full create, read, update, and delete functionality for menu items, tables, reservations, and inventory with optimistic UI updates and duplicate functionality.
    - **Analytics Dashboard:** Real-time analytics with batched queries, date-based filtering, and metrics for revenue, orders, average order value, popular items, and revenue by order type.
    - **Location-Based Delivery Zones:** Transformed from coordinate-based to country/city/neighborhood. Zones include delivery fee, optional minimum order, and active/inactive status. Cart validates delivery addresses using case-insensitive zone matching (trim + toLowerCase for country/city/neighborhood) via `/api/storefront/delivery-fee/:restaurantId` endpoint. If address is outside coverage, checkout is blocked and error message displayed. Delivery fee (if applicable) is added to cart total and 100% goes to drivers, with restaurant receiving only the subtotal portion after platform fee deduction.
    - **Marketing Features:** Customer-facing storefront includes "Frequently Bought Together" upsell (bundle pricing), "Countdown Timer" (urgency), and "Live Purchase Notifications" (recent order alerts).

## External Dependencies

- **Payment Processing:** Platform-managed payments using platform-owned Stripe and PayPal accounts. Platform collects all customer payments via `/api/checkout/stripe` and `/api/paypal/capture-order/:paypalOrderId` endpoints using platform credentials (`process.env.STRIPE_SECRET_KEY`, `process.env.PAYPAL_CLIENT_ID`). No connected accounts or OAuth flows. Uses @stripe/stripe-js, @stripe/react-stripe-js for frontend, Stripe SDK (v2025-09-30.clover) and @paypal/paypal-server-sdk for backend. Supports Google Pay, Apple Pay, credit/debit cards via Stripe, and PayPal. Payment confirmation uses `confirmOrderWithPayment(orderId, paymentProvider, paymentIntentId, totalAmount, deliveryFee)` which: (1) Calculates shares (platformFee = totalAmount * 2%, driverShare = deliveryFee for delivery orders, restaurantShare = totalAmount - platformFee - driverShare); (2) Updates order with payment tracking (`paymentProvider`, `platformCaptureStatus: 'captured'`, `paymentIntentId`, share amounts); (3) Sets order status to 'confirmed'.
- **Internationalization:** i18next, react-i18next, i18next-browser-languagedetector.
- **UI Components:** Radix UI primitives, Lucide React (icons), React Hook Form (with Zod validation), CMDK (command palette), Embla Carousel.
- **File Storage:** Replit Object Storage integration via @google-cloud/storage for restaurant assets, using Uppy for uploads.
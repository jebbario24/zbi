# EatOut Restaurant Management Platform

## Overview
EatOut is a comprehensive SaaS restaurant management platform for commission-free online ordering and restaurant operations. It offers a subscription-based model with a dual-interface: a professional admin dashboard and a customer-facing online storefront. The platform is multi-tenant, providing each restaurant with a customizable online menu store via subdomain or custom domain. It supports multiple currencies and countries, with future plans for delivery app and mobile marketplace integrations.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Technology Stack:** React with TypeScript, Vite, Wouter for routing, TanStack Query for server state, Shadcn/ui (Radix UI), Tailwind CSS.
- **Design System:** Hybrid approach combining Material Design for the admin dashboard and reference-based design (klit.ma, Toast, Square) for the storefront. Features a custom color palette (brand orange), Inter/Outfit typography, dark mode for admin, and component library path aliases.
- **Key UI Patterns:** Server-side rendering, authentication-guarded routes, role-based routing (admin vs owner), responsive design (mobile-first), toast notifications, sidebar navigation, and sheet/drawer components for mobile.

### Backend Architecture
- **Server Framework:** Express.js on Node.js with TypeScript.
- **Authentication & Authorization:** Session-based authentication using Replit Auth (OpenID Connect/Passport strategy) with httpOnly cookies and a PostgreSQL session store. Role-based access control (admin/owner) with middleware protection. Protected API routes and automatic session refresh.
- **Multi-Tenant Architecture:** Single database with `restaurant_id` foreign key separation. Hostname-based routing (custom domains/subdomains) maps to specific restaurants, isolating all data by `restaurantId`.
- **Admin Panel:** Platform admin role with dedicated dashboard showing MRR, active subscriptions, trial counts, and all restaurants management. Admins bypass subscription checks and have access to platform-wide analytics.

### Data Storage
- **Database:** Neon Serverless PostgreSQL with Drizzle ORM for type-safe queries.
- **Schema Design:** Multi-tenant with `restaurant_id` across all tables. Core entities include users, restaurants, menu items, orders, reservations, staff, and inventory. Supports custom domains/subdomains, URL slugs, decimal fields for currency, and JSONB for flexible settings.
- **Data Relationships:** Standard one-to-many and many-to-many relationships link users to restaurants, restaurants to menus/orders, and orders to menu items.

### System Design Choices
- **Online Store Customization:** Restaurant owners can customize branding (logo, cover photo), manage opening hours, and add images to menu items.
- **Payment Settings & Methods:** Stripe Connect and PayPal OAuth integration for secure multi-tenant payment processing. Each restaurant connects their own Stripe and PayPal accounts via OAuth flows. Platform automatically earns 2% commission per transaction using Stripe's `on_behalf_of` and `application_fee_amount` parameters. Restaurants can enable/disable payment methods (Stripe, PayPal, Cash on Delivery) individually.
- **Subscription & Billing:** $79/month subscription with 7-day free trial. New users automatically receive 7-day trial upon signup (configured in server/replitAuth.ts). Stripe webhooks handle subscription lifecycle (payment_succeeded, payment_failed, subscription_deleted, subscription_updated). Billing page shows subscription status, next billing date, and cancellation option. Platform admin dashboard tracks MRR and subscription metrics.
- **Onboarding Flow:** Landing page offers two entry points: "Get Started Free" (navigates to /subscribe) and "Login" (navigates to /api/login). Unauthenticated users accessing /subscribe see feature list and "Sign In to Subscribe" button. After OIDC authentication, users receive automatic 7-day trial. Subscribe page (/subscribe) is accessible to both authenticated and unauthenticated users - shows sign-in prompt when not logged in, shows payment form when authenticated. Users can subscribe early during trial period. Authentication detection uses React Query status field (`status === 'success'`) for reliable state management. Fixed JSON parsing in subscription initialization to properly handle Stripe client secret creation.
- **Multi-Currency & Regional Settings:** Comprehensive worldwide support with 170+ currencies (ISO-4217 aligned) and 195+ countries (all 193 UN members plus key territories like Palestine, Taiwan, Kosovo, Western Sahara). Features searchable Command/Popover selectors with real-time filtering for easy currency and country selection. Locale-aware price formatting using `Intl.NumberFormat`.
- **Table Categories & Management:** Full CRUD for tables with optional categorization (e.g., Interior, Exterior) and capacity tracking.
- **Staff Management:** Full CRUD for staff members with active/inactive status toggling and detailed information.
- **Comprehensive CRUD Operations:** Complete create, read, update, and delete functionality for menu items, tables, reservations, and inventory, ensuring consistent UI patterns and optimistic UI updates with React Query cache invalidation. Menu items and tables both support duplication via Copy button (hover-revealed alongside Edit/Delete), which creates a new item with " (Copy)" appended to the name/table number while preserving all other attributes (for menu items: description, price, category, image, availability; for tables: capacity, category). All duplicate and delete endpoints enforce restaurant ownership verification to prevent cross-tenant data access.
- **Analytics Dashboard:** Real-time analytics with batched database queries for performance. Features date-based filtering (Today, Yesterday, Last 7 days, This month, Last month, Year) with normalized date boundaries to accurately segment data. Displays total revenue, order counts, average order value, popular menu items (aggregated by quantity sold from filtered orders), and revenue breakdown by order type (dine-in, takeout, delivery, online). Uses efficient single-query fetching of all order items to avoid N+1 query patterns, with client-side filtering by order ID set to maintain consistency across all metrics.
- **Location-Based Delivery Zones:** Transformed from coordinate-based (latitude/longitude/radius) to location-based system (country/city/neighborhood). Features searchable Command/Popover selectors for country and city selection with fallback to manual text input for cities not in the predefined list. Static cities data covers 70+ countries with major cities. Database schema includes both legacy coordinate fields (optional for migration) and new location fields. Each zone includes delivery fee, optional minimum order amount, and active/inactive status toggle.

## External Dependencies

- **Payment Processing:** Stripe Connect integration for multi-tenant payments with 2% platform commission. Each restaurant connects their own Stripe account via OAuth, and the platform processes payments `on_behalf_of` the connected account with automatic fee collection. PayPal OAuth integration for merchant account linking. Frontend uses @stripe/stripe-js and @stripe/react-stripe-js for Stripe Elements. Backend uses Stripe SDK and @paypal/paypal-server-sdk for payment processing. Supports Google Pay and Apple Pay through Stripe.
- **Development Tools:** Replit-specific plugins, runtime error overlay, source map support (@jridgewell/trace-mapping), and Hot Module Replacement (HMR).
- **UI Components:** Radix UI primitives, Lucide React for icons, React Hook Form with Zod validation, CMDK for command palette, and Embla Carousel.
- **Build & Deployment:** ESBuild for server, Vite for client-side bundling, platform-agnostic builds, and static asset serving.
- **File Storage:** Replit Object Storage integration via @google-cloud/storage for restaurant assets (logos, cover photos, menu item images) using Uppy for file uploads. Images are automatically made public via ACL policies when uploaded. Image URLs are stored as `/objects/uploads/[uuid]` format in the database and served through the `/objects/*` route without authentication for public access.
- **Planned Integrations:** "EatOut Delivery" app synchronization, mobile app marketplace integration, and potential drag-and-drop customization platform.
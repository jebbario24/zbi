# EatOut Restaurant Management Platform

## Overview
EatOut is a comprehensive SaaS restaurant management platform for commission-free online ordering and restaurant operations. It offers a subscription-based model with a dual-interface: a professional admin dashboard and a customer-facing online storefront. The platform is multi-tenant, providing each restaurant with a customizable online menu store via subdomain or custom domain. It supports multiple currencies and countries, with future plans for delivery app and mobile marketplace integrations.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Technology Stack:** React with TypeScript, Vite, Wouter for routing, TanStack Query for server state, Shadcn/ui (Radix UI), Tailwind CSS.
- **Design System:** Hybrid approach combining Material Design for the admin dashboard and reference-based design (klit.ma, Toast, Square) for the storefront. Features a custom color palette (brand orange), Inter/Outfit typography, dark mode for admin, and component library path aliases.
- **Key UI Patterns:** Server-side rendering, authentication-guarded routes, responsive design (mobile-first), toast notifications, sidebar navigation, and sheet/drawer components for mobile.

### Backend Architecture
- **Server Framework:** Express.js on Node.js with TypeScript.
- **Authentication & Authorization:** Session-based authentication using Replit Auth (OpenID Connect/Passport strategy) with httpOnly cookies and a PostgreSQL session store. Protected API routes and automatic session refresh.
- **Multi-Tenant Architecture:** Single database with `restaurant_id` foreign key separation. Hostname-based routing (custom domains/subdomains) maps to specific restaurants, isolating all data by `restaurantId`.

### Data Storage
- **Database:** Neon Serverless PostgreSQL with Drizzle ORM for type-safe queries.
- **Schema Design:** Multi-tenant with `restaurant_id` across all tables. Core entities include users, restaurants, menu items, orders, reservations, staff, and inventory. Supports custom domains/subdomains, URL slugs, decimal fields for currency, and JSONB for flexible settings.
- **Data Relationships:** Standard one-to-many and many-to-many relationships link users to restaurants, restaurants to menus/orders, and orders to menu items.

### System Design Choices
- **Online Store Customization:** Restaurant owners can customize branding (logo, cover photo), manage opening hours, and add images to menu items.
- **Payment Settings & Methods:** Configuration of Stripe and PayPal credentials, with options to enable/disable various payment methods (Stripe, PayPal, Cash on Delivery).
- **Multi-Currency & Regional Settings:** Comprehensive worldwide support with 170+ currencies (ISO-4217 aligned) and 195+ countries (all 193 UN members plus key territories like Palestine, Taiwan, Kosovo, Western Sahara). Features searchable Command/Popover selectors with real-time filtering for easy currency and country selection. Locale-aware price formatting using `Intl.NumberFormat`.
- **Table Categories & Management:** Full CRUD for tables with optional categorization (e.g., Interior, Exterior) and capacity tracking.
- **Staff Management:** Full CRUD for staff members with active/inactive status toggling and detailed information.
- **Comprehensive CRUD Operations:** Complete create, read, update, and delete functionality for menu items, reservations, and inventory, ensuring consistent UI patterns and optimistic UI updates with React Query cache invalidation.
- **Analytics Dashboard:** Real-time analytics with batched database queries for performance. Features date-based filtering (Today, Yesterday, Last 7 days, This month, Last month, Year) with normalized date boundaries to accurately segment data. Displays total revenue, order counts, average order value, popular menu items (aggregated by quantity sold from filtered orders), and revenue breakdown by order type (dine-in, takeout, delivery, online). Uses efficient single-query fetching of all order items to avoid N+1 query patterns, with client-side filtering by order ID set to maintain consistency across all metrics.

## External Dependencies

- **Payment Processing:** Stripe (@stripe/stripe-js, @stripe/react-stripe-js) and PayPal server SDK (@paypal/paypal-server-sdk). Planned support for Google Pay and Apple Pay.
- **Development Tools:** Replit-specific plugins, runtime error overlay, source map support (@jridgewell/trace-mapping), and Hot Module Replacement (HMR).
- **UI Components:** Radix UI primitives, Lucide React for icons, React Hook Form with Zod validation, CMDK for command palette, and Embla Carousel.
- **Build & Deployment:** ESBuild for server, Vite for client-side bundling, platform-agnostic builds, and static asset serving.
- **File Storage:** Replit Object Storage integration via @google-cloud/storage for restaurant assets (logos, cover photos, menu item images) using Uppy for file uploads. Images are automatically made public via ACL policies when uploaded. Image URLs are stored as `/objects/uploads/[uuid]` format in the database and served through the `/objects/*` route without authentication for public access.
- **Planned Integrations:** "EatOut Delivery" app synchronization, mobile app marketplace integration, and potential drag-and-drop customization platform.
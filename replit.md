# EatOut Restaurant Management Platform

## Overview
EatOut is a subscription-based SaaS platform for restaurants, offering commission-free online ordering and operational tools through a multi-tenant architecture. It includes a professional admin dashboard and customizable customer-facing online storefronts, supporting multiple currencies and countries. The platform aims to provide a robust solution for restaurant management with a centralized admin control system for real-time synchronization across all operations.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Design System:** Hybrid Material Design for admin, custom storefront design with brand orange palette, Inter/Outfit typography, dark mode for admin, and component library path aliases.
- **Key UI Patterns:** Server-side rendering, authenticated and role-based routes, responsive design, toast notifications, sidebar navigation, and sheet/drawer components.
- **Cart & Payments:** Displays 5 distinct payment buttons (Apple Pay, Google Pay, Credit/Debit Card via Stripe; PayPal; Cash on Delivery) based on restaurant settings.
- **Notifications:** Real-time order notifications with red badge, audio alerts, and smart polling.
- **Storefront Customization:** Owners can customize branding, opening hours, menu item images, and brand colors (primary, secondary, accent) with WCAG-compliant automatic text contrast.
- **Menu Item Display:** "Open"/"Closed" status, "Out of Stock," and "Low Stock" indicators, with custom badges/tags (e.g., Bestseller, New, Spicy, Vegetarian) and color-coded styling.

### Technical Implementations
- **Frontend:** React, TypeScript, Vite, Wouter, TanStack Query, Shadcn/ui (Radix UI), Tailwind CSS.
- **Backend:** Express.js on Node.js with TypeScript.
- **Authentication:** Session-based authentication using Replit Auth (OpenID Connect/Passport) with httpOnly cookies and PostgreSQL session store, supporting role-based access control.
- **Multi-Tenancy:** Single database with `restaurant_id` separation and hostname-based routing.
- **Platform-Managed Payments:** Centralized payment model via platform-owned Stripe and PayPal accounts; platform collects payments, charges a 2% commission, and distributes shares.
- **Automated Payout System:** UberEats-style automated payouts using Stripe Connect Express and Stripe Transfers API, processed daily/weekly via a cron scheduler with a minimum threshold of $10.
- **Tax & Currency:** Per-restaurant configurable tax rates and multi-currency support for 170+ currencies and 195+ countries.
- **Subscriptions:** $79/month subscription with a 7-day free trial, managed via Stripe webhooks.
- **Internationalization (i18n):** Multi-language support using i18next with full RTL support.
- **Multi-Language Translation System:** Complete restaurant content translation system enabling storefronts in multiple languages:
  - **Translation Management UI:** Translation tabs in menu item edit dialog for managing translations in all enabled languages
  - **Language Selector:** Storefront dropdown with native language names (العربية, Español, etc.) and locale persistence
  - **Custom i18next Backend:** Dynamic loading of restaurant-specific translations from API with fallback to original content
  - **RTL Support:** Automatic bidirectional text support for Arabic, Hebrew, Persian, and Urdu
  - **Auto-Sync:** Automatic marking of translations as "needs review" when source content changes
  - **Database Schema:** `translation_records` table with status tracking (current/needs_review/outdated) and multi-tenant isolation
- **Analytics:** Real-time analytics dashboard with batched queries and date-based filtering.
- **Synchronized Delivery Zones:** Location-based delivery zones with complete synchronization across admin, drivers, and storefront:
  - **Admin Configuration:** Restaurant owners configure delivery zones with country, city, neighborhood, delivery fee, and minimum order
  - **Storefront Integration:** Cart dropdowns show only countries, cities, and neighborhoods where delivery is configured (no all-world location library)
  - **Cascading Selection:** Country selection filters available cities; city selection filters available neighborhoods
  - **Smart Neighborhood Handling:** Shows dropdown if specific neighborhoods are configured, otherwise text input for flexibility
  - **Driver Portal Sync:** Drivers see and select from the same delivery zones configured by restaurants
  - **Real-time Updates:** Adding/removing/activating/deactivating zones in admin instantly reflects in storefront and driver interfaces
  - **Single Data Source:** All three interfaces (admin, drivers, storefront) use the same `deliveryZones` table for consistency
  - **API Endpoints:** Public `/api/storefront/delivery-zones/:restaurantId` for storefront, authenticated endpoints for admin and drivers
- **Marketing Features:** Storefront includes "Frequently Bought Together," "Countdown Timer," "Live Purchase Notifications," customer reviews/ratings, and a contact form.
- **Admin Inbox:** For customer messages and review management.
- **Pixel Tracking:** Configuration for Meta, TikTok, Google Analytics, and Google Ads pixels with automatic e-commerce event firing.
- **Promo Code System:** Comprehensive system for various promotions (percentage, fixed amount, free delivery, BOGO) with admin CRUD and storefront integration.
- **Marketing Suite:** Full CRUD for marketing pages (Promos, Loyalty, Boosts, Upsells, Messages, Social, Bundles, and Campaigns), including scheduling and tracking.
- **Smart Upsell System:** Admin-configured upsell rules trigger "Perfect Pairing" modals.
- **Marketing Triggers Modal:** Post-toppings selection modal system displaying upsell/cross-sell/downsell suggestions with:
  - **Priority System:** Cross-sell → Upsell → Downsell trigger prioritization
  - **Flow Integration:** Displays after toppings selection, before cart addition
  - **Interactive Grid:** Suggested items with images, names, descriptions, prices, and quick-add buttons
  - **Infinite Loop Prevention:** `skipMarketingTriggersForCurrentItem` flag prevents retrigger when suggested items have toppings
  - **Smart Dismissal:** Manual modal closure clears pending item (prevents unintended cart additions)
  - **Icon System:** Lucide-react icons (ArrowUp for upsell, Sparkles for cross-sell, Lightbulb for downsell)
  - **Data Model:** Menu items have `upsellItemIds`, `crossSellItemIds`, `downsellItemIds` arrays for trigger configuration
- **QR Code Generation:** For printable table ordering QR codes.
- **Printable Order Tickets:** "Print Ticket" functionality for printer-friendly order tickets.
- **Bulk Order Management:** Bulk operations in the Orders page for status changes, printing, and deletion.
- **Driver Delivery Portal:** A web-based Progressive Web App (PWA) for delivery drivers, including an application system, order management, delivery tracking, and earnings calculation. Features:
  - **Progressive Profile Completion:** 20% Personal Info → 40% Vehicle Details → 60% Documents → 100% Bank Account (Stripe Connect) with real-time percentage tracking
  - **Navigation System:** Consistent header across dashboard and settings with quick links to Dashboard, Service Zones (with zone count badge), Settings, and Earnings
  - **Zone Count Badge:** Displays number of selected service zones (red/destructive when 0, secondary when configured) for at-a-glance status
  - **Driver Status Toggle:** Online/offline availability control in dashboard header
  - **Accessible Navigation:** Uses `<Button asChild>` pattern with wouter `<Link>` for valid HTML semantics and keyboard/mouse accessibility
  - Dual authentication and integration with Stripe Connect for payouts
- **Real-Time Delivery System:** Complete driver delivery workflow with 7 secured APIs and WebSocket-based real-time synchronization across driver/restaurant/admin dashboards.
- **Comprehensive Admin Controls:** Platform administrators have centralized access to payout management, content moderation, user management, subscription controls, financial dashboard, platform settings, and a synchronized dashboard.

### System Design Choices
- **Database:** Neon Serverless PostgreSQL with Drizzle ORM.
- **Schema Design:** Multi-tenant with `restaurant_id` across all tables.
- **Menu Data Model:** Enhanced 4-table architecture (Menus, Menu Categories, Menu Items, Item Options) for flexible configuration, scheduling, and multi-tenant isolation.
- **Data Handling:** Menu items store prices in both `price` (decimal) and `priceCents` (integer) formats. API endpoints expect `priceCents` for create/update operations, while other monetary fields use `decimal`.

## External Dependencies

- **Payment Processing:** Stripe and PayPal.
- **Internationalization:** i18next, react-i18next, i18next-browser-languagedetector.
- **UI Components:** Radix UI primitives, Lucide React, React Hook Form, CMDK, Embla Carousel.
- **File Storage:** Replit Object Storage via `@google-cloud/storage`, Uppy for uploads.
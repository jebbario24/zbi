# EatOut Restaurant Management Platform

## Overview
EatOut is a comprehensive, subscription-based SaaS restaurant management platform designed to empower restaurants with efficient online presence and operational capabilities. It offers commission-free online ordering and operational tools through a multi-tenant architecture, including a professional admin dashboard and customizable customer-facing online storefronts. The platform supports multiple currencies and countries, aiming to provide a robust solution for restaurant management.

**Admin Control System:** Centralized platform administration with real-time synchronization across all restaurants, drivers, subscriptions, payouts, and customer reviews. The admin dashboard provides unified oversight with quick access to all platform operations.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Design System:** Hybrid Material Design for admin, custom storefront design with brand orange palette, Inter/Outfit typography, dark mode for admin, and component library path aliases.
- **Key UI Patterns:** Server-side rendering, authenticated and role-based routes, responsive design, toast notifications, sidebar navigation, and sheet/drawer components.
- **Cart & Payments:** Displays 5 distinct payment buttons (Apple Pay, Google Pay, Credit/Debit Card via Stripe; PayPal; Cash on Delivery) based on restaurant settings. For pickup orders with no configured online payments, a "Place Order" button allows pay-on-arrival.
- **Notifications:** Real-time order notifications with red badge, audio alerts, and smart polling.
- **Storefront Customization:** Owners can customize branding (logo, cover photo), opening hours, and menu item images.
- **Menu Item Display:** "Open"/"Closed" status, "Out of Stock," and "Low Stock" indicators. Custom badges/tags (e.g., Bestseller, New, Spicy, Vegetarian) with color-coded styling.

### Technical Implementations
- **Frontend:** React, TypeScript, Vite, Wouter, TanStack Query, Shadcn/ui (Radix UI), Tailwind CSS.
- **Backend:** Express.js on Node.js with TypeScript.
- **Authentication:** Session-based authentication using Replit Auth (OpenID Connect/Passport) with httpOnly cookies and PostgreSQL session store, supporting role-based access control.
- **Multi-Tenancy:** Single database with `restaurant_id` separation and hostname-based routing.
- **Platform-Managed Payments:** Centralized payment model via platform-owned Stripe and PayPal accounts; platform collects payments, charges a 2% commission, and distributes shares.
- **Automated Payout System:** UberEats-style automated payouts using **Stripe Connect Express**. Restaurants connect their Stripe accounts, and the platform uses the **Stripe Transfers API** to send funds. Earnings are tracked per order in an `earningsLedger` table, and payouts are processed daily/weekly via a cron scheduler with a minimum threshold of $10.
- **Tax & Currency:** Per-restaurant configurable tax rates and multi-currency support for 170+ currencies and 195+ countries.
- **Subscriptions:** $79/month subscription with a 7-day free trial, managed via Stripe webhooks.
- **Internationalization (i18n):** Multi-language support using i18next with full RTL (Right-to-Left) support for Arabic, Hebrew, Persian, and Urdu, including automatic layout mirroring.
- **Analytics:** Real-time analytics dashboard with batched queries and date-based filtering.
- **Delivery Zones:** Location-based delivery zones with fees and minimum order validation.
- **Marketing Features:** Storefront includes "Frequently Bought Together," "Countdown Timer," "Live Purchase Notifications," customer reviews/ratings, and a contact form.
- **Admin Inbox:** For customer messages and review management.
- **Pixel Tracking:** Configuration for Meta, TikTok, Google Analytics, and Google Ads pixels with automatic e-commerce event firing.
- **Promo Code System:** Comprehensive system for various promotions (percentage, fixed amount, free delivery, BOGO) with admin CRUD and storefront integration.
- **Marketing Suite:** Full CRUD for marketing pages: Promos, Loyalty, Boosts, Upsells, Messages, Social, Bundles, and Campaigns, including scheduling and tracking.
- **Bundle Ordering:** System for creating and ordering bundle deals.
- **Smart Upsell System:** Admin-configured upsell rules trigger "Perfect Pairing" modals.
- **QR Code Generation:** For printable table ordering QR codes.
- **Printable Order Tickets:** "Print Ticket" functionality for printer-friendly order tickets.
- **Bulk Order Management:** Bulk operations in the Orders page for status changes, printing, and deletion.
- **Driver Delivery Portal:** A web-based Progressive Web App (PWA) for delivery drivers, including an application system, order management, delivery tracking, and earnings calculation. It features a progressive profile completion system, dual authentication (email/password and Google OAuth), and integration with Stripe Connect for payouts. Orders are only accessible after full profile completion and admin approval.
  - **PWA Implementation:** Full Progressive Web App support with custom branding ("EatOut Driver" name and custom logo), installable on mobile devices with offline functionality. Features include service worker for offline caching, web app manifest with theme colors (#f26419 brand orange), and optimized icons (192x192, 512x512, maskable). Service worker intelligently caches navigation requests while allowing API calls to fail naturally for proper error handling.
  - **Driver Signup Flow:** Fixed authentication state management issue where signup was using non-existent `refetch()` method - now properly uses `queryClient.invalidateQueries()` to update auth state after account creation.
  - **Admin Driver Management:** Enhanced dashboard with comprehensive stats (total drivers, pending applications, approved drivers, profile completion rate), tabbed interface for filtering by status (Pending, Approved, Rejected, Incomplete), and detailed driver cards showing completion progress and quick approval/rejection actions.
  - **Separated Driver Interface:** Drivers now have a completely separate UI from restaurant owners with dedicated `DriverSidebar` component containing only driver-relevant navigation (Dashboard, Settings). Drivers bypass `SubscriptionGuard`, access dedicated routes (`/driver/dashboard`, `/driver/settings`), and cannot access restaurant management pages.
  - **Real-Time Delivery System:** Complete driver delivery workflow with 7 secured APIs (available orders, accept order, status updates, active delivery tracking, stats, driver status toggle, earnings breakdown), WebSocket-based real-time synchronization across driver/restaurant/admin dashboards, and session-validated WebSocket authentication preventing identity spoofing.
  - **Driver Dashboard:** Fully functional dashboard displaying online/offline status toggle, active delivery tracker with step-by-step progress (en_route_to_pickup → arrived → picked_up → en_route_to_customer → delivered), available orders feed with accept functionality, and real-time stats cards (deliveries, earnings, acceptance rate). Drivers earn 80% of delivery fee per order.
  - **Restaurant Orders Integration:** Orders page displays assigned driver information with driver name, formatted phone number, and delivery status badge. Real-time WebSocket updates automatically refresh driver status as deliveries progress, with tooltips showing last update time.
  - **Admin Driver Monitoring:** Admin dashboard features live driver activity monitoring with real-time stats (total drivers, online drivers, active deliveries), current deliveries list showing up to 5 active deliveries with full details (order number, restaurant, driver, customer, status), and today's metrics (deliveries completed, total earnings). WebSocket integration ensures instant updates across all admin views.
- **Comprehensive Admin Controls:** Platform administrators have centralized access to:
  - **Payout Management:** Monitor, retry, cancel, and manually process payouts across all restaurants with real-time status tracking
  - **Content Moderation:** Review, publish/hide, respond to, and delete customer reviews from all restaurants
  - **User Management:** Advanced filtering, search, and account control for all users (owners, drivers, admins)
  - **Subscription Controls:** Cancel, delete, extend trials, and force renewals for restaurant subscriptions
  - **Financial Dashboard:** Platform-wide revenue tracking, commission breakdown, and per-restaurant analytics
  - **Platform Settings:** Configure commission rates, subscription pricing, and contact information
  - **Synchronized Dashboard:** Real-time stats from all platform operations with quick access links to detailed management pages

### System Design Choices
- **Database:** Neon Serverless PostgreSQL with Drizzle ORM.
- **Schema Design:** Multi-tenant with `restaurant_id` across all tables, covering core entities, payment infrastructure, driver data, and extended configurations.
- **Menu Data Model:** Enhanced 4-table architecture (Menus, Menu Categories, Menu Items, Item Options) for flexible configuration, scheduling, and multi-tenant isolation.
- **Data Handling:** Menu items store prices in both `price` (decimal) and `priceCents` (integer) formats. API endpoints expect `priceCents` for create/update operations. All other monetary fields (bundles, delivery fees, promo discounts, order totals) use `decimal` type and accept string dollar values.

## Recent Bug Fixes

### Critical: Menu Item Creation Bug (Fixed October 27, 2025)
**Issue:** New restaurants could not create menu items. The form collected price as a string (e.g., "8.99") but the API required `priceCents` as an integer (e.g., 899).

**Root Cause:** The `menuItems` table has both `price` (decimal) and `priceCents` (integer) columns. The frontend form sent only the `price` field, but the API endpoint `/api/menu/items` requires `priceCents` in the request body.

**Fix Applied:** 
- **Backend Fix (server/routes.ts):** Modified both POST `/api/menu/items` and PATCH `/api/menu/items/:id` endpoints to automatically convert `price` to `priceCents` while keeping both fields for database insertion.
- **Conversion Logic:** `priceCents = Math.round(parseFloat(price) * 100)` and `price = priceValue.toFixed(2)`

**Impact:** Resolves the primary blocker preventing new restaurant subscribers from completing their onboarding by setting up their menu.

**Verified Safe:** All other forms across Restaurant, Driver, and Admin dashboards correctly handle their respective data types (decimals, integers, strings) without requiring similar fixes.

### Cart Delivery Address Form Labels (Fixed October 27, 2025)
**Issue:** The cart checkout form was displaying raw translation keys instead of clean labels: "storefrontcountry", "storefrontcity", "storefront.neighborhood (storefront.optional)" instead of "Country", "City", "Neighborhood (optional)".

**Root Cause:** The i18n translation keys (`storefront.country`, `storefront.city`, `storefront.neighborhood`, `storefront.optional`, `storefront.calculatingDeliveryFee`) were being used in the code but were **missing** from the translation files (`client/src/locales/*.json`), causing the i18n system to display the raw key names as fallback text.

**Fix Applied:** Added the missing translation keys to `client/src/locales/en.json`:
```json
"storefront": {
  "country": "Country",
  "city": "City",
  "neighborhood": "Neighborhood",
  "optional": "optional",
  "calculatingDeliveryFee": "Calculating delivery fee",
  ...
}
```

**Impact:** Delivery address form now displays clean, user-friendly labels in the cart checkout flow. The i18n system is preserved for future multi-language support.

**Note:** Other locale files (es.json, fr.json, etc.) will fall back to English for these fields until translations are added.

### Known Limitations
- Marketing suite pages (Upsells, Boosts, Messages) currently use local state only and do not persist data to the database. These features require API integration to become fully functional.

## External Dependencies

- **Payment Processing:** Stripe and PayPal (platform-owned accounts).
- **Internationalization:** i18next, react-i18next, i18next-browser-languagedetector.
- **UI Components:** Radix UI primitives, Lucide React, React Hook Form, CMDK, Embla Carousel.
- **File Storage:** Replit Object Storage via `@google-cloud/storage`, Uppy for uploads.
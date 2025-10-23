# EatOut Restaurant Management Platform

## Overview
EatOut is a comprehensive SaaS restaurant management platform offering commission-free online ordering and restaurant operations. It features a subscription-based, multi-tenant architecture with a professional admin dashboard and a customizable customer-facing online storefront for each restaurant. The platform supports multiple currencies and countries, aiming to empower restaurants with efficient online presence and operational tools.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Design System:** Hybrid approach with Material Design for the admin dashboard and a custom storefront design. Features a custom color palette (brand orange), Inter/Outfit typography, dark mode for admin, and component library path aliases.
- **Key UI Patterns:** Server-side rendering, authentication-guarded routes, role-based routing (admin vs owner), responsive design, toast notifications, sidebar navigation, and sheet/drawer components.
- **Cart Payment UI:** Displays 5 distinct payment buttons (Apple Pay, Google Pay, Credit/Debit Card via Stripe; PayPal; Cash on Delivery) based on restaurant settings. All payments processed through platform-owned accounts.
- **Order Notification System:** Real-time red badge on Orders sidebar for pending orders, audio alerts for new orders, and smart polling.
- **Opening Hours Synchronization:** Storefront displays real-time "Open"/"Closed" status, automatically updating with owner changes.
- **Online Store Customization:** Owners can customize branding (logo, cover photo), opening hours, and menu item images.
- **Menu Item Availability:** Storefront displays "Out of Stock" and "Low Stock" indicators based on `isAvailable` and `stockCount` fields.

### Technical Implementations
- **Frontend Stack:** React with TypeScript, Vite, Wouter, TanStack Query, Shadcn/ui (Radix UI), Tailwind CSS.
- **Backend Stack:** Express.js on Node.js with TypeScript.
- **Authentication:** Session-based authentication using Replit Auth (OpenID Connect/Passport strategy) with httpOnly cookies and PostgreSQL session store. Role-based access control.
- **Multi-Tenant Architecture:** Single database with `restaurant_id` separation and hostname-based routing for custom domains/subdomains.
- **Admin Panel:** Dedicated platform admin dashboard for MRR tracking, subscription management, and platform-wide analytics.
- **Platform-Managed Payments:** Centralized payment model via platform-owned Stripe and PayPal accounts. Platform collects payments, charges a 2% commission, and distributes shares to restaurants and drivers.
- **Tax Customization:** Per-restaurant configurable tax rates, labels, and inclusion in menu prices.
- **Subscription & Billing:** $79/month subscription with a 7-day free trial, managed via Stripe webhooks.
- **Onboarding Flow:** "Get Started Free" and "Login" entry points, automatic 7-day trial.
- **Multi-Currency & Regional Settings:** Worldwide support for 170+ currencies and 195+ countries using locale-aware price formatting.
- **Internationalization (i18n):** Full multi-language support using i18next with automatic RTL text. Separate language settings for admin and storefront.
- **Analytics Dashboard:** Real-time analytics with batched queries, date-based filtering, and key metrics.
- **Location-Based Delivery Zones:** Zones defined by country/city/neighborhood with delivery fees and optional minimum order. Cart validates delivery addresses.
- **Pickup/Delivery Order Types:** Restaurants can configure enabled order types. Storefront adapts UI based on availability.
- **Menu Item Modifiers System:** Customizable options for menu items (e.g., size, toppings) with validation and pricing breakdown.
- **Marketing Features:** Storefront includes "Frequently Bought Together" upsell, "Countdown Timer," and "Live Purchase Notifications."
- **Customer Reviews & Ratings:** Storefront displays reviews and ratings; customers can submit reviews, owners can respond.
- **Customer Contact Form:** Storefront contact form sends messages directly to the restaurant inbox.
- **Pixel Tracking & Analytics:** Restaurant owners configure Meta, TikTok, Google Analytics, and Google Ads pixels. E-commerce events are automatically fired. Domain verification supported.
- **Promo Code System:** API routes for fetching and validating promo codes; frontend integration pending.
- **Marketing Suite Infrastructure:** Production-ready database schema for customer profiles, smart promos, loyalty, bundles, boosts, segmentation, campaigns, and pixels/referrals.

### System Design Choices
- **Database:** Neon Serverless PostgreSQL with Drizzle ORM.
- **Schema Design:** Multi-tenant with `restaurant_id` across all tables. Core entities: users, restaurants, menu items, orders, reservations, staff, inventory. Includes detailed payment infrastructure (payout accounts, earnings ledger, payout runs), driver-related tables, and extended order/restaurant/customer tables for specific features (e.g., tax config, order type preference, custom domains).
- **Enhanced Menu Data Model (UberEats-Style):** Comprehensive 4-table architecture: **Menus** (grouping, scheduling), **Menu Categories** (organization), **Menu Items** (20+ enhanced fields including SKU, pricing, visibility, prep time, allergens, stock, linking), and **Item Options** (modifiers with type, validation, choices). All tables enforce multi-tenant isolation and have comprehensive performance indexes.

## External Dependencies

- **Payment Processing:** Stripe and PayPal (platform-owned accounts). Uses `@stripe/stripe-js`, `@stripe/react-stripe-js`, Stripe SDK, and `@paypal/paypal-server-sdk`.
- **Internationalization:** i18next, react-i18next, i18next-browser-languagedetector.
- **UI Components:** Radix UI primitives, Lucide React, React Hook Form, CMDK, Embla Carousel.
- **File Storage:** Replit Object Storage via `@google-cloud/storage`, Uppy for uploads.
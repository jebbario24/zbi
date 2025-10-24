# EatOut Restaurant Management Platform

## Overview
EatOut is a comprehensive, subscription-based SaaS restaurant management platform. It offers commission-free online ordering and operational tools for restaurants through a multi-tenant architecture. Key features include a professional admin dashboard, a customizable customer-facing online storefront for each restaurant, and support for multiple currencies and countries. The platform aims to empower restaurants with efficient online presence and operational capabilities.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Design System:** Hybrid Material Design for admin, custom storefront design with brand orange palette, Inter/Outfit typography, dark mode for admin, and component library path aliases.
- **Key UI Patterns:** Server-side rendering, authenticated and role-based routes, responsive design, toast notifications, sidebar navigation, and sheet/drawer components.
- **Cart & Payments:** Displays 5 distinct payment buttons (Apple Pay, Google Pay, Credit/Debit Card via Stripe; PayPal; Cash on Delivery) based on restaurant settings, all processed through platform-owned accounts.
- **Notifications:** Real-time order notifications with red badge, audio alerts for new orders, and smart polling.
- **Storefront Customization:** Owners can customize branding (logo, cover photo), opening hours, and menu item images.
- **Menu Item Display:** Storefront shows "Open"/"Closed" status, "Out of Stock," and "Low Stock" indicators.

### Technical Implementations
- **Frontend:** React, TypeScript, Vite, Wouter, TanStack Query, Shadcn/ui (Radix UI), Tailwind CSS.
- **Backend:** Express.js on Node.js with TypeScript.
- **Authentication:** Session-based authentication using Replit Auth (OpenID Connect/Passport) with httpOnly cookies and PostgreSQL session store, supporting role-based access control.
- **Multi-Tenancy:** Single database with `restaurant_id` separation and hostname-based routing.
- **Admin Panel:** Dedicated platform admin dashboard for MRR tracking, subscription management, and platform-wide analytics.
- **Platform-Managed Payments:** Centralized payment model via platform-owned Stripe and PayPal accounts; platform collects payments, charges a 2% commission, and distributes shares.
- **Tax & Currency:** Per-restaurant configurable tax rates and multi-currency support for 170+ currencies and 195+ countries.
- **Subscriptions:** $79/month subscription with a 7-day free trial, managed via Stripe webhooks.
- **Internationalization (i18n):** Multi-language support using i18next with automatic RTL text for both admin and storefront.
- **Analytics:** Real-time analytics dashboard with batched queries and date-based filtering.
- **Delivery Zones:** Location-based delivery zones with fees and minimum order validation.
- **Order Types:** Configurable pickup/delivery options, adapting storefront UI accordingly.
- **Menu Modifiers:** Customizable options for menu items with validation and pricing.
- **Marketing Features:** Storefront includes "Frequently Bought Together," "Countdown Timer," and "Live Purchase Notifications."
- **Customer Engagement:** Customer reviews and ratings with owner response capability; contact form sending messages to restaurant inbox.
- **Admin Inbox:** Inbox for customer messages and review management with real-time response updates to the storefront.
- **Pixel Tracking:** Owners can configure Meta, TikTok, Google Analytics, and Google Ads pixels with automatic e-commerce event firing.
- **Promo Code System:** Comprehensive system for percentage, fixed amount, free delivery, and Buy X Get Y Free (BOGO) promotions, with admin CRUD and storefront integration.
- **Marketing Suite:** Full CRUD implementations for all marketing pages: Promos, Loyalty, Boosts, Upsells, Messages, Social, Bundles, and Campaigns. Features include scheduling, tracking, and validation across various marketing tools.
- **Bundle Ordering:** End-to-end system for creating and ordering bundle deals (combo meals), with proper tracking in orders and sales.
- **Smart Upsell System:** Admin-configured upsell rules trigger "Perfect Pairing" modals on the storefront, suggesting complementary items.
- **QR Code Generation:** System for generating printable QR codes for table ordering, with real-time preview and high-quality download.
- **Printable Order Tickets:** "Print Ticket" functionality for generating printer-friendly order tickets with full order details and XSS protection.
- **Bulk Order Management:** Bulk operations system in the Orders page for selecting multiple orders, changing status, printing, and deleting.
- **Global Delivery:** Expanded delivery zones to include 209 countries and territories.
- **Storefront Boosts Integration:** Active boosted items from the admin dashboard are prominently displayed on the storefront with a "Featured" badge.
- **Storefront Promo Codes Integration:** Active promo codes are displayed on the storefront via an "Active Promos Banner" with copy-to-clipboard functionality.

### System Design Choices
- **Database:** Neon Serverless PostgreSQL with Drizzle ORM.
- **Schema Design:** Multi-tenant with `restaurant_id` across all tables. Includes core entities (users, restaurants, menu items, orders), payment infrastructure, driver data, and extended configurations (tax, custom domains).
- **Menu Data Model:** Enhanced 4-table architecture (Menus, Menu Categories, Menu Items, Item Options) for flexible grouping, scheduling, and detailed item configuration, all with multi-tenant isolation and performance indexes.

## External Dependencies

- **Payment Processing:** Stripe and PayPal (platform-owned accounts).
- **Internationalization:** i18next, react-i18next, i18next-browser-languagedetector.
- **UI Components:** Radix UI primitives, Lucide React, React Hook Form, CMDK, Embla Carousel.
- **File Storage:** Replit Object Storage via `@google-cloud/storage`, Uppy for uploads.
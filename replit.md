# EatOut Restaurant Management Platform

## Overview

EatOut is a comprehensive SaaS restaurant management platform that enables restaurants to manage their operations and accept online orders. The platform uses a commission-free model with subscription-based pricing (monthly/yearly). It features a dual-interface approach: a professional admin dashboard for restaurant management and a customer-facing online storefront for ordering.

The system is built as a multi-tenant application where each restaurant has its own customizable online menu store, accessible via subdomain or custom domain. The platform is designed to support multiple currencies and countries, with future integration planned for a delivery app and mobile marketplace.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- React with TypeScript for type safety
- Vite as the build tool and development server
- Wouter for client-side routing
- TanStack Query (React Query) for server state management
- Shadcn/ui components built on Radix UI primitives
- Tailwind CSS for styling with custom design tokens

**Design System:**
- Hybrid approach: Material Design principles for admin dashboard, reference-based design (inspired by klit.ma, Toast, Square) for storefront
- Custom color palette with brand orange (HSL: 25 95% 55%) as primary
- Typography: Inter for interface text, Outfit for display/branding
- Dark mode support for admin dashboard
- Component library path aliases for clean imports (@/components, @/lib, @/hooks)

**Key UI Patterns:**
- Server-side rendering setup with Vite middleware
- Authentication-guarded routes with automatic redirect to login
- Responsive design with mobile-first approach
- Toast notifications for user feedback
- Sidebar navigation for admin dashboard
- Sheet/drawer components for mobile cart experience

### Backend Architecture

**Server Framework:**
- Express.js running on Node.js
- TypeScript for type safety across frontend and backend
- Session-based authentication using Replit Auth (OpenID Connect)
- PostgreSQL session store with connect-pg-simple

**Authentication & Authorization:**
- Replit Auth integration via OpenID Connect/Passport strategy
- Session-based authentication with httpOnly cookies
- User session stored in PostgreSQL sessions table
- Protected API routes with isAuthenticated middleware
- Automatic session refresh and token management

**Multi-Tenant Architecture:**
- Single database with restaurant_id foreign key separation
- Each restaurant linked to owner via ownerId (references users.id)
- Hostname-based routing: custom domains and subdomains map to specific restaurants
- Storefront middleware checks custom domain or subdomain before serving content
- All data (menus, orders, reservations) isolated by restaurantId

### Data Storage

**Database:**
- Neon Serverless PostgreSQL via @neondatabase/serverless
- Drizzle ORM for type-safe database queries
- WebSocket connection pooling for serverless compatibility
- Database URL from environment variable (DATABASE_URL)

**Schema Design:**
- Multi-tenant with restaurant_id separation across all tables
- Core entities: users, restaurants, menuCategories, menuItems, tables, reservations, orders, orderItems, staff, inventory
- Cascading deletes on restaurant ownership (ownerId references users.id)
- Support for custom domains, subdomains, and URL slugs per restaurant
- Decimal fields for precise currency handling (prices, totals)
- JSONB for flexible settings storage

**Data Relationships:**
- One-to-many: User → Restaurants (owner relationship)
- One-to-many: Restaurant → Menu Categories → Menu Items
- One-to-many: Restaurant → Tables, Staff, Inventory, Orders
- Many-to-many: Orders → Menu Items (via orderItems junction table)

### External Dependencies

**Payment Processing:**
- Stripe integration (@stripe/stripe-js, @stripe/react-stripe-js)
- PayPal server SDK (@paypal/paypal-server-sdk)
- Support for Google Pay and Apple Pay planned
- Online payment handling for storefront orders

**Development Tools:**
- Replit-specific plugins for development environment
- Runtime error overlay for better debugging
- Source map support via @jridgewell/trace-mapping
- Hot module replacement (HMR) in development

**UI Components:**
- Radix UI primitives for accessible components
- Lucide React for icons
- React Hook Form with Zod validation
- CMDK for command palette functionality
- Embla Carousel for image carousels

**Build & Deployment:**
- ESBuild for server bundle compilation
- Vite for client-side bundling
- Platform-agnostic build (packages marked as external)
- Static asset serving in production
- Environment-based configuration (NODE_ENV)

**Planned Integrations:**
- Future synchronization with "EatOut Delivery" app
- Mobile app marketplace integration
- Possible drag-and-drop customization platform for app owner
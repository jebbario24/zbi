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

**File Storage:**
- Replit Object Storage integration via @google-cloud/storage
- Uppy file upload UI (@uppy/core, @uppy/dashboard, @uppy/react, @uppy/aws-s3)
- Support for restaurant logos, cover photos, and menu item images
- Public assets stored in object storage for scalable delivery

**Planned Integrations:**
- Future synchronization with "EatOut Delivery" app
- Mobile app marketplace integration
- Possible drag-and-drop customization platform for app owner

## Recent Features (October 2025)

### Online Store Customization (Completed)
Restaurant owners can now fully customize their online storefront through the Online Store settings page:

**Branding & Visuals:**
- Upload restaurant logo (displayed in storefront header)
- Upload cover photo (hero background image)
- Support for JPG/PNG images via Replit Object Storage
- Real-time preview of logo and cover image

**Opening Hours Management:**
- Configure daily opening/closing times for all 7 days
- Toggle days as open/closed
- Opening hours displayed on storefront
- Validates time format and prevents invalid entries

**Menu Item Images:**
- Upload photos for individual menu items
- Images displayed on both admin menu and public storefront
- Improves visual appeal and helps customers make selections

**Implementation Details:**
- Frontend: OnlineStore.tsx for settings management
- File uploads: ObjectUploader component with Uppy integration
- Backend routes: /api/restaurant/logo, /api/restaurant/cover-image, /api/restaurant/opening-hours
- Database: Added logo_url, cover_image_url, opening_hours (jsonb) to restaurants table
- Database: Added image_url to menu_items table
- Storefront: Updated to display all branding elements dynamically
- Navigation: Added "Online Store" link to admin sidebar

### Payment Settings & Methods (Completed - October 2025)
Restaurant owners can now configure their payment processing options:

**Payment Credentials Management:**
- Enter and save Stripe API keys (Public Key and Secret Key)
- Enter and save PayPal credentials (Client ID and Client Secret)
- Secure storage of payment credentials in restaurant table
- Only accessible to authenticated restaurant owners

**Payment Methods Control:**
- Enable/disable Stripe payment processing
- Enable/disable PayPal payment processing
- Enable/disable Cash on Delivery option
- Payment methods stored as JSON in paymentMethods field
- Dynamic rendering of payment options on storefront based on enabled methods

**Storefront Enhancements:**
- Cart moved from floating bottom-right to sticky top navigation (top right)
- Responsive cart button with item count badge
- Dynamic payment options display (only shows enabled methods)
- Cash on Delivery option with clear messaging
- Improved checkout flow for all payment types
- Mobile-optimized cart and checkout experience

**Implementation Details:**
- Backend routes: /api/restaurant/payment-settings (PUT), /api/restaurant/payment-methods (PUT)
- Database: Added stripePublicKey, stripeSecretKey, paypalClientId, paypalClientSecret, paymentMethods (jsonb) to restaurants table
- Order schema: Updated to accept 'cash', 'stripe', and 'paypal' payment methods
- Checkout route: Handles cash orders without payment gateway processing
- Frontend: Payment Settings section in OnlineStore.tsx
- Storefront: Conditional rendering of payment options based on restaurant settings

### Multi-Currency & Regional Settings (Completed - October 2025)
Platform now supports multiple currencies and countries with proper localization and formatting:

**Regional Settings Configuration:**
- Currency selector with 12 supported currencies: USD, EUR, GBP, MAD, CAD, AUD, JPY, CNY, INR, AED, SAR, EGP
- Country selector with 15+ supported countries for locale mapping
- Settings accessible in Online Store page
- Real-time save and persistence via backend API
- Auto-reloads restaurant data after changes

**Currency Formatting System:**
- Locale-aware price formatting using Intl.NumberFormat
- Automatic currency symbol and decimal placement based on country/currency combination
- Examples: France/EUR → "15,99 €", USA/USD → "$15.99", Morocco/MAD → "DH 50"
- Applied to all price displays: menu items, cart items, subtotal, tax, total

**Payment Integration:**
- PayPal SDK dynamically loads with correct currency parameter
- Stripe checkout uses restaurant's configured currency
- Currency passed to payment gateways for accurate transactions
- Prevents hardcoded USD issues in multi-currency environments

**Storefront Design Updates:**
- Redesigned to match klit.ma reference design
- Large cover photo with circular logo overlay
- Horizontal category pills navigation
- Modern grid layout for menu items
- Responsive design for mobile, tablet, and desktop
- Hover effects and smooth animations

**Implementation Details:**
- Backend route: /api/restaurant/regional-settings (PUT) for currency/country updates
- Database: Added currency (varchar 10) and country (varchar 100) to restaurants table
- Frontend: Regional Settings section in OnlineStore.tsx with Globe icon
- Storefront: formatPrice() function maps country to locale codes (en-US, fr-FR, ar-MA, etc.)
- PayPal SDK: useEffect loads script with dynamic currency parameter
- File uploads: Fixed ObjectUploader component for better file browsing UX
- All prices throughout storefront use consistent currency formatting
# EatOut Restaurant Management Platform - Design Guidelines

## Design Approach

**Hybrid Approach**: Reference-based storefront (inspired by klit.ma, Toast, Square) with system-based admin dashboard using Material Design principles for data-heavy interfaces.

**Core Philosophy**: Professional SaaS platform with warm, inviting brand personality through strategic orange accents. The admin dashboard prioritizes efficiency and clarity, while the customer-facing storefront emphasizes visual appeal and ease of ordering.

---

## Color Palette

### Primary Colors
- **Brand Orange**: 25 95% 55% - Primary actions, navigation highlights, active states
- **Deep Orange**: 18 80% 45% - Hover states, emphasis elements
- **White**: 0 0% 100% - Primary backgrounds, cards, content areas

### Supporting Colors
- **Charcoal**: 220 15% 15% - Primary text, headers
- **Slate Gray**: 220 10% 45% - Secondary text, labels
- **Light Gray**: 220 10% 95% - Background surfaces, dividers
- **Success Green**: 145 65% 45% - Order confirmations, inventory in-stock
- **Warning Amber**: 38 92% 50% - Low stock alerts, pending actions
- **Error Red**: 0 75% 55% - Cancellations, out of stock

### Dark Mode (Admin Dashboard)
- **Background**: 220 15% 10%
- **Surface**: 220 15% 15%
- **Orange Muted**: 25 70% 60% - Adjusted for dark backgrounds

---

## Typography

### Font Families
- **Primary (Interface)**: Inter via Google Fonts - Clean, modern, excellent readability for data
- **Display (Branding)**: Outfit via Google Fonts - Friendly, contemporary for headers and CTAs

### Type Scale
- **Display**: 3.5rem (56px) / Bold / Outfit - Hero headlines, landing page
- **H1**: 2.5rem (40px) / Semibold / Outfit - Dashboard section headers
- **H2**: 2rem (32px) / Semibold / Outfit - Card headers, modal titles  
- **H3**: 1.5rem (24px) / Medium / Inter - Subsection headers
- **Body Large**: 1.125rem (18px) / Regular / Inter - Primary content, menu descriptions
- **Body**: 1rem (16px) / Regular / Inter - Standard text, form labels
- **Small**: 0.875rem (14px) / Regular / Inter - Captions, metadata, timestamps

---

## Layout System

### Spacing Primitives
Use Tailwind spacing units: **2, 3, 4, 6, 8, 12, 16, 20** for consistent rhythm
- Micro spacing (gaps, padding): 2, 3, 4
- Component spacing: 6, 8
- Section spacing: 12, 16, 20

### Grid System
- **Admin Dashboard**: 12-column grid with 24px gutters
- **Storefront**: Flexible grid - 1 column mobile, 2-3 columns tablet/desktop for menu items
- **Container Max Width**: 1400px for dashboard, 1200px for storefront

---

## Component Library

### Navigation
**Admin Sidebar** (Desktop)
- Fixed left sidebar, 280px width
- Dark background (220 15% 15%)
- Orange accent for active item (left border 3px + background tint)
- Collapsible with icon-only state (72px)

**Top Bar**
- White background, 64px height
- Restaurant switcher dropdown (multi-tenant)
- User profile, notifications, settings

**Storefront Header**
- Restaurant logo + name centered
- Minimal navigation (Menu, Cart, Account)
- Sticky on scroll with shadow

### Cards & Surfaces
- **Dashboard Cards**: White bg, 1px border (220 10% 85%), 12px radius, subtle shadow on hover
- **Menu Item Cards**: 16px radius, image top, content bottom, 2px orange border on hover
- **Stat Cards**: Large number display, icon in orange, trend indicator

### Forms & Inputs
- **Text Inputs**: 48px height, 8px radius, 1px border (220 10% 75%), orange focus ring (2px)
- **Select Dropdowns**: Chevron icon, same styling as text inputs
- **Checkboxes/Radio**: Orange when checked, 20px size
- **Buttons Primary**: Orange background, white text, 48px height, 8px radius, slight scale on hover (1.02)
- **Buttons Secondary**: White bg, orange border (2px), orange text, same dimensions

### Tables (Orders, Inventory, Reservations)
- Zebra striping (subtle gray on alternate rows)
- Sticky header on scroll
- Row hover state: light orange tint (25 95% 97%)
- Action buttons: icon-only, appear on row hover
- Status badges: pill-shaped, colored by state

### POS Interface
- **Grid Layout**: Menu categories left (200px), items center (grid), cart right (400px)
- **Cart**: Sticky, dark background, running total prominent
- **Quick Actions**: Large touch-friendly buttons (min 56px height)
- **Payment Modal**: Full screen on mobile, centered on desktop

### Modals & Overlays
- **Backdrop**: Black 50% opacity with blur effect
- **Modal Container**: White, 24px padding, 16px radius, max-width 600px
- **Close Button**: Top-right, orange on hover

### Data Visualization (Analytics)
- **Charts**: Use Chart.js with orange primary color, gray comparisons
- **Line Charts**: 2px stroke, gradient fill below (orange 20% opacity)
- **Bar Charts**: 12px radius on top, orange fill
- **Date Range Picker**: Orange selection highlight

---

## Storefront-Specific Design

### Online Menu Store (klit.ma Reference)
- **Hero**: Full-width restaurant image, 60vh height, overlay with restaurant name and tagline
- **Category Navigation**: Horizontal scroll chips, orange active state, sticky below header
- **Menu Grid**: 2-column tablet, 3-column desktop, masonry-style if images vary
- **Item Modal**: Image left (40%), details right (60%), quantity selector, add to cart CTA
- **Cart Drawer**: Slide from right, 400px width, orange checkout button fixed at bottom

### Customer Ordering Flow
- Clear progress indicator (Menu → Cart → Checkout → Confirmation)
- Order type selector: pills for Dine-in/Takeout/Delivery
- Table selection: visual grid for dine-in orders

---

## Images

### Hero Section (Landing Page - Restaurant Owners)
- Large hero image (1920x800px): Modern restaurant interior or chef preparing food
- Gradient overlay (orange to transparent) for text readability
- CTA buttons with blur background

### Dashboard
- Empty states: Friendly illustrations in orange line art style
- Placeholder images for menu items without photos: 400x300px with orange icon centered

### Storefront
- Menu item photos: 400x300px, 4:3 ratio, high quality food photography
- Restaurant cover photo: 1200x400px hero image
- Category icons: 64x64px, orange monochrome style

---

## Animations

**Minimal & Purposeful**
- Page transitions: 200ms ease-out fade
- Button interactions: 150ms scale transform (1.02)
- Modal entrance: 300ms slide-up with fade
- Cart updates: 200ms number count animation
- Loading states: Orange spinner or skeleton screens (no elaborate animations)

---

## Accessibility & Responsiveness

- Minimum contrast ratio: 4.5:1 for all text
- Focus indicators: 3px orange outline with 2px offset
- Touch targets: Minimum 44x44px for mobile
- Responsive breakpoints: 640px (sm), 768px (md), 1024px (lg), 1400px (xl)
- Dark mode: Admin dashboard only (customer storefront remains light)
# 🛍️ Marketplace Admin Management Plan

## Overview
Add comprehensive marketplace management to the Platform Admin Portal to control the customer-facing marketplace (https://github.com/jebbario24/Marketplaceetitout).

---

## 🎯 Features to Add

### 1. **Hero Slider Management**
Admins can manage homepage hero sliders with:
- Upload slider images (multiple slides)
- Add title, subtitle, CTA button
- Link to specific restaurant or category
- Set display order
- Schedule slides (start/end dates)
- Enable/disable individual slides
- Mobile vs Desktop images

### 2. **Cuisine Type Management**
Admins can manage cuisine categories:
- Add/edit/delete cuisine types
- Upload cuisine icon/image
- Set display order
- Enable/disable cuisines
- Tag restaurants with cuisines
- Filter restaurants by cuisine in marketplace

### 3. **Featured Restaurants**
Admins can manually feature restaurants:
- Select restaurants to feature
- Set featured position/order
- Schedule featured period
- Featured badge/banner
- Separate from paid "Boost" slots

### 4. **Marketplace Settings**
Global marketplace configuration:
- Platform name & logo
- Default delivery fee
- Default delivery radius
- Platform commission rate
- Featured restaurants count
- Search result limits
- Sorting options

### 5. **Banner Management**
Promotional banners:
- Top banner (site-wide announcements)
- Category banners
- Upload banner images
- Set banner text, CTA, link
- Schedule banners

### 6. **SEO Settings**
Marketplace SEO:
- Meta title/description
- Open Graph tags
- Keywords
- Sitemap generation

---

## 📊 Database Schema Additions

### New Tables Needed:

```sql
-- Marketplace hero sliders
CREATE TABLE marketplace_sliders (
  id VARCHAR PRIMARY KEY,
  title VARCHAR(255),
  subtitle TEXT,
  description TEXT,
  desktop_image_url TEXT NOT NULL,
  mobile_image_url TEXT,
  cta_text VARCHAR(100),
  cta_link TEXT,
  link_type VARCHAR(50), -- 'restaurant', 'cuisine', 'external', 'none'
  target_id VARCHAR, -- Restaurant ID or cuisine ID
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  starts_at TIMESTAMP,
  ends_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Cuisine types
CREATE TABLE cuisine_types (
  id VARCHAR PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  icon_url TEXT,
  image_url TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Restaurant cuisine mappings (many-to-many)
CREATE TABLE restaurant_cuisines (
  id VARCHAR PRIMARY KEY,
  restaurant_id VARCHAR NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  cuisine_id VARCHAR NOT NULL REFERENCES cuisine_types(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(restaurant_id, cuisine_id)
);

-- Featured restaurants (manual admin selection)
CREATE TABLE featured_restaurants (
  id VARCHAR PRIMARY KEY,
  restaurant_id VARCHAR NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  featured_position INTEGER NOT NULL, -- 1, 2, 3 for ordering
  starts_at TIMESTAMP NOT NULL,
  ends_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Marketplace promotional banners
CREATE TABLE marketplace_banners (
  id VARCHAR PRIMARY KEY,
  title VARCHAR(255),
  subtitle TEXT,
  banner_type VARCHAR(50) NOT NULL, -- 'top', 'category', 'promo'
  position VARCHAR(50) DEFAULT 'top', -- 'top', 'middle', 'bottom'
  image_url TEXT,
  background_color VARCHAR(7), -- Hex color
  text_color VARCHAR(7),
  cta_text VARCHAR(100),
  cta_link TEXT,
  link_type VARCHAR(50),
  target_id VARCHAR,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  starts_at TIMESTAMP,
  ends_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Marketplace global settings
CREATE TABLE marketplace_settings (
  id VARCHAR PRIMARY KEY,
  key VARCHAR(100) NOT NULL UNIQUE,
  value TEXT NOT NULL,
  value_type VARCHAR(50) DEFAULT 'string', -- 'string', 'number', 'boolean', 'json'
  description TEXT,
  category VARCHAR(50) DEFAULT 'general', -- 'general', 'seo', 'delivery', 'display'
  is_editable BOOLEAN DEFAULT true,
  updated_by VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🎨 Admin Page Design: `/admin/marketplace`

### Layout:
```
┌─────────────────────────────────────────┐
│  Platform Admin Portal                   │
│  ┌─────────┐                             │
│  │ Sidebar │ Main Content                │
│  │         │ ┌──────────────────────┐   │
│  │ - Dash  │ │ Marketplace Settings  │   │
│  │ - Rest. │ └──────────────────────┘   │
│  │ - Drive │                             │
│  │ - Mkt   │ Tabs:                       │
│  │   place │ [Hero Sliders] [Cuisines]  │
│  │         │ [Featured] [Banners]        │
│  │         │ [Settings]                  │
│  └─────────┘                             │
└─────────────────────────────────────────┘
```

### Tab 1: Hero Sliders
- Data table with slider list
- Columns: Image preview, Title, Link, Order, Active, Schedule
- Actions: Edit, Delete, Toggle active
- "Add New Slider" button
- Drag-and-drop reordering

**Add/Edit Modal:**
- Desktop image upload
- Mobile image upload (optional)
- Title input
- Subtitle textarea
- Link type selector (Restaurant, Cuisine, External, None)
- Target selector (if restaurant/cuisine selected)
- CTA text & link
- Display order
- Schedule dates (optional)
- Active toggle

### Tab 2: Cuisine Types
- Grid or list view of cuisines
- Each card shows: Icon, Name, Restaurant count
- Actions: Edit, Delete, Toggle active
- "Add Cuisine" button
- Drag-and-drop reordering

**Add/Edit Modal:**
- Cuisine name
- Slug (auto-generated)
- Description
- Icon upload
- Cover image upload
- Display order
- Active toggle

### Tab 3: Featured Restaurants
- List of currently featured restaurants
- Show restaurant card with:
  - Logo
  - Name
  - Featured position (1st, 2nd, 3rd)
  - Schedule
- Actions: Edit, Remove
- "Add Featured Restaurant" button
- Drag-and-drop to reorder

**Add Modal:**
- Restaurant search/selector
- Position (1-10)
- Schedule dates
- Active toggle

### Tab 4: Promotional Banners
- List of banners
- Preview of how banner looks
- Actions: Edit, Delete, Toggle active
- "Add Banner" button

**Add/Edit Modal:**
- Banner type selector
- Title & subtitle
- Image upload
- Background & text colors
- CTA text & link
- Position
- Schedule
- Active toggle

### Tab 5: Settings
Form with sections:

**General:**
- Marketplace name
- Marketplace tagline
- Logo upload
- Favicon upload

**Display:**
- Featured restaurants count
- Restaurants per page
- Default sorting (Relevance, Rating, Delivery Time, etc.)
- Show restaurant ratings
- Show delivery time estimates

**Delivery:**
- Default delivery fee (cents)
- Default delivery radius (km)
- Maximum delivery radius
- Delivery time estimate buffer

**Commission:**
- Platform commission rate (%)
- Commission on delivery fees
- Minimum commission amount

**SEO:**
- Meta title
- Meta description
- Meta keywords
- Open Graph image
- Twitter card settings

---

## 🔌 API Endpoints to Add

### Sliders:
```
GET    /api/admin/marketplace/sliders           - List all sliders
POST   /api/admin/marketplace/sliders           - Create slider
PUT    /api/admin/marketplace/sliders/:id       - Update slider
DELETE /api/admin/marketplace/sliders/:id       - Delete slider
PUT    /api/admin/marketplace/sliders/:id/order - Update display order
GET    /api/marketplace/sliders                 - Public: Get active sliders
```

### Cuisines:
```
GET    /api/admin/marketplace/cuisines          - List all cuisines
POST   /api/admin/marketplace/cuisines          - Create cuisine
PUT    /api/admin/marketplace/cuisines/:id      - Update cuisine
DELETE /api/admin/marketplace/cuisines/:id      - Delete cuisine
PUT    /api/admin/marketplace/cuisines/:id/order - Update display order
GET    /api/marketplace/cuisines                - Public: Get active cuisines
GET    /api/marketplace/cuisines/:id/restaurants - Public: Restaurants by cuisine
```

### Featured Restaurants:
```
GET    /api/admin/marketplace/featured          - List featured
POST   /api/admin/marketplace/featured          - Add featured
PUT    /api/admin/marketplace/featured/:id      - Update featured
DELETE /api/admin/marketplace/featured/:id      - Remove featured
GET    /api/marketplace/featured                - Public: Get featured restaurants
```

### Banners:
```
GET    /api/admin/marketplace/banners           - List all banners
POST   /api/admin/marketplace/banners           - Create banner
PUT    /api/admin/marketplace/banners/:id       - Update banner
DELETE /api/admin/marketplace/banners/:id       - Delete banner
GET    /api/marketplace/banners                 - Public: Get active banners
```

### Settings:
```
GET    /api/admin/marketplace/settings          - Get all settings
PUT    /api/admin/marketplace/settings          - Update settings
GET    /api/marketplace/settings                - Public: Get public settings
```

### Restaurant Cuisines:
```
GET    /api/admin/restaurants/:id/cuisines      - Get restaurant cuisines
PUT    /api/admin/restaurants/:id/cuisines      - Update restaurant cuisines
```

---

## 📱 Public Marketplace Changes

The external marketplace frontend will consume these APIs:

**Homepage:**
- Show hero sliders (carousel)
- Show featured restaurants section
- Show cuisines grid with icons
- Show promotional banners

**Restaurant Listing:**
- Filter by cuisine type
- Show cuisine badges on restaurant cards
- Sort by various options from settings

**Restaurant Detail:**
- Show cuisine badges

---

## 🚀 Implementation Steps

### Phase 1: Database Schema
1. Add new tables to `shared/schema.ts`
2. Run migrations

### Phase 2: API Development
1. Create `/server/admin/marketplace.ts` router
2. Implement all admin endpoints
3. Update `/server/marketplace.ts` with public endpoints
4. Add validation schemas

### Phase 3: Admin UI
1. Create `/client/src/pages/AdminMarketplace.tsx`
2. Build all 5 tabs
3. Create modals/forms for CRUD operations
4. Image upload integration
5. Drag-and-drop reordering

### Phase 4: Integration
1. Update restaurant edit page to include cuisine selector
2. Test all admin functions
3. Update external marketplace to consume new APIs

### Phase 5: Documentation
1. Admin user guide
2. API documentation
3. Update README

---

## 🎯 Benefits

✅ **Full marketplace control** for platform admins  
✅ **Dynamic hero sliders** without code changes  
✅ **Cuisine-based filtering** for better UX  
✅ **Manual featured restaurants** for promotions  
✅ **Promotional banners** for marketing  
✅ **Centralized settings** management  
✅ **SEO optimization** built-in  
✅ **Scheduled content** with automatic activation  

---

## 📋 To-Do Checklist

- [ ] Design database schema
- [ ] Add tables to shared/schema.ts
- [ ] Create API endpoints (admin)
- [ ] Create API endpoints (public)
- [ ] Build AdminMarketplace.tsx page
- [ ] Build Hero Sliders tab
- [ ] Build Cuisines tab
- [ ] Build Featured Restaurants tab
- [ ] Build Banners tab
- [ ] Build Settings tab
- [ ] Add cuisine selector to restaurant edit
- [ ] Update external marketplace frontend
- [ ] Test all functionality
- [ ] Write documentation
- [ ] Deploy

---

Ready to start building this? 🚀

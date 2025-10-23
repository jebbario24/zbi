import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  decimal,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table - Required for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  password: varchar("password"), // Hashed password for email/password auth (nullable for OAuth users)
  googleId: varchar("google_id").unique(), // Google OAuth ID (nullable for email/password users)
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role", { length: 20 }).notNull().default('owner'),
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  subscriptionStatus: varchar("subscription_status", { length: 50 }).default('trial'),
  trialEndsAt: timestamp("trial_ends_at"),
  subscriptionEndsAt: timestamp("subscription_ends_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Restaurants table - Multi-tenant core
export const restaurants = pgTable("restaurants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerId: varchar("owner_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  subdomain: varchar("subdomain", { length: 255 }).unique(),
  customDomain: varchar("custom_domain", { length: 255 }).unique(),
  description: text("description"),
  address: text("address"),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  logoUrl: text("logo_url"),
  coverImageUrl: text("cover_image_url"),
  openingHours: jsonb("opening_hours"),
  themeSettings: jsonb("theme_settings"),
  marketingSettings: jsonb("marketing_settings"),
  stripePublicKey: text("stripe_public_key"),
  stripeSecretKey: text("stripe_secret_key"),
  stripeAccountId: text("stripe_account_id"),
  paypalClientId: text("paypal_client_id"),
  paypalClientSecret: text("paypal_client_secret"),
  paypalMerchantId: text("paypal_merchant_id"),
  paymentMethods: jsonb("payment_methods"),
  currency: varchar("currency", { length: 10 }).notNull().default('USD'),
  country: varchar("country", { length: 100 }).default('United States'),
  timezone: varchar("timezone", { length: 100 }).default('UTC'),
  platformLanguage: varchar("platform_language", { length: 10 }).default('en'),
  storefrontLanguage: varchar("storefront_language", { length: 10 }).default('en'),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default('0.00'),
  taxIncludedInPrice: boolean("tax_included_in_price").default(false),
  taxLabel: varchar("tax_label", { length: 50 }).default('Tax'),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Menu Categories
export const menuCategories = pgTable("menu_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Menu Items
export const menuItems = pgTable("menu_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  categoryId: varchar("category_id").notNull().references(() => menuCategories.id, { onDelete: 'cascade' }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  imageUrl: text("image_url"),
  isAvailable: boolean("is_available").notNull().default(true),
  preparationTime: integer("preparation_time"),
  // Marketing tactics - per item configuration
  upsellItemIds: text("upsell_item_ids").array(),
  crossSellItemIds: text("cross_sell_item_ids").array(),
  downsellItemIds: text("downsell_item_ids").array(),
  marketingTactics: jsonb("marketing_tactics"),
  // Modifiers/Options configuration
  options: jsonb("options"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tables
export const tables = pgTable("tables", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  tableNumber: varchar("table_number", { length: 50 }).notNull(),
  category: varchar("category", { length: 100 }),
  capacity: integer("capacity").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Reservations
export const reservations = pgTable("reservations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  tableId: varchar("table_id").references(() => tables.id, { onDelete: 'set null' }),
  customerName: varchar("customer_name", { length: 255 }).notNull(),
  customerPhone: varchar("customer_phone", { length: 50 }).notNull(),
  customerEmail: varchar("customer_email", { length: 255 }),
  partySize: integer("party_size").notNull(),
  reservationDate: timestamp("reservation_date").notNull(),
  status: varchar("status", { length: 50 }).notNull().default('pending'),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Orders
export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  tableId: varchar("table_id").references(() => tables.id, { onDelete: 'set null' }),
  orderNumber: varchar("order_number", { length: 50 }).notNull(),
  orderType: varchar("order_type", { length: 50 }).notNull(),
  customerName: varchar("customer_name", { length: 255 }),
  customerPhone: varchar("customer_phone", { length: 50 }),
  customerEmail: varchar("customer_email", { length: 255 }),
  shippingAddress: text("shipping_address"),
  deliveryCountry: varchar("delivery_country", { length: 100 }),
  deliveryCity: varchar("delivery_city", { length: 100 }),
  deliveryAddress: text("delivery_address"),
  deliveryFee: decimal("delivery_fee", { precision: 10, scale: 2 }).default('0'),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  tax: decimal("tax", { precision: 10, scale: 2 }).notNull().default('0'),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default('pending'),
  paymentStatus: varchar("payment_status", { length: 50 }).notNull().default('pending'),
  paymentMethod: varchar("payment_method", { length: 50 }),
  paymentIntentId: varchar("payment_intent_id", { length: 255 }),
  paymentProvider: varchar("payment_provider", { length: 50 }),
  platformCaptureStatus: varchar("platform_capture_status", { length: 50 }).default('pending'),
  restaurantShare: decimal("restaurant_share", { precision: 10, scale: 2 }),
  driverShare: decimal("driver_share", { precision: 10, scale: 2 }),
  platformFee: decimal("platform_fee", { precision: 10, scale: 2 }),
  assignedDriverId: varchar("assigned_driver_id").references(() => driverProfiles.id, { onDelete: 'set null' }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Order Items
export const orderItems = pgTable("order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => orders.id, { onDelete: 'cascade' }),
  menuItemId: varchar("menu_item_id").notNull().references(() => menuItems.id),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Staff
export const staff = pgTable("staff", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  role: varchar("role", { length: 100 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Inventory
export const inventory = pgTable("inventory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  itemName: varchar("item_name", { length: 255 }).notNull(),
  quantity: integer("quantity").notNull().default(0),
  unit: varchar("unit", { length: 50 }).notNull(),
  lowStockThreshold: integer("low_stock_threshold").default(10),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Delivery Zones
export const deliveryZones = pgTable("delivery_zones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  name: varchar("name", { length: 255 }).notNull(),
  country: varchar("country", { length: 100 }),
  city: varchar("city", { length: 255 }),
  neighborhood: varchar("neighborhood", { length: 255 }),
  centerLat: decimal("center_lat", { precision: 10, scale: 7 }),
  centerLng: decimal("center_lng", { precision: 10, scale: 7 }),
  radiusKm: decimal("radius_km", { precision: 6, scale: 2 }),
  deliveryFee: decimal("delivery_fee", { precision: 10, scale: 2 }).notNull(),
  minimumOrder: decimal("minimum_order", { precision: 10, scale: 2 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Platform Payment Settings - Global Stripe/PayPal credentials
export const platformPaymentSettings = pgTable("platform_payment_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stripePublicKey: text("stripe_public_key"),
  stripeSecretKey: text("stripe_secret_key"),
  paypalClientId: text("paypal_client_id"),
  paypalClientSecret: text("paypal_client_secret"),
  platformFeePercentage: decimal("platform_fee_percentage", { precision: 5, scale: 2 }).default('2.00'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Restaurant Payout Accounts - Bank details for restaurant payouts
export const restaurantPayoutAccounts = pgTable("restaurant_payout_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").notNull().unique().references(() => restaurants.id, { onDelete: 'cascade' }),
  accountHolderName: varchar("account_holder_name", { length: 255 }),
  bankName: varchar("bank_name", { length: 255 }),
  accountNumber: varchar("account_number", { length: 100 }),
  routingNumber: varchar("routing_number", { length: 50 }),
  iban: varchar("iban", { length: 50 }),
  swiftCode: varchar("swift_code", { length: 20 }),
  country: varchar("country", { length: 100 }),
  payoutSchedule: varchar("payout_schedule", { length: 20 }).notNull().default('weekly'),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Driver Profiles - Driver information for delivery app
export const driverProfiles = pgTable("driver_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").unique().references(() => users.id, { onDelete: 'cascade' }),
  firstName: varchar("first_name", { length: 255 }).notNull(),
  lastName: varchar("last_name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  vehicleType: varchar("vehicle_type", { length: 50 }),
  vehiclePlate: varchar("vehicle_plate", { length: 50 }),
  currentLat: decimal("current_lat", { precision: 10, scale: 7 }),
  currentLng: decimal("current_lng", { precision: 10, scale: 7 }),
  isActive: boolean("is_active").notNull().default(true),
  isAvailable: boolean("is_available").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Driver Wallet Balances - Current balance for each driver
export const driverWalletBalances = pgTable("driver_wallet_balances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  driverId: varchar("driver_id").notNull().unique().references(() => driverProfiles.id, { onDelete: 'cascade' }),
  balance: decimal("balance", { precision: 10, scale: 2 }).notNull().default('0.00'),
  pendingBalance: decimal("pending_balance", { precision: 10, scale: 2 }).notNull().default('0.00'),
  lifetimeEarnings: decimal("lifetime_earnings", { precision: 10, scale: 2 }).notNull().default('0.00'),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Earnings Ledger - Per-order payment splits and tracking
export const earningsLedger = pgTable("earnings_ledger", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => orders.id, { onDelete: 'cascade' }),
  restaurantId: varchar("restaurant_id").notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  driverId: varchar("driver_id").references(() => driverProfiles.id, { onDelete: 'set null' }),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  restaurantShare: decimal("restaurant_share", { precision: 10, scale: 2 }).notNull(),
  driverShare: decimal("driver_share", { precision: 10, scale: 2 }).default('0.00'),
  platformFee: decimal("platform_fee", { precision: 10, scale: 2 }).notNull(),
  paymentProvider: varchar("payment_provider", { length: 50 }).notNull(),
  paymentIntentId: varchar("payment_intent_id", { length: 255 }),
  platformCaptureStatus: varchar("platform_capture_status", { length: 50 }).notNull().default('pending'),
  restaurantPayoutStatus: varchar("restaurant_payout_status", { length: 50 }).notNull().default('pending'),
  driverPayoutStatus: varchar("driver_payout_status", { length: 50 }).default('pending'),
  restaurantPaidAt: timestamp("restaurant_paid_at"),
  driverPaidAt: timestamp("driver_paid_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Payout Runs - Batched restaurant payouts
export const payoutRuns = pgTable("payout_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  payoutProvider: varchar("payout_provider", { length: 50 }).notNull(),
  payoutTransactionId: varchar("payout_transaction_id", { length: 255 }),
  status: varchar("status", { length: 50 }).notNull().default('pending'),
  failureReason: text("failure_reason"),
  scheduledFor: timestamp("scheduled_for").notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Payout Run Ledger Entries - Join table for payout runs and earnings ledger
export const payoutRunLedgerEntries = pgTable("payout_run_ledger_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  payoutRunId: varchar("payout_run_id").notNull().references(() => payoutRuns.id, { onDelete: 'cascade' }),
  ledgerEntryId: varchar("ledger_entry_id").notNull().references(() => earningsLedger.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Wallet Transactions - Driver wallet credits/debits and payout audit
export const walletTransactions = pgTable("wallet_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  driverId: varchar("driver_id").notNull().references(() => driverProfiles.id, { onDelete: 'cascade' }),
  type: varchar("type", { length: 50 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  balanceBefore: decimal("balance_before", { precision: 10, scale: 2 }).notNull(),
  balanceAfter: decimal("balance_after", { precision: 10, scale: 2 }).notNull(),
  relatedOrderId: varchar("related_order_id").references(() => orders.id, { onDelete: 'set null' }),
  relatedLedgerId: varchar("related_ledger_id").references(() => earningsLedger.id, { onDelete: 'set null' }),
  payoutTransactionId: varchar("payout_transaction_id", { length: 255 }),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Customers - Customer profiles for marketing & loyalty
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  name: varchar("name", { length: 255 }),
  orderType: varchar("order_type", { length: 50 }).default('delivery'),
  signupSource: varchar("signup_source", { length: 100 }),
  firstOrderAt: timestamp("first_order_at"),
  lastOrderAt: timestamp("last_order_at"),
  ordersCount: integer("orders_count").notNull().default(0),
  lifetimeValueCents: integer("lifetime_value_cents").notNull().default(0),
  tags: jsonb("tags"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Item Options - Modifiers for menu items (sizes, add-ons, extras)
export const itemOptions = pgTable("item_options", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  menuItemId: varchar("menu_item_id").notNull().references(() => menuItems.id, { onDelete: 'cascade' }),
  label: varchar("label", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // 'single', 'multi', 'boolean', 'quantity'
  required: boolean("required").notNull().default(false),
  minSelections: integer("min_selections").default(0),
  maxSelections: integer("max_selections"),
  choices: jsonb("choices").notNull(), // [{id, label, priceCents, sku, available}]
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ========================================
// MARKETING SUITE - Promos, Loyalty, Campaigns, Boosts, Segmentation
// ========================================

// Promo Rules - Discount rules and auto-apply conditions
export const promoRules = pgTable("promo_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  promoCode: varchar("promo_code", { length: 100 }).unique(),
  promoType: varchar("promo_type", { length: 50 }).notNull(), // 'percentage', 'fixed_amount', 'buy_x_get_y', 'free_delivery'
  discountValue: decimal("discount_value", { precision: 10, scale: 2 }), // Percentage or fixed amount
  scope: varchar("scope", { length: 50 }).notNull(), // 'order', 'item', 'category'
  targetItemIds: jsonb("target_item_ids"), // For item/category scoped promos
  conditions: jsonb("conditions"), // {minOrderAmount, maxDiscount, applicableDays, timeRanges}
  autoApply: boolean("auto_apply").notNull().default(false),
  redemptionLimit: integer("redemption_limit"), // Total redemptions allowed
  perCustomerLimit: integer("per_customer_limit").default(1),
  priority: integer("priority").default(0), // Higher priority applies first
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Promo Redemptions - Track promo usage
export const promoRedemptions = pgTable("promo_redemptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  promoRuleId: varchar("promo_rule_id").notNull().references(() => promoRules.id, { onDelete: 'cascade' }),
  orderId: varchar("order_id").notNull().references(() => orders.id, { onDelete: 'cascade' }),
  customerId: varchar("customer_id").references(() => customers.id, { onDelete: 'set null' }),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Promo Performance - Analytics for promos
export const promoPerformance = pgTable("promo_performance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  promoRuleId: varchar("promo_rule_id").notNull().references(() => promoRules.id, { onDelete: 'cascade' }),
  date: timestamp("date").notNull(),
  impressions: integer("impressions").notNull().default(0),
  redemptions: integer("redemptions").notNull().default(0),
  revenueGenerated: decimal("revenue_generated", { precision: 10, scale: 2 }).default('0'),
  discountGiven: decimal("discount_given", { precision: 10, scale: 2 }).default('0'),
  ordersCount: integer("orders_count").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Loyalty Tiers - Bronze, Silver, Gold tiers
export const loyaltyTiers = pgTable("loyalty_tiers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  name: varchar("name", { length: 100 }).notNull(),
  minPoints: integer("min_points").notNull().default(0),
  benefits: jsonb("benefits"), // {discountPercentage, freeDelivery, prioritySupport, boostCredits}
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Loyalty Accounts - Customer loyalty points and tiers
export const loyaltyAccounts = pgTable("loyalty_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  customerId: varchar("customer_id").notNull().references(() => customers.id, { onDelete: 'cascade' }),
  pointsBalance: integer("points_balance").notNull().default(0),
  lifetimePoints: integer("lifetime_points").notNull().default(0),
  tierId: varchar("tier_id").references(() => loyaltyTiers.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Loyalty Transactions - Points earn/redeem history
export const loyaltyTransactions = pgTable("loyalty_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  loyaltyAccountId: varchar("loyalty_account_id").notNull().references(() => loyaltyAccounts.id, { onDelete: 'cascade' }),
  type: varchar("type", { length: 50 }).notNull(), // 'earn', 'redeem', 'expire', 'adjustment'
  points: integer("points").notNull(),
  balanceBefore: integer("balance_before").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  orderId: varchar("order_id").references(() => orders.id, { onDelete: 'set null' }),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Bundles - Combo meals and bundle offers
export const bundles = pgTable("bundles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  bundlePrice: decimal("bundle_price", { precision: 10, scale: 2 }).notNull(),
  originalPrice: decimal("original_price", { precision: 10, scale: 2 }), // Sum of individual items
  limitPerOrder: integer("limit_per_order").default(1),
  displayPriority: integer("display_priority").default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Bundle Items - Items included in bundles
export const bundleItems = pgTable("bundle_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bundleId: varchar("bundle_id").notNull().references(() => bundles.id, { onDelete: 'cascade' }),
  menuItemId: varchar("menu_item_id").notNull().references(() => menuItems.id, { onDelete: 'cascade' }),
  quantity: integer("quantity").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

// Upsell Rules - Smart pairing and cart suggestions
export const upsellRules = pgTable("upsell_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  name: varchar("name", { length: 255 }).notNull(),
  triggerType: varchar("trigger_type", { length: 50 }).notNull(), // 'item', 'cart_total', 'category'
  triggerItemId: varchar("trigger_item_id").references(() => menuItems.id, { onDelete: 'cascade' }),
  triggerConditions: jsonb("trigger_conditions"), // {minCartTotal, categoryId}
  suggestionItemIds: jsonb("suggestion_item_ids").notNull(), // Array of menu item IDs
  suggestionText: varchar("suggestion_text", { length: 255 }),
  uiPosition: varchar("ui_position", { length: 50 }).default('cart'), // 'cart', 'checkout', 'item_modal'
  priority: integer("priority").default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Boost Credits - Daily boost credits per restaurant
export const boostCredits = pgTable("boost_credits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").notNull().unique().references(() => restaurants.id, { onDelete: 'cascade' }),
  creditsBalance: integer("credits_balance").notNull().default(0),
  dailyAllowance: integer("daily_allowance").notNull().default(1), // Free boosts per day
  lastResetDate: timestamp("last_reset_date").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Boost Slots - Featured placement slots
export const boostSlots = pgTable("boost_slots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  slotType: varchar("slot_type", { length: 50 }).notNull(), // 'home_featured', 'category_top', 'search_priority'
  startedAt: timestamp("started_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),
  status: varchar("status", { length: 50 }).notNull().default('active'), // 'active', 'completed', 'cancelled'
  creditsUsed: integer("credits_used").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

// Boost Impressions - Track boost performance
export const boostImpressions = pgTable("boost_impressions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  boostSlotId: varchar("boost_slot_id").notNull().references(() => boostSlots.id, { onDelete: 'cascade' }),
  viewerId: varchar("viewer_id"), // Anonymous or customer ID
  orderId: varchar("order_id").references(() => orders.id, { onDelete: 'set null' }),
  converted: boolean("converted").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Customer Segments - Segmentation for targeted campaigns
export const customerSegments = pgTable("customer_segments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  rules: jsonb("rules").notNull(), // {ordersCount, lifetimeValue, lastOrderDays, tags}
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Segment Members - Customers in segments (computed/cached)
export const segmentMembers = pgTable("segment_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  segmentId: varchar("segment_id").notNull().references(() => customerSegments.id, { onDelete: 'cascade' }),
  customerId: varchar("customer_id").notNull().references(() => customers.id, { onDelete: 'cascade' }),
  addedAt: timestamp("added_at").defaultNow(),
});

// Campaigns - Marketing campaign definitions
export const campaigns = pgTable("campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // 'welcome', 'reactivation', 'birthday', 'abandoned_cart', 'custom'
  channel: varchar("channel", { length: 50 }).notNull(), // 'push', 'sms', 'email'
  subject: varchar("subject", { length: 255 }),
  message: text("message").notNull(),
  promoRuleId: varchar("promo_rule_id").references(() => promoRules.id, { onDelete: 'set null' }),
  segmentId: varchar("segment_id").references(() => customerSegments.id, { onDelete: 'set null' }),
  triggerRules: jsonb("trigger_rules"), // {daysInactive, events}
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Campaign Runs - Campaign execution logs
export const campaignRuns = pgTable("campaign_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  scheduledFor: timestamp("scheduled_for").notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  recipientsCount: integer("recipients_count").notNull().default(0),
  sentCount: integer("sent_count").notNull().default(0),
  deliveredCount: integer("delivered_count").notNull().default(0),
  clickedCount: integer("clicked_count").notNull().default(0),
  redemptionsCount: integer("redemptions_count").notNull().default(0),
  status: varchar("status", { length: 50 }).notNull().default('pending'), // 'pending', 'running', 'completed', 'failed'
  createdAt: timestamp("created_at").defaultNow(),
});

// Marketing Events - Event tracking for analytics
export const marketingEvents = pgTable("marketing_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  eventType: varchar("event_type", { length: 100 }).notNull(), // 'view_menu', 'add_to_cart', 'checkout', 'promo_view', etc.
  customerId: varchar("customer_id").references(() => customers.id, { onDelete: 'set null' }),
  sessionId: varchar("session_id", { length: 255 }),
  eventData: jsonb("event_data"), // Context-specific data
  createdAt: timestamp("created_at").defaultNow(),
});

// Marketing Metrics Daily - Aggregated daily metrics
export const marketingMetricsDaily = pgTable("marketing_metrics_daily", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  date: timestamp("date").notNull(),
  newCustomers: integer("new_customers").notNull().default(0),
  returningCustomers: integer("returning_customers").notNull().default(0),
  ordersCount: integer("orders_count").notNull().default(0),
  revenue: decimal("revenue", { precision: 10, scale: 2 }).default('0'),
  promoRevenue: decimal("promo_revenue", { precision: 10, scale: 2 }).default('0'),
  discountsGiven: decimal("discounts_given", { precision: 10, scale: 2 }).default('0'),
  avgOrderValue: decimal("avg_order_value", { precision: 10, scale: 2 }).default('0'),
  conversionRate: decimal("conversion_rate", { precision: 5, scale: 2 }).default('0'),
  createdAt: timestamp("created_at").defaultNow(),
});

// Pixels - Third-party tracking pixels (Meta, TikTok, Google)
export const pixels = pgTable("pixels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  platform: varchar("platform", { length: 50 }).notNull(), // 'meta', 'tiktok', 'google_ads', 'snapchat'
  pixelId: varchar("pixel_id", { length: 255 }).notNull(),
  accessToken: text("access_token"), // For server-side events
  isActive: boolean("is_active").notNull().default(true),
  domainVerified: boolean("domain_verified").notNull().default(false),
  consentRequired: boolean("consent_required").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Pixel Events - Track pixel event fires
export const pixelEvents = pgTable("pixel_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pixelId: varchar("pixel_id").notNull().references(() => pixels.id, { onDelete: 'cascade' }),
  eventName: varchar("event_name", { length: 100 }).notNull(), // 'ViewContent', 'AddToCart', 'Purchase'
  eventData: jsonb("event_data"),
  customerId: varchar("customer_id").references(() => customers.id, { onDelete: 'set null' }),
  orderId: varchar("order_id").references(() => orders.id, { onDelete: 'set null' }),
  status: varchar("status", { length: 50 }).notNull().default('pending'), // 'pending', 'sent', 'failed'
  createdAt: timestamp("created_at").defaultNow(),
});

// Referral Programs - Referral program configuration
export const referralPrograms = pgTable("referral_programs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").notNull().unique().references(() => restaurants.id, { onDelete: 'cascade' }),
  referrerRewardType: varchar("referrer_reward_type", { length: 50 }).notNull(), // 'percentage', 'fixed_amount', 'points'
  referrerRewardValue: decimal("referrer_reward_value", { precision: 10, scale: 2 }).notNull(),
  refereeRewardType: varchar("referee_reward_type", { length: 50 }).notNull(),
  refereeRewardValue: decimal("referee_reward_value", { precision: 10, scale: 2 }).notNull(),
  minOrderAmount: decimal("min_order_amount", { precision: 10, scale: 2 }),
  maxRedemptionsPerReferrer: integer("max_redemptions_per_referrer"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Referral Links - Unique referral codes per customer
export const referralLinks = pgTable("referral_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referralProgramId: varchar("referral_program_id").notNull().references(() => referralPrograms.id, { onDelete: 'cascade' }),
  referrerId: varchar("referrer_id").notNull().references(() => customers.id, { onDelete: 'cascade' }),
  referralCode: varchar("referral_code", { length: 50 }).notNull().unique(),
  clicksCount: integer("clicks_count").notNull().default(0),
  conversionsCount: integer("conversions_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Referral Rewards - Track referral rewards given
export const referralRewards = pgTable("referral_rewards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referralLinkId: varchar("referral_link_id").notNull().references(() => referralLinks.id, { onDelete: 'cascade' }),
  refereeId: varchar("referee_id").notNull().references(() => customers.id, { onDelete: 'cascade' }),
  orderId: varchar("order_id").notNull().references(() => orders.id, { onDelete: 'cascade' }),
  referrerRewardAmount: decimal("referrer_reward_amount", { precision: 10, scale: 2 }).notNull(),
  refereeRewardAmount: decimal("referee_reward_amount", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default('pending'), // 'pending', 'awarded', 'expired'
  awardedAt: timestamp("awarded_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  restaurants: many(restaurants),
}));

export const restaurantsRelations = relations(restaurants, ({ one, many }) => ({
  owner: one(users, {
    fields: [restaurants.ownerId],
    references: [users.id],
  }),
  menuCategories: many(menuCategories),
  menuItems: many(menuItems),
  tables: many(tables),
  reservations: many(reservations),
  orders: many(orders),
  staff: many(staff),
  inventory: many(inventory),
  deliveryZones: many(deliveryZones),
}));

export const menuCategoriesRelations = relations(menuCategories, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [menuCategories.restaurantId],
    references: [restaurants.id],
  }),
  items: many(menuItems),
}));

export const menuItemsRelations = relations(menuItems, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [menuItems.restaurantId],
    references: [restaurants.id],
  }),
  category: one(menuCategories, {
    fields: [menuItems.categoryId],
    references: [menuCategories.id],
  }),
  orderItems: many(orderItems),
  options: many(itemOptions),
}));

export const tablesRelations = relations(tables, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [tables.restaurantId],
    references: [restaurants.id],
  }),
  reservations: many(reservations),
  orders: many(orders),
}));

export const reservationsRelations = relations(reservations, ({ one }) => ({
  restaurant: one(restaurants, {
    fields: [reservations.restaurantId],
    references: [restaurants.id],
  }),
  table: one(tables, {
    fields: [reservations.tableId],
    references: [tables.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [orders.restaurantId],
    references: [restaurants.id],
  }),
  table: one(tables, {
    fields: [orders.tableId],
    references: [tables.id],
  }),
  assignedDriver: one(driverProfiles, {
    fields: [orders.assignedDriverId],
    references: [driverProfiles.id],
  }),
  items: many(orderItems),
  ledgerEntry: one(earningsLedger),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  menuItem: one(menuItems, {
    fields: [orderItems.menuItemId],
    references: [menuItems.id],
  }),
}));

export const staffRelations = relations(staff, ({ one }) => ({
  restaurant: one(restaurants, {
    fields: [staff.restaurantId],
    references: [restaurants.id],
  }),
}));

export const inventoryRelations = relations(inventory, ({ one }) => ({
  restaurant: one(restaurants, {
    fields: [inventory.restaurantId],
    references: [restaurants.id],
  }),
}));

export const deliveryZonesRelations = relations(deliveryZones, ({ one }) => ({
  restaurant: one(restaurants, {
    fields: [deliveryZones.restaurantId],
    references: [restaurants.id],
  }),
}));

export const restaurantPayoutAccountsRelations = relations(restaurantPayoutAccounts, ({ one }) => ({
  restaurant: one(restaurants, {
    fields: [restaurantPayoutAccounts.restaurantId],
    references: [restaurants.id],
  }),
}));

export const driverProfilesRelations = relations(driverProfiles, ({ one, many }) => ({
  user: one(users, {
    fields: [driverProfiles.userId],
    references: [users.id],
  }),
  walletBalance: one(driverWalletBalances),
  ledgerEntries: many(earningsLedger),
  walletTransactions: many(walletTransactions),
}));

export const driverWalletBalancesRelations = relations(driverWalletBalances, ({ one }) => ({
  driver: one(driverProfiles, {
    fields: [driverWalletBalances.driverId],
    references: [driverProfiles.id],
  }),
}));

export const earningsLedgerRelations = relations(earningsLedger, ({ one }) => ({
  order: one(orders, {
    fields: [earningsLedger.orderId],
    references: [orders.id],
  }),
  restaurant: one(restaurants, {
    fields: [earningsLedger.restaurantId],
    references: [restaurants.id],
  }),
  driver: one(driverProfiles, {
    fields: [earningsLedger.driverId],
    references: [driverProfiles.id],
  }),
}));

export const payoutRunsRelations = relations(payoutRuns, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [payoutRuns.restaurantId],
    references: [restaurants.id],
  }),
  ledgerEntries: many(payoutRunLedgerEntries),
}));

export const payoutRunLedgerEntriesRelations = relations(payoutRunLedgerEntries, ({ one }) => ({
  payoutRun: one(payoutRuns, {
    fields: [payoutRunLedgerEntries.payoutRunId],
    references: [payoutRuns.id],
  }),
  ledgerEntry: one(earningsLedger, {
    fields: [payoutRunLedgerEntries.ledgerEntryId],
    references: [earningsLedger.id],
  }),
}));

export const walletTransactionsRelations = relations(walletTransactions, ({ one }) => ({
  driver: one(driverProfiles, {
    fields: [walletTransactions.driverId],
    references: [driverProfiles.id],
  }),
  relatedOrder: one(orders, {
    fields: [walletTransactions.relatedOrderId],
    references: [orders.id],
  }),
  relatedLedger: one(earningsLedger, {
    fields: [walletTransactions.relatedLedgerId],
    references: [earningsLedger.id],
  }),
}));

export const itemOptionsRelations = relations(itemOptions, ({ one }) => ({
  menuItem: one(menuItems, {
    fields: [itemOptions.menuItemId],
    references: [menuItems.id],
  }),
}));

// Marketing Relations
export const promoRulesRelations = relations(promoRules, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [promoRules.restaurantId],
    references: [restaurants.id],
  }),
  redemptions: many(promoRedemptions),
  performance: many(promoPerformance),
}));

export const promoRedemptionsRelations = relations(promoRedemptions, ({ one }) => ({
  promoRule: one(promoRules, {
    fields: [promoRedemptions.promoRuleId],
    references: [promoRules.id],
  }),
  order: one(orders, {
    fields: [promoRedemptions.orderId],
    references: [orders.id],
  }),
  customer: one(customers, {
    fields: [promoRedemptions.customerId],
    references: [customers.id],
  }),
}));

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [loyaltyTiers.restaurantId],
    references: [restaurants.id],
  }),
  accounts: many(loyaltyAccounts),
}));

export const loyaltyAccountsRelations = relations(loyaltyAccounts, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [loyaltyAccounts.restaurantId],
    references: [restaurants.id],
  }),
  customer: one(customers, {
    fields: [loyaltyAccounts.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyAccounts.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const bundlesRelations = relations(bundles, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [bundles.restaurantId],
    references: [restaurants.id],
  }),
  items: many(bundleItems),
}));

export const bundleItemsRelations = relations(bundleItems, ({ one }) => ({
  bundle: one(bundles, {
    fields: [bundleItems.bundleId],
    references: [bundles.id],
  }),
  menuItem: one(menuItems, {
    fields: [bundleItems.menuItemId],
    references: [menuItems.id],
  }),
}));

export const upsellRulesRelations = relations(upsellRules, ({ one }) => ({
  restaurant: one(restaurants, {
    fields: [upsellRules.restaurantId],
    references: [restaurants.id],
  }),
  triggerItem: one(menuItems, {
    fields: [upsellRules.triggerItemId],
    references: [menuItems.id],
  }),
}));

export const boostSlotsRelations = relations(boostSlots, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [boostSlots.restaurantId],
    references: [restaurants.id],
  }),
  impressions: many(boostImpressions),
}));

export const customerSegmentsRelations = relations(customerSegments, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [customerSegments.restaurantId],
    references: [restaurants.id],
  }),
  members: many(segmentMembers),
  campaigns: many(campaigns),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [campaigns.restaurantId],
    references: [restaurants.id],
  }),
  promoRule: one(promoRules, {
    fields: [campaigns.promoRuleId],
    references: [promoRules.id],
  }),
  segment: one(customerSegments, {
    fields: [campaigns.segmentId],
    references: [customerSegments.id],
  }),
  runs: many(campaignRuns),
}));

export const campaignRunsRelations = relations(campaignRuns, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [campaignRuns.campaignId],
    references: [campaigns.id],
  }),
}));

export const pixelsRelations = relations(pixels, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [pixels.restaurantId],
    references: [restaurants.id],
  }),
  events: many(pixelEvents),
}));

export const referralProgramsRelations = relations(referralPrograms, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [referralPrograms.restaurantId],
    references: [restaurants.id],
  }),
  links: many(referralLinks),
}));

export const referralLinksRelations = relations(referralLinks, ({ one, many }) => ({
  program: one(referralPrograms, {
    fields: [referralLinks.referralProgramId],
    references: [referralPrograms.id],
  }),
  referrer: one(customers, {
    fields: [referralLinks.referrerId],
    references: [customers.id],
  }),
  rewards: many(referralRewards),
}));

// Insert Schemas
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export const insertRestaurantSchema = createInsertSchema(restaurants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRestaurant = z.infer<typeof insertRestaurantSchema>;
export type Restaurant = typeof restaurants.$inferSelect;

export const insertMenuCategorySchema = createInsertSchema(menuCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertMenuCategory = z.infer<typeof insertMenuCategorySchema>;
export type MenuCategory = typeof menuCategories.$inferSelect;

export const insertMenuItemSchema = createInsertSchema(menuItems, {
  upsellItemIds: z.array(z.string()).optional(),
  crossSellItemIds: z.array(z.string()).optional(),
  downsellItemIds: z.array(z.string()).optional(),
  marketingTactics: z.object({
    enableUrgencyTimer: z.boolean().optional(),
    urgencyTimerMinutes: z.number().optional(),
    urgencyTimerMessage: z.string().optional(),
    enableScarcityNotice: z.boolean().optional(),
    scarcityThreshold: z.number().optional(),
    scarcityMessage: z.string().optional(),
    enableSocialProof: z.boolean().optional(),
    socialProofMessage: z.string().optional(),
    socialProofCount: z.number().optional(),
  }).optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertMenuItem = z.infer<typeof insertMenuItemSchema>;
export type MenuItem = typeof menuItems.$inferSelect;

export const insertTableSchema = createInsertSchema(tables).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTable = z.infer<typeof insertTableSchema>;
export type Table = typeof tables.$inferSelect;

export const insertReservationSchema = createInsertSchema(reservations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertReservation = z.infer<typeof insertReservationSchema>;
export type Reservation = typeof reservations.$inferSelect;

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

export const insertOrderItemSchema = createInsertSchema(orderItems).omit({
  id: true,
  createdAt: true,
});
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type OrderItem = typeof orderItems.$inferSelect;

export const insertStaffSchema = createInsertSchema(staff).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertStaff = z.infer<typeof insertStaffSchema>;
export type Staff = typeof staff.$inferSelect;

export const insertInventorySchema = createInsertSchema(inventory).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertInventory = z.infer<typeof insertInventorySchema>;
export type Inventory = typeof inventory.$inferSelect;

export const insertDeliveryZoneSchema = createInsertSchema(deliveryZones).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDeliveryZone = z.infer<typeof insertDeliveryZoneSchema>;
export type DeliveryZone = typeof deliveryZones.$inferSelect;

export const insertPlatformPaymentSettingsSchema = createInsertSchema(platformPaymentSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPlatformPaymentSettings = z.infer<typeof insertPlatformPaymentSettingsSchema>;
export type PlatformPaymentSettings = typeof platformPaymentSettings.$inferSelect;

export const insertRestaurantPayoutAccountSchema = createInsertSchema(restaurantPayoutAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRestaurantPayoutAccount = z.infer<typeof insertRestaurantPayoutAccountSchema>;
export type RestaurantPayoutAccount = typeof restaurantPayoutAccounts.$inferSelect;

export const insertDriverProfileSchema = createInsertSchema(driverProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDriverProfile = z.infer<typeof insertDriverProfileSchema>;
export type DriverProfile = typeof driverProfiles.$inferSelect;

export const insertDriverWalletBalanceSchema = createInsertSchema(driverWalletBalances).omit({
  id: true,
  updatedAt: true,
});
export type InsertDriverWalletBalance = z.infer<typeof insertDriverWalletBalanceSchema>;
export type DriverWalletBalance = typeof driverWalletBalances.$inferSelect;

export const insertEarningsLedgerSchema = createInsertSchema(earningsLedger).omit({
  id: true,
  createdAt: true,
});
export type InsertEarningsLedger = z.infer<typeof insertEarningsLedgerSchema>;
export type EarningsLedger = typeof earningsLedger.$inferSelect;

export const insertPayoutRunSchema = createInsertSchema(payoutRuns).omit({
  id: true,
  createdAt: true,
});
export type InsertPayoutRun = z.infer<typeof insertPayoutRunSchema>;
export type PayoutRun = typeof payoutRuns.$inferSelect;

export const insertPayoutRunLedgerEntrySchema = createInsertSchema(payoutRunLedgerEntries).omit({
  id: true,
  createdAt: true,
});
export type InsertPayoutRunLedgerEntry = z.infer<typeof insertPayoutRunLedgerEntrySchema>;
export type PayoutRunLedgerEntry = typeof payoutRunLedgerEntries.$inferSelect;

export const insertWalletTransactionSchema = createInsertSchema(walletTransactions).omit({
  id: true,
  createdAt: true,
});
export type InsertWalletTransaction = z.infer<typeof insertWalletTransactionSchema>;
export type WalletTransaction = typeof walletTransactions.$inferSelect;

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

export const insertItemOptionSchema = createInsertSchema(itemOptions, {
  choices: z.array(z.object({
    id: z.string(),
    label: z.string(),
    priceCents: z.number(),
    sku: z.string().optional(),
    available: z.boolean().optional(),
  })),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertItemOption = z.infer<typeof insertItemOptionSchema>;
export type ItemOption = typeof itemOptions.$inferSelect;

// Marketing Insert Schemas
export const insertPromoRuleSchema = createInsertSchema(promoRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPromoRule = z.infer<typeof insertPromoRuleSchema>;
export type PromoRule = typeof promoRules.$inferSelect;

export const insertPromoRedemptionSchema = createInsertSchema(promoRedemptions).omit({
  id: true,
  createdAt: true,
});
export type InsertPromoRedemption = z.infer<typeof insertPromoRedemptionSchema>;
export type PromoRedemption = typeof promoRedemptions.$inferSelect;

export const insertLoyaltyTierSchema = createInsertSchema(loyaltyTiers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertLoyaltyTier = z.infer<typeof insertLoyaltyTierSchema>;
export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;

export const insertLoyaltyAccountSchema = createInsertSchema(loyaltyAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertLoyaltyAccount = z.infer<typeof insertLoyaltyAccountSchema>;
export type LoyaltyAccount = typeof loyaltyAccounts.$inferSelect;

export const insertLoyaltyTransactionSchema = createInsertSchema(loyaltyTransactions).omit({
  id: true,
  createdAt: true,
});
export type InsertLoyaltyTransaction = z.infer<typeof insertLoyaltyTransactionSchema>;
export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;

export const insertBundleSchema = createInsertSchema(bundles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBundle = z.infer<typeof insertBundleSchema>;
export type Bundle = typeof bundles.$inferSelect;

export const insertBundleItemSchema = createInsertSchema(bundleItems).omit({
  id: true,
  createdAt: true,
});
export type InsertBundleItem = z.infer<typeof insertBundleItemSchema>;
export type BundleItem = typeof bundleItems.$inferSelect;

export const insertUpsellRuleSchema = createInsertSchema(upsellRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUpsellRule = z.infer<typeof insertUpsellRuleSchema>;
export type UpsellRule = typeof upsellRules.$inferSelect;

export const insertBoostCreditSchema = createInsertSchema(boostCredits).omit({
  id: true,
  updatedAt: true,
});
export type InsertBoostCredit = z.infer<typeof insertBoostCreditSchema>;
export type BoostCredit = typeof boostCredits.$inferSelect;

export const insertBoostSlotSchema = createInsertSchema(boostSlots).omit({
  id: true,
  createdAt: true,
});
export type InsertBoostSlot = z.infer<typeof insertBoostSlotSchema>;
export type BoostSlot = typeof boostSlots.$inferSelect;

export const insertCustomerSegmentSchema = createInsertSchema(customerSegments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCustomerSegment = z.infer<typeof insertCustomerSegmentSchema>;
export type CustomerSegment = typeof customerSegments.$inferSelect;

export const insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaigns.$inferSelect;

export const insertCampaignRunSchema = createInsertSchema(campaignRuns).omit({
  id: true,
  createdAt: true,
});
export type InsertCampaignRun = z.infer<typeof insertCampaignRunSchema>;
export type CampaignRun = typeof campaignRuns.$inferSelect;

export const insertMarketingEventSchema = createInsertSchema(marketingEvents).omit({
  id: true,
  createdAt: true,
});
export type InsertMarketingEvent = z.infer<typeof insertMarketingEventSchema>;
export type MarketingEvent = typeof marketingEvents.$inferSelect;

export const insertPixelSchema = createInsertSchema(pixels).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPixel = z.infer<typeof insertPixelSchema>;
export type Pixel = typeof pixels.$inferSelect;

export const insertReferralProgramSchema = createInsertSchema(referralPrograms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertReferralProgram = z.infer<typeof insertReferralProgramSchema>;
export type ReferralProgram = typeof referralPrograms.$inferSelect;

export const insertReferralLinkSchema = createInsertSchema(referralLinks).omit({
  id: true,
  createdAt: true,
});
export type InsertReferralLink = z.infer<typeof insertReferralLinkSchema>;
export type ReferralLink = typeof referralLinks.$inferSelect;

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

import {
  users,
  restaurants,
  menuCategories,
  menuItems,
  tables,
  reservations,
  orders,
  orderItems,
  staff,
  inventory,
  deliveryZones,
  driverProfiles,
  restaurantPayoutAccounts,
  earningsLedger,
  payoutRuns,
  customerReviews,
  inboxMessages,
  promoRules,
  bundles as bundlesTable,
  type User,
  type UpsertUser,
  type Restaurant,
  type InsertRestaurant,
  type MenuCategory,
  type InsertMenuCategory,
  type MenuItem,
  type InsertMenuItem,
  type Table,
  type InsertTable,
  type Reservation,
  type InsertReservation,
  type Order,
  type InsertOrder,
  type OrderItem,
  type InsertOrderItem,
  type Staff,
  type InsertStaff,
  type Inventory,
  type InsertInventory,
  type DeliveryZone,
  type InsertDeliveryZone,
  type DriverProfile,
  type RestaurantPayoutAccount,
  type InsertRestaurantPayoutAccount,
  type CustomerReview,
  type InsertCustomerReview,
  type InboxMessage,
  type InsertInboxMessage,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, like, sql } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByStripeCustomerId(stripeCustomerId: string): Promise<User | undefined>;
  createUser(user: Partial<UpsertUser>): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserSubscription(userId: string, data: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    subscriptionStatus?: string;
    subscriptionEndsAt?: Date;
  }): Promise<User>;
  
  // Restaurant operations
  getRestaurant(id: string): Promise<Restaurant | undefined>;
  getRestaurantByOwnerId(ownerId: string): Promise<Restaurant | undefined>;
  getRestaurantBySlug(slug: string): Promise<Restaurant | undefined>;
  getRestaurantBySubdomain(subdomain: string): Promise<Restaurant | undefined>;
  getRestaurantByCustomDomain(customDomain: string): Promise<Restaurant | undefined>;
  createRestaurant(restaurant: InsertRestaurant): Promise<Restaurant>;
  updateRestaurant(id: string, restaurant: Partial<InsertRestaurant>): Promise<Restaurant>;
  deleteRestaurant(id: string): Promise<void>;
  
  // Menu operations
  getMenuCategories(restaurantId: string): Promise<MenuCategory[]>;
  createMenuCategory(category: InsertMenuCategory): Promise<MenuCategory>;
  updateMenuCategory(id: string, category: Partial<InsertMenuCategory>): Promise<MenuCategory>;
  deleteMenuCategory(id: string): Promise<void>;
  getMenuItems(restaurantId: string): Promise<MenuItem[]>;
  getMenuItem(id: string): Promise<MenuItem | undefined>;
  createMenuItem(item: InsertMenuItem): Promise<MenuItem>;
  updateMenuItem(id: string, item: Partial<InsertMenuItem>): Promise<MenuItem>;
  deleteMenuItem(id: string): Promise<void>;
  
  // Table operations
  getTables(restaurantId: string): Promise<Table[]>;
  getTable(id: string): Promise<Table | undefined>;
  createTable(table: InsertTable): Promise<Table>;
  updateTable(id: string, table: Partial<InsertTable>): Promise<Table>;
  deleteTable(id: string): Promise<void>;
  
  // Reservation operations
  getReservations(restaurantId: string): Promise<Reservation[]>;
  createReservation(reservation: InsertReservation): Promise<Reservation>;
  updateReservation(id: string, reservation: Partial<InsertReservation>): Promise<Reservation>;
  deleteReservation(id: string): Promise<void>;
  
  // Order operations
  getOrders(restaurantId: string): Promise<Order[]>;
  getRecentOrders(restaurantId: string, limit: number): Promise<Order[]>;
  getOrderWithItems(orderId: string): Promise<{ order: Order; items: (OrderItem & { menuItem: MenuItem })[] } | undefined>;
  getAllOrderItems(restaurantId: string): Promise<(OrderItem & { menuItem: MenuItem })[]>;
  createOrder(order: InsertOrder, items: Omit<InsertOrderItem, 'orderId'>[]): Promise<Order>;
  updateOrderStatus(orderId: string, status: string): Promise<Order>;
  confirmOrderWithPayment(orderId: string, paymentProvider: string, paymentIntentId: string, totalAmount: number, deliveryFee?: number): Promise<Order>;
  getLastOrderByPrefix(restaurantId: string, prefix: string): Promise<Order | undefined>;
  
  // Staff operations
  getStaff(restaurantId: string): Promise<Staff[]>;
  createStaff(staff: InsertStaff): Promise<Staff>;
  updateStaff(id: string, staff: Partial<InsertStaff>): Promise<Staff>;
  deleteStaff(id: string): Promise<void>;
  
  // Inventory operations
  getInventory(restaurantId: string): Promise<Inventory[]>;
  createInventory(inventory: InsertInventory): Promise<Inventory>;
  updateInventory(id: string, inventory: Partial<InsertInventory>): Promise<Inventory>;
  deleteInventory(id: string): Promise<void>;
  
  // Delivery zone operations
  getDeliveryZones(restaurantId: string): Promise<DeliveryZone[]>;
  createDeliveryZone(zone: InsertDeliveryZone): Promise<DeliveryZone>;
  updateDeliveryZone(id: string, zone: Partial<InsertDeliveryZone>): Promise<DeliveryZone>;
  deleteDeliveryZone(id: string): Promise<void>;
  
  // Payout account operations
  getPayoutAccount(restaurantId: string): Promise<RestaurantPayoutAccount | undefined>;
  createOrUpdatePayoutAccount(restaurantId: string, account: Partial<InsertRestaurantPayoutAccount>): Promise<RestaurantPayoutAccount>;
  
  // Earnings and Payouts operations
  getEarningsLedger(restaurantId: string): Promise<any[]>;
  getPayoutRuns(restaurantId: string): Promise<any[]>;
  getPendingEarnings(restaurantId: string): Promise<{ total: string; count: number }>;
  
  // Driver operations
  getAllDrivers(): Promise<DriverProfile[]>;
  getDriver(id: string): Promise<DriverProfile | undefined>;
  updateDriverAvailability(id: string, isAvailable: boolean): Promise<DriverProfile>;
  getDriverAssignments(): Promise<(Order & { driver?: DriverProfile })[]>;
  getDriverPerformance(): Promise<{ driverId: string; driver: DriverProfile; deliveries: number; earnings: string; rating: string }[]>;
  
  // Admin operations
  getAllRestaurants(): Promise<(Restaurant & { owner: User })[]>;
  getAllUsers(): Promise<User[]>;
  updateUserRole(userId: string, role: string): Promise<User>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByStripeCustomerId(stripeCustomerId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.stripeCustomerId, stripeCustomerId));
    return user;
  }

  async createUser(userData: Partial<UpsertUser>): Promise<User> {
    const [user] = await db.insert(users).values(userData as UpsertUser).returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserSubscription(userId: string, data: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    subscriptionStatus?: string;
    subscriptionEndsAt?: Date;
  }): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async getRestaurant(id: string): Promise<Restaurant | undefined> {
    const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.id, id));
    return restaurant;
  }

  async getRestaurantByOwnerId(ownerId: string): Promise<Restaurant | undefined> {
    const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.ownerId, ownerId));
    return restaurant;
  }

  async getRestaurantBySlug(slug: string): Promise<Restaurant | undefined> {
    const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.slug, slug));
    return restaurant;
  }

  async getRestaurantBySubdomain(subdomain: string): Promise<Restaurant | undefined> {
    const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.subdomain, subdomain));
    return restaurant;
  }

  async getRestaurantByCustomDomain(customDomain: string): Promise<Restaurant | undefined> {
    const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.customDomain, customDomain));
    return restaurant;
  }

  async createRestaurant(restaurant: InsertRestaurant): Promise<Restaurant> {
    const [newRestaurant] = await db.insert(restaurants).values(restaurant).returning();
    return newRestaurant;
  }

  async updateRestaurant(id: string, restaurant: Partial<InsertRestaurant>): Promise<Restaurant> {
    const [updated] = await db
      .update(restaurants)
      .set({ ...restaurant, updatedAt: new Date() })
      .where(eq(restaurants.id, id))
      .returning();
    return updated;
  }

  async deleteRestaurant(id: string): Promise<void> {
    await db.delete(restaurants).where(eq(restaurants.id, id));
  }

  async getMenuCategories(restaurantId: string): Promise<MenuCategory[]> {
    return await db.select().from(menuCategories).where(eq(menuCategories.restaurantId, restaurantId));
  }

  async createMenuCategory(category: InsertMenuCategory): Promise<MenuCategory> {
    const [newCategory] = await db.insert(menuCategories).values(category).returning();
    return newCategory;
  }

  async updateMenuCategory(id: string, category: Partial<InsertMenuCategory>): Promise<MenuCategory> {
    const [updated] = await db.update(menuCategories).set(category).where(eq(menuCategories.id, id)).returning();
    return updated;
  }

  async deleteMenuCategory(id: string): Promise<void> {
    await db.delete(menuCategories).where(eq(menuCategories.id, id));
  }

  async getMenuItems(restaurantId: string): Promise<MenuItem[]> {
    return await db.select().from(menuItems).where(eq(menuItems.restaurantId, restaurantId));
  }

  async getMenuItem(id: string): Promise<MenuItem | undefined> {
    const [item] = await db.select().from(menuItems).where(eq(menuItems.id, id));
    return item;
  }

  async createMenuItem(item: InsertMenuItem): Promise<MenuItem> {
    const [newItem] = await db.insert(menuItems).values(item).returning();
    return newItem;
  }

  async updateMenuItem(id: string, item: Partial<InsertMenuItem>): Promise<MenuItem> {
    const [updated] = await db
      .update(menuItems)
      .set({ ...item, updatedAt: new Date() })
      .where(eq(menuItems.id, id))
      .returning();
    return updated;
  }

  async deleteMenuItem(id: string): Promise<void> {
    await db.delete(menuItems).where(eq(menuItems.id, id));
  }

  async getTables(restaurantId: string): Promise<Table[]> {
    return await db.select().from(tables).where(eq(tables.restaurantId, restaurantId));
  }

  async getTable(id: string): Promise<Table | undefined> {
    const [table] = await db.select().from(tables).where(eq(tables.id, id));
    return table;
  }

  async createTable(table: InsertTable): Promise<Table> {
    const [newTable] = await db.insert(tables).values(table).returning();
    return newTable;
  }

  async updateTable(id: string, table: Partial<InsertTable>): Promise<Table> {
    const [updatedTable] = await db.update(tables)
      .set({ ...table, updatedAt: new Date() })
      .where(eq(tables.id, id))
      .returning();
    return updatedTable;
  }

  async deleteTable(id: string): Promise<void> {
    await db.delete(tables).where(eq(tables.id, id));
  }

  async getReservations(restaurantId: string): Promise<Reservation[]> {
    return await db.select().from(reservations).where(eq(reservations.restaurantId, restaurantId)).orderBy(desc(reservations.reservationDate));
  }

  async createReservation(reservation: InsertReservation): Promise<Reservation> {
    const [newReservation] = await db.insert(reservations).values(reservation).returning();
    return newReservation;
  }

  async updateReservation(id: string, reservation: Partial<InsertReservation>): Promise<Reservation> {
    const [updated] = await db
      .update(reservations)
      .set({ ...reservation, updatedAt: new Date() })
      .where(eq(reservations.id, id))
      .returning();
    return updated;
  }

  async deleteReservation(id: string): Promise<void> {
    await db.delete(reservations).where(eq(reservations.id, id));
  }

  async getOrders(restaurantId: string): Promise<Order[]> {
    return await db.select().from(orders).where(eq(orders.restaurantId, restaurantId)).orderBy(desc(orders.createdAt));
  }

  async getRecentOrders(restaurantId: string, limit: number): Promise<Order[]> {
    return await db.select().from(orders).where(eq(orders.restaurantId, restaurantId)).orderBy(desc(orders.createdAt)).limit(limit);
  }

  async createOrder(order: InsertOrder, items: Omit<InsertOrderItem, 'orderId'>[]): Promise<Order> {
    const [newOrder] = await db.insert(orders).values(order).returning();
    
    if (items.length > 0) {
      await db.insert(orderItems).values(
        items.map((item) => ({ ...item, orderId: newOrder.id }))
      );
    }
    
    return newOrder;
  }

  async getOrderWithItems(orderId: string): Promise<{ order: Order; items: (OrderItem & { menuItem: MenuItem })[] } | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
    if (!order) return undefined;
    
    const items = await db
      .select()
      .from(orderItems)
      .innerJoin(menuItems, eq(orderItems.menuItemId, menuItems.id))
      .where(eq(orderItems.orderId, orderId));
    
    return {
      order,
      items: items.map(item => ({
        ...item.order_items,
        menuItem: item.menu_items
      }))
    };
  }

  async getAllOrderItems(restaurantId: string): Promise<(OrderItem & { menuItem: MenuItem })[]> {
    const items = await db
      .select()
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(menuItems, eq(orderItems.menuItemId, menuItems.id))
      .where(eq(orders.restaurantId, restaurantId));
    
    return items.map(item => ({
      ...item.order_items,
      menuItem: item.menu_items
    }));
  }

  async updateOrderStatus(orderId: string, status: string): Promise<Order> {
    const [updated] = await db
      .update(orders)
      .set({ status, updatedAt: new Date() })
      .where(eq(orders.id, orderId))
      .returning();
    return updated;
  }

  async confirmOrderWithPayment(orderId: string, paymentProvider: string, paymentIntentId: string, totalAmount: number, deliveryFee: number = 0): Promise<Order> {
    const currentOrder = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!currentOrder || currentOrder.length === 0) {
      throw new Error("Order not found");
    }
    
    const order = currentOrder[0];
    
    // Calculate amounts correctly to avoid double-counting delivery fees
    // totalAmount = subtotal + tax + deliveryFee (what customer pays)
    const platformFeeRate = 0.02; // 2% platform fee
    const platformFee = Math.round(totalAmount * platformFeeRate * 100) / 100;
    
    // Driver gets 100% of delivery fee (if delivery order)
    const driverShare = order.orderType === 'delivery' ? deliveryFee : 0;
    
    // Restaurant gets: totalAmount - platformFee - driverShare
    const restaurantShare = Math.round((totalAmount - platformFee - driverShare) * 100) / 100;
    
    // Update order with payment tracking data
    const [updated] = await db
      .update(orders)
      .set({
        status: 'confirmed',
        paymentProvider,
        platformCaptureStatus: 'captured',
        paymentIntentId,
        restaurantShare: restaurantShare.toString(),
        driverShare: driverShare.toString(),
        platformFee: platformFee.toString(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId))
      .returning();
    
    // TODO: Create earnings ledger entries
    // This will be implemented fully in task #10 (admin payout management)
    // For now, the payment tracking data is stored in the orders table
    
    return updated;
  }

  async getLastOrderByPrefix(restaurantId: string, prefix: string): Promise<Order | undefined> {
    const [lastOrder] = await db
      .select()
      .from(orders)
      .where(and(
        eq(orders.restaurantId, restaurantId),
        like(orders.orderNumber, `${prefix}-%`)
      ))
      .orderBy(desc(orders.createdAt))
      .limit(1);
    
    return lastOrder;
  }

  async getStaff(restaurantId: string): Promise<Staff[]> {
    return await db.select().from(staff).where(eq(staff.restaurantId, restaurantId));
  }

  async createStaff(staffMember: InsertStaff): Promise<Staff> {
    const [newStaff] = await db.insert(staff).values(staffMember).returning();
    return newStaff;
  }

  async updateStaff(id: string, staffData: Partial<InsertStaff>): Promise<Staff> {
    const [updated] = await db
      .update(staff)
      .set({ ...staffData, updatedAt: new Date() })
      .where(eq(staff.id, id))
      .returning();
    return updated;
  }

  async deleteStaff(id: string): Promise<void> {
    await db.delete(staff).where(eq(staff.id, id));
  }

  async getInventory(restaurantId: string): Promise<Inventory[]> {
    return await db.select().from(inventory).where(eq(inventory.restaurantId, restaurantId));
  }

  async createInventory(inventoryItem: InsertInventory): Promise<Inventory> {
    const [newInventory] = await db.insert(inventory).values(inventoryItem).returning();
    return newInventory;
  }

  async updateInventory(id: string, inventoryData: Partial<InsertInventory>): Promise<Inventory> {
    const [updated] = await db
      .update(inventory)
      .set({ ...inventoryData, updatedAt: new Date() })
      .where(eq(inventory.id, id))
      .returning();
    return updated;
  }

  async deleteInventory(id: string): Promise<void> {
    await db.delete(inventory).where(eq(inventory.id, id));
  }

  async getDeliveryZones(restaurantId: string): Promise<DeliveryZone[]> {
    return await db.select().from(deliveryZones).where(eq(deliveryZones.restaurantId, restaurantId));
  }

  async createDeliveryZone(zone: InsertDeliveryZone): Promise<DeliveryZone> {
    const [newZone] = await db.insert(deliveryZones).values(zone).returning();
    return newZone;
  }

  async updateDeliveryZone(id: string, zone: Partial<InsertDeliveryZone>): Promise<DeliveryZone> {
    const [updated] = await db
      .update(deliveryZones)
      .set({ ...zone, updatedAt: new Date() })
      .where(eq(deliveryZones.id, id))
      .returning();
    return updated;
  }

  async deleteDeliveryZone(id: string): Promise<void> {
    await db.delete(deliveryZones).where(eq(deliveryZones.id, id));
  }

  async getPayoutAccount(restaurantId: string): Promise<RestaurantPayoutAccount | undefined> {
    const [account] = await db
      .select()
      .from(restaurantPayoutAccounts)
      .where(eq(restaurantPayoutAccounts.restaurantId, restaurantId));
    return account;
  }

  async createOrUpdatePayoutAccount(restaurantId: string, account: Partial<InsertRestaurantPayoutAccount>): Promise<RestaurantPayoutAccount> {
    // Check if account already exists
    const [existing] = await db
      .select()
      .from(restaurantPayoutAccounts)
      .where(eq(restaurantPayoutAccounts.restaurantId, restaurantId));

    if (existing) {
      // Update existing account
      const [updated] = await db
        .update(restaurantPayoutAccounts)
        .set({ ...account, updatedAt: new Date() })
        .where(eq(restaurantPayoutAccounts.restaurantId, restaurantId))
        .returning();
      return updated;
    } else {
      // Create new account
      const [newAccount] = await db
        .insert(restaurantPayoutAccounts)
        .values({ ...account, restaurantId })
        .returning();
      return newAccount;
    }
  }

  async getAllRestaurants(): Promise<(Restaurant & { owner: User })[]> {
    const result = await db
      .select()
      .from(restaurants)
      .leftJoin(users, eq(restaurants.ownerId, users.id));
    
    return result.map(row => ({
      ...row.restaurants,
      owner: row.users!
    }));
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async updateUserRole(userId: string, role: string): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  // Earnings and Payouts operations
  async getEarningsLedger(restaurantId: string): Promise<any[]> {
    const ledger = await db
      .select()
      .from(earningsLedger)
      .where(eq(earningsLedger.restaurantId, restaurantId))
      .orderBy(desc(earningsLedger.createdAt));
    return ledger;
  }

  async getPayoutRuns(restaurantId: string): Promise<any[]> {
    const runs = await db
      .select()
      .from(payoutRuns)
      .where(eq(payoutRuns.restaurantId, restaurantId))
      .orderBy(desc(payoutRuns.createdAt));
    return runs;
  }

  async getPendingEarnings(restaurantId: string): Promise<{ total: string; count: number }> {
    const pending = await db
      .select({
        total: sql<string>`COALESCE(SUM(${earningsLedger.restaurantShare}), 0)`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(earningsLedger)
      .where(
        and(
          eq(earningsLedger.restaurantId, restaurantId),
          eq(earningsLedger.restaurantPayoutStatus, 'pending')
        )
      );
    return pending[0] || { total: '0', count: 0 };
  }

  // Driver operations
  async getAllDrivers(): Promise<DriverProfile[]> {
    const drivers = await db.select().from(driverProfiles).orderBy(driverProfiles.createdAt);
    return drivers;
  }

  async getDriver(id: string): Promise<DriverProfile | undefined> {
    const [driver] = await db.select().from(driverProfiles).where(eq(driverProfiles.id, id));
    return driver;
  }

  async updateDriverAvailability(id: string, isAvailable: boolean): Promise<DriverProfile> {
    const [updated] = await db
      .update(driverProfiles)
      .set({ isAvailable, updatedAt: new Date() })
      .where(eq(driverProfiles.id, id))
      .returning();
    return updated;
  }

  async getDriverAssignments(): Promise<(Order & { driver?: DriverProfile })[]> {
    const assignments = await db
      .select()
      .from(orders)
      .leftJoin(driverProfiles, eq(orders.assignedDriverId, driverProfiles.id))
      .where(and(
        eq(orders.orderType, 'delivery'),
        eq(orders.status, 'confirmed')
      ))
      .orderBy(orders.createdAt);
    
    return assignments.map(row => ({
      ...row.orders,
      driver: row.driver_profiles || undefined
    }));
  }

  async getDriverPerformance(): Promise<{ driverId: string; driver: DriverProfile; deliveries: number; earnings: string; rating: string }[]> {
    const performance = await db
      .select({
        driverId: driverProfiles.id,
        driver: driverProfiles,
        deliveries: sql<number>`COUNT(DISTINCT ${orders.id})`.as('deliveries'),
        earnings: sql<string>`COALESCE(SUM(${orders.driverShare}), 0)`.as('earnings'),
      })
      .from(driverProfiles)
      .leftJoin(orders, eq(driverProfiles.id, orders.assignedDriverId))
      .groupBy(driverProfiles.id)
      .orderBy(sql`COUNT(DISTINCT ${orders.id}) DESC`);
    
    return performance.map(p => ({
      driverId: p.driverId,
      driver: p.driver,
      deliveries: p.deliveries,
      earnings: p.earnings,
      rating: '4.8' // Placeholder - would need a ratings table
    }));
  }

  // Customer Reviews
  async getCustomerReviews(restaurantId: string): Promise<CustomerReview[]> {
    const reviews = await db
      .select()
      .from(customerReviews)
      .where(and(
        eq(customerReviews.restaurantId, restaurantId),
        eq(customerReviews.isPublished, true)
      ))
      .orderBy(desc(customerReviews.createdAt));
    return reviews;
  }

  async createCustomerReview(review: InsertCustomerReview): Promise<CustomerReview> {
    const [created] = await db
      .insert(customerReviews)
      .values(review)
      .returning();
    return created;
  }

  // Inbox Messages
  async getInboxMessages(restaurantId: string): Promise<InboxMessage[]> {
    const messages = await db
      .select()
      .from(inboxMessages)
      .where(eq(inboxMessages.restaurantId, restaurantId))
      .orderBy(desc(inboxMessages.createdAt));
    return messages;
  }

  async createInboxMessage(message: InsertInboxMessage): Promise<InboxMessage> {
    const [created] = await db
      .insert(inboxMessages)
      .values(message)
      .returning();
    return created;
  }

  async respondToReview(reviewId: string, response: string): Promise<CustomerReview> {
    const [updated] = await db
      .update(customerReviews)
      .set({
        response,
        respondedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(customerReviews.id, reviewId))
      .returning();
    return updated;
  }

  async respondToMessage(messageId: string, response: string): Promise<InboxMessage> {
    const [updated] = await db
      .update(inboxMessages)
      .set({
        response,
        respondedAt: new Date(),
        status: 'responded',
        updatedAt: new Date(),
      })
      .where(eq(inboxMessages.id, messageId))
      .returning();
    return updated;
  }

  async updateMessageStatus(messageId: string, status: string): Promise<InboxMessage> {
    const [updated] = await db
      .update(inboxMessages)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(inboxMessages.id, messageId))
      .returning();
    return updated;
  }

  // Promo Management
  async getActiveAutoApplyPromos(restaurantId: string): Promise<any[]> {
    const now = new Date();
    const promos = await db
      .select()
      .from(promoRules)
      .where(and(
        eq(promoRules.restaurantId, restaurantId),
        eq(promoRules.isActive, true),
        eq(promoRules.autoApply, true),
        sql`${promoRules.startsAt} <= ${now}`,
        sql`(${promoRules.endsAt} IS NULL OR ${promoRules.endsAt} >= ${now})`
      ))
      .orderBy(desc(promoRules.priority));
    return promos;
  }

  async validatePromoCode(restaurantId: string, promoCode: string): Promise<any | null> {
    const now = new Date();
    const [promo] = await db
      .select()
      .from(promoRules)
      .where(and(
        eq(promoRules.restaurantId, restaurantId),
        eq(promoRules.promoCode, promoCode),
        eq(promoRules.isActive, true),
        sql`${promoRules.startsAt} <= ${now}`,
        sql`(${promoRules.endsAt} IS NULL OR ${promoRules.endsAt} >= ${now})`
      ));
    return promo || null;
  }

  // Bundle Management
  async getBundles(restaurantId: string): Promise<any[]> {
    const bundles = await db
      .select()
      .from(bundlesTable)
      .where(eq(bundlesTable.restaurantId, restaurantId))
      .orderBy(desc(bundlesTable.createdAt));
    return bundles;
  }

  async getActiveBundles(restaurantId: string): Promise<any[]> {
    const bundles = await db
      .select()
      .from(bundlesTable)
      .where(and(
        eq(bundlesTable.restaurantId, restaurantId),
        eq(bundlesTable.isActive, true)
      ))
      .orderBy(desc(bundlesTable.sales));
    return bundles;
  }

  async getBundle(id: string): Promise<any | null> {
    const [bundle] = await db
      .select()
      .from(bundlesTable)
      .where(eq(bundlesTable.id, id));
    return bundle || null;
  }

  async createBundle(bundle: any): Promise<any> {
    const [created] = await db
      .insert(bundlesTable)
      .values(bundle)
      .returning();
    return created;
  }

  async updateBundle(id: string, updates: any): Promise<any> {
    const [updated] = await db
      .update(bundlesTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(bundlesTable.id, id))
      .returning();
    return updated;
  }

  async deleteBundle(id: string): Promise<void> {
    await db
      .delete(bundlesTable)
      .where(eq(bundlesTable.id, id));
  }

  async incrementBundleSales(id: string): Promise<void> {
    await db
      .update(bundlesTable)
      .set({ sales: sql`${bundlesTable.sales} + 1` })
      .where(eq(bundlesTable.id, id));
  }
}

export const storage = new DatabaseStorage();

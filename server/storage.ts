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
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, like } from "drizzle-orm";

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
}

export const storage = new DatabaseStorage();

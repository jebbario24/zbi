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
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserSubscription(userId: string, data: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    subscriptionStatus?: string;
    subscriptionEndsAt?: Date;
  }): Promise<User>;
  
  // Restaurant operations
  getRestaurantByOwnerId(ownerId: string): Promise<Restaurant | undefined>;
  getRestaurantBySlug(slug: string): Promise<Restaurant | undefined>;
  getRestaurantBySubdomain(subdomain: string): Promise<Restaurant | undefined>;
  getRestaurantByCustomDomain(customDomain: string): Promise<Restaurant | undefined>;
  createRestaurant(restaurant: InsertRestaurant): Promise<Restaurant>;
  updateRestaurant(id: string, restaurant: Partial<InsertRestaurant>): Promise<Restaurant>;
  
  // Menu operations
  getMenuCategories(restaurantId: string): Promise<MenuCategory[]>;
  createMenuCategory(category: InsertMenuCategory): Promise<MenuCategory>;
  getMenuItems(restaurantId: string): Promise<MenuItem[]>;
  createMenuItem(item: InsertMenuItem): Promise<MenuItem>;
  
  // Table operations
  getTables(restaurantId: string): Promise<Table[]>;
  createTable(table: InsertTable): Promise<Table>;
  
  // Reservation operations
  getReservations(restaurantId: string): Promise<Reservation[]>;
  createReservation(reservation: InsertReservation): Promise<Reservation>;
  
  // Order operations
  getOrders(restaurantId: string): Promise<Order[]>;
  getRecentOrders(restaurantId: string, limit: number): Promise<Order[]>;
  createOrder(order: InsertOrder, items: Omit<InsertOrderItem, 'orderId'>[]): Promise<Order>;
  
  // Staff operations
  getStaff(restaurantId: string): Promise<Staff[]>;
  createStaff(staff: InsertStaff): Promise<Staff>;
  
  // Inventory operations
  getInventory(restaurantId: string): Promise<Inventory[]>;
  createInventory(inventory: InsertInventory): Promise<Inventory>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
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

  async getMenuCategories(restaurantId: string): Promise<MenuCategory[]> {
    return await db.select().from(menuCategories).where(eq(menuCategories.restaurantId, restaurantId));
  }

  async createMenuCategory(category: InsertMenuCategory): Promise<MenuCategory> {
    const [newCategory] = await db.insert(menuCategories).values(category).returning();
    return newCategory;
  }

  async getMenuItems(restaurantId: string): Promise<MenuItem[]> {
    return await db.select().from(menuItems).where(eq(menuItems.restaurantId, restaurantId));
  }

  async createMenuItem(item: InsertMenuItem): Promise<MenuItem> {
    const [newItem] = await db.insert(menuItems).values(item).returning();
    return newItem;
  }

  async getTables(restaurantId: string): Promise<Table[]> {
    return await db.select().from(tables).where(eq(tables.restaurantId, restaurantId));
  }

  async createTable(table: InsertTable): Promise<Table> {
    const [newTable] = await db.insert(tables).values(table).returning();
    return newTable;
  }

  async getReservations(restaurantId: string): Promise<Reservation[]> {
    return await db.select().from(reservations).where(eq(reservations.restaurantId, restaurantId)).orderBy(desc(reservations.reservationDate));
  }

  async createReservation(reservation: InsertReservation): Promise<Reservation> {
    const [newReservation] = await db.insert(reservations).values(reservation).returning();
    return newReservation;
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

  async getStaff(restaurantId: string): Promise<Staff[]> {
    return await db.select().from(staff).where(eq(staff.restaurantId, restaurantId));
  }

  async createStaff(staffMember: InsertStaff): Promise<Staff> {
    const [newStaff] = await db.insert(staff).values(staffMember).returning();
    return newStaff;
  }

  async getInventory(restaurantId: string): Promise<Inventory[]> {
    return await db.select().from(inventory).where(eq(inventory.restaurantId, restaurantId));
  }

  async createInventory(inventoryItem: InsertInventory): Promise<Inventory> {
    const [newInventory] = await db.insert(inventory).values(inventoryItem).returning();
    return newInventory;
  }
}

export const storage = new DatabaseStorage();

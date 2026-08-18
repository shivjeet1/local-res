import { z } from "zod";

export type UserRole = "ADMIN" | "STAFF" | "KITCHEN";

export interface User {
  id: string; restaurantId: string; name: string;
  email: string; role: UserRole;
  createdAt: number; updatedAt: number; deletedAt: number | null;
}

export type OrderStatus =
  | "OPEN" | "SENT_TO_KITCHEN" | "READY" | "DELIVERED" | "COMPLETED" | "VOIDED";

export interface OrderItem {
  id: string; restaurantId: string; orderId: string; productId: string;
  deviceId: string; quantity: number; unitPriceCents: number;
  notes: string | null; createdAt: number; updatedAt: number;
  deletedAt: number | null; syncedAt: number | null;
}

export interface Order {
  id: string; restaurantId: string; tableId: string | null;
  userId: string; deviceId: string; status: OrderStatus;
  notes: string | null; applyGst: boolean; subtotalCents: number; taxCents: number;
  totalCents: number; paidAt: number | null;
  createdAt: number; updatedAt: number;
  deletedAt: number | null; syncedAt: number | null;
  items: OrderItem[];
}

export interface Product {
  id: string; restaurantId: string; categoryId: string | null;
  name: string; description: string | null; priceCents: number;
  taxRatePct: number; isAvailable: boolean; imageUrl: string | null;
  createdAt: number; updatedAt: number; deletedAt: number | null;
}

export interface Category {
  id: string; restaurantId: string; name: string; sortOrder: number;
  createdAt: number; updatedAt: number; deletedAt: number | null;
}

export interface RestaurantTable {
  id: string; restaurantId: string; label: string; capacity: number;
  createdAt: number; updatedAt: number; deletedAt: number | null;
}

// Validation schemas (Extracted from backend routes)
export const CreateProductSchema = z.object({
  name:        z.string().min(1),
  categoryId:  z.string().optional(),
  description: z.string().optional(),
  priceCents:  z.number().int().nonnegative(),
  taxRatePct:  z.number().min(0).max(100).default(0),
  imageUrl:    z.string().url().optional(),
});

export const CreateCategorySchema = z.object({
  name:      z.string().min(1),
  sortOrder: z.number().int().default(0),
});

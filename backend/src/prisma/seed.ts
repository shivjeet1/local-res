// src/prisma/seed.ts
// Run once: npm run db:seed
// Creates: 1 restaurant, 1 admin, 1 staff, 1 kitchen user, sample menu

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createId } from "@paralleldrive/cuid2";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding...");

  const restaurantId = createId();

  await prisma.restaurant.create({
    data: {
      id:       restaurantId,
      name:     "Stone Age Grill",
      slug:     "stone-age-grill",
      timezone: "Asia/Kolkata",
    },
  });

  // Users
  const [admin] = await Promise.all([
    prisma.user.create({ data: {
      id: createId(), restaurantId,
      name: "Admin", email: "admin@pos.dev",
      passwordHash: await bcrypt.hash("admin1234", 12),
      role: "ADMIN",
    }}),
    prisma.user.create({ data: {
      id: createId(), restaurantId,
      name: "Staff One", email: "staff@pos.dev",
      passwordHash: await bcrypt.hash("staff1234", 12),
      role: "STAFF",
    }}),
    prisma.user.create({ data: {
      id: createId(), restaurantId,
      name: "Kitchen", email: "kitchen@pos.dev",
      passwordHash: await bcrypt.hash("kitchen1234", 12),
      role: "KITCHEN",
    }}),
  ]);

  // Tables
  const tableLabels = ["T-01","T-02","T-03","T-04","Bar-1","Bar-2"];
  await prisma.restaurantTable.createMany({
    data: tableLabels.map(label => ({
      id: createId(), restaurantId, label, capacity: 4,
    })),
  });

  // Categories
  const [starters, mains, drinks, desserts] = await Promise.all([
    prisma.category.create({ data: { id: createId(), restaurantId, name: "Starters",  sortOrder: 1 }}),
    prisma.category.create({ data: { id: createId(), restaurantId, name: "Mains",     sortOrder: 2 }}),
    prisma.category.create({ data: { id: createId(), restaurantId, name: "Drinks",    sortOrder: 3 }}),
    prisma.category.create({ data: { id: createId(), restaurantId, name: "Desserts",  sortOrder: 4 }}),
  ]);

  // Products
  await prisma.product.createMany({ data: [
    { id: createId(), restaurantId, categoryId: starters.id, name: "Garlic Bread",       priceCents: 18000, taxRatePct: 5  },
    { id: createId(), restaurantId, categoryId: starters.id, name: "Soup of the Day",    priceCents: 22000, taxRatePct: 5  },
    { id: createId(), restaurantId, categoryId: starters.id, name: "Bruschetta",         priceCents: 24000, taxRatePct: 5  },
    { id: createId(), restaurantId, categoryId: mains.id,    name: "Grilled Chicken",    priceCents: 52000, taxRatePct: 12 },
    { id: createId(), restaurantId, categoryId: mains.id,    name: "Paneer Tikka Masala",priceCents: 42000, taxRatePct: 12 },
    { id: createId(), restaurantId, categoryId: mains.id,    name: "Dal Makhani",        priceCents: 32000, taxRatePct: 12 },
    { id: createId(), restaurantId, categoryId: mains.id,    name: "Fish & Chips",       priceCents: 58000, taxRatePct: 12 },
    { id: createId(), restaurantId, categoryId: drinks.id,   name: "Fresh Lime Soda",    priceCents:  8000, taxRatePct: 5  },
    { id: createId(), restaurantId, categoryId: drinks.id,   name: "Masala Chai",        priceCents:  4000, taxRatePct: 5  },
    { id: createId(), restaurantId, categoryId: drinks.id,   name: "Cold Coffee",        priceCents: 12000, taxRatePct: 5  },
    { id: createId(), restaurantId, categoryId: desserts.id, name: "Gulab Jamun",        priceCents: 14000, taxRatePct: 5  },
    { id: createId(), restaurantId, categoryId: desserts.id, name: "Brownie + Ice Cream",priceCents: 18000, taxRatePct: 5  },
  ]});

  console.log("✅ Seed done.");
  console.log(`   Restaurant : Stone Age Grill (${restaurantId})`);
  console.log(`   Admin      : admin@pos.dev / admin1234`);
  console.log(`   Staff      : staff@pos.dev / staff1234`);
  console.log(`   Kitchen    : kitchen@pos.dev / kitchen1234`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

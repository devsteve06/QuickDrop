import { db } from "./db.js";

const restaurants = [
  {
    name: "Bombay Bites",
    cuisine: "Indian",
    emoji: "🍛",
    rating: 4.7,
    delivery_fee: 2.49,
    delivery_minutes: 30,
    menu: [
      ["Butter Chicken", "Tender chicken in a creamy tomato gravy", 13.99],
      ["Paneer Tikka Masala", "Grilled paneer in spiced onion-tomato sauce", 12.49],
      ["Garlic Naan", "Freshly baked, brushed with garlic butter", 3.49],
      ["Vegetable Biryani", "Aromatic basmati rice with seasonal veggies", 11.99],
    ],
  },
  {
    name: "Pasta Volt",
    cuisine: "Italian",
    emoji: "🍝",
    rating: 4.5,
    delivery_fee: 1.99,
    delivery_minutes: 25,
    menu: [
      ["Margherita Pizza", "San Marzano tomato, mozzarella, basil", 10.99],
      ["Spaghetti Carbonara", "Pancetta, egg yolk, pecorino, black pepper", 13.49],
      ["Lasagna al Forno", "Layered beef ragu and béchamel", 14.99],
      ["Tiramisu", "Espresso-soaked ladyfingers, mascarpone", 6.49],
    ],
  },
  {
    name: "Kimchi & Koi",
    cuisine: "Korean",
    emoji: "🍜",
    rating: 4.8,
    delivery_fee: 3.49,
    delivery_minutes: 35,
    menu: [
      ["Bibimbap", "Rice bowl with vegetables, egg and gochujang", 12.99],
      ["Korean Fried Chicken", "Double-fried, sweet-spicy glaze", 15.49],
      ["Kimchi Pancake", "Crispy socca-style pancake with kimchi", 8.99],
      ["Tteokbokki", "Chewy rice cakes in a fiery red sauce", 9.49],
    ],
  },
  {
    name: "Green Fork",
    cuisine: "Healthy",
    emoji: "🥗",
    rating: 4.3,
    delivery_fee: 1.49,
    delivery_minutes: 20,
    menu: [
      ["Quinoa Power Bowl", "Quinoa, avocado, kale, tahini dressing", 11.49],
      ["Grilled Salmon Salad", "Salmon, mixed greens, lemon vinaigrette", 14.99],
      ["Vegan Burrito", "Black beans, brown rice, guac, salsa", 9.99],
      ["Berry Smoothie", "Mixed berries, banana, oat milk", 5.99],
    ],
  },
];

db.exec("DELETE FROM order_items; DELETE FROM orders; DELETE FROM menu_items; DELETE FROM restaurants;");

const insertRestaurant = db.prepare(
  "INSERT INTO restaurants (name, cuisine, emoji, rating, delivery_fee, delivery_minutes) VALUES (?, ?, ?, ?, ?, ?)"
);
const insertItem = db.prepare(
  "INSERT INTO menu_items (restaurant_id, name, description, price) VALUES (?, ?, ?, ?)"
);

for (const r of restaurants) {
  const { lastInsertRowid } = insertRestaurant.run(
    r.name, r.cuisine, r.emoji, r.rating, r.delivery_fee, r.delivery_minutes
  );
  for (const [name, description, price] of r.menu) {
    insertItem.run(lastInsertRowid, name, description, price);
  }
}

console.log(`Seeded ${restaurants.length} restaurants.`);

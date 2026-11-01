import React, { useEffect, useState } from "react";
import { api } from "./api.js";

const money = (n) => `$${n.toFixed(2)}`;

export default function App() {
  const [view, setView] = useState({ page: "home" }); // home | menu | checkout | order
  const [cart, setCart] = useState({ restaurant: null, items: {} }); // items: {id: {item, qty}}
  const [error, setError] = useState("");
  const [order, setOrder] = useState(null);

  const cartCount = Object.values(cart.items).reduce((s, { qty }) => s + qty, 0);
  const subtotal = Object.values(cart.items).reduce(
    (s, { item, qty }) => s + item.price * qty,
    0
  );

  const addItem = (item, restaurant) => {
    setError("");
    setCart((prev) => {
      if (prev.restaurant && prev.restaurant.id !== restaurant.id) {
        if (!confirm(`Replace your ${prev.restaurant.name} cart with items from ${restaurant.name}?`)) {
          return prev;
        }
        return { restaurant, items: { [item.id]: { item, qty: 1 } } };
      }
      const items = { ...prev.items };
      items[item.id] = { item, qty: (items[item.id]?.qty ?? 0) + 1 };
      return { restaurant, items };
    });
  };

  const setQty = (id, qty) => {
    setCart((prev) => {
      const items = { ...prev.items };
      if (qty <= 0) delete items[id];
      else items[id] = { ...items[id], qty };
      return { ...prev, items };
    });
  };

  const clearCart = () => setCart({ restaurant: null, items: {} });

  return (
    <div className="app">
      <header className="header">
        <h1 className="logo" onClick={() => setView({ page: "home" })}>
          ⚡ QuickDrop
        </h1>
        <div className="header-right">
          {error && <span className="error">{error}</span>}
          {cartCount > 0 && (
            <button className="cart-btn" onClick={() => setView({ page: "checkout" })}>
              🛒 {cartCount} item{cartCount > 1 ? "s" : ""} · {money(subtotal)}
            </button>
          )}
        </div>
      </header>

      <main className="main">
        {view.page === "home" && (
          <Home
            onOpen={(restaurant) => setView({ page: "menu", restaurantId: restaurant.id })}
          />
        )}
        {view.page === "menu" && (
          <Menu
            restaurantId={view.restaurantId}
            cart={cart}
            onAdd={addItem}
            onQty={setQty}
          />
        )}
        {view.page === "checkout" && cartCount > 0 && (
          <Checkout
            cart={cart}
            subtotal={subtotal}
            onQty={setQty}
            onClear={clearCart}
            onPlaced={(placed) => {
              setOrder(placed);
              setCart({ restaurant: null, items: {} });
              setView({ page: "order" });
            }}
            onCancel={() => setView({ page: "home" })}
            onError={setError}
          />
        )}
        {view.page === "order" && order && <OrderConfirmation orderId={order.orderId} />}
      </main>
    </div>
  );
}

function Home({ onOpen }) {
  const [restaurants, setRestaurants] = useState(null);

  useEffect(() => {
    api.getRestaurants().then(setRestaurants).catch((e) => setRestaurants([]));
  }, []);

  if (!restaurants) return <p className="loading">Loading restaurants…</p>;

  return (
    <>
      <h2>Restaurants near you</h2>
      <div className="grid">
        {restaurants.map((r) => (
          <button key={r.id} className="card" onClick={() => onOpen(r)}>
            <span className="card-emoji">{r.emoji}</span>
            <div className="card-body">
              <strong>{r.name}</strong>
              <span className="muted">{r.cuisine}</span>
              <span className="muted">
                ★ {r.rating} · {r.delivery_minutes} min · {money(r.delivery_fee)} delivery
              </span>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

function Menu({ restaurantId, cart, onAdd, onQty }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.getRestaurant(restaurantId).then(setData).catch(console.error);
  }, [restaurantId]);

  if (!data) return <p className="loading">Loading menu…</p>;

  return (
    <>
      <div className="menu-header">
        <span className="card-emoji big">{data.emoji}</span>
        <div>
          <h2>{data.name}</h2>
          <p className="muted">
            {data.cuisine} · ★ {data.rating} · {data.delivery_minutes} min ·{" "}
            {money(data.delivery_fee)} delivery
          </p>
        </div>
      </div>
      <ul className="menu-list">
        {data.menu.map((item) => (
          <li key={item.id} className="menu-row">
            <div>
              <strong>{item.name}</strong>
              <p className="muted">{item.description}</p>
            </div>
            <div className="menu-actions">
              <span>{money(item.price)}</span>
              {cart.items[item.id] ? (
                <div className="qty">
                  <button onClick={() => onQty(item.id, cart.items[item.id].qty - 1)}>−</button>
                  <span>{cart.items[item.id].qty}</span>
                  <button onClick={() => onAdd(item, data)}>+</button>
                </div>
              ) : (
                <button className="add" onClick={() => onAdd(item, data)}>
                  Add
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function Checkout({ cart, subtotal, onQty, onClear, onPlaced, onCancel, onError }) {
  const [form, setForm] = useState({ customerName: "", address: "", phone: "" });
  const [busy, setBusy] = useState(false);

  const deliveryFee = cart.restaurant?.delivery_fee ?? 0;
  const total = subtotal + deliveryFee;

  const placeOrder = async () => {
    setBusy(true);
    onError("");
    try {
      // 1. Create the order server-side
      const placed = await api.createOrder({
        restaurantId: cart.restaurant.id,
        customerName: form.customerName,
        address: form.address,
        phone: form.phone,
        items: Object.values(cart.items).map(({ item, qty }) => ({ id: item.id, qty })),
      });
      // 2. Simulated payment
      const paid = await api.payOrder(placed.orderId);
      onPlaced({ ...placed, payment: paid });
    } catch (e) {
      onError(e.message);
      setBusy(false);
    }
  };

  const valid = form.customerName.trim() && form.address.trim();

  return (
    <div className="checkout">
      <h2>
        Checkout — {cart.restaurant?.emoji} {cart.restaurant?.name}
      </h2>

      <ul className="menu-list">
        {Object.entries(cart.items).map(([id, { item, qty }]) => (
          <li key={id} className="menu-row">
            <div>
              <strong>{item.name}</strong>
            </div>
            <div className="menu-actions">
              <div className="qty">
                <button onClick={() => onQty(id, qty - 1)}>−</button>
                <span>{qty}</span>
                <button onClick={() => onQty(id, qty + 1)}>+</button>
              </div>
              <span>{money(item.price * qty)}</span>
            </div>
          </li>
        ))}
      </ul>

      <div className="totals">
        <div><span>Subtotal</span><span>{money(subtotal)}</span></div>
        <div><span>Delivery</span><span>{money(deliveryFee)}</span></div>
        <div className="total"><span>Total</span><span>{money(total)}</span></div>
      </div>

      <div className="form">
        <input
          placeholder="Your name"
          value={form.customerName}
          onChange={(e) => setForm({ ...form, customerName: e.target.value })}
        />
        <input
          placeholder="Delivery address"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
        />
        <input
          placeholder="Phone (optional)"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
      </div>

      <p className="muted">
        💳 This is a simulated payment — no real card is charged.
      </p>

      <div className="actions">
        <button className="secondary" onClick={onCancel} disabled={busy}>
          ← Keep browsing
        </button>
        <button className="primary" onClick={placeOrder} disabled={busy || !valid}>
          {busy ? "Processing…" : `Pay ${money(total)}`}
        </button>
        <button className="link" onClick={onClear} disabled={busy}>
          Clear cart
        </button>
      </div>
    </div>
  );
}

function OrderConfirmation({ orderId }) {
  const [order, setOrder] = useState(null);

  useEffect(() => {
    api.getOrder(orderId).then(setOrder).catch(console.error);
  }, [orderId]);

  if (!order) return <p className="loading">Loading order…</p>;

  return (
    <div className="order">
      <h2>✅ Order confirmed!</h2>
      <p className="muted">
        {order.restaurant.emoji} {order.restaurant.name} is preparing your food.
      </p>
      <div className="order-box">
        <p>
          <strong>Order #{order.id}</strong> — status: {order.status}
        </p>
        <p>
          ETA: <strong>~{order.restaurant.delivery_minutes} minutes</strong>
        </p>
        <p>
          Delivering to: {order.customer_name}, {order.address}
        </p>
        <ul>
          {order.items.map((it, i) => (
            <li key={i}>
              {it.qty}× {it.name} — {money(it.price * it.qty)}
            </li>
          ))}
        </ul>
        <p className="total">
          Total paid: <strong>{money(order.total)}</strong>
        </p>
      </div>
      <button className="primary" onClick={() => location.reload()}>
        Order something else
      </button>
    </div>
  );
}

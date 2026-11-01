async function request(path, options) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  getRestaurants: () => request("/api/restaurants"),
  getRestaurant: (id) => request(`/api/restaurants/${id}`),
  createOrder: (payload) =>
    request("/api/orders", { method: "POST", body: JSON.stringify(payload) }),
  payOrder: (id) => request(`/api/orders/${id}/pay`, { method: "POST" }),
  getOrder: (id) => request(`/api/orders/${id}`),
};

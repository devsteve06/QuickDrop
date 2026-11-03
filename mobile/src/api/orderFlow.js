/**
 * The API splits placing an order into two calls: create (which returns an id and
 * the server-priced total) and pay (which flips the status). Only the first can
 * legitimately fail without leaving anything behind, so the two failure modes are
 * kept apart:
 *
 *   - createOrder throws  -> nothing was created, the form stays as it is.
 *   - payOrder throws     -> the order exists in `pending_payment`, so the id is
 *                            returned and the caller offers a retry instead of
 *                            losing the order or creating a duplicate.
 */

export async function placeOrder(createOrder, payOrder, payload) {
  const created = await createOrder(payload);
  const orderId = created?.orderId;

  if (!Number.isInteger(orderId) || orderId < 1) {
    throw new Error("The API did not return an order id.");
  }

  return payOrdered(orderId, payOrder);
}

export async function payOrdered(orderId, payOrder) {
  try {
    const payment = await payOrder(orderId);
    return { orderId, paid: true, payment, error: null };
  } catch (error) {
    return { orderId, paid: false, payment: null, error };
  }
}

/**
 * The pay endpoint answers 409 when the order is no longer `pending_payment`.
 * That is what a lost response looks like from the client: the money moved but
 * the reply never arrived, so a retry must be treated as settled, not as a
 * failure the user has to resolve.
 */
export function wasAlreadyPaid(error) {
  return error?.status === 409;
}

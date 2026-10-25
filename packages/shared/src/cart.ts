import type { Cart, CartItem, Product } from "./types";

export const emptyCart: Cart = { storeId: null, items: [] };

export class CartStoreConflictError extends Error {
  constructor() {
    super("O carrinho já tem produtos de outra loja.");
  }
}

/**
 * Adiciona um produto ao carrinho. Um carrinho só pode ter produtos de uma loja;
 * passar `replaceStore` esvazia o carrinho antes quando a loja é diferente.
 */
export function addToCart(
  cart: Cart,
  product: Pick<Product, "id" | "storeId" | "name" | "priceCents">,
  quantity = 1,
  { replaceStore = false } = {},
): Cart {
  if (quantity <= 0) return cart;
  let base = cart;
  if (cart.storeId && cart.storeId !== product.storeId) {
    if (!replaceStore) throw new CartStoreConflictError();
    base = emptyCart;
  }
  const existing = base.items.find((i) => i.productId === product.id);
  const items: CartItem[] = existing
    ? base.items.map((i) =>
        i.productId === product.id ? { ...i, quantity: i.quantity + quantity } : i,
      )
    : [
        ...base.items,
        {
          productId: product.id,
          name: product.name,
          unitPriceCents: product.priceCents,
          quantity,
        },
      ];
  return { storeId: product.storeId, items };
}

export function setQuantity(cart: Cart, productId: string, quantity: number): Cart {
  const items =
    quantity <= 0
      ? cart.items.filter((i) => i.productId !== productId)
      : cart.items.map((i) => (i.productId === productId ? { ...i, quantity } : i));
  return items.length === 0 ? emptyCart : { ...cart, items };
}

export function cartSubtotalCents(cart: Cart): number {
  return cart.items.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0);
}

export function cartItemCount(cart: Cart): number {
  return cart.items.reduce((sum, i) => sum + i.quantity, 0);
}

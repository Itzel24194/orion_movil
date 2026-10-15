import React, { createContext, useState, useEffect } from "react";

import { fetchProducts } from '../services/api';

export const ProductContext = createContext();

export const ProductProvider = ({ children }) => {
  const [products, setProducts] = useState([]);

  // El catálogo viene del backend web (MongoDB).
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const remote = (await fetchProducts()).filter(
          (item) => item.status !== 'Agotado' && item.status !== 'Inactivo'
        );
        if (alive) setProducts(remote);
      } catch {
        // Backend sin conexión: se mantiene el catálogo actual (vacío).
      }
    };
    load();
    const timer = setInterval(load, 60000);
    return () => { alive = false; clearInterval(timer); };
  }, []);

  // Estado del carrito global (inicia vacío)
  const [cart, setCart] = useState([]);

  // Cada combinación talla/color es una línea distinta de carrito.
  const keyFor = (item) =>
    item.cartKey || `${item.id}::${item.selectedSize || ''}::${item.selectedColor || ''}`;

  const addToCart = (product) => {
    const key = keyFor(product);
    const quantity = Math.max(1, Number(product.quantity) || 1);
    setCart((prev) => {
      const existing = prev.find((item) => keyFor(item) === key);
      if (existing)
        return prev.map((item) =>
          keyFor(item) === key ? { ...item, quantity: item.quantity + quantity } : item
        );
      return [
        ...prev,
        { ...product, cartKey: key, price: Number(product.price) || 0, quantity },
      ];
    });
  };

  const increaseQuantity = (key) =>
    setCart((prev) =>
      prev.map((item) =>
        keyFor(item) === key ? { ...item, quantity: item.quantity + 1 } : item
      )
    );

  const decreaseQuantity = (key) =>
    setCart((prev) =>
      prev.map((item) =>
        keyFor(item) === key ? { ...item, quantity: Math.max(1, item.quantity - 1) } : item
      )
    );

  const removeItem = (key) =>
    setCart((prev) => prev.filter((item) => keyFor(item) !== key));

  const clearCart = () => setCart([]);

  return (
    <ProductContext.Provider
      value={{
        products,
        setProducts,
        cart,
        addToCart,
        increaseQuantity,
        decreaseQuantity,
        removeItem,
        clearCart,
      }}
    >
      {children}
    </ProductContext.Provider>
  );
};
import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'
import { useAuth } from './AuthContext'

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const { token } = useAuth()
  const [cartItems, setCartItems] = useState([])

  useEffect(() => {
    if (token) fetchCart()
  }, [token])

  const fetchCart = async () => {
    try {
      const r = await api.get('/cart')
      setCartItems(r.data.items || [])
    } catch {}
  }

  const addToCart = async (productId) => {
    try {
      const r = await api.post('/cart/add', { productId })
      setCartItems(r.data.items || [])
      return true
    } catch { return false }
  }

  const removeFromCart = async (productId) => {
    try {
      const r = await api.delete(`/cart/remove/${productId}`)
      setCartItems(r.data.items || [])
    } catch {}
  }

  const total = cartItems.reduce((sum, i) => sum + (i.price || 0), 0)

  return (
    <CartContext.Provider value={{ cartItems, addToCart, removeFromCart, total, fetchCart }}>
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => useContext(CartContext)

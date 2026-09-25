import { useState } from 'react'

// Shared DayDrawer wiring for both the grid and agenda views, so editing a
// transaction behaves identically no matter which view opened the drawer.
export default function useDayDrawer(onTypeChange, onCategoryChange, onTransactionAdded) {
  const [selectedDay, setSelectedDay] = useState(null)
  const [initialEditId, setInitialEditId] = useState(null)
  const [openSeq, setOpenSeq] = useState(0)

  // editTxnId: when opened from a row click (agenda view), jump straight into
  // editing that transaction instead of just showing the day.
  function openDay(day, editTxnId = null) {
    setSelectedDay(day)
    setInitialEditId(editTxnId)
    setOpenSeq(s => s + 1)
  }

  function closeDay() {
    setSelectedDay(null)
  }

  function handleTypeChange(txnId, newType, linkedAccountId = null) {
    setSelectedDay(prev => prev ? {
      ...prev,
      transactions: prev.transactions.map(t =>
        t.id === txnId ? { ...t, type: newType, linked_account_id: linkedAccountId } : t
      ),
    } : prev)
    onTypeChange?.(txnId, newType, linkedAccountId)
  }

  function handleCategoryChange(txnId, newCategory) {
    setSelectedDay(prev => prev ? {
      ...prev,
      transactions: prev.transactions.map(t =>
        t.id === txnId ? { ...t, category: newCategory } : t
      ),
    } : prev)
    onCategoryChange?.(txnId, newCategory)
  }

  function handleTransactionAdded(newTxn) {
    if (newTxn) {
      setSelectedDay(prev => prev ? {
        ...prev,
        transactions: [...prev.transactions, newTxn],
      } : prev)
    }
    onTransactionAdded?.()
  }

  function handleTransactionEdited(txnId, updated) {
    setSelectedDay(prev => prev ? {
      ...prev,
      transactions: prev.transactions.map(t => t.id === txnId ? { ...t, ...updated } : t),
    } : prev)
    onTransactionAdded?.()
  }

  function handleTransactionDeleted(txnId) {
    setSelectedDay(prev => {
      if (!prev) return prev
      const remaining = prev.transactions.filter(t => t.id !== txnId)
      return remaining.length === 0 ? null : { ...prev, transactions: remaining }
    })
    onTransactionAdded?.()
  }

  return {
    selectedDay, openDay, closeDay, openSeq, initialEditId,
    handleTypeChange, handleCategoryChange, handleTransactionAdded, handleTransactionEdited, handleTransactionDeleted,
  }
}

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const DB_NAME = 'wanderlog-offline'
const STORE = 'pending-moments'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = e => e.target.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = e => resolve(e.target.result)
    req.onerror = () => reject(req.error)
  })
}

async function queueMoment(moment) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(moment)
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
  })
}

async function getPendingMoments() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function removeMoment(id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
  })
}

export function useOfflineQueue(addMomentFn) {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  // Check pending on load
  useEffect(() => {
    getPendingMoments().then(items => setPendingCount(items.length))
  }, [])

  // Sync when back online
  useEffect(() => {
    if (!isOnline) return
    async function sync() {
      const pending = await getPendingMoments()
      if (!pending.length) return
      setSyncing(true)
      for (const item of pending) {
        try {
          // Re-create File objects from stored base64
          const imageFiles = await Promise.all(
            (item.imageData ?? []).map(async ({ name, type, base64 }) => {
              const res = await fetch(base64)
              const blob = await res.blob()
              return new File([blob], name, { type })
            })
          )
          await addMomentFn({ ...item, imageFiles })
          await removeMoment(item.id)
        } catch {}
      }
      const remaining = await getPendingMoments()
      setPendingCount(remaining.length)
      setSyncing(false)
    }
    sync()
  }, [isOnline])

  const queueOrPost = useCallback(async (payload) => {
    if (isOnline) {
      return addMomentFn(payload)
    }
    // Store images as base64 for offline persistence
    const imageData = await Promise.all(
      (payload.imageFiles ?? []).map(file => new Promise(resolve => {
        const r = new FileReader()
        r.onload = ev => resolve({ name: file.name, type: file.type, base64: ev.target.result })
        r.readAsDataURL(file)
      }))
    )
    const queued = { ...payload, id: Date.now().toString(), imageData, imageFiles: undefined }
    await queueMoment(queued)
    setPendingCount(c => c + 1)
    return null
  }, [isOnline, addMomentFn])

  return { isOnline, pendingCount, syncing, queueOrPost }
}

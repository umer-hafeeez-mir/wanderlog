import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useMoments(tripId) {
  const [moments, setMoments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchMoments = useCallback(async () => {
    if (!tripId) { setMoments([]); setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('moments')
      .select(`
        id, user_id, user_name, user_avatar, caption, location,
        latitude, longitude, created_at,
        moment_images (id, url, position),
        reactions (id, user_id, emoji)
      `)
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false })

    if (error) { setError(error.message); setLoading(false); return }
    setMoments(data ?? [])
    setLoading(false)
  }, [tripId])

  useEffect(() => { fetchMoments() }, [fetchMoments])

  async function addMoment({ caption, location, latitude, longitude, imageFiles, userId, userName, userAvatar }) {
    // 1. Insert moment row immediately
    const { data: moment, error: momentErr } = await supabase
      .from('moments')
      .insert({ trip_id: tripId, user_id: userId, user_name: userName, user_avatar: userAvatar, caption, location, latitude, longitude })
      .select()
      .single()

    if (momentErr) throw new Error(momentErr.message)

    // 2. Show moment instantly with local image previews (base64) — no waiting for upload
    const localImages = await Promise.all(
      (imageFiles ?? []).map((file, i) => new Promise(resolve => {
        if (file.type.startsWith('video/')) {
          resolve({ id: `local-${i}`, url: URL.createObjectURL(file), position: i })
        } else {
          const r = new FileReader()
          r.onload = ev => resolve({ id: `local-${i}`, url: ev.target.result, position: i })
          r.readAsDataURL(file)
        }
      }))
    )

    // Add to top of feed immediately with local preview
    const optimistic = { ...moment, moment_images: localImages, reactions: [] }
    setMoments(ms => [optimistic, ...ms.filter(m => m.id !== moment.id)])

    // 3. Upload images in background — parallel
    if (imageFiles?.length > 0) {
      const uploadPromises = imageFiles.map(async (file, i) => {
        const ext = file.name.split('.').pop() || (file.type.startsWith('video/') ? 'mp4' : 'jpg')
        const path = `${tripId}/${moment.id}/${i}.${ext}`
        const { error: uploadErr } = await supabase.storage
          .from('moment-images')
          .upload(path, file, { upsert: true })
        if (uploadErr) throw new Error(uploadErr.message)
        const { data: { publicUrl } } = supabase.storage.from('moment-images').getPublicUrl(path)
        return { momentId: moment.id, url: publicUrl, position: i }
      })

      try {
        const imageUrls = await Promise.all(uploadPromises)
        if (imageUrls.length > 0) {
          await supabase.from('moment_images').insert(
            imageUrls.map(({ momentId, url, position }) => ({ moment_id: momentId, url, position }))
          )
          // Replace local previews with real URLs silently
          setMoments(ms => ms.map(m =>
            m.id === moment.id
              ? { ...m, moment_images: imageUrls.map(({ url, position }) => ({ id: `${moment.id}-${position}`, url, position })) }
              : m
          ))
        }
      } catch(e) {
        console.error('Image upload failed:', e)
        // Keep local preview, try to refetch
        fetchMoments()
      }
    }

    // Notify family
    supabase.functions.invoke('send-push-notification', {
      body: { tripId, posterName: userName, tripName: '', momentId: moment.id }
    }).catch(() => {})

    return moment
  }

  async function toggleReaction(momentId, userId, emoji) {
    const existing = moments
      .find(m => m.id === momentId)
      ?.reactions?.find(r => r.user_id === userId && r.emoji === emoji)

    // Optimistic update — instant
    setMoments(ms => ms.map(m => {
      if (m.id !== momentId) return m
      const reactions = m.reactions ?? []
      if (existing) {
        return { ...m, reactions: reactions.filter(r => r.id !== existing.id) }
      } else {
        return { ...m, reactions: [...reactions, { id: `temp-${Date.now()}`, moment_id: momentId, user_id: userId, emoji }] }
      }
    }))

    // Sync to DB quietly
    if (existing) await supabase.from('reactions').delete().eq('id', existing.id)
    else await supabase.from('reactions').insert({ moment_id: momentId, user_id: userId, emoji })
  }

  return { moments, loading, error, addMoment, toggleReaction, refetch: fetchMoments, setMoments }
}

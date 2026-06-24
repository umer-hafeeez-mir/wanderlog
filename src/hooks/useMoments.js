import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useMoments(tripId) {
  const [moments, setMoments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchMoments = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('moments')
      .select(`
        id, caption, location, created_at,
        moment_images (id, url, position),
        reactions (id, user_id, emoji)
      `)
      .eq('trip_id', tripId)
      .order('created_at', { ascending: true })

    if (error) { setError(error.message); setLoading(false); return }

    setMoments(data ?? [])
    setLoading(false)
  }, [tripId])

  useEffect(() => { fetchMoments() }, [fetchMoments])

  async function addMoment({ caption, location, imageFiles, userId }) {
    // 1. Insert moment row
    const { data: moment, error: momentErr } = await supabase
      .from('moments')
      .insert({ trip_id: tripId, user_id: userId, caption, location })
      .select()
      .single()

    if (momentErr) throw new Error(momentErr.message)

    // 2. Upload images to storage
    const imageUrls = await Promise.all(
      imageFiles.map(async (file, i) => {
        const ext = file.name.split('.').pop()
        const path = `${tripId}/${moment.id}/${i}.${ext}`
        const { error: uploadErr } = await supabase.storage
          .from('moment-images')
          .upload(path, file, { upsert: true })
        if (uploadErr) throw new Error(uploadErr.message)

        const { data: { publicUrl } } = supabase.storage
          .from('moment-images')
          .getPublicUrl(path)
        return { momentId: moment.id, url: publicUrl, position: i }
      })
    )

    // 3. Insert image rows
    if (imageUrls.length > 0) {
      await supabase.from('moment_images').insert(
        imageUrls.map(({ momentId, url, position }) => ({
          moment_id: momentId, url, position
        }))
      )
    }

    await fetchMoments()
    return moment
  }

  async function toggleReaction(momentId, userId, emoji = '🫶') {
    const existing = moments
      .find(m => m.id === momentId)
      ?.reactions?.find(r => r.user_id === userId && r.emoji === emoji)

    if (existing) {
      await supabase.from('reactions').delete().eq('id', existing.id)
    } else {
      await supabase.from('reactions').insert({ moment_id: momentId, user_id: userId, emoji })
    }

    await fetchMoments()
  }

  return { moments, loading, error, addMoment, toggleReaction, refetch: fetchMoments }
}

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const { tripId, posterName, tripName, momentId } = await req.json()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Get all push subscriptions for trip members (excluding poster)
  const { data: members } = await supabase
    .from('trip_members')
    .select('user_id')
    .eq('trip_id', tripId)
    .eq('status', 'approved')

  if (!members?.length) return new Response(JSON.stringify({ sent: 0 }))

  const userIds = members.map(m => m.user_id)
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*')
    .in('user_id', userIds)

  if (!subs?.length) return new Response(JSON.stringify({ sent: 0 }))

  const payload = JSON.stringify({
    title: `${posterName} posted a moment`,
    body: `New memory added to ${tripName} 📸`,
    url: 'https://wanderlog-one.vercel.app',
    icon: '/icon-192.png',
  })

  // Send push to each subscriber using Web Push
  let sent = 0
  for (const sub of subs) {
    try {
      const res = await fetch(sub.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'TTL': '86400',
        },
        body: payload,
      })
      if (res.ok) sent++
    } catch {}
  }

  return new Response(JSON.stringify({ sent }), { headers: { 'Content-Type': 'application/json' } })
})

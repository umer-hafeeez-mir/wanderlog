import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes — covers sign in, sign out, token refresh
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setUser(session?.user ?? null)
        setLoading(false)
      }
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signInWithGoogle = useCallback(() => {
    // Preserve join token through OAuth by appending it to redirectTo
    let redirectTo = window.location.origin
    try {
      const token = localStorage.getItem('wanderlog_join_token')
        || new URLSearchParams(window.location.search).get('join')
      if (token) redirectTo = `${window.location.origin}?join=${token}`
    } catch(e) {}
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: { prompt: 'select_account' },
      }
    })
  }, [])

  const signOut = useCallback(async () => {
    setUser(null) // Optimistic — show welcome instantly
    await supabase.auth.signOut()
  }, [])

  return { user, loading, signInWithGoogle, signOut }
}

import type { Session } from '@supabase/supabase-js'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { supabase } from '../src/lib/supabase'

export function useAuthRedirect() {
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setIsLoading(false)
      
      // Redirect based on auth state
      if (session) {
        // User is authenticated, redirect to tabs
        router.replace('/(tabs)')
      } else {
        // User is not authenticated, redirect to welcome
        router.replace('/auth/welcome')
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      
      // Handle auth state changes
      if (session) {
        // User just logged in, redirect to tabs
        router.replace('/(tabs)')
      } else {
        // User just logged out, redirect to welcome
        router.replace('/auth/welcome')
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  return {
    session,
    isLoading,
    isAuthenticated: !!session,
  }
} 
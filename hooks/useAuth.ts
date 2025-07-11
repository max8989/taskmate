import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { authKeys, useProfile, useSession } from '../src/hooks/useAuthQuery'
import { supabase } from '../src/lib/supabase'

export function useAuth() {
  const queryClient = useQueryClient()
  const { data: session, isLoading: sessionLoading, error: sessionError } = useSession()
  const { 
    data: profile, 
    isLoading: profileLoading, 
    error: profileError,
    refetch: refetchProfile 
  } = useProfile(session?.user?.id)

  // Set up auth state listener for real-time updates
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event, session ? 'Session exists' : 'No session')
      
      // Update session cache
      queryClient.setQueryData(authKeys.session, session)
      
      if (session?.user) {
        // Invalidate profile to refetch with new session
        queryClient.invalidateQueries({ queryKey: authKeys.profile(session.user.id) })
        
        // Force refetch profile data to ensure we have the latest
        setTimeout(() => {
          refetchProfile()
        }, 100)
      } else {
        // Clear all auth-related cache when logged out
        queryClient.removeQueries({ queryKey: ['auth'] })
        queryClient.removeQueries({ queryKey: ['household'] })
      }
    })

    return () => subscription.unsubscribe()
  }, [queryClient, refetchProfile])

  // Listen for profile changes from database triggers
  useEffect(() => {
    if (!session?.user?.id) return

    const channel = supabase.channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${session.user.id}`,
        },
        (payload) => {
          console.log('Profile updated in database:', payload)
          // Invalidate profile cache when it changes in the database
          queryClient.invalidateQueries({ queryKey: authKeys.profile(session.user.id) })
          refetchProfile()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [session?.user?.id, queryClient, refetchProfile])

  return {
    session,
    user: session?.user || null,
    profile,
    isLoading: sessionLoading || profileLoading,
    isAuthenticated: !!session,
    hasHousehold: !!profile?.household_id,
    error: sessionError || profileError,
    refetchProfile,
  }
} 
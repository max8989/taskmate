import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert } from 'react-native'
import { supabase } from '../lib/supabase'

// Query keys for consistency
export const authKeys = {
  session: ['auth', 'session'] as const,
  profile: (userId: string) => ['auth', 'profile', userId] as const,
}

// Get current session
export function useSession() {
  return useQuery({
    queryKey: authKeys.session,
    queryFn: async () => {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) throw error
      return session
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  })
}

// Get user profile
export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: authKeys.profile(userId!),
    queryFn: async () => {
      if (!userId) throw new Error('No user ID provided')
      
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      
      if (error) throw error
      return profile
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  })
}

// Login mutation
export function useLogin() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      // Update session cache
      queryClient.setQueryData(authKeys.session, data.session)
      
      // Invalidate and refetch profile
      if (data.user) {
        queryClient.invalidateQueries({ queryKey: authKeys.profile(data.user.id) })
      }
    },
    onError: (error: any) => {
      Alert.alert('Login Error', error.message || 'Failed to login')
    },
  })
}

// Signup mutation
export function useSignup() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ 
      email, 
      password, 
      displayName 
    }: { 
      email: string; 
      password: string; 
      displayName: string 
    }) => {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: displayName.trim(),
          },
        },
      })
      
      if (error) throw error
      
      // Create profile after successful signup
      if (data.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            display_name: displayName.trim(),
          })
        
        if (profileError) {
          console.error('Profile creation error:', profileError)
        }
      }
      
      return data
    },
    onSuccess: (data) => {
      // Update session cache
      queryClient.setQueryData(authKeys.session, data.session)
      
      // Prefetch profile data
      if (data.user) {
        queryClient.invalidateQueries({ queryKey: authKeys.profile(data.user.id) })
      }
    },
    onError: (error: any) => {
      let message = 'Failed to create account'
      if (error.message.includes('already registered')) {
        message = 'Email already exists'
      } else if (error.message) {
        message = error.message
      }
      Alert.alert('Signup Error', message)
    },
  })
}

// Logout mutation
export function useLogout() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    },
    onSuccess: () => {
      // Clear all auth-related cache
      queryClient.setQueryData(authKeys.session, null)
      queryClient.removeQueries({ queryKey: ['auth'] })
      queryClient.removeQueries({ queryKey: ['household'] })
    },
    onError: (error: any) => {
      Alert.alert('Logout Error', error.message || 'Failed to logout')
    },
  })
}

// Password reset mutation
export function usePasswordReset() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim())
      if (error) throw error
    },
    onSuccess: () => {
      Alert.alert('Success', 'Password reset email sent')
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to send reset email')
    },
  })
} 
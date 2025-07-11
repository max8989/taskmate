import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { Alert } from 'react-native'
import { supabase } from '../lib/supabase'
import { authKeys } from './useAuthQuery'

// Query keys for consistency
export const householdKeys = {
  all: ['household'] as const,
  byId: (id: string) => ['household', id] as const,
  members: (householdId: string) => ['household', householdId, 'members'] as const,
}

// Get household by ID
export function useHousehold(householdId: string | null) {
  return useQuery({
    queryKey: householdKeys.byId(householdId!),
    queryFn: async () => {
      if (!householdId) throw new Error('No household ID provided')
      
      const { data: household, error } = await supabase
        .from('households')
        .select('*')
        .eq('id', householdId)
        .single()
      
      if (error) throw error
      return household
    },
    enabled: !!householdId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

// Get household members
export function useHouseholdMembers(householdId: string | null) {
  return useQuery({
    queryKey: householdKeys.members(householdId!),
    queryFn: async () => {
      if (!householdId) throw new Error('No household ID provided')
      
      const { data: members, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('household_id', householdId)
        .order('created_at', { ascending: true })
      
      if (error) throw error
      return members
    },
    enabled: !!householdId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  })
}

// Create household mutation
export function useCreateHousehold() {
  const queryClient = useQueryClient()
  const router = useRouter()
  
  return useMutation({
    mutationFn: async ({ 
      name, 
      userId 
    }: { 
      name: string; 
      userId: string 
    }) => {
      // Generate invite code
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase()
      
      // Create household
      const { data: household, error: householdError } = await supabase
        .from('households')
        .insert({
          name: name.trim(),
          invite_code: inviteCode,
        })
        .select()
        .single()
      
      if (householdError) throw householdError
      
      // Update user profile to join household as admin
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          household_id: household.id,
          role: 'admin',
        })
        .eq('id', userId)
      
      if (profileError) throw profileError
      
      return { household, inviteCode }
    },
    onSuccess: async (data, variables) => {
      // Update profile cache to include household_id
      await queryClient.invalidateQueries({ queryKey: authKeys.profile(variables.userId) })
      
      // Add household to cache
      queryClient.setQueryData(householdKeys.byId(data.household.id), data.household)
      
      // Invalidate members list
      queryClient.invalidateQueries({ 
        queryKey: householdKeys.members(data.household.id) 
      })
      
      Alert.alert(
        'Household Created!', 
        `Your household "${data.household.name}" has been created.\nInvite code: ${data.inviteCode}`,
        [
          {
            text: 'Continue',
            onPress: () => {
              // Force navigation to tabs
              router.replace('/(tabs)')
            }
          }
        ]
      )
    },
    onError: (error: any) => {
      console.error('Error creating household:', error)
      Alert.alert('Error', error.message || 'Failed to create household')
    },
  })
}

// Join household mutation
export function useJoinHousehold() {
  const queryClient = useQueryClient()
  const router = useRouter()
  
  return useMutation({
    mutationFn: async ({ 
      inviteCode, 
      userId 
    }: { 
      inviteCode: string; 
      userId: string 
    }) => {
      // Find household by invite code
      const { data: household, error: householdError } = await supabase
        .from('households')
        .select('*')
        .eq('invite_code', inviteCode.trim().toUpperCase())
        .single()
      
      if (householdError || !household) {
        throw new Error('Invalid invite code')
      }
      
      // Update user profile to join household
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          household_id: household.id,
          role: 'member',
        })
        .eq('id', userId)
      
      if (profileError) throw profileError
      
      return household
    },
    onSuccess: async (household, variables) => {
      // Update profile cache to include household_id
      await queryClient.invalidateQueries({ queryKey: authKeys.profile(variables.userId) })
      
      // Add household to cache
      queryClient.setQueryData(householdKeys.byId(household.id), household)
      
      // Invalidate members list to include new member
      queryClient.invalidateQueries({ 
        queryKey: householdKeys.members(household.id) 
      })
      
      Alert.alert(
        'Welcome!', 
        `You've joined "${household.name}"`,
        [
          {
            text: 'Continue',
            onPress: () => {
              // Force navigation to tabs
              router.replace('/(tabs)')
            }
          }
        ]
      )
    },
    onError: (error: any) => {
      console.error('Error joining household:', error)
      Alert.alert('Error', error.message || 'Failed to join household')
    },
  })
}

// Leave household mutation
export function useLeaveHousehold() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('profiles')
        .update({
          household_id: null,
          role: 'member',
        })
        .eq('id', userId)
      
      if (error) throw error
    },
    onSuccess: (_, userId) => {
      // Update profile cache to remove household_id
      queryClient.invalidateQueries({ queryKey: authKeys.profile(userId) })
      
      // Clear household-related cache
      queryClient.removeQueries({ queryKey: householdKeys.all })
      
      Alert.alert('Left Household', 'You have left the household')
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to leave household')
    },
  })
}

// Update household mutation
export function useUpdateHousehold() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ 
      householdId, 
      updates 
    }: { 
      householdId: string; 
      updates: { name?: string } 
    }) => {
      const { data: household, error } = await supabase
        .from('households')
        .update(updates)
        .eq('id', householdId)
        .select()
        .single()
      
      if (error) throw error
      return household
    },
    onSuccess: (household) => {
      // Update household cache
      queryClient.setQueryData(householdKeys.byId(household.id), household)
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: householdKeys.all })
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to update household')
    },
  })
} 
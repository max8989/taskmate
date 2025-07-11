import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { Alert } from 'react-native'
import { supabase, TablesInsert } from '../lib/supabase'

// Query keys for consistency
export const taskKeys = {
  all: ['task'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (householdId: string) => [...taskKeys.lists(), householdId] as const,
  details: () => [...taskKeys.all, 'detail'] as const,
  detail: (id: string) => [...taskKeys.details(), id] as const,
  assignments: (householdId: string) => [...taskKeys.all, 'assignments', householdId] as const,
  userAssignments: (userId: string) => [...taskKeys.all, 'user-assignments', userId] as const,
  participants: (taskId: string) => [...taskKeys.all, 'participants', taskId] as const,
}

// Get tasks for a household
export function useTasks(householdId: string | null) {
  return useQuery({
    queryKey: taskKeys.list(householdId!),
    queryFn: async () => {
      if (!householdId) throw new Error('No household ID provided')
      
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select(`
          *,
          created_by_profile:profiles!created_by(id, display_name),
          task_participants(
            id,
            user_id,
            rotation_order,
            is_active,
            profiles(id, display_name)
          )
        `)
        .eq('household_id', householdId)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return tasks
    },
    enabled: !!householdId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  })
}

// Get single task details
export function useTask(taskId: string | null) {
  return useQuery({
    queryKey: taskKeys.detail(taskId!),
    queryFn: async () => {
      if (!taskId) throw new Error('No task ID provided')
      
      const { data: task, error } = await supabase
        .from('tasks')
        .select(`
          *,
          created_by_profile:profiles!created_by(id, display_name),
          task_participants(
            id,
            user_id,
            rotation_order,
            is_active,
            profiles(id, display_name)
          )
        `)
        .eq('id', taskId)
        .single()
      
      if (error) throw error
      return task
    },
    enabled: !!taskId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  })
}

// Get task assignments for a household
export function useTaskAssignments(householdId: string | null) {
  return useQuery({
    queryKey: taskKeys.assignments(householdId!),
    queryFn: async () => {
      if (!householdId) throw new Error('No household ID provided')
      
      const { data: assignments, error } = await supabase
        .from('task_assignments')
        .select(`
          *,
          tasks(*),
          assigned_to_profile:profiles!assigned_to(id, display_name),
          completed_by_profile:profiles!completed_by(id, display_name)
        `)
        .eq('tasks.household_id', householdId)
        .order('due_date', { ascending: true })
      
      if (error) throw error
      return assignments
    },
    enabled: !!householdId,
    staleTime: 1000 * 60 * 1, // 1 minute
  })
}

// Get user's task assignments
export function useUserTaskAssignments(userId: string | null) {
  return useQuery({
    queryKey: taskKeys.userAssignments(userId!),
    queryFn: async () => {
      if (!userId) throw new Error('No user ID provided')
      
      const { data: assignments, error } = await supabase
        .from('task_assignments')
        .select(`
          *,
          tasks(*),
          assigned_to_profile:profiles!assigned_to(id, display_name),
          completed_by_profile:profiles!completed_by(id, display_name)
        `)
        .eq('assigned_to', userId)
        .order('due_date', { ascending: true })
      
      if (error) throw error
      return assignments
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 1, // 1 minute
  })
}

// Get task participants
export function useTaskParticipants(taskId: string | null) {
  return useQuery({
    queryKey: taskKeys.participants(taskId!),
    queryFn: async () => {
      if (!taskId) throw new Error('No task ID provided')
      
      const { data: participants, error } = await supabase
        .from('task_participants')
        .select(`
          *,
          profiles(id, display_name)
        `)
        .eq('task_id', taskId)
        .eq('is_active', true)
        .order('rotation_order', { ascending: true })
      
      if (error) throw error
      return participants
    },
    enabled: !!taskId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  })
}

// Create task mutation
export function useCreateTask() {
  const queryClient = useQueryClient()
  const router = useRouter()
  
  return useMutation({
    mutationFn: async ({ 
      taskData,
      participants 
    }: { 
      taskData: TablesInsert<'tasks'>
      participants: string[] // Array of user IDs
    }) => {
      // Create the task
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .insert(taskData)
        .select()
        .single()
      
      if (taskError) throw taskError
      
      // Add participants if provided
      if (participants.length > 0) {
        const participantInserts = participants.map((userId, index) => ({
          task_id: task.id,
          user_id: userId,
          rotation_order: index + 1,
          is_active: true,
        }))
        
        const { error: participantsError } = await supabase
          .from('task_participants')
          .insert(participantInserts)
        
        if (participantsError) throw participantsError
      }
      
      // For one-time tasks or if no participants, create initial assignment
      if (!task.is_recurring || participants.length === 0) {
        const assignedTo = participants.length > 0 ? participants[0] : taskData.created_by
        
        if (assignedTo) {
          const dueDate = new Date()
          dueDate.setHours(23, 59, 59, 999) // End of today
          
          const { error: assignmentError } = await supabase
            .from('task_assignments')
            .insert({
              task_id: task.id,
              assigned_to: assignedTo,
              due_date: dueDate.toISOString().split('T')[0],
              rotation_order: 1,
            })
          
          if (assignmentError) throw assignmentError
        }
      }
      
      return task
    },
    onSuccess: (task) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: taskKeys.list(task.household_id) })
      queryClient.invalidateQueries({ queryKey: taskKeys.assignments(task.household_id) })
      
      Alert.alert(
        'Task Created!', 
        `"${task.title}" has been created successfully.`,
        [
          {
            text: 'OK',
            onPress: () => {
              router.back()
            }
          }
        ]
      )
    },
    onError: (error: any) => {
      console.error('Error creating task:', error)
      Alert.alert('Error', error.message || 'Failed to create task')
    },
  })
}

// Update task mutation
export function useUpdateTask() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ 
      taskId, 
      updates 
    }: { 
      taskId: string
      updates: Partial<TablesInsert<'tasks'>>
    }) => {
      const { data: task, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId)
        .select()
        .single()
      
      if (error) throw error
      return task
    },
    onSuccess: (task) => {
      // Update task cache
      queryClient.setQueryData(taskKeys.detail(task.id), task)
      
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: taskKeys.list(task.household_id) })
      queryClient.invalidateQueries({ queryKey: taskKeys.assignments(task.household_id) })
      
      Alert.alert('Success', 'Task updated successfully')
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to update task')
    },
  })
}

// Delete task mutation
export function useDeleteTask() {
  const queryClient = useQueryClient()
  const router = useRouter()
  
  return useMutation({
    mutationFn: async (taskId: string) => {
      // Delete task participants first
      await supabase
        .from('task_participants')
        .delete()
        .eq('task_id', taskId)
      
      // Delete task assignments
      await supabase
        .from('task_assignments')
        .delete()
        .eq('task_id', taskId)
      
      // Delete the task
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)
      
      if (error) throw error
      return taskId
    },
    onSuccess: (taskId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: taskKeys.detail(taskId) })
      
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() })
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
      
      Alert.alert('Success', 'Task deleted successfully')
      router.back()
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to delete task')
    },
  })
}

// Complete task assignment mutation
export function useCompleteTaskAssignment() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ 
      assignmentId, 
      completedBy 
    }: { 
      assignmentId: string
      completedBy: string
    }) => {
      const { data: assignment, error } = await supabase
        .from('task_assignments')
        .update({
          is_completed: true,
          completed_at: new Date().toISOString(),
          completed_by: completedBy,
        })
        .eq('id', assignmentId)
        .select(`
          *,
          tasks(*)
        `)
        .single()
      
      if (error) throw error
      
      // If it's a recurring task, create next assignment
      if (assignment.tasks?.is_recurring) {
        // TODO: Implement rotation logic here
        // For now, just create a simple next assignment
        const nextDueDate = new Date()
        
        if (assignment.tasks.frequency_type === 'daily') {
          nextDueDate.setDate(nextDueDate.getDate() + (assignment.tasks.frequency_value || 1))
        } else if (assignment.tasks.frequency_type === 'weekly') {
          nextDueDate.setDate(nextDueDate.getDate() + (assignment.tasks.frequency_value || 1) * 7)
        } else if (assignment.tasks.frequency_type === 'monthly') {
          nextDueDate.setMonth(nextDueDate.getMonth() + (assignment.tasks.frequency_value || 1))
        }
        
        // Create next assignment (simplified - will be enhanced with rotation)
        await supabase
          .from('task_assignments')
          .insert({
            task_id: assignment.task_id,
            assigned_to: assignment.assigned_to, // Will be rotated later
            due_date: nextDueDate.toISOString().split('T')[0],
            rotation_order: (assignment.rotation_order || 0) + 1,
          })
      }
      
      return assignment
    },
    onSuccess: (assignment) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: taskKeys.assignments(assignment.tasks?.household_id!) })
      queryClient.invalidateQueries({ queryKey: taskKeys.userAssignments(assignment.assigned_to) })
      
      // Update user points (simplified for now)
      // TODO: Implement proper points calculation
      
      Alert.alert('Great job!', `You completed "${assignment.tasks?.title}"!`)
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to complete task')
    },
  })
}

// Add/update task participants
export function useUpdateTaskParticipants() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ 
      taskId, 
      participants 
    }: { 
      taskId: string
      participants: string[] // Array of user IDs
    }) => {
      // Remove existing participants
      await supabase
        .from('task_participants')
        .delete()
        .eq('task_id', taskId)
      
      // Add new participants
      if (participants.length > 0) {
        const participantInserts = participants.map((userId, index) => ({
          task_id: taskId,
          user_id: userId,
          rotation_order: index + 1,
          is_active: true,
        }))
        
        const { error } = await supabase
          .from('task_participants')
          .insert(participantInserts)
        
        if (error) throw error
      }
      
      return participants
    },
    onSuccess: (_, variables) => {
      // Invalidate participants cache
      queryClient.invalidateQueries({ queryKey: taskKeys.participants(variables.taskId) })
      
      Alert.alert('Success', 'Task participants updated')
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to update participants')
    },
  })
}
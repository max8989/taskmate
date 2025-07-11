import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isBefore, parseISO, startOfDay } from 'date-fns'
import { useRouter } from 'expo-router'
import { Alert } from 'react-native'
import { supabase, TablesInsert } from '../lib/supabase'

// Helper functions for task assignment and rotation
function calculateNextDueDate(
  frequency_type: 'daily' | 'weekly' | 'monthly',
  frequency_value: number,
  fromDate: Date = new Date(),
  scheduledDays?: number[] | null,
  scheduledTime?: string | null
): Date {
  const nextDate = new Date(fromDate)
  
  // Set time if provided (default to 9 AM if not specified)
  if (scheduledTime) {
    const [hours, minutes] = scheduledTime.split(':').map(Number)
    nextDate.setHours(hours, minutes, 0, 0)
  } else {
    nextDate.setHours(9, 0, 0, 0) // Default to 9 AM
  }
  
  switch (frequency_type) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + frequency_value)
      break
      
    case 'weekly':
      if (scheduledDays && scheduledDays.length > 0) {
        // Find next occurrence of any scheduled day
        const currentDay = nextDate.getDay()
        const sortedDays = [...scheduledDays].sort()
        
        // Find next scheduled day this week
        let nextDay = sortedDays.find(day => day > currentDay)
        
        if (nextDay === undefined) {
          // No more days this week, go to first day of next week cycle
          nextDay = sortedDays[0]
          const daysUntilNext = (7 - currentDay) + nextDay + ((frequency_value - 1) * 7)
          nextDate.setDate(nextDate.getDate() + daysUntilNext)
        } else {
          // Next day is this week
          nextDate.setDate(nextDate.getDate() + (nextDay - currentDay))
        }
      } else {
        // Fallback to simple weekly increment
        nextDate.setDate(nextDate.getDate() + (frequency_value * 7))
      }
      break
      
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + frequency_value)
      
      // If scheduled days are provided for monthly tasks, try to match the day of week
      if (scheduledDays && scheduledDays.length > 0) {
        const targetDay = scheduledDays[0] // Use first scheduled day for monthly
        const currentDay = nextDate.getDay()
        
        if (currentDay !== targetDay) {
          const daysToAdd = (targetDay - currentDay + 7) % 7
          nextDate.setDate(nextDate.getDate() + daysToAdd)
        }
      }
      break
  }
  
  return nextDate
}

// Points calculation system
function calculateTaskPoints(task: any, assignment: any, completedEarly: boolean = false): number {
  let points = task.points_value || 10 // Base points
  
  // Early completion bonus
  if (completedEarly) {
    points += 2
  }
  
  // Difficult task bonus based on frequency (less frequent = more difficult)
  if (task.frequency_type === 'monthly') {
    points += 5
  } else if (task.frequency_type === 'weekly') {
    points += 2
  }
  
  return points
}

// Streak calculation
async function updateUserStreak(userId: string): Promise<{ newStreak: number; streakBonus: number }> {
  // Get user's current profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('current_streak, total_points')
    .eq('id', userId)
    .single()
    
  if (profileError || !profile) {
    return { newStreak: 1, streakBonus: 0 }
  }
  
  // Check if user completed any task yesterday
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]
  
  const { data: yesterdayCompletions, error: yesterdayError } = await supabase
    .from('task_assignments')
    .select('id')
    .eq('completed_by', userId)
    .eq('is_completed', true)
    .gte('completed_at', yesterdayStr + 'T00:00:00Z')
    .lt('completed_at', yesterdayStr + 'T23:59:59Z')
  
  let newStreak: number
  if (yesterdayError || !yesterdayCompletions || yesterdayCompletions.length === 0) {
    // No completion yesterday, reset streak
    newStreak = 1
  } else {
    // Had completion yesterday, continue streak
    newStreak = profile.current_streak + 1
  }
  
  // Calculate streak bonus (+5 points per day in streak)
  const streakBonus = newStreak * 5
  
  return { newStreak, streakBonus }
}

// Check if task was completed early
function isCompletedEarly(dueDate: string, completedAt: Date): boolean {
  // Compare just the date parts using date-fns for robust comparison
  const dueDateNormalized = startOfDay(parseISO(dueDate))
  const completedDateNormalized = startOfDay(completedAt)
  return isBefore(completedDateNormalized, dueDateNormalized)
}

// Check if completion is allowed based on earliest completion time
function isCompletionAllowed(task: any, assignment: any, currentTime: Date): { allowed: boolean; message?: string } {
  if (!task.earliest_completion_time) {
    return { allowed: true }
  }

  const today = new Date()
  const currentDateStr = today.toISOString().split('T')[0]
  
  // Get the assignment's due date
  const dueDate = assignment.due_date || currentDateStr
  
  // Only enforce earliest completion time on the due date
  if (dueDate !== currentDateStr) {
    return { allowed: true }
  }

  // Parse earliest completion time
  const [hours, minutes] = task.earliest_completion_time.split(':').map(Number)
  const earliestTime = new Date()
  earliestTime.setHours(hours, minutes, 0, 0)

  if (currentTime < earliestTime) {
    const timeStr = task.earliest_completion_time
    return { 
      allowed: false, 
      message: `This task can only be completed after ${timeStr} today.` 
    }
  }

  return { allowed: true }
}

async function getNextAssignee(taskId: string, currentAssigneeId: string): Promise<string | null> {
  // Get all participants for this task, ordered by rotation_order
  const { data: participants, error } = await supabase
    .from('task_participants')
    .select('user_id, rotation_order')
    .eq('task_id', taskId)
    .eq('is_active', true)
    .order('rotation_order', { ascending: true })
  
  if (error || !participants || participants.length === 0) {
    return currentAssigneeId // Fallback to current assignee
  }
  
  // If only one participant, keep assigning to them
  if (participants.length === 1) {
    return participants[0].user_id
  }
  
  // Find current assignee's position
  const currentIndex = participants.findIndex(p => p.user_id === currentAssigneeId)
  
  if (currentIndex === -1) {
    // Current assignee not in participants, assign to first participant
    return participants[0].user_id
  }
  
  // Get next participant in rotation (wrap around to beginning if at end)
  const nextIndex = (currentIndex + 1) % participants.length
  return participants[nextIndex].user_id
}

async function createInitialAssignmentForRecurringTask(
  taskId: string, 
  participants: string[],
  task?: { scheduled_days?: number[] | null, scheduled_time?: string | null, frequency_type?: string }
): Promise<void> {
  if (participants.length === 0) return
  
  // Create initial assignment for the first participant
  const firstAssignee = participants[0]
  
  // Calculate the due date/time based on scheduling preferences
  let dueDate = new Date()
  
  if (task?.scheduled_time) {
    const [hours, minutes] = task.scheduled_time.split(':').map(Number)
    dueDate.setHours(hours, minutes, 0, 0)
  } else {
    dueDate.setHours(23, 59, 59, 999) // End of today if no time specified
  }
  
  // If it's a weekly task with scheduled days, find the next occurrence
  if (task?.frequency_type === 'weekly' && task?.scheduled_days && task.scheduled_days.length > 0) {
    const currentDay = dueDate.getDay()
    const nextDay = task.scheduled_days.find(day => day >= currentDay) || task.scheduled_days[0]
    
    if (nextDay === currentDay) {
      // Today is a scheduled day, use today
    } else if (nextDay > currentDay) {
      // Later this week
      dueDate.setDate(dueDate.getDate() + (nextDay - currentDay))
    } else {
      // Next week
      dueDate.setDate(dueDate.getDate() + (7 - currentDay + nextDay))
    }
  }
  
  const { error } = await supabase
    .from('task_assignments')
    .insert({
      task_id: taskId,
      assigned_to: firstAssignee,
      due_date: dueDate.toISOString().split('T')[0],
      due_datetime: dueDate.toISOString(),
      rotation_order: 1,
    })
  
  if (error) throw error
}

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
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return tasks
    },
    enabled: !!householdId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  })
}

// Get single task details (includes deleted tasks for history)
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
          deleted_by_profile:profiles!deleted_by(id, display_name),
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
        .eq('tasks.is_deleted', false)
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
        .eq('tasks.is_deleted', false)
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

// Get pending assignments for a specific task (includes deleted tasks for history view)
export function useTaskPendingAssignments(taskId: string | null) {
  return useQuery({
    queryKey: [...taskKeys.detail(taskId!), 'pending-assignments'],
    queryFn: async () => {
      if (!taskId) throw new Error('No task ID provided')
      
      const { data: assignments, error } = await supabase
        .from('task_assignments')
        .select(`
          *,
          assigned_to_profile:profiles!assigned_to(id, display_name)
        `)
        .eq('task_id', taskId)
        .eq('is_completed', false)
        .order('due_date', { ascending: true })
      
      if (error) throw error
      return assignments
    },
    enabled: !!taskId,
    staleTime: 1000 * 60 * 1, // 1 minute
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
      
      // Create initial assignment based on task type
      if (!task.is_recurring) {
        // For one-time tasks, create immediate assignment
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
      } else {
        // For recurring tasks, create initial assignment if there are participants
        if (participants.length > 0) {
          await createInitialAssignmentForRecurringTask(task.id, participants, {
            scheduled_days: task.scheduled_days,
            scheduled_time: task.scheduled_time,
            frequency_type: task.frequency_type
          })
        } else if (taskData.created_by) {
          // If no participants, assign to creator
          await createInitialAssignmentForRecurringTask(task.id, [taskData.created_by], {
            scheduled_days: task.scheduled_days,
            scheduled_time: task.scheduled_time,
            frequency_type: task.frequency_type
          })
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

// Soft delete task mutation
export function useDeleteTask() {
  const queryClient = useQueryClient()
  const router = useRouter()
  
  return useMutation({
    mutationFn: async ({ taskId, deletedBy }: { taskId: string; deletedBy: string }) => {
      // Soft delete the task by marking it as deleted
      const { data: task, error } = await supabase
        .from('tasks')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          deleted_by: deletedBy,
        })
        .eq('id', taskId)
        .select()
        .single()
      
      if (error) throw error
      
      // Also soft delete related task assignments to prevent them from showing up
      await supabase
        .from('task_assignments')
        .update({
          is_completed: true,  // Mark as completed to prevent further interaction
          completed_at: new Date().toISOString(),
          completed_by: deletedBy,
        })
        .eq('task_id', taskId)
        .eq('is_completed', false)  // Only update pending assignments
      
      return task
    },
    onSuccess: (task) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: taskKeys.detail(task.id) })
      
      // Invalidate lists to remove the task from views
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

// Complete task assignment mutation with points and streak tracking
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
      const completedAt = new Date()
      
      // First, get the assignment and task details
      const { data: assignment, error: getError } = await supabase
        .from('task_assignments')
        .select(`
          *,
          tasks(*)
        `)
        .eq('id', assignmentId)
        .single()
      
      if (getError || !assignment) throw getError || new Error('Assignment not found')
      
      // Check if completion is allowed based on earliest completion time
      const completionCheck = isCompletionAllowed(assignment.tasks, assignment, completedAt)
      if (!completionCheck.allowed) {
        throw new Error(completionCheck.message || 'Completion not allowed at this time')
      }
      
      // Calculate points and bonuses
      const wasCompletedEarly = isCompletedEarly(assignment.due_date, completedAt)
      const basePoints = calculateTaskPoints(assignment.tasks, assignment, wasCompletedEarly)
      
      // Update streak and get streak bonus
      const { newStreak, streakBonus } = await updateUserStreak(completedBy)
      
      const totalPoints = basePoints + streakBonus
      
      // Mark assignment as completed
      const { data: updatedAssignment, error: updateError } = await supabase
        .from('task_assignments')
        .update({
          is_completed: true,
          completed_at: completedAt.toISOString(),
          completed_by: completedBy,
        })
        .eq('id', assignmentId)
        .select(`
          *,
          tasks(*)
        `)
        .single()
      
      if (updateError) throw updateError
      
      // Update user's points and streak in profile
      const { data: currentProfile, error: getProfileError } = await supabase
        .from('profiles')
        .select('total_points')
        .eq('id', completedBy)
        .single()
        
      if (!getProfileError && currentProfile) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            total_points: currentProfile.total_points + totalPoints,
            current_streak: newStreak,
          })
          .eq('id', completedBy)
          
        if (profileError) {
          console.error('Error updating user profile:', profileError)
          // Don't throw error here as the main task completion was successful
        }
      }
      
      // If it's a recurring task, create next assignment with proper rotation
      if (assignment.tasks?.is_recurring && assignment.tasks.frequency_type) {
        // Calculate next due date with scheduling preferences
        const nextDueDate = calculateNextDueDate(
          assignment.tasks.frequency_type,
          assignment.tasks.frequency_value || 1,
          new Date(assignment.due_datetime || assignment.due_date),
          assignment.tasks.scheduled_days,
          assignment.tasks.scheduled_time
        )
        
        // Get next assignee in rotation
        const nextAssignee = await getNextAssignee(assignment.task_id, assignment.assigned_to)
        
        if (nextAssignee) {
          const { error: nextAssignmentError } = await supabase
            .from('task_assignments')
            .insert({
              task_id: assignment.task_id,
              assigned_to: nextAssignee,
              due_date: nextDueDate.toISOString().split('T')[0],
              due_datetime: nextDueDate.toISOString(),
              rotation_order: (assignment.rotation_order || 0) + 1,
            })
          
          if (nextAssignmentError) {
            console.error('Error creating next assignment:', nextAssignmentError)
            // Don't throw error here as the main task completion was successful
          }
        }
      }
      
      return {
        assignment: updatedAssignment,
        pointsEarned: totalPoints,
        streakBonus,
        newStreak,
        wasCompletedEarly
      }
    },
    onSuccess: (result) => {
      const { assignment, pointsEarned, streakBonus, newStreak, wasCompletedEarly } = result
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: taskKeys.assignments(assignment.tasks?.household_id!) })
      queryClient.invalidateQueries({ queryKey: taskKeys.userAssignments(assignment.assigned_to) })
      queryClient.invalidateQueries({ queryKey: taskKeys.userAssignments(assignment.completed_by!) })
      
      // Invalidate profile data to update points and streak
      queryClient.invalidateQueries({ queryKey: ['auth', 'profile', assignment.completed_by] })
      
      // Show success message with points breakdown
      let message = `You completed "${assignment.tasks?.title}"!\n\n`
      message += `🎉 +${pointsEarned} points earned!\n`
      
      if (streakBonus > 0) {
        message += `🔥 Streak bonus: +${streakBonus} points (${newStreak} day streak)\n`
      }
      
      if (wasCompletedEarly) {
        message += `⚡ Early completion bonus: +2 points\n`
      }
      
      Alert.alert('Great job!', message)
    },
    onError: (error: any) => {
      console.error('Error completing task:', error)
      Alert.alert('Error', error.message || 'Failed to complete task')
    },
  })
}

// Uncomplete task assignment mutation - reverses completion
export function useUncompleteTaskAssignment() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ 
      assignmentId, 
      uncompletedBy 
    }: { 
      assignmentId: string
      uncompletedBy: string
    }) => {
      // First, get the assignment and task details
      const { data: assignment, error: getError } = await supabase
        .from('task_assignments')
        .select(`
          *,
          tasks(*),
          assigned_to_profile:profiles!assigned_to(id, display_name),
          completed_by_profile:profiles!completed_by(id, display_name)
        `)
        .eq('id', assignmentId)
        .single()
      
      if (getError || !assignment) throw getError || new Error('Assignment not found')
      
      if (!assignment.is_completed) {
        throw new Error('This task is not completed')
      }
      
      // Only allow uncompleting if the person uncompleting is the one who completed it or an admin
      const { data: uncompleterProfile, error: profileError } = await supabase
        .from('profiles')
        .select('household_id, role')
        .eq('id', uncompletedBy)
        .single()
        
      if (profileError || !uncompleterProfile) {
        throw new Error('User profile not found')
      }
      
      if (uncompleterProfile.household_id !== assignment.tasks?.household_id) {
        throw new Error('You can only uncomplete tasks in your household')
      }
      
      const canUncomplete = assignment.completed_by === uncompletedBy || uncompleterProfile.role === 'admin'
      if (!canUncomplete) {
        throw new Error('You can only uncomplete tasks that you completed, or if you are an admin')
      }
      
      // Calculate the points that were originally earned (we need to subtract them)
      const wasCompletedEarly = assignment.completed_at ? isCompletedEarly(assignment.due_date, new Date(assignment.completed_at)) : false
      const basePoints = calculateTaskPoints(assignment.tasks, assignment, wasCompletedEarly)
      
      // Calculate what the streak bonus was (this is tricky since streaks change over time)
      // We'll make a simple assumption: if they have a current streak > 1, reduce it by 1
      // and subtract the corresponding points
      const { data: currentProfile, error: getCurrentProfileError } = await supabase
        .from('profiles')
        .select('total_points, current_streak')
        .eq('id', assignment.completed_by!)
        .single()
        
      if (getCurrentProfileError || !currentProfile) {
        throw new Error('Could not find user profile for points reversal')
      }
      
      // Estimate the streak bonus that was originally applied
      // This is an approximation since we don't store the exact bonus that was applied
      const originalStreak = Math.max(1, currentProfile.current_streak)
      const estimatedStreakBonus = originalStreak * 5
      const totalPointsToSubtract = basePoints + estimatedStreakBonus
      
      // Mark assignment as uncompleted
      const { data: updatedAssignment, error: updateError } = await supabase
        .from('task_assignments')
        .update({
          is_completed: false,
          completed_at: null,
          completed_by: null,
        })
        .eq('id', assignmentId)
        .select(`
          *,
          tasks(*),
          assigned_to_profile:profiles!assigned_to(id, display_name)
        `)
        .single()
      
      if (updateError) throw updateError
      
      // Subtract points and reduce streak
      const newTotalPoints = Math.max(0, currentProfile.total_points - totalPointsToSubtract)
      const newStreak = Math.max(0, currentProfile.current_streak - 1)
      
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({
          total_points: newTotalPoints,
          current_streak: newStreak,
        })
        .eq('id', assignment.completed_by!)
        
      if (profileUpdateError) {
        console.error('Error updating user profile:', profileUpdateError)
        // Don't throw error here as the main task uncompletion was successful
      }
      
      return {
        assignment: updatedAssignment,
        pointsSubtracted: totalPointsToSubtract,
        newStreak,
        wasCompletedEarly
      }
    },
    onSuccess: (result) => {
      const { assignment, pointsSubtracted, newStreak, wasCompletedEarly } = result
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: taskKeys.assignments(assignment.tasks?.household_id!) })
      queryClient.invalidateQueries({ queryKey: taskKeys.userAssignments(assignment.assigned_to) })
      
      // Invalidate profile data to update points and streak
      queryClient.invalidateQueries({ queryKey: ['auth', 'profile'] })
      
      // Show success message
      let message = `Task "${assignment.tasks?.title}" has been marked as not completed.\n\n`
      message += `📉 -${pointsSubtracted} points removed\n`
      message += `🔥 Streak reduced to ${newStreak} days`
      
      Alert.alert('Task Uncompleted', message)
    },
    onError: (error: any) => {
      console.error('Error uncompleting task:', error)
      Alert.alert('Error', error.message || 'Failed to uncomplete task')
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
        
        // For recurring tasks, check if we need to create an initial assignment
        const { data: task, error: taskError } = await supabase
          .from('tasks')
          .select('is_recurring, household_id, scheduled_days, scheduled_time, frequency_type')
          .eq('id', taskId)
          .single()
        
        if (!taskError && task?.is_recurring) {
          // Check if there are any pending assignments
          const { data: pendingAssignments, error: assignmentError } = await supabase
            .from('task_assignments')
            .select('id')
            .eq('task_id', taskId)
            .eq('is_completed', false)
          
          // If no pending assignments, create initial assignment
          if (!assignmentError && (!pendingAssignments || pendingAssignments.length === 0)) {
            await createInitialAssignmentForRecurringTask(taskId, participants, {
              scheduled_days: task.scheduled_days,
              scheduled_time: task.scheduled_time,
              frequency_type: task.frequency_type
            })
          }
        }
      }
      
      return participants
    },
    onSuccess: (_, variables) => {
      // Invalidate participants cache
      queryClient.invalidateQueries({ queryKey: taskKeys.participants(variables.taskId) })
      
      // Invalidate assignments cache to show new assignments
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
      
      Alert.alert('Success', 'Task participants updated')
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to update participants')
    },
  })
}

// Reassign a specific task assignment (for admin use)
export function useReassignTaskAssignment() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ 
      assignmentId, 
      newAssigneeId 
    }: { 
      assignmentId: string
      newAssigneeId: string
    }) => {
      const { data: assignment, error } = await supabase
        .from('task_assignments')
        .update({
          assigned_to: newAssigneeId,
        })
        .eq('id', assignmentId)
        .eq('is_completed', false) // Only allow reassigning incomplete tasks
        .select(`
          *,
          tasks(household_id)
        `)
        .single()
      
      if (error) throw error
      return assignment
    },
    onSuccess: (assignment) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: taskKeys.assignments(assignment.tasks?.household_id!) })
      queryClient.invalidateQueries({ queryKey: taskKeys.userAssignments(assignment.assigned_to) })
      
      Alert.alert('Success', 'Task reassigned successfully')
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to reassign task')
    },
  })
}

// Complete any task assignment (allows any household member to complete any task)
export function useCompleteAnyTaskAssignment() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ 
      assignmentId, 
      completedBy 
    }: { 
      assignmentId: string
      completedBy: string
    }) => {
      const completedAt = new Date()
      
      // First, get the assignment and task details
      const { data: assignment, error: getError } = await supabase
        .from('task_assignments')
        .select(`
          *,
          tasks(*),
          assigned_to_profile:profiles!assigned_to(id, display_name)
        `)
        .eq('id', assignmentId)
        .single()
      
      if (getError || !assignment) throw getError || new Error('Assignment not found')
      
      // Verify the person completing is in the same household
      const { data: completedByProfile, error: profileError } = await supabase
        .from('profiles')
        .select('household_id')
        .eq('id', completedBy)
        .single()
        
      if (profileError || !completedByProfile) {
        throw new Error('User profile not found')
      }
      
      if (completedByProfile.household_id !== assignment.tasks?.household_id) {
        throw new Error('You can only complete tasks in your household')
      }
      
      // Check if completion is allowed based on earliest completion time
      const completionCheck = isCompletionAllowed(assignment.tasks, assignment, completedAt)
      if (!completionCheck.allowed) {
        throw new Error(completionCheck.message || 'Completion not allowed at this time')
      }
      
      // Calculate points and bonuses
      const wasCompletedEarly = isCompletedEarly(assignment.due_date, completedAt)
      const basePoints = calculateTaskPoints(assignment.tasks, assignment, wasCompletedEarly)
      
      // Update streak and get streak bonus
      const { newStreak, streakBonus } = await updateUserStreak(completedBy)
      
      const totalPoints = basePoints + streakBonus
      
      // Mark assignment as completed
      const { data: updatedAssignment, error: updateError } = await supabase
        .from('task_assignments')
        .update({
          is_completed: true,
          completed_at: completedAt.toISOString(),
          completed_by: completedBy,
        })
        .eq('id', assignmentId)
        .select(`
          *,
          tasks(*),
          assigned_to_profile:profiles!assigned_to(id, display_name),
          completed_by_profile:profiles!completed_by(id, display_name)
        `)
        .single()
      
      if (updateError) throw updateError
      
      // Update user's points and streak in profile
      const { data: currentProfile, error: getProfileError } = await supabase
        .from('profiles')
        .select('total_points')
        .eq('id', completedBy)
        .single()
        
      if (!getProfileError && currentProfile) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            total_points: currentProfile.total_points + totalPoints,
            current_streak: newStreak,
          })
          .eq('id', completedBy)
          
        if (profileError) {
          console.error('Error updating user profile:', profileError)
          // Don't throw error here as the main task completion was successful
        }
      }
      
      // If it's a recurring task, create next assignment with proper rotation
      if (assignment.tasks?.is_recurring && assignment.tasks.frequency_type) {
        // Calculate next due date with scheduling preferences
        const nextDueDate = calculateNextDueDate(
          assignment.tasks.frequency_type,
          assignment.tasks.frequency_value || 1,
          new Date(assignment.due_datetime || assignment.due_date),
          assignment.tasks.scheduled_days,
          assignment.tasks.scheduled_time
        )
        
        // Get next assignee in rotation (continue from originally assigned person)
        const nextAssignee = await getNextAssignee(assignment.task_id, assignment.assigned_to)
        
        if (nextAssignee) {
          const { error: nextAssignmentError } = await supabase
            .from('task_assignments')
            .insert({
              task_id: assignment.task_id,
              assigned_to: nextAssignee,
              due_date: nextDueDate.toISOString().split('T')[0],
              due_datetime: nextDueDate.toISOString(),
              rotation_order: (assignment.rotation_order || 0) + 1,
            })
          
          if (nextAssignmentError) {
            console.error('Error creating next assignment:', nextAssignmentError)
            // Don't throw error here as the main task completion was successful
          }
        }
      }
      
      return {
        assignment: updatedAssignment,
        pointsEarned: totalPoints,
        streakBonus,
        newStreak,
        wasCompletedEarly,
        wasCompletedByAssignee: assignment.assigned_to === completedBy
      }
    },
    onSuccess: (result) => {
      const { assignment, pointsEarned, streakBonus, newStreak, wasCompletedEarly, wasCompletedByAssignee } = result
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: taskKeys.assignments(assignment.tasks?.household_id!) })
      queryClient.invalidateQueries({ queryKey: taskKeys.userAssignments(assignment.assigned_to) })
      queryClient.invalidateQueries({ queryKey: taskKeys.userAssignments(assignment.completed_by!) })
      
      // Invalidate profile data to update points and streak
      queryClient.invalidateQueries({ queryKey: ['auth', 'profile', assignment.completed_by] })
      
      // Show success message with points breakdown
      let message = `You completed "${assignment.tasks?.title}"!\n\n`
      
      if (!wasCompletedByAssignee) {
        message += `💪 Helped out ${assignment.assigned_to_profile?.display_name}!\n\n`
      }
      
      message += `🎉 +${pointsEarned} points earned!\n`
      
      if (streakBonus > 0) {
        message += `🔥 Streak bonus: +${streakBonus} points (${newStreak} day streak)\n`
      }
      
      if (wasCompletedEarly) {
        message += `⚡ Early completion bonus: +2 points\n`
      }
      
      Alert.alert('Great job!', message)
    },
    onError: (error: any) => {
      console.error('Error completing task:', error)
      Alert.alert('Error', error.message || 'Failed to complete task')
    },
  })
}
import { useRouter } from 'expo-router'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useAuth } from '../../hooks/useAuth'
import { useCompleteAnyTaskAssignment, useTaskAssignments, useTaskPendingAssignments, useTasks, useUserTaskAssignments } from '../../src/hooks/useTaskQuery'

// Helper function to check if task completion is allowed
function canCompleteTask(task: any, assignment: any): { allowed: boolean; message?: string; timeUntilAllowed?: string } {
  if (!task?.earliest_completion_time) {
    return { allowed: true }
  }

  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const dueDate = assignment?.due_date || today
  
  // Only enforce earliest completion time on the due date
  if (dueDate !== today) {
    return { allowed: true }
  }

  // Parse earliest completion time
  const [hours, minutes] = task.earliest_completion_time.split(':').map(Number)
  const earliestTime = new Date()
  earliestTime.setHours(hours, minutes, 0, 0)

  if (now < earliestTime) {
    const timeStr = task.earliest_completion_time
    const timeUntilAllowed = earliestTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    return { 
      allowed: false, 
      message: `Available after ${timeStr}`,
      timeUntilAllowed
    }
  }

  return { allowed: true }
}

export default function TasksScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { user, profile } = useAuth()
  
  const { data: tasks, isLoading: tasksLoading } = useTasks(profile?.household_id)
  const { data: userAssignments, isLoading: assignmentsLoading } = useUserTaskAssignments(user?.id || null)
  const { data: allAssignments, isLoading: allAssignmentsLoading } = useTaskAssignments(profile?.household_id)

  const handleCreateTask = () => {
    router.push('/tasks/create')
  }

  if (tasksLoading || assignmentsLoading || allAssignmentsLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B4D" />
        <Text style={styles.loadingText}>Loading tasks...</Text>
      </View>
    )
  }

  // Filter assignments by status
  const todayAssignments = userAssignments?.filter(assignment => {
    const today = new Date().toISOString().split('T')[0]
    return assignment.due_date === today && !assignment.is_completed
  }) || []

  const upcomingAssignments = userAssignments?.filter(assignment => {
    const today = new Date().toISOString().split('T')[0]
    return assignment.due_date > today && !assignment.is_completed
  }) || []

  const completedAssignments = userAssignments?.filter(assignment => 
    assignment.is_completed
  )?.slice(0, 3) || []

  // Filter all household assignments for "anyone can complete" section
  const householdPendingAssignments = allAssignments?.filter(assignment => 
    !assignment.is_completed
  ) || []
  
  const householdOverdueAssignments = householdPendingAssignments.filter(assignment => {
    const today = new Date().toISOString().split('T')[0]
    return assignment.due_date < today
  })
  
  const householdTodayAssignments = householdPendingAssignments.filter(assignment => {
    const today = new Date().toISOString().split('T')[0]
    return assignment.due_date === today
  })

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('tasks.title')}</Text>
        <Text style={styles.subtitle}>Manage your household tasks</Text>
      </View>

      <View style={styles.actionContainer}>
        <TouchableOpacity style={styles.createButton} onPress={handleCreateTask}>
          <Text style={styles.createButtonText}>+ {t('tasks.create')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>📅 {t('tasks.dueToday')} ({todayAssignments.length})</Text>
        {todayAssignments.length > 0 ? (
          todayAssignments.map((assignment) => (
            <SimpleTaskCard key={assignment.id} assignment={assignment} />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{t('dashboard.noTasks')}</Text>
            <Text style={styles.emptySubtext}>{t('dashboard.allCaughtUp')}</Text>
          </View>
        )}
      </View>

      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>📋 {t('tasks.upcoming')} ({upcomingAssignments.length})</Text>
        {upcomingAssignments.length > 0 ? (
          upcomingAssignments.slice(0, 3).map((assignment) => (
            <SimpleTaskCard key={assignment.id} assignment={assignment} />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No upcoming tasks</Text>
            <Text style={styles.emptySubtext}>Create recurring tasks to see them here</Text>
          </View>
        )}
      </View>

      {/* New section: Household Tasks Anyone Can Complete */}
      {householdOverdueAssignments.length > 0 && (
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>🚨 Overdue Household Tasks ({householdOverdueAssignments.length})</Text>
          <Text style={styles.sectionSubtitle}>Help out by completing these overdue tasks!</Text>
          {householdOverdueAssignments.slice(0, 3).map((assignment) => (
            <HouseholdTaskCard key={assignment.id} assignment={assignment} />
          ))}
        </View>
      )}

      {householdTodayAssignments.length > 0 && (
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>🏠 Household Tasks Due Today ({householdTodayAssignments.length})</Text>
          <Text style={styles.sectionSubtitle}>Anyone can complete these tasks to help the household!</Text>
          {householdTodayAssignments.slice(0, 5).map((assignment) => (
            <HouseholdTaskCard key={assignment.id} assignment={assignment} />
          ))}
        </View>
      )}

              <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>🏠 All Household Tasks ({tasks?.length || 0})</Text>
          {tasks && tasks.length > 0 ? (
            tasks.slice(0, 5).map((task) => (
              <TaskDetailCard key={task.id} task={task} />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No tasks created yet</Text>
              <Text style={styles.emptySubtext}>Create your first task to get started!</Text>
            </View>
          )}
        </View>

      {completedAssignments.length > 0 && (
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>✅ {t('tasks.completed')} (Recent)</Text>
          {completedAssignments.map((assignment) => (
            <SimpleTaskCard key={assignment.id} assignment={assignment} completed />
          ))}
        </View>
      )}
    </ScrollView>
  )
}

// Enhanced Task Card Component with Assignment Info
function SimpleTaskCard({ assignment, task, completed = false }: { 
  assignment?: any, 
  task?: any,
  completed?: boolean
}) {
  const { user } = useAuth()
  const router = useRouter()
  const completeTaskMutation = useCompleteAnyTaskAssignment()
  const displayTask = assignment?.tasks || task
  
  if (!displayTask) return null

  const completionCheck = canCompleteTask(displayTask, assignment)

  const handleCompleteTask = () => {
    if (!assignment || completed) return
    
    if (!completionCheck.allowed) {
      Alert.alert(
        'Cannot Complete Yet',
        completionCheck.message || 'Task cannot be completed at this time.',
        [{ text: 'OK' }]
      )
      return
    }
    
    Alert.alert(
      'Complete Task',
      `Mark "${displayTask.title}" as completed?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Complete', 
          onPress: () => {
            completeTaskMutation.mutate({
              assignmentId: assignment.id,
              completedBy: user?.id!,
            })
          }
        }
      ]
    )
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today'
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow'
    } else {
      return date.toLocaleDateString()
    }
  }

  const isOverdue = assignment && !completed && new Date(assignment.due_date) < new Date()

  const handleCardPress = () => {
    if (assignment && !completed && completionCheck.allowed) {
      handleCompleteTask()
    } else if (displayTask?.id) {
      // Navigate to task detail screen
      router.push(`/tasks/${displayTask.id}`)
    }
  }

  return (
    <TouchableOpacity 
      style={[
        styles.taskCard, 
        completed && styles.completedTask,
        isOverdue && styles.overdueTask
      ]}
      onPress={handleCardPress}
      onLongPress={() => displayTask?.id && router.push(`/tasks/${displayTask.id}`)}
      disabled={completeTaskMutation.isPending}
    >
      <View style={styles.taskHeader}>
        <View style={styles.taskTitleContainer}>
          <Text style={[styles.taskTitle, completed && styles.completedText]}>
            {displayTask.title}
          </Text>
          {displayTask.is_recurring && (
            <Text style={styles.recurringBadge}>🔄</Text>
          )}
        </View>
        <Text style={styles.taskPoints}>{displayTask.points_value} pts</Text>
      </View>
      
      {displayTask.description && (
        <Text style={[styles.taskDescription, completed && styles.completedText]} numberOfLines={1}>
          {displayTask.description}
        </Text>
      )}
      
      {assignment && (
        <View style={styles.assignmentInfo}>
          <Text style={[styles.assignmentText, completed && styles.completedText]}>
            Assigned to: {assignment.assigned_to_profile?.display_name}
          </Text>
          <Text style={[
            styles.dueDateText,
            completed && styles.completedText,
            isOverdue && styles.overdueText
          ]}>
            Due: {formatDate(assignment.due_date)}
            {isOverdue && ' (Overdue)'}
          </Text>
          {displayTask.earliest_completion_time && !completed && (
            <Text style={[
              styles.completionTimeText,
              !completionCheck.allowed && styles.restrictedTimeText
            ]}>
              {completionCheck.allowed 
                ? `Can complete after ${displayTask.earliest_completion_time}` 
                : `Available after ${displayTask.earliest_completion_time} today`
              }
            </Text>
          )}
        </View>
      )}
      
      {assignment && !completed && (
        <View style={styles.tapHintContainer}>
          <Text style={[
            styles.tapHint,
            !completionCheck.allowed && styles.restrictedTimeText
          ]}>
            {completeTaskMutation.isPending ? 'Completing...' : 
             !completionCheck.allowed ? 'Tap for details • ' + completionCheck.message :
             'Tap to complete • Long press for details'
            }
          </Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

// Household Task Card Component - allows any user to complete any task
function HouseholdTaskCard({ assignment }: { assignment: any }) {
  const { user } = useAuth()
  const router = useRouter()
  const completeTaskMutation = useCompleteAnyTaskAssignment()
  
  if (!assignment?.tasks) return null

  const completionCheck = canCompleteTask(assignment.tasks, assignment)

  const handleCompleteTask = () => {
    if (!completionCheck.allowed) {
      Alert.alert(
        'Cannot Complete Yet',
        completionCheck.message || 'Task cannot be completed at this time.',
        [{ text: 'OK' }]
      )
      return
    }

    Alert.alert(
      'Complete Task',
      `Mark "${assignment.tasks.title}" as completed?\n\nThis task is assigned to ${assignment.assigned_to_profile?.display_name}, but you can complete it to help out!`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Complete', 
          onPress: () => {
            completeTaskMutation.mutate({
              assignmentId: assignment.id,
              completedBy: user?.id!,
            })
          }
        }
      ]
    )
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today'
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow'
    } else {
      return date.toLocaleDateString()
    }
  }

  const isOverdue = new Date(assignment.due_date) < new Date()
  const isAssignedToCurrentUser = assignment.assigned_to === user?.id

  const handleCardPress = () => {
    if (completionCheck.allowed) {
      handleCompleteTask()
    } else {
      // Navigate to task detail screen for restricted tasks
      router.push(`/tasks/${assignment.tasks.id}`)
    }
  }

  return (
    <TouchableOpacity 
      style={[
        styles.taskCard, 
        isOverdue && styles.overdueTask,
        !isAssignedToCurrentUser && styles.householdTaskCard
      ]}
      onPress={handleCardPress}
      disabled={completeTaskMutation.isPending}
    >
      <View style={styles.taskHeader}>
        <View style={styles.taskTitleContainer}>
          <Text style={styles.taskTitle}>
            {assignment.tasks.title}
          </Text>
          {assignment.tasks.is_recurring && (
            <Text style={styles.recurringBadge}>🔄</Text>
          )}
        </View>
        <Text style={styles.taskPoints}>{assignment.tasks.points_value} pts</Text>
      </View>
      
      {assignment.tasks.description && (
        <Text style={styles.taskDescription} numberOfLines={1}>
          {assignment.tasks.description}
        </Text>
      )}
      
      <View style={styles.assignmentInfo}>
        <Text style={styles.assignmentText}>
          Assigned to: {assignment.assigned_to_profile?.display_name}
          {isAssignedToCurrentUser && ' (You)'}
        </Text>
        <Text style={[
          styles.dueDateText,
          isOverdue && styles.overdueText
        ]}>
          Due: {formatDate(assignment.due_date)}
          {isOverdue && ' (Overdue)'}
        </Text>
        {assignment.tasks.earliest_completion_time && (
          <Text style={[
            styles.completionTimeText,
            !completionCheck.allowed && styles.restrictedTimeText
          ]}>
            {completionCheck.allowed 
              ? `Can complete after ${assignment.tasks.earliest_completion_time}` 
              : `Available after ${assignment.tasks.earliest_completion_time} today`
            }
          </Text>
        )}
      </View>
      
      <View style={styles.tapHintContainer}>
        <Text style={[
          styles.tapHint,
          !completionCheck.allowed && styles.restrictedTimeText
        ]}>
          {completeTaskMutation.isPending ? 'Completing...' : 
           !completionCheck.allowed ? completionCheck.message :
           isAssignedToCurrentUser ? 'Tap to complete your task' : 
           'Tap to help complete this task'
          }
        </Text>
      </View>
    </TouchableOpacity>
  )
}

// Task Detail Component for testing rotation
function TaskDetailCard({ task }: { task: any }) {
  const router = useRouter()
  const { data: pendingAssignments } = useTaskPendingAssignments(task?.id)
  
  if (!task) return null

  const handlePress = () => {
    router.push(`/tasks/${task.id}`)
  }

  const formatScheduledDays = (days: number[]) => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return days.sort().map(day => dayNames[day]).join(', ')
  }

  const formatScheduledTime = (time: string) => {
    // Convert 24-hour to 12-hour format
    const [hours, minutes] = time.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
  }

  return (
    <TouchableOpacity style={styles.taskDetailCard} onPress={handlePress}>
      <Text style={styles.taskDetailTitle}>{task.title}</Text>
      {task.description && (
        <Text style={styles.taskDetailDescription}>{task.description}</Text>
      )}
      
      <View style={styles.taskDetailInfo}>
        <Text style={styles.taskDetailLabel}>Category: {task.category}</Text>
        <Text style={styles.taskDetailLabel}>
          Type: {task.is_recurring ? `Recurring (${task.frequency_type})` : 'One-time'}
        </Text>
        
        {/* Show scheduling details for recurring tasks */}
        {task.is_recurring && task.scheduled_time && (
          <Text style={styles.taskDetailLabel}>
            Time: {formatScheduledTime(task.scheduled_time)}
          </Text>
        )}
        
        {task.is_recurring && task.frequency_type === 'weekly' && task.scheduled_days && task.scheduled_days.length > 0 && (
          <Text style={styles.taskDetailLabel}>
            Days: {formatScheduledDays(task.scheduled_days)}
          </Text>
        )}
        
        <Text style={styles.taskDetailLabel}>Points: {task.points_value}</Text>
      </View>
      
      {pendingAssignments && pendingAssignments.length > 0 && (
        <View style={styles.pendingAssignments}>
          <Text style={styles.pendingTitle}>Pending Assignments:</Text>
          {pendingAssignments.map((assignment: any) => (
            <Text key={assignment.id} style={styles.pendingAssignment}>
              • {assignment.assigned_to_profile?.display_name} - Due: {
                assignment.due_datetime ? 
                  new Date(assignment.due_datetime).toLocaleString() : 
                  assignment.due_date
              }
            </Text>
          ))}
        </View>
      )}
      
      {task.task_participants && task.task_participants.length > 0 && (
        <View style={styles.participantsList}>
          <Text style={styles.participantsTitle}>Rotation Order:</Text>
          {task.task_participants.map((participant: any, index: number) => (
            <Text key={participant.id} style={styles.participant}>
              {index + 1}. {participant.profiles?.display_name}
            </Text>
                  ))}
      </View>
    )}
    
    <View style={styles.tapHintContainer}>
      <Text style={styles.tapHint}>Tap for details</Text>
    </View>
  </TouchableOpacity>
)
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF8F0',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    padding: 24,
    paddingTop: 60,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2D3748',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#4A5568',
    textAlign: 'center',
  },
  actionContainer: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  createButton: {
    backgroundColor: '#FF6B4D',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionContainer: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A5568',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 12,
    color: '#718096',
    textAlign: 'center',
  },
  taskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  completedTask: {
    backgroundColor: '#F7FAFC',
    opacity: 0.8,
  },
  householdTaskCard: {
    borderWidth: 2,
    borderColor: '#48BB78',
    backgroundColor: '#F0FFF4',
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
    flex: 1,
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: '#718096',
  },
  taskPoints: {
    fontSize: 14,
    color: '#FF6B4D',
    fontWeight: '600',
  },
  taskDescription: {
    fontSize: 14,
    color: '#4A5568',
    marginTop: 4,
  },
  overdueTask: {
    borderLeftWidth: 4,
    borderLeftColor: '#E53E3E',
  },
  taskTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  recurringBadge: {
    fontSize: 14,
    marginLeft: 8,
  },
  assignmentInfo: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  assignmentText: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  dueDateText: {
    fontSize: 12,
    color: '#4A5568',
    fontWeight: '500',
  },
  overdueText: {
    color: '#E53E3E',
    fontWeight: '600',
  },
  completionTimeText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    fontStyle: 'italic',
  },
  restrictedTimeText: {
    color: '#F59E0B',
    fontWeight: '500',
  },
  tapHintContainer: {
    marginTop: 8,
    alignItems: 'center',
  },
  tapHint: {
    fontSize: 12,
    color: '#FF6B4D',
    fontWeight: '500',
  },
  taskDetailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  taskDetailTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 8,
  },
  taskDetailDescription: {
    fontSize: 14,
    color: '#4A5568',
    marginBottom: 12,
  },
  taskDetailInfo: {
    marginBottom: 12,
  },
  taskDetailLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  pendingAssignments: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
  },
  pendingTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 4,
  },
  pendingAssignment: {
    fontSize: 11,
    color: '#92400E',
    marginLeft: 8,
  },
  participantsList: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
  },
  participantsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 4,
  },
  participant: {
    fontSize: 11,
    color: '#1E40AF',
    marginLeft: 8,
  },
})

import { useRouter } from 'expo-router'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useAuth } from '../../hooks/useAuth'
import { useCompleteTaskAssignment, useTaskPendingAssignments, useTasks, useUserTaskAssignments } from '../../src/hooks/useTaskQuery'

export default function TasksScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { user, profile } = useAuth()
  
  const { data: tasks, isLoading: tasksLoading } = useTasks(profile?.household_id)
  const { data: userAssignments, isLoading: assignmentsLoading } = useUserTaskAssignments(user?.id || null)

  const handleCreateTask = () => {
    router.push('/tasks/create')
  }

  if (tasksLoading || assignmentsLoading) {
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
  const completeTaskMutation = useCompleteTaskAssignment()
  const displayTask = assignment?.tasks || task
  
  if (!displayTask) return null

  const handleCompleteTask = () => {
    if (!assignment || completed) return
    
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

  return (
    <TouchableOpacity 
      style={[
        styles.taskCard, 
        completed && styles.completedTask,
        isOverdue && styles.overdueTask
      ]}
      onPress={assignment && !completed ? handleCompleteTask : undefined}
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
        </View>
      )}
      
      {assignment && !completed && (
        <View style={styles.tapHintContainer}>
          <Text style={styles.tapHint}>
            {completeTaskMutation.isPending ? 'Completing...' : 'Tap to complete'}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

// Task Detail Component for testing rotation
function TaskDetailCard({ task }: { task: any }) {
  const { data: pendingAssignments } = useTaskPendingAssignments(task?.id)
  
  if (!task) return null

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
    <View style={styles.taskDetailCard}>
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
    </View>
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

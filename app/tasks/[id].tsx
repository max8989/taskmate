import { isBefore, parseISO, startOfDay } from 'date-fns'
import { LinearGradient } from 'expo-linear-gradient'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useAuth } from '../../hooks/useAuth'
import { useCompleteAnyTaskAssignment, useDeleteTask, useTask, useTaskPendingAssignments } from '../../src/hooks/useTaskQuery'

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

export default function TaskDetailScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { user, profile } = useAuth()
  const { id } = useLocalSearchParams<{ id: string }>()
  
  const { data: task, isLoading: taskLoading } = useTask(id || null)
  const { data: pendingAssignments, isLoading: assignmentsLoading } = useTaskPendingAssignments(id || null)
  const completeTaskMutation = useCompleteAnyTaskAssignment()
  const deleteTaskMutation = useDeleteTask()

  if (taskLoading || assignmentsLoading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B4D" />
          <Text style={styles.loadingText}>Loading task details...</Text>
        </View>
      </>
    )
  }

  if (!task) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Task not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </>
    )
  }

  const handleEdit = () => {
    router.push(`/tasks/edit/${task.id}`)
  }

  const handleDelete = () => {
    Alert.alert(
      'Delete Task',
      `Are you sure you want to delete "${task.title}"?\n\nThis will archive the task while preserving completion history.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            deleteTaskMutation.mutate({
              taskId: task.id,
              deletedBy: user?.id!,
            })
          }
        }
      ]
    )
  }

  const handleCompleteAssignment = (assignment: any) => {
    if (task.is_deleted) {
      Alert.alert(
        'Cannot Complete Deleted Task',
        'This task has been deleted and cannot be completed.',
        [{ text: 'OK' }]
      )
      return
    }

    const completionCheck = canCompleteTask(task, assignment)
    
    if (!completionCheck.allowed) {
      Alert.alert(
        'Cannot Complete Yet',
        completionCheck.message || 'Task cannot be completed at this time.',
        [{ text: 'OK' }]
      )
      return
    }

    const isAssignedToCurrentUser = assignment.assigned_to === user?.id
    
    Alert.alert(
      'Complete Task',
      isAssignedToCurrentUser 
        ? `Mark "${task.title}" as completed?`
        : `Mark "${task.title}" as completed?\n\nThis task is assigned to ${assignment.assigned_to_profile?.display_name}, but you can complete it to help out!`,
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

  const formatScheduledDays = (days: number[]) => {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    return days.sort().map(day => dayNames[day]).join(', ')
  }

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
  }

  const isUserAllowedToEdit = (task.created_by === user?.id || profile?.role === 'admin') && !task.is_deleted

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient
          colors={['#FFF8F0', '#FFE8D6']}
          style={styles.gradient}
        />
        
        <ScrollView contentContainerStyle={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{task.title}</Text>
            <View style={styles.badgesContainer}>
              {task.is_recurring && (
                <View style={styles.recurringBadge}>
                  <Text style={styles.recurringText}>🔄 Recurring</Text>
                </View>
              )}
              {task.is_deleted && (
                <View style={styles.deletedBadge}>
                  <Text style={styles.deletedText}>🗑️ Deleted</Text>
                </View>
              )}
            </View>
          </View>

          {/* Main Content */}
          <View style={styles.contentCard}>
            {/* Description */}
            {task.description && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Description</Text>
                <Text style={styles.description}>{task.description}</Text>
              </View>
            )}

            {/* Task Details */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Task Details</Text>
              <View style={styles.detailsGrid}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Category</Text>
                  <Text style={styles.detailValue}>{task.category}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Points</Text>
                  <Text style={styles.detailValue}>{task.points_value}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Type</Text>
                  <Text style={styles.detailValue}>
                    {task.is_recurring ? `Recurring (${task.frequency_type})` : 'One-time'}
                  </Text>
                </View>
                {task.created_by_profile && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Created by</Text>
                    <Text style={styles.detailValue}>{task.created_by_profile.display_name}</Text>
                  </View>
                )}
                {task.is_deleted && task.deleted_by_profile && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Deleted by</Text>
                    <Text style={styles.detailValue}>{task.deleted_by_profile.display_name}</Text>
                  </View>
                )}
                {task.is_deleted && task.deleted_at && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Deleted on</Text>
                    <Text style={styles.detailValue}>
                      {new Date(task.deleted_at).toLocaleDateString()}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Scheduling Information */}
            {task.is_recurring && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Schedule</Text>
                <View style={styles.detailsGrid}>
                  {task.scheduled_time && (
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Time</Text>
                      <Text style={styles.detailValue}>{formatTime(task.scheduled_time)}</Text>
                    </View>
                  )}
                  {task.frequency_type === 'weekly' && task.scheduled_days && task.scheduled_days.length > 0 && (
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Days</Text>
                      <Text style={styles.detailValue}>{formatScheduledDays(task.scheduled_days)}</Text>
                    </View>
                  )}
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Repeat</Text>
                    <Text style={styles.detailValue}>
                      Every {task.frequency_value} {task.frequency_type === 'daily' ? 'day(s)' : 
                             task.frequency_type === 'weekly' ? 'week(s)' : 'month(s)'}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Completion Restrictions */}
            {task.earliest_completion_time && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Completion Rules</Text>
                <View style={styles.completionRule}>
                  <Text style={styles.completionRuleText}>
                    ⏰ Can only be completed after {formatTime(task.earliest_completion_time)} on the due date
                  </Text>
                </View>
              </View>
            )}

            {/* Participants */}
            {task.task_participants && task.task_participants.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Participants (Rotation Order)</Text>
                <View style={styles.participantsList}>
                  {task.task_participants.map((participant: any, index: number) => (
                    <View key={participant.id} style={styles.participantItem}>
                      <Text style={styles.participantOrder}>{index + 1}.</Text>
                      <Text style={styles.participantName}>{participant.profiles?.display_name}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Pending Assignments */}
            {pendingAssignments && pendingAssignments.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Pending Assignments</Text>
                {pendingAssignments.map((assignment: any) => {
                  const isOverdue = (() => {
                    const today = startOfDay(new Date())
                    const dueDate = startOfDay(parseISO(assignment.due_date))
                    return isBefore(dueDate, today)
                  })()
                  const completionCheck = canCompleteTask(task, assignment)
                  const isAssignedToCurrentUser = assignment.assigned_to === user?.id
                  
                  return (
                    <TouchableOpacity
                      key={assignment.id}
                      style={[
                        styles.assignmentCard,
                        isOverdue && styles.overdueAssignment,
                        !isAssignedToCurrentUser && styles.householdAssignment,
                        task.is_deleted && styles.deletedAssignment
                      ]}
                      onPress={() => handleCompleteAssignment(assignment)}
                      disabled={task.is_deleted || !completionCheck.allowed || completeTaskMutation.isPending}
                    >
                      <View style={styles.assignmentHeader}>
                        <Text style={styles.assignmentAssignee}>
                          {assignment.assigned_to_profile?.display_name}
                          {isAssignedToCurrentUser && ' (You)'}
                        </Text>
                        <Text style={[
                          styles.assignmentDue,
                          isOverdue && styles.overdueText
                        ]}>
                          Due: {formatDate(assignment.due_date)}
                          {isOverdue && ' (Overdue)'}
                        </Text>
                      </View>
                      
                      {task.earliest_completion_time && (
                        <Text style={[
                          styles.completionTimeText,
                          !completionCheck.allowed && styles.restrictedTimeText
                        ]}>
                          {completionCheck.allowed 
                            ? `Can complete after ${task.earliest_completion_time}` 
                            : `Available after ${task.earliest_completion_time} today`
                          }
                        </Text>
                      )}
                      
                      <Text style={[
                        styles.assignmentAction,
                        !completionCheck.allowed && styles.restrictedTimeText
                      ]}>
                        {task.is_deleted ? 'Task deleted - Cannot complete' :
                         completeTaskMutation.isPending ? 'Completing...' : 
                         !completionCheck.allowed ? completionCheck.message :
                         isAssignedToCurrentUser ? 'Tap to complete your task' : 
                         'Tap to help complete this task'
                        }
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              {isUserAllowedToEdit && (
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={handleEdit}
                  disabled={deleteTaskMutation.isPending}
                >
                  <Text style={styles.editButtonText}>✏️ Edit Task</Text>
                </TouchableOpacity>
              )}
              
              {isUserAllowedToEdit && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={handleDelete}
                  disabled={deleteTaskMutation.isPending}
                >
                  <Text style={styles.deleteButtonText}>
                    {deleteTaskMutation.isPending ? 'Deleting...' : '🗑️ Delete Task'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ScrollView>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 200,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#DC2626',
    marginBottom: 20,
    textAlign: 'center',
  },
  header: {
    marginBottom: 20,
  },
  backButton: {
    marginBottom: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#FF6B4D',
    fontWeight: '500',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  badgesContainer: {
    flexDirection: 'row',
    gap: 8,
    alignSelf: 'flex-start',
  },
  recurringBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  recurringText: {
    fontSize: 14,
    color: '#1E40AF',
    fontWeight: '500',
  },
  deletedBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  deletedText: {
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '500',
  },
  contentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#4B5563',
    lineHeight: 24,
  },
  detailsGrid: {
    gap: 12,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '600',
  },
  completionRule: {
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  completionRuleText: {
    fontSize: 14,
    color: '#92400E',
    fontWeight: '500',
  },
  participantsList: {
    gap: 8,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  participantOrder: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
    marginRight: 12,
    width: 20,
  },
  participantName: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
  },
  assignmentCard: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  overdueAssignment: {
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  householdAssignment: {
    borderWidth: 2,
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  deletedAssignment: {
    opacity: 0.6,
    backgroundColor: '#F3F4F6',
    borderColor: '#D1D5DB',
  },
  assignmentHeader: {
    marginBottom: 4,
  },
  assignmentAssignee: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  assignmentDue: {
    fontSize: 14,
    color: '#6B7280',
  },
  overdueText: {
    color: '#DC2626',
    fontWeight: '600',
  },
  completionTimeText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    fontStyle: 'italic',
  },
  restrictedTimeText: {
    color: '#F59E0B',
    fontWeight: '500',
  },
  assignmentAction: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  editButton: {
    flex: 1,
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#DC2626',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
}) 
import { isBefore, parseISO, startOfDay } from 'date-fns'
import { useRouter } from 'expo-router'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useAuth } from '../../hooks/useAuth'
import { useCompleteAnyTaskAssignment, useTaskAssignments, useTaskPendingAssignments, useTasks, useUncompleteTaskAssignment, useUserTaskAssignments } from '../../src/hooks/useTaskQuery'
import { formatTaskDate } from '../../src/lib/dateUtils'

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
  
  const { data: tasks, isLoading: tasksLoading, refetch: refetchTasks } = useTasks(profile?.household_id)
  const { data: userAssignments, isLoading: assignmentsLoading, refetch: refetchUserAssignments } = useUserTaskAssignments(user?.id || null)
  const { data: allAssignments, isLoading: allAssignmentsLoading, refetch: refetchAllAssignments } = useTaskAssignments(profile?.household_id)

  // State for collapsible sections
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})
  
  // State for pull-to-refresh
  const [refreshing, setRefreshing] = useState(false)

  const handleCreateTask = () => {
    router.push('/tasks/create')
  }

  const toggleSection = (sectionId: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }))
  }

  const onRefresh = async () => {
    setRefreshing(true)
    try {
      await Promise.all([
        refetchTasks(),
        refetchUserAssignments(),
        refetchAllAssignments(),
      ])
    } catch (error) {
      console.error('Error refreshing data:', error)
    } finally {
      setRefreshing(false)
    }
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
    const today = startOfDay(new Date())
    const dueDate = startOfDay(parseISO(assignment.due_date))
    const isDueToday = dueDate.getTime() === today.getTime() && !assignment.is_completed
    
    // Also include tasks that can be completed right now (earliest completion time has passed)
    const canComplete = !assignment.is_completed && canCompleteTask(assignment.tasks, assignment).allowed
    
    return isDueToday || canComplete
  }) || []

  const upcomingAssignments = userAssignments?.filter(assignment => {
    const today = startOfDay(new Date())
    const dueDate = startOfDay(parseISO(assignment.due_date))
    const isUpcoming = dueDate > today && !assignment.is_completed
    
    // Exclude tasks that can be completed now (they should be in "Due Today")
    const canComplete = canCompleteTask(assignment.tasks, assignment).allowed
    
    return isUpcoming && !canComplete
  }) || []

  const completedAssignments = userAssignments?.filter(assignment => 
    assignment.is_completed
  )?.slice(0, 3) || []

  // Filter all household assignments for "anyone can complete" section
  const householdPendingAssignments = allAssignments?.filter(assignment => 
    !assignment.is_completed
  ) || []
  
  const householdOverdueAssignments = householdPendingAssignments.filter(assignment => {
    const today = startOfDay(new Date())
    const dueDate = startOfDay(parseISO(assignment.due_date))
    return isBefore(dueDate, today)
  })
  
  const householdTodayAssignments = householdPendingAssignments.filter(assignment => {
    const today = startOfDay(new Date())
    const dueDate = startOfDay(parseISO(assignment.due_date))
    return dueDate.getTime() === today.getTime()
  })

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={['#FF6B4D']}
          tintColor="#FF6B4D"
          progressViewOffset={100}
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>{t('tasks.title')}</Text>
        <Text style={styles.subtitle}>{t('tasks.manageHousehold')}</Text>
      </View>

      <View style={styles.actionContainer}>
        <TouchableOpacity style={styles.createButton} onPress={handleCreateTask}>
          <Text style={styles.createButtonText}>+ {t('tasks.create')}</Text>
        </TouchableOpacity>
      </View>

      <CollapsibleSection
        id="today"
        title={`📅 ${t('tasks.dueToday')} (${todayAssignments.length})`}
        isCollapsed={collapsedSections.today}
        onToggle={() => toggleSection('today')}
      >
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
      </CollapsibleSection>

      <CollapsibleSection
        id="upcoming"
        title={`📋 ${t('tasks.upcoming')} (${upcomingAssignments.length})`}
        isCollapsed={collapsedSections.upcoming}
        onToggle={() => toggleSection('upcoming')}
      >
        {upcomingAssignments.length > 0 ? (
          upcomingAssignments.slice(0, 3).map((assignment) => (
            <SimpleTaskCard key={assignment.id} assignment={assignment} />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{t('tasks.noUpcoming')}</Text>
            <Text style={styles.emptySubtext}>{t('tasks.createRecurringHelp')}</Text>
          </View>
        )}
      </CollapsibleSection>

      {/* New section: Household Tasks Anyone Can Complete */}
      {householdOverdueAssignments.length > 0 && (
        <CollapsibleSection
          id="overdue"
          title={`🚨 ${t('tasks.overdue')} ${t('tasks.householdTasksToday', { count: householdOverdueAssignments.length })}`}
          subtitle={t('tasks.anyoneCanComplete')}
          isCollapsed={collapsedSections.overdue}
          onToggle={() => toggleSection('overdue')}
        >
          {householdOverdueAssignments.slice(0, 3).map((assignment) => (
            <HouseholdTaskCard key={assignment.id} assignment={assignment} />
          ))}
        </CollapsibleSection>
      )}

      {householdTodayAssignments.length > 0 && (
        <CollapsibleSection
          id="householdToday"
          title={`🏠 ${t('tasks.householdTasksToday', { count: householdTodayAssignments.length })}`}
          subtitle={t('tasks.anyoneCanComplete')}
          isCollapsed={collapsedSections.householdToday}
          onToggle={() => toggleSection('householdToday')}
        >
          {householdTodayAssignments.slice(0, 5).map((assignment) => (
            <HouseholdTaskCard key={assignment.id} assignment={assignment} />
          ))}
        </CollapsibleSection>
      )}

      <CollapsibleSection
        id="allTasks"
        title={`🏠 ${t('tasks.allHouseholdTasks', { count: tasks?.length || 0 })}`}
        isCollapsed={collapsedSections.allTasks}
        onToggle={() => toggleSection('allTasks')}
      >
        {tasks && tasks.length > 0 ? (
          tasks.slice(0, 5).map((task) => (
            <TaskDetailCard key={task.id} task={task} />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{t('tasks.noUpcoming')}</Text>
            <Text style={styles.emptySubtext}>{t('tasks.createRecurringHelp')}</Text>
          </View>
        )}
      </CollapsibleSection>

      {completedAssignments.length > 0 && (
        <CollapsibleSection
          id="completed"
          title={`✅ ${t('tasks.completed')} (Recent)`}
          isCollapsed={collapsedSections.completed}
          onToggle={() => toggleSection('completed')}
        >
          {completedAssignments.map((assignment) => (
            <SimpleTaskCard key={assignment.id} assignment={assignment} completed />
          ))}
        </CollapsibleSection>
      )}
    </ScrollView>
  )
}

// Collapsible Section Component
function CollapsibleSection({ 
  id, 
  title, 
  subtitle, 
  isCollapsed, 
  onToggle, 
  children 
}: { 
  id: string
  title: string
  subtitle?: string
  isCollapsed: boolean
  onToggle: () => void
  children: React.ReactNode 
}) {
  return (
    <View style={styles.sectionContainer}>
      <TouchableOpacity style={styles.sectionHeader} onPress={onToggle}>
        <View style={styles.sectionTitleContainer}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle && (
            <Text style={styles.sectionSubtitle}>{subtitle}</Text>
          )}
        </View>
        <Text style={styles.collapseIcon}>
          {isCollapsed ? '▶️' : '🔽'}
        </Text>
      </TouchableOpacity>
      {!isCollapsed && (
        <View style={styles.sectionContent}>
          {children}
        </View>
      )}
    </View>
  )
}

// Enhanced Task Card Component with Assignment Info
function SimpleTaskCard({ assignment, task, completed = false }: { 
  assignment?: any, 
  task?: any,
  completed?: boolean
}) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const router = useRouter()
  const completeTaskMutation = useCompleteAnyTaskAssignment()
  const uncompleteTaskMutation = useUncompleteTaskAssignment()
  const displayTask = assignment?.tasks || task
  
  if (!displayTask) return null

  const completionCheck = canCompleteTask(displayTask, assignment)

  const handleCompleteTask = () => {
    if (!assignment || completed) return
    
    if (!completionCheck.allowed) {
      Alert.alert(
        t('tasks.cannotCompleteYet'),
        completionCheck.message || t('tasks.cannotCompleteMessage'),
        [{ text: t('common.ok') }]
      )
      return
    }
    
    Alert.alert(
      t('tasks.completeTask'),
      t('tasks.markAsCompleted', { title: displayTask.title }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { 
          text: t('tasks.complete'), 
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

  const handleUncompleteTask = () => {
    if (!assignment || !completed) return

    Alert.alert(
      'Uncomplete Task',
      `Mark "${displayTask.title}" as uncompleted?`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        { 
          text: 'Uncomplete', 
          onPress: () => {
            uncompleteTaskMutation.mutate({
              assignmentId: assignment.id,
              uncompletedBy: user?.id!,
            })
          }
        }
      ]
    )
  }

  const formatDate = (dateString: string) => {
    return formatTaskDate(dateString)
  }

  const isOverdue = assignment && !completed && (() => {
    const today = startOfDay(new Date())
    const dueDate = startOfDay(parseISO(assignment.due_date))
    return isBefore(dueDate, today)
  })()

  const handleCardPress = () => {
    if (assignment && !completed && completionCheck.allowed) {
      handleCompleteTask()
    } else if (assignment && completed && uncompleteTaskMutation.isIdle) {
      handleUncompleteTask()
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
      disabled={completeTaskMutation.isPending || uncompleteTaskMutation.isPending}
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
            {assignment.assigned_to === user?.id 
              ? t('tasks.assignedToYou', { name: assignment.assigned_to_profile?.display_name })
              : t('tasks.assignedToOther', { name: assignment.assigned_to_profile?.display_name })
            }
          </Text>
          <Text style={[
            styles.dueDateText,
            completed && styles.completedText,
            isOverdue && styles.overdueText
          ]}>
            {t('tasks.dueDate', { date: formatDate(assignment.due_date) })}
            {isOverdue && ` (${t('tasks.overdue')})`}
          </Text>
          {displayTask.earliest_completion_time && !completed && (
            <Text style={[
              styles.completionTimeText,
              !completionCheck.allowed && styles.restrictedTimeText
            ]}>
              {completionCheck.allowed 
                ? t('tasks.canCompleteAfter', { time: displayTask.earliest_completion_time })
                : t('tasks.canCompleteAfter', { time: displayTask.earliest_completion_time }) + ' today'
              }
            </Text>
          )}
        </View>
      )}
      
      {assignment && (
        <View style={styles.tapHintContainer}>
          <Text style={[
            styles.tapHint,
            !completionCheck.allowed && styles.restrictedTimeText
          ]}>
            {completeTaskMutation.isPending ? t('tasks.completing') : 
             uncompleteTaskMutation.isPending ? t('tasks.uncompleting') :
             completed ? t('tasks.tapToUncomplete') :
             !completionCheck.allowed ? 'Tap for details • ' + completionCheck.message :
             t('tasks.tapToCompleteDetails')
            }
          </Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

// Household Task Card Component - allows any user to complete any task
function HouseholdTaskCard({ assignment }: { assignment: any }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const router = useRouter()
  const completeTaskMutation = useCompleteAnyTaskAssignment()
  
  if (!assignment?.tasks) return null

  const completionCheck = canCompleteTask(assignment.tasks, assignment)

  const handleCompleteTask = () => {
    if (!completionCheck.allowed) {
      Alert.alert(
        t('tasks.cannotCompleteYet'),
        completionCheck.message || t('tasks.cannotCompleteMessage'),
        [{ text: t('common.ok') }]
      )
      return
    }

    Alert.alert(
      t('tasks.completeTask'),
      `Mark "${assignment.tasks.title}" as completed?\n\nThis task is assigned to ${assignment.assigned_to_profile?.display_name}, but you can complete it to help out!`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        { 
          text: t('tasks.complete'), 
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
    return formatTaskDate(dateString)
  }

  const isOverdue = (() => {
    const today = startOfDay(new Date())
    const dueDate = startOfDay(parseISO(assignment.due_date))
    return isBefore(dueDate, today)
  })()
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
          {isAssignedToCurrentUser 
            ? t('tasks.assignedToYou', { name: assignment.assigned_to_profile?.display_name })
            : t('tasks.assignedToOther', { name: assignment.assigned_to_profile?.display_name })
          }
        </Text>
        <Text style={[
          styles.dueDateText,
          isOverdue && styles.overdueText
        ]}>
          {t('tasks.dueDate', { date: formatDate(assignment.due_date) })}
          {isOverdue && ` (${t('tasks.overdue')})`}
        </Text>
        {assignment.tasks.earliest_completion_time && (
          <Text style={[
            styles.completionTimeText,
            !completionCheck.allowed && styles.restrictedTimeText
          ]}>
            {completionCheck.allowed 
              ? t('tasks.canCompleteAfter', { time: assignment.tasks.earliest_completion_time })
              : t('tasks.canCompleteAfter', { time: assignment.tasks.earliest_completion_time }) + ' today'
            }
          </Text>
        )}
      </View>
      
      <View style={styles.tapHintContainer}>
        <Text style={[
          styles.tapHint,
          !completionCheck.allowed && styles.restrictedTimeText
        ]}>
          {completeTaskMutation.isPending ? t('common.loading') : 
           !completionCheck.allowed ? completionCheck.message :
           isAssignedToCurrentUser ? t('tasks.tapToComplete') : 
           t('tasks.tapHelpComplete')
          }
        </Text>
      </View>
    </TouchableOpacity>
  )
}

// Task Detail Component for testing rotation
function TaskDetailCard({ task }: { task: any }) {
  const { t } = useTranslation()
  const router = useRouter()
  const { data: pendingAssignments } = useTaskPendingAssignments(task?.id)
  
  if (!task) return null

  const handlePress = () => {
    router.push(`/tasks/${task.id}`)
  }

  const formatScheduledDays = (days: number[]) => {
    const dayNames = [
      t('days.sun'), t('days.mon'), t('days.tue'), t('days.wed'), 
      t('days.thu'), t('days.fri'), t('days.sat')
    ]
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
        <Text style={styles.taskDetailLabel}>{t('taskDetail.category')}: {t(`categories.${task.category}`)}</Text>
        <Text style={styles.taskDetailLabel}>
          {t('taskDetail.type')}: {task.is_recurring ? t(`taskDetail.recurring${task.frequency_type.charAt(0).toUpperCase() + task.frequency_type.slice(1)}`) : t('taskDetail.oneTime')}
        </Text>
        
        {/* Show scheduling details for recurring tasks */}
        {task.is_recurring && task.scheduled_time && (
          <Text style={styles.taskDetailLabel}>
            {t('taskDetail.time')}: {formatScheduledTime(task.scheduled_time)}
          </Text>
        )}
        
        {task.is_recurring && task.frequency_type === 'weekly' && task.scheduled_days && task.scheduled_days.length > 0 && (
          <Text style={styles.taskDetailLabel}>
            Days: {formatScheduledDays(task.scheduled_days)}
          </Text>
        )}
        
        <Text style={styles.taskDetailLabel}>{t('taskDetail.points')}: {task.points_value}</Text>
      </View>
      
      {pendingAssignments && pendingAssignments.length > 0 && (
        <View style={styles.pendingAssignments}>
          <Text style={styles.pendingTitle}>{t('tasks.pendingAssignments')}</Text>
          {pendingAssignments.map((assignment: any) => (
            <Text key={assignment.id} style={styles.pendingAssignment}>
              • {assignment.assigned_to_profile?.display_name} - {t('tasks.dueDate', { 
                date: assignment.due_datetime ? 
                  new Date(assignment.due_datetime).toLocaleString() : 
                  assignment.due_date
              })}
            </Text>
          ))}
        </View>
      )}
      
      {task.task_participants && task.task_participants.length > 0 && (
        <View style={styles.participantsList}>
          <Text style={styles.participantsTitle}>{t('taskDetail.participantsRotation')}:</Text>
          {task.task_participants.map((participant: any, index: number) => (
            <Text key={participant.id} style={styles.participant}>
              {index + 1}. {participant.profiles?.display_name}
            </Text>
          ))}
        </View>
      )}
      
      <View style={styles.tapHintContainer}>
        <Text style={styles.tapHint}>{t('taskDetail.tapForDetails')}</Text>
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  sectionTitleContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
    fontStyle: 'italic',
  },
  collapseIcon: {
    fontSize: 20,
    color: '#FF6B4D',
  },
  sectionContent: {
    paddingHorizontal: 8,
    paddingBottom: 16,
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

import { useRouter } from 'expo-router'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useAuth } from '../../hooks/useAuth'
import { useTasks, useUserTaskAssignments } from '../../src/hooks/useTaskQuery'

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
            <SimpleTaskCard key={task.id} task={task} />
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

// Simplified Task Card Component
function SimpleTaskCard({ assignment, task, completed = false }: { 
  assignment?: any, 
  task?: any,
  completed?: boolean
}) {
  const displayTask = assignment?.tasks || task
  
  if (!displayTask) return null

  return (
    <View style={[styles.taskCard, completed && styles.completedTask]}>
      <View style={styles.taskHeader}>
        <Text style={[styles.taskTitle, completed && styles.completedText]}>
          {displayTask.title}
        </Text>
        <Text style={styles.taskPoints}>{displayTask.points_value} pts</Text>
      </View>
      {displayTask.description && (
        <Text style={[styles.taskDescription, completed && styles.completedText]} numberOfLines={1}>
          {displayTask.description}
        </Text>
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
})

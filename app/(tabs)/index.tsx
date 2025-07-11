import { isBefore, parseISO, startOfDay } from 'date-fns'
import { useRouter } from 'expo-router'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useAuth } from '../../hooks/useAuth'
import { useCompleteAnyTaskAssignment, useHouseholdLeaderboard, useHouseholdStats, useUserDashboardStats, useUserTaskAssignments } from '../../src/hooks/useTaskQuery'

// Helper function to check if task completion is allowed
function canCompleteTask(task: any, assignment: any): { allowed: boolean; message?: string } {
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
    return { 
      allowed: false, 
      message: `Available after ${timeStr}` 
    }
  }

  return { allowed: true }
}

// Simple Task Card Component for Dashboard
function DashboardTaskCard({ assignment }: { assignment: any }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const completeTaskMutation = useCompleteAnyTaskAssignment()
  
  if (!assignment?.tasks) return null

  const completionCheck = canCompleteTask(assignment.tasks, assignment)
  const isOverdue = (() => {
    const today = startOfDay(new Date())
    const dueDate = startOfDay(parseISO(assignment.due_date))
    return isBefore(dueDate, today)
  })()

  const handleCompleteTask = () => {
    if (!completionCheck.allowed) {
      Alert.alert(
        'Cannot Complete Yet',
        completionCheck.message || 'This task cannot be completed at this time.',
        [{ text: 'OK' }]
      )
      return
    }

    completeTaskMutation.mutate({
      assignmentId: assignment.id,
      completedBy: user?.id!,
    })
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    if (date.toDateString() === today.toDateString()) {
      return t('dashboard.today')
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return t('dashboard.tomorrow')
    } else {
      return date.toLocaleDateString()
    }
  }

  return (
    <View style={[
      styles.dashboardTaskCard,
      isOverdue && styles.overdueTaskCard
    ]}>
      <View style={styles.taskCardContent}>
        <View style={styles.taskCardInfo}>
          <Text style={styles.taskCardTitle} numberOfLines={1}>
            {assignment.tasks.title}
          </Text>
          <Text style={[
            styles.taskCardDue,
            isOverdue && styles.overdueText
          ]}>
            {formatDate(assignment.due_date)}
            {isOverdue && ` • ${t('dashboard.overdue')}`}
          </Text>
        </View>
        
        <View style={styles.taskCardActions}>
          <Text style={styles.taskCardPoints}>
            {assignment.tasks.points_value} pts
          </Text>
          <TouchableOpacity
            style={[
              styles.completeButton,
              !completionCheck.allowed && styles.disabledButton,
              completeTaskMutation.isPending && styles.loadingButton
            ]}
            onPress={handleCompleteTask}
            disabled={!completionCheck.allowed || completeTaskMutation.isPending}
          >
            <Text style={[
              styles.completeButtonText,
              !completionCheck.allowed && styles.disabledButtonText
            ]}>
              {completeTaskMutation.isPending ? '...' : 
               !completionCheck.allowed ? '🔒' : '✓'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {!completionCheck.allowed && (
        <Text style={styles.restrictionText}>
          {completionCheck.message}
        </Text>
      )}
    </View>
  )
}

export default function DashboardScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { user, profile } = useAuth()
  
  // State for pull-to-refresh
  const [refreshing, setRefreshing] = useState(false)
  
  const { data: userStats, isLoading: userStatsLoading, refetch: refetchUserStats } = useUserDashboardStats(user?.id || null, profile?.household_id || null)
  const { data: householdStats, isLoading: householdStatsLoading, refetch: refetchHouseholdStats } = useHouseholdStats(profile?.household_id || null)
  const { data: leaderboard, isLoading: leaderboardLoading, refetch: refetchLeaderboard } = useHouseholdLeaderboard(profile?.household_id || null)
  const { data: userAssignments, isLoading: assignmentsLoading, refetch: refetchUserAssignments } = useUserTaskAssignments(user?.id || null)

  const isLoading = userStatsLoading || householdStatsLoading || leaderboardLoading || assignmentsLoading

  // Find current user in leaderboard
  const currentUserRank = leaderboard?.find(entry => entry.userId === user?.id)?.rank || 0

  // Filter today's tasks and upcoming tasks
  const todayTasks = userAssignments?.filter(assignment => {
    const today = startOfDay(new Date())
    const dueDate = startOfDay(parseISO(assignment.due_date))
    const isDueToday = dueDate.getTime() === today.getTime() && !assignment.is_completed
    
    // Also include tasks that can be completed right now (earliest completion time has passed)
    const canComplete = !assignment.is_completed && canCompleteTask(assignment.tasks, assignment).allowed
    
    return isDueToday || canComplete
  }) || []

  const upcomingTasks = userAssignments?.filter(assignment => {
    const today = startOfDay(new Date())
    const dueDate = startOfDay(parseISO(assignment.due_date))
    const isUpcoming = dueDate > today && !assignment.is_completed
    
    // Exclude tasks that can be completed now (they should be in "Due Today")
    const canComplete = canCompleteTask(assignment.tasks, assignment).allowed
    
    return isUpcoming && !canComplete
  })?.slice(0, 3) || []

  // Pull-to-refresh handler
  const onRefresh = async () => {
    setRefreshing(true)
    try {
      await Promise.all([
        refetchUserStats(),
        refetchHouseholdStats(),
        refetchLeaderboard(),
        refetchUserAssignments(),
      ])
    } catch (error) {
      console.error('Error refreshing dashboard data:', error)
    } finally {
      setRefreshing(false)
    }
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B4D" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    )
  }

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
      {/* App Header */}
      <View style={styles.appHeader}>
        <View style={styles.headerBackground}>
          <View style={styles.headerGradientOverlay} />
          <View style={styles.appBranding}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoIcon}>🏠</Text>
            </View>
            <View style={styles.brandTextContainer}>
              <Text style={styles.appName}>TaskMate</Text>
              <Text style={styles.appTagline}>{t('dashboard.appTagline')}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{t('dashboard.welcome', { name: profile?.display_name || 'User' })}</Text>
            <Text style={styles.subtitle}>
              {householdStats?.memberCount} {t('dashboard.members')} • {householdStats?.totalPoints || 0} {t('dashboard.totalPoints')}
            </Text>
          </View>
        </View>
      </View>

      {/* Personal Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{userStats?.todayTasks || 0}</Text>
          <Text style={styles.statLabel}>{t('dashboard.todayTasks')}</Text>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${userStats?.efficiency || 0}%` }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>
            {userStats?.completedToday || 0}/{userStats?.todayTasks || 0} {t('dashboard.completed')}
          </Text>
        </View>
        
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{profile?.current_streak || 0}</Text>
          <Text style={styles.statLabel}>{t('dashboard.currentStreak')}</Text>
          <Text style={styles.streakEmoji}>🔥</Text>
          <Text style={styles.progressText}>
            {profile?.current_streak === 1 ? t('dashboard.keepGoing') : t('dashboard.onFire')}
          </Text>
        </View>
        
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{profile?.total_points || 0}</Text>
          <Text style={styles.statLabel}>{t('dashboard.totalPoints')}</Text>
          <Text style={styles.rankBadge}>#{currentUserRank}</Text>
          <Text style={styles.progressText}>
            +{userStats?.weeklyPoints || 0} {t('dashboard.thisWeek')}
          </Text>
        </View>
      </View>

      {/* Overdue Tasks Warning */}
      {userStats?.overdueTasks && userStats.overdueTasks > 0 && (
        <View style={styles.warningCard}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <View style={styles.warningContent}>
            <Text style={styles.warningTitle}>
              {userStats.overdueTasks} {t('dashboard.overdueTasks')}
            </Text>
            <Text style={styles.warningText}>{t('dashboard.catchUpMessage')}</Text>
          </View>
          <TouchableOpacity 
            style={styles.warningButton}
            onPress={() => router.push('/(tabs)/explore')}
          >
            <Text style={styles.warningButtonText}>{t('dashboard.viewTasks')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Today's Tasks */}
      {todayTasks.length > 0 && (
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📅 {t('dashboard.todayTasks')} ({todayTasks.length})</Text>
            {todayTasks.length > 3 && (
              <TouchableOpacity 
                style={styles.viewAllButton}
                onPress={() => router.push('/(tabs)/explore')}
              >
                <Text style={styles.viewAllText}>{t('dashboard.viewAll')}</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {todayTasks.slice(0, 3).map((assignment) => (
            <DashboardTaskCard key={assignment.id} assignment={assignment} />
          ))}
        </View>
      )}

      {/* Upcoming Tasks */}
      {upcomingTasks.length > 0 && (
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📋 {t('dashboard.upcomingTasks')} ({upcomingTasks.length})</Text>
            <TouchableOpacity 
              style={styles.viewAllButton}
              onPress={() => router.push('/(tabs)/explore')}
            >
              <Text style={styles.viewAllText}>{t('dashboard.viewAll')}</Text>
            </TouchableOpacity>
          </View>
          
          {upcomingTasks.map((assignment) => (
            <View key={assignment.id} style={styles.upcomingTaskCard}>
              <View style={styles.taskCardInfo}>
                <Text style={styles.taskCardTitle} numberOfLines={1}>
                  {assignment.tasks?.title}
                </Text>
                <Text style={styles.taskCardDue}>
                  {(() => {
                    const date = new Date(assignment.due_date)
                    const today = new Date()
                    const tomorrow = new Date(today)
                    tomorrow.setDate(tomorrow.getDate() + 1)
                    
                    if (date.toDateString() === tomorrow.toDateString()) {
                      return t('dashboard.tomorrow')
                    } else {
                      return date.toLocaleDateString()
                    }
                  })()}
                </Text>
              </View>
              <Text style={styles.taskCardPoints}>
                {assignment.tasks?.points_value || 10} pts
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Show message when no tasks today */}
      {todayTasks.length === 0 && (
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>📅 {t('dashboard.todayTasks')}</Text>
          <View style={styles.noTasksCard}>
            <Text style={styles.noTasksEmoji}>🎉</Text>
            <Text style={styles.noTasksTitle}>{t('dashboard.allCaughtUp')}</Text>
            <Text style={styles.noTasksText}>{t('dashboard.noTasksToday')}</Text>
          </View>
        </View>
      )}

      {/* Household Overview */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>🏠 {t('dashboard.householdOverview')}</Text>
        
        <View style={styles.householdStatsGrid}>
          <View style={styles.householdStatItem}>
            <Text style={styles.householdStatNumber}>{householdStats?.completedTodayTasks || 0}</Text>
            <Text style={styles.householdStatLabel}>{t('dashboard.completedTodayCount')}</Text>
          </View>
          
          <View style={styles.householdStatItem}>
            <Text style={styles.householdStatNumber}>{householdStats?.weeklyTasksCompleted || 0}</Text>
            <Text style={styles.householdStatLabel}>{t('dashboard.thisWeekTasks')}</Text>
          </View>
          
          <View style={styles.householdStatItem}>
            <Text style={styles.householdStatNumber}>{householdStats?.householdEfficiency || 0}%</Text>
            <Text style={styles.householdStatLabel}>{t('dashboard.efficiency')}</Text>
          </View>
          
          <View style={styles.householdStatItem}>
            <Text style={styles.householdStatNumber}>{householdStats?.topStreakMember?.current_streak || 0}</Text>
            <Text style={styles.householdStatLabel}>{t('dashboard.topStreak')}</Text>
            {householdStats?.topStreakMember && (
              <Text style={styles.topStreakName}>{householdStats.topStreakMember.display_name}</Text>
            )}
          </View>
        </View>
      </View>

      {/* Leaderboard Preview */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🏆 {t('dashboard.leaderboard')}</Text>
          <TouchableOpacity 
            style={styles.viewAllButton}
            onPress={() => router.push('/(tabs)/profile')} // Assuming leaderboard is in profile tab
          >
            <Text style={styles.viewAllText}>{t('dashboard.viewAll')}</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.leaderboardContainer}>
          {leaderboard?.slice(0, 3).map((entry, index) => (
            <View key={entry.userId} style={styles.leaderboardItem}>
              <View style={styles.leaderboardRank}>
                <Text style={styles.rankNumber}>
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                </Text>
              </View>
              <View style={styles.leaderboardInfo}>
                <Text style={[
                  styles.leaderboardName,
                  entry.userId === user?.id && styles.currentUserName
                ]}>
                  {entry.displayName}
                  {entry.userId === user?.id && ' (You)'}
                </Text>
                <Text style={styles.leaderboardStats}>
                  {entry.totalPoints} pts • {entry.currentStreak} 🔥
                </Text>
              </View>
              <View style={styles.leaderboardBadge}>
                <Text style={styles.leaderboardBadgeText}>+{entry.weeklyPoints}</Text>
                <Text style={styles.leaderboardBadgeLabel}>{t('dashboard.thisWeek')}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>⚡ {t('dashboard.quickActions')}</Text>
        
        <View style={styles.quickActionsGrid}>
          <TouchableOpacity 
            style={styles.quickActionButton}
            onPress={() => router.push('/tasks/create')}
          >
            <Text style={styles.quickActionIcon}>➕</Text>
            <Text style={styles.quickActionText}>{t('tasks.create')}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickActionButton}
            onPress={() => router.push('/(tabs)/explore')}
          >
            <Text style={styles.quickActionIcon}>📋</Text>
            <Text style={styles.quickActionText}>{t('dashboard.myTasks')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
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
    marginTop: 12,
    fontSize: 16,
    color: '#4A5568',
  },
  appHeader: {
    paddingTop: 60,
  },
  headerBackground: {
    position: 'relative',
    height: 140,
    overflow: 'hidden',
    backgroundColor: '#FF6B4D', // Fallback color
    // Create a gradient-like effect with multiple layers
    shadowColor: '#FF6B4D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  headerGradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'linear-gradient(135deg, #FF6B4D 0%, #FF8A65 50%, #FFB74D 100%)', // Will fallback to solid color on RN
    opacity: 0.9,
  },
  appBranding: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
    height: '100%',
    position: 'relative',
    zIndex: 1,
  },
  logoContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
  },
  logoIcon: {
    fontSize: 28,
    color: '#FFFFFF',
  },
  brandTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  appName: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  appTagline: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
    textAlign: 'left',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  header: {
    padding: 24,
    paddingTop: 24, // Add space after the orange header
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleContainer: {
    flex: 1,
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
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    minHeight: 120,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FF6B4D',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#4A5568',
    textAlign: 'center',
    marginBottom: 8,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF6B4D',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 10,
    color: '#718096',
    textAlign: 'center',
  },
  streakEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  rankBadge: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B7FFF',
    marginBottom: 4,
  },
  warningCard: {
    flexDirection: 'row',
    backgroundColor: '#FED7CC',
    marginHorizontal: 24,
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  warningIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#C53030',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 14,
    color: '#9C4221',
  },
  warningButton: {
    backgroundColor: '#C53030',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  warningButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
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
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 16,
  },
  viewAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F7FAFC',
    borderRadius: 8,
  },
  viewAllText: {
    fontSize: 14,
    color: '#FF6B4D',
    fontWeight: '600',
  },
  // Dashboard Task Card Styles
  dashboardTaskCard: {
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
  overdueTaskCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#E53E3E',
  },
  taskCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  taskCardInfo: {
    flex: 1,
    marginRight: 12,
  },
  taskCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 4,
  },
  taskCardDue: {
    fontSize: 14,
    color: '#718096',
  },
  overdueText: {
    color: '#E53E3E',
    fontWeight: '600',
  },
  taskCardActions: {
    alignItems: 'center',
  },
  taskCardPoints: {
    fontSize: 12,
    color: '#8B7FFF',
    fontWeight: '600',
    marginBottom: 8,
  },
  completeButton: {
    backgroundColor: '#48BB78',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#E2E8F0',
  },
  disabledButtonText: {
    color: '#9CA3AF',
  },
  loadingButton: {
    backgroundColor: '#F7FAFC',
  },
  restrictionText: {
    fontSize: 12,
    color: '#F59E0B',
    marginTop: 8,
    fontStyle: 'italic',
  },
  // Upcoming Task Card Styles
  upcomingTaskCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  // No Tasks Card
  noTasksCard: {
    backgroundColor: '#F0FFF4',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C6F6D5',
  },
  noTasksEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  noTasksTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#38A169',
    marginBottom: 4,
  },
  noTasksText: {
    fontSize: 14,
    color: '#68D391',
    textAlign: 'center',
  },
  householdStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  householdStatItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  householdStatNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#8B7FFF',
    marginBottom: 4,
  },
  householdStatLabel: {
    fontSize: 12,
    color: '#4A5568',
    textAlign: 'center',
  },
  topStreakName: {
    fontSize: 10,
    color: '#718096',
    marginTop: 2,
    textAlign: 'center',
  },
  leaderboardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F7FAFC',
  },
  leaderboardRank: {
    marginRight: 12,
  },
  rankNumber: {
    fontSize: 24,
  },
  leaderboardInfo: {
    flex: 1,
  },
  leaderboardName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 2,
  },
  currentUserName: {
    color: '#FF6B4D',
  },
  leaderboardStats: {
    fontSize: 14,
    color: '#718096',
  },
  leaderboardBadge: {
    alignItems: 'center',
  },
  leaderboardBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#48BB78',
  },
  leaderboardBadgeLabel: {
    fontSize: 10,
    color: '#718096',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  quickActionIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A5568',
    textAlign: 'center',
  },
})

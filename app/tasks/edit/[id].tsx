import { LinearGradient } from 'expo-linear-gradient'
import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useAuth } from '../../../hooks/useAuth'
import { useHouseholdMembers } from '../../../src/hooks/useHouseholdQuery'
import { useTask, useTaskParticipants, useUpdateTask, useUpdateTaskParticipants } from '../../../src/hooks/useTaskQuery'
import { TablesInsert } from '../../../src/lib/supabase'

const TASK_CATEGORIES = [
  'general',
  'cleaning', 
  'kitchen',
  'bathroom',
  'laundry',
  'maintenance',
  'groceries',
  'bills',
  'outdoor'
]

const FREQUENCY_TYPES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' }
]

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
]

export default function TaskEditScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { user, profile } = useAuth()
  const { id } = useLocalSearchParams<{ id: string }>()
  
  const { data: task, isLoading: taskLoading } = useTask(id || null)
  const { data: taskParticipants, isLoading: participantsLoading } = useTaskParticipants(id || null)
  const { data: householdMembers } = useHouseholdMembers(profile?.household_id)
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'general',
    is_recurring: true,
    frequency_type: 'weekly' as 'daily' | 'weekly' | 'monthly',
    frequency_value: 1,
    points_value: 10,
    scheduled_days: [] as number[],
    scheduled_time: '09:00',
    earliest_completion_time: '',
  })
  
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([])
  const [isDataLoaded, setIsDataLoaded] = useState(false)
  
  const updateTaskMutation = useUpdateTask()
  const updateParticipantsMutation = useUpdateTaskParticipants()

  // Load existing task data
  useEffect(() => {
    if (task && !isDataLoaded) {
      setFormData({
        title: task.title || '',
        description: task.description || '',
        category: task.category || 'general',
        is_recurring: task.is_recurring ?? true,
        frequency_type: (task.frequency_type as 'daily' | 'weekly' | 'monthly') || 'weekly',
        frequency_value: task.frequency_value || 1,
        points_value: task.points_value || 10,
        scheduled_days: task.scheduled_days || [],
        scheduled_time: task.scheduled_time || '09:00',
        earliest_completion_time: task.earliest_completion_time || '',
      })
      setIsDataLoaded(true)
    }
  }, [task, isDataLoaded])

  // Load existing participants
  useEffect(() => {
    if (taskParticipants && !isDataLoaded) {
      const participantIds = taskParticipants.map(p => p.user_id)
      setSelectedParticipants(participantIds)
    }
  }, [taskParticipants, isDataLoaded])

  const validateForm = () => {
    if (!formData.title.trim()) {
      Alert.alert('Error', t('tasks.titleRequired') || 'Task title is required')
      return false
    }
    return true
  }

  const handleUpdateTask = async () => {
    if (!validateForm() || !task) return

    const taskUpdates: Partial<TablesInsert<'tasks'>> = {
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      category: formData.category,
      is_recurring: formData.is_recurring,
      frequency_type: formData.is_recurring ? formData.frequency_type : null,
      frequency_value: formData.is_recurring ? formData.frequency_value : 1,
      points_value: formData.points_value,
      scheduled_days: formData.is_recurring && formData.scheduled_days.length > 0 ? formData.scheduled_days : null,
      scheduled_time: formData.is_recurring ? formData.scheduled_time : null,
      earliest_completion_time: formData.earliest_completion_time.trim() || null,
    }

    try {
      // Update task details
      await updateTaskMutation.mutateAsync({
        taskId: task.id,
        updates: taskUpdates,
      })

      // Update participants
      await updateParticipantsMutation.mutateAsync({
        taskId: task.id,
        participants: selectedParticipants,
      })

      // Navigate back to task detail
      router.replace(`/tasks/${task.id}`)
    } catch (error) {
      console.error('Error updating task:', error)
    }
  }

  const toggleParticipant = (userId: string) => {
    setSelectedParticipants(prev => 
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const toggleDay = (dayValue: number) => {
    setFormData(prev => ({
      ...prev,
      scheduled_days: prev.scheduled_days.includes(dayValue)
        ? prev.scheduled_days.filter(d => d !== dayValue)
        : [...prev.scheduled_days, dayValue].sort()
    }))
  }

  const isLoading = updateTaskMutation.isPending || updateParticipantsMutation.isPending

  if (taskLoading || participantsLoading || !isDataLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading task...</Text>
      </View>
    )
  }

  if (!task) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Task not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // Check if user can edit this task
  const canEdit = task.created_by === user?.id || profile?.role === 'admin'
  if (!canEdit) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>You don't have permission to edit this task</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#FFF8F0', '#FFE8D6']}
        style={styles.gradient}
      />
      
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>← Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Edit Task</Text>
          <Text style={styles.subtitle}>Modify task details and settings</Text>
        </View>

        {/* Task Details Form */}
        <View style={styles.formContainer}>
          {/* Task Title */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Task Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Take out trash, Clean bathroom"
              value={formData.title}
              onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
              maxLength={100}
            />
          </View>

          {/* Task Description */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Add any details or instructions..."
              value={formData.description}
              onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
              multiline
              numberOfLines={3}
              maxLength={500}
            />
          </View>

          {/* Task Category */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryContainer}>
              {TASK_CATEGORIES.map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryButton,
                    formData.category === category && styles.categoryButtonActive
                  ]}
                  onPress={() => setFormData(prev => ({ ...prev, category }))}
                >
                  <Text style={[
                    styles.categoryButtonText,
                    formData.category === category && styles.categoryButtonTextActive
                  ]}>
                    {t(`categories.${category}`) || category}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Recurring Toggle */}
          <View style={styles.inputGroup}>
            <View style={styles.switchContainer}>
              <Text style={styles.label}>Recurring Task</Text>
              <Switch
                value={formData.is_recurring}
                onValueChange={(value) => setFormData(prev => ({ ...prev, is_recurring: value }))}
                trackColor={{ false: '#E2E8F0', true: '#FF6B4D' }}
                thumbColor={formData.is_recurring ? '#FFFFFF' : '#9CA3AF'}
              />
            </View>
            <Text style={styles.helpText}>
              {formData.is_recurring 
                ? 'This task will repeat automatically' 
                : 'This task will only need to be done once'
              }
            </Text>
          </View>

          {/* Frequency Settings (only for recurring tasks) */}
          {formData.is_recurring && (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Frequency</Text>
                <View style={styles.frequencyContainer}>
                  {FREQUENCY_TYPES.map((freq) => (
                    <TouchableOpacity
                      key={freq.value}
                      style={[
                        styles.frequencyButton,
                        formData.frequency_type === freq.value && styles.frequencyButtonActive
                      ]}
                      onPress={() => setFormData(prev => ({ ...prev, frequency_type: freq.value as any }))}
                    >
                      <Text style={[
                        styles.frequencyButtonText,
                        formData.frequency_type === freq.value && styles.frequencyButtonTextActive
                      ]}>
                        {freq.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Repeat Every</Text>
                <View style={styles.repeatContainer}>
                  <TextInput
                    style={styles.repeatInput}
                    value={formData.frequency_value.toString()}
                    onChangeText={(text) => {
                      const value = parseInt(text) || 1
                      setFormData(prev => ({ ...prev, frequency_value: Math.max(1, value) }))
                    }}
                    keyboardType="numeric"
                    maxLength={2}
                  />
                  <Text style={styles.repeatLabel}>
                    {formData.frequency_type === 'daily' ? 'day(s)' :
                     formData.frequency_type === 'weekly' ? 'week(s)' : 
                     'month(s)'}
                  </Text>
                </View>
              </View>

              {/* Scheduled Days (only for weekly recurring tasks) */}
              {formData.frequency_type === 'weekly' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Scheduled Days</Text>
                  <View style={styles.scheduledDaysContainer}>
                    {DAYS_OF_WEEK.map((day) => (
                      <TouchableOpacity
                        key={day.value}
                        style={[
                          styles.scheduledDayButton,
                          formData.scheduled_days.includes(day.value) && styles.scheduledDayButtonActive
                        ]}
                        onPress={() => toggleDay(day.value)}
                      >
                        <Text style={[
                          styles.scheduledDayButtonText,
                          formData.scheduled_days.includes(day.value) && styles.scheduledDayButtonTextActive
                        ]}>
                          {day.short}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Scheduled Time (for all recurring tasks) */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Scheduled Time</Text>
                <Text style={styles.helpText}>
                  {formData.frequency_type === 'daily' ? 'Daily at this time' :
                   formData.frequency_type === 'weekly' ? 'Weekly on selected days at this time' :
                   'Monthly at this time'}
                </Text>
                <View style={styles.scheduledTimeContainer}>
                  <TextInput
                    style={styles.scheduledTimeInput}
                    value={formData.scheduled_time}
                    onChangeText={(text) => {
                      // Basic time format validation
                      if (text.length <= 5) {
                        setFormData(prev => ({ ...prev, scheduled_time: text }))
                      }
                    }}
                    keyboardType="numeric"
                    maxLength={5}
                    placeholder="HH:MM"
                  />
                  <Text style={styles.scheduledTimeLabel}>
                    24-hour format (e.g., 09:00, 14:30)
                  </Text>
                </View>
              </View>
            </>
          )}

          {/* Points Value */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Points Value</Text>
            <View style={styles.pointsContainer}>
              {[5, 10, 15, 20, 25].map((points) => (
                <TouchableOpacity
                  key={points}
                  style={[
                    styles.pointsButton,
                    formData.points_value === points && styles.pointsButtonActive
                  ]}
                  onPress={() => setFormData(prev => ({ ...prev, points_value: points }))}
                >
                  <Text style={[
                    styles.pointsButtonText,
                    formData.points_value === points && styles.pointsButtonTextActive
                  ]}>
                    {points}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Earliest Completion Time */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Earliest Completion Time (Optional)</Text>
            <Text style={styles.helpText}>
              Set the earliest time users can mark this task as completed. Leave blank to allow completion anytime.
            </Text>
            <View style={styles.scheduledTimeContainer}>
              <TextInput
                style={styles.scheduledTimeInput}
                value={formData.earliest_completion_time}
                onChangeText={(text) => {
                  if (text.length <= 5) {
                    setFormData(prev => ({ ...prev, earliest_completion_time: text }))
                  }
                }}
                keyboardType="numeric"
                maxLength={5}
                placeholder="HH:MM (e.g., 17:00)"
              />
              <Text style={styles.scheduledTimeLabel}>
                24-hour format. Users can only complete after this time on the due date.
              </Text>
            </View>
          </View>

          {/* Participants Selection */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Participants {selectedParticipants.length > 0 && `(${selectedParticipants.length} selected)`}
            </Text>
            <Text style={styles.helpText}>
              Select who can be assigned this task. If none selected, only the creator will be assigned.
            </Text>
            <View style={styles.participantsContainer}>
              {householdMembers?.map((member) => (
                <TouchableOpacity
                  key={member.id}
                  style={[
                    styles.participantButton,
                    selectedParticipants.includes(member.id) && styles.participantButtonActive
                  ]}
                  onPress={() => toggleParticipant(member.id)}
                >
                  <Text style={[
                    styles.participantButtonText,
                    selectedParticipants.includes(member.id) && styles.participantButtonTextActive
                  ]}>
                    {member.display_name}
                    {member.id === user?.id && ' (You)'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.saveButton, isLoading && styles.disabledButton]}
            onPress={handleUpdateTask}
            disabled={isLoading}
          >
            <Text style={styles.saveButtonText}>
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.back()}
            disabled={isLoading}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
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
    paddingTop: 60,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
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
    alignItems: 'center',
    marginBottom: 30,
  },
  backButton: {
    alignSelf: 'flex-start',
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
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  formContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  helpText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryContainer: {
    flexDirection: 'row',
  },
  categoryButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  categoryButtonActive: {
    backgroundColor: '#FF6B4D',
    borderColor: '#FF6B4D',
  },
  categoryButtonText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  categoryButtonTextActive: {
    color: '#FFFFFF',
  },
  frequencyContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  frequencyButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  frequencyButtonActive: {
    backgroundColor: '#FF6B4D',
    borderColor: '#FF6B4D',
  },
  frequencyButtonText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  frequencyButtonTextActive: {
    color: '#FFFFFF',
  },
  repeatContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  repeatInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    width: 60,
    textAlign: 'center',
  },
  repeatLabel: {
    fontSize: 16,
    color: '#6B7280',
  },
  scheduledDaysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  scheduledDayButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  scheduledDayButtonActive: {
    backgroundColor: '#FF6B4D',
    borderColor: '#FF6B4D',
  },
  scheduledDayButtonText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  scheduledDayButtonTextActive: {
    color: '#FFFFFF',
  },
  scheduledTimeContainer: {
    gap: 8,
  },
  scheduledTimeInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    width: 100,
  },
  scheduledTimeLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  pointsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  pointsButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pointsButtonActive: {
    backgroundColor: '#FF6B4D',
    borderColor: '#FF6B4D',
  },
  pointsButtonText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  pointsButtonTextActive: {
    color: '#FFFFFF',
  },
  participantsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  participantButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  participantButtonActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  participantButtonText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  participantButtonTextActive: {
    color: '#FFFFFF',
  },
  buttonContainer: {
    gap: 12,
  },
  saveButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#6B7280',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
}) 
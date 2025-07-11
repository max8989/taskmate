import { LinearGradient } from 'expo-linear-gradient'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Modal, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native'
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

// Generate hours and minutes for time picker
const generateHours = () => Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'))
const generateMinutes = () => Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'))

interface TimePickerModalProps {
  visible: boolean
  initialTime: string
  onClose: () => void
  onConfirm: (time: string) => void
  title: string
}

function TimePickerModal({ visible, initialTime, onClose, onConfirm, title }: TimePickerModalProps) {
  const [selectedHour, setSelectedHour] = useState(initialTime.split(':')[0] || '09')
  const [selectedMinute, setSelectedMinute] = useState(initialTime.split(':')[1] || '00')
  
  const hours = generateHours()
  const minutes = generateMinutes()

  const handleConfirm = () => {
    onConfirm(`${selectedHour}:${selectedMinute}`)
    onClose()
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{title}</Text>
          
          <View style={styles.timePickerContainer}>
            <View style={styles.timeColumn}>
              <Text style={styles.timeColumnLabel}>Hour</Text>
              <ScrollView style={styles.timeScrollView} showsVerticalScrollIndicator={false}>
                {hours.map((hour) => (
                  <TouchableOpacity
                    key={hour}
                    style={[
                      styles.timeOption,
                      selectedHour === hour && styles.timeOptionSelected
                    ]}
                    onPress={() => setSelectedHour(hour)}
                  >
                    <Text style={[
                      styles.timeOptionText,
                      selectedHour === hour && styles.timeOptionTextSelected
                    ]}>
                      {hour}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            
            <Text style={styles.timeSeparator}>:</Text>
            
            <View style={styles.timeColumn}>
              <Text style={styles.timeColumnLabel}>Minute</Text>
              <ScrollView style={styles.timeScrollView} showsVerticalScrollIndicator={false}>
                {minutes.map((minute) => (
                  <TouchableOpacity
                    key={minute}
                    style={[
                      styles.timeOption,
                      selectedMinute === minute && styles.timeOptionSelected
                    ]}
                    onPress={() => setSelectedMinute(minute)}
                  >
                    <Text style={[
                      styles.timeOptionText,
                      selectedMinute === minute && styles.timeOptionTextSelected
                    ]}>
                      {minute}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
          
          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.modalCancelButton} onPress={onClose}>
              <Text style={styles.modalCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalConfirmButton} onPress={handleConfirm}>
              <Text style={styles.modalConfirmButtonText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

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
    notify_on_incomplete: false,
  })
  
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([])
  const [isDataLoaded, setIsDataLoaded] = useState(false)
  const [timePickerVisible, setTimePickerVisible] = useState(false)
  const [earliestTimePickerVisible, setEarliestTimePickerVisible] = useState(false)
  
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
        notify_on_incomplete: task.notify_on_incomplete ?? false,
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
      notify_on_incomplete: formData.notify_on_incomplete,
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
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading task...</Text>
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

  // Check if user can edit this task
  const canEdit = task.created_by === user?.id || profile?.role === 'admin'
  if (!canEdit) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>You don't have permission to edit this task</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </>
    )
  }

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
                    <TouchableOpacity
                      style={styles.repeatButton}
                      onPress={() => setFormData(prev => ({ 
                        ...prev, 
                        frequency_value: Math.max(1, prev.frequency_value - 1) 
                      }))}
                    >
                      <Text style={styles.repeatButtonText}>-</Text>
                    </TouchableOpacity>
                    <View style={styles.repeatValueContainer}>
                      <Text style={styles.repeatValue}>{formData.frequency_value}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.repeatButton}
                      onPress={() => setFormData(prev => ({ 
                        ...prev, 
                        frequency_value: Math.min(99, prev.frequency_value + 1) 
                      }))}
                    >
                      <Text style={styles.repeatButtonText}>+</Text>
                    </TouchableOpacity>
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
                  <TouchableOpacity 
                    style={styles.timeButton}
                    onPress={() => setTimePickerVisible(true)}
                  >
                    <Text style={styles.timeButtonText}>
                      {formData.scheduled_time || 'Select Time'}
                    </Text>
                    <Text style={styles.timeButtonLabel}>24-hour format</Text>
                  </TouchableOpacity>
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
              <Text style={styles.label}>{t('taskCreate.earliestCompletion')}</Text>
              <Text style={styles.helpText}>
                {t('taskCreate.earliestCompletionDesc')}
              </Text>
              
              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => setEarliestTimePickerVisible(true)}
              >
                <Text style={styles.timeButtonText}>
                  {formData.earliest_completion_time || t('taskCreate.selectTimeOptional')}
                </Text>
                <Text style={styles.timeButtonLabel}>
                  {t('taskCreate.selectTimeDesc')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Notify on Incomplete Toggle */}
            <View style={styles.inputGroup}>
              <View style={styles.switchContainer}>
                <Text style={styles.label}>{t('taskCreate.notifyIncomplete')}</Text>
                <Switch
                  value={formData.notify_on_incomplete}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, notify_on_incomplete: value }))}
                  trackColor={{ false: '#E2E8F0', true: '#FF6B4D' }}
                  thumbColor={formData.notify_on_incomplete ? '#FFFFFF' : '#9CA3AF'}
                />
              </View>
              <Text style={styles.helpText}>
                {t('taskCreate.notifyIncompleteDesc')}
              </Text>
            </View>

            {/* Participants Selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                {t('taskCreate.participants')} {selectedParticipants.length > 0 && `(${selectedParticipants.length} selected)`}
              </Text>
              <Text style={styles.helpText}>
                {t('taskCreate.participantsDesc')}
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
                      {member.id === user?.id && ` (${t('taskCreate.you')})`}
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

        {/* Time Picker Modals */}
        <TimePickerModal
          visible={timePickerVisible}
          initialTime={formData.scheduled_time}
          onClose={() => setTimePickerVisible(false)}
          onConfirm={(time) => setFormData(prev => ({ ...prev, scheduled_time: time }))}
          title="Select Scheduled Time"
        />
        
        <TimePickerModal
          visible={earliestTimePickerVisible}
          initialTime={formData.earliest_completion_time || '00:00'}
          onClose={() => setEarliestTimePickerVisible(false)}
          onConfirm={(time) => setFormData(prev => ({ ...prev, earliest_completion_time: time }))}
          title="Select Earliest Completion Time"
        />
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
    flexWrap: 'wrap',
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
  repeatButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
  },
  repeatButtonText: {
    fontSize: 20,
    color: '#FF6B4D',
    fontWeight: 'bold',
  },
  repeatValueContainer: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
  },
  repeatValue: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '600',
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
  timeButton: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  timeButtonText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  timeButtonLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    textAlign: 'center',
    flexWrap: 'wrap',
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
    flexShrink: 1,
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 20,
  },
  timePickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  timeColumn: {
    flex: 1,
    alignItems: 'center',
  },
  timeColumnLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  timeScrollView: {
    height: 200,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
  },
  timeOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  timeOptionSelected: {
    backgroundColor: '#FF6B4D',
  },
  timeOptionText: {
    fontSize: 16,
    color: '#374151',
  },
  timeOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  timeSeparator: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#374151',
    marginHorizontal: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  modalCancelButtonText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#FF6B4D',
    alignItems: 'center',
  },
  modalConfirmButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
}) 
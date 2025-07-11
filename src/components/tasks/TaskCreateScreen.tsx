import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useAuth } from '../../../hooks/useAuth'
import { useHouseholdMembers } from '../../hooks/useHouseholdQuery'
import { useCreateTask } from '../../hooks/useTaskQuery'
import { TablesInsert } from '../../lib/supabase'

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

export function TaskCreateScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { user, profile } = useAuth()
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
  })
  
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([])
  
  const createTaskMutation = useCreateTask()

  const validateForm = () => {
    if (!formData.title.trim()) {
      Alert.alert('Error', t('tasks.titleRequired') || 'Task title is required')
      return false
    }
    if (!profile?.household_id) {
      Alert.alert('Error', 'No household found')
      return false
    }
    return true
  }

  const handleCreateTask = async () => {
    if (!validateForm()) return

    const taskData: TablesInsert<'tasks'> = {
      household_id: profile!.household_id!,
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      category: formData.category,
      is_recurring: formData.is_recurring,
      frequency_type: formData.is_recurring ? formData.frequency_type : null,
      frequency_value: formData.is_recurring ? formData.frequency_value : 1,
      points_value: formData.points_value,
      created_by: user?.id || null,
      scheduled_days: formData.is_recurring && formData.scheduled_days.length > 0 ? formData.scheduled_days : null,
      scheduled_time: formData.is_recurring ? formData.scheduled_time : null,
    }

    createTaskMutation.mutate({
      taskData,
      participants: selectedParticipants,
    })
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

  const isLoading = createTaskMutation.isPending

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#FFF8F0', '#FFE8D6']}
        style={styles.gradient}
      />
      
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('tasks.create')}</Text>
          <Text style={styles.subtitle}>Create a new task for your household</Text>
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

              {/* Scheduled Days (only for recurring tasks) */}
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
                       const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
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

          {/* Participants Selection */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Participants {selectedParticipants.length > 0 && `(${selectedParticipants.length} selected)`}
            </Text>
            <Text style={styles.helpText}>
              Select who can be assigned this task. If none selected, only you will be assigned.
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
            style={[styles.createButton, isLoading && styles.disabledButton]}
            onPress={handleCreateTask}
            disabled={isLoading}
          >
            <Text style={styles.createButtonText}>
              {isLoading ? 'Creating...' : 'Create Task'}
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
  header: {
    alignItems: 'center',
    marginBottom: 30,
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
    minWidth: 45,
    alignItems: 'center',
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
    marginTop: 8,
  },
  participantButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  participantButtonActive: {
    backgroundColor: '#FF6B4D',
    borderColor: '#FF6B4D',
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
  createButton: {
    backgroundColor: '#FF6B4D',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#FF6B4D',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  scheduledDaysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  scheduledDayButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scheduledTimeInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    width: 80,
    textAlign: 'center',
  },
  scheduledTimeLabel: {
    fontSize: 16,
    color: '#6B7280',
  },
})
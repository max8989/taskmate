import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useAuth } from '../../../hooks/useAuth'
import { useCreateHousehold, useJoinHousehold } from '../../hooks/useHouseholdQuery'

export function HouseholdScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { user } = useAuth()
  const [householdName, setHouseholdName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose')

  const createHouseholdMutation = useCreateHousehold()
  const joinHouseholdMutation = useJoinHousehold()

  const handleCreateHousehold = async () => {
    if (!householdName.trim()) {
      Alert.alert('Error', 'Please enter a household name')
      return
    }

    if (!user?.id) {
      Alert.alert('Error', 'User not found')
      return
    }

    createHouseholdMutation.mutate({
      name: householdName,
      userId: user.id,
    })
  }

  const handleJoinHousehold = async () => {
    if (!inviteCode.trim()) {
      Alert.alert('Error', 'Please enter an invite code')
      return
    }

    if (!user?.id) {
      Alert.alert('Error', 'User not found')
      return
    }

    joinHouseholdMutation.mutate({
      inviteCode,
      userId: user.id,
    })
  }

  const isLoading = createHouseholdMutation.isPending || joinHouseholdMutation.isPending

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#FFF8F0', '#FFE8D6']}
        style={styles.gradient}
      />
      
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logo}>🏠</Text>
          </View>
          <Text style={styles.title}>Setup Your Household</Text>
          <Text style={styles.subtitle}>
            {mode === 'choose' && 'Create a new household or join an existing one'}
            {mode === 'create' && 'Create a new household for your roommates'}
            {mode === 'join' && 'Join an existing household with an invite code'}
          </Text>
        </View>

        {/* Mode Selection */}
        {mode === 'choose' && (
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setMode('create')}
              disabled={isLoading}
            >
              <Text style={styles.primaryButtonText}>Create Household</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setMode('join')}
              disabled={isLoading}
            >
              <Text style={styles.secondaryButtonText}>Join Household</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Create Household */}
        {mode === 'create' && (
          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Household Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Awesome Apartment"
                value={householdName}
                onChangeText={setHouseholdName}
                autoCapitalize="words"
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, isLoading && styles.disabledButton]}
              onPress={handleCreateHousehold}
              disabled={isLoading}
            >
              <Text style={styles.primaryButtonText}>
                {createHouseholdMutation.isPending ? 'Creating...' : 'Create Household'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setMode('choose')}
              disabled={isLoading}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Join Household */}
        {mode === 'join' && (
          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Invite Code</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., ABC123"
                value={inviteCode}
                onChangeText={setInviteCode}
                autoCapitalize="characters"
                maxLength={6}
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, isLoading && styles.disabledButton]}
              onPress={handleJoinHousehold}
              disabled={isLoading}
            >
              <Text style={styles.primaryButtonText}>
                {joinHouseholdMutation.isPending ? 'Joining...' : 'Join Household'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setMode('choose')}
              disabled={isLoading}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  content: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 80,
    height: 80,
    backgroundColor: '#FFFFFF',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  logo: {
    fontSize: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2D3748',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 22,
  },
  buttonContainer: {
    gap: 16,
  },
  formContainer: {
    gap: 24,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryButton: {
    backgroundColor: '#FF6B4D',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#FF6B4D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF6B4D',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  secondaryButtonText: {
    color: '#FF6B4D',
    fontSize: 16,
    fontWeight: 'bold',
  },
  backButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#718096',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
}) 
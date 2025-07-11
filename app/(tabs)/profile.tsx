import React from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useAuth } from '../../hooks/useAuth'
import { useLogout } from '../../src/hooks/useAuthQuery'

export default function ProfileScreen() {
  const { t } = useTranslation()
  const { user, session, profile } = useAuth()
  const logoutMutation = useLogout()

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => {
            logoutMutation.mutate()
          },
        },
      ],
    )
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatar}>👤</Text>
        </View>
        <Text style={styles.displayName}>
          {profile?.display_name || user?.user_metadata?.display_name || 'User'}
        </Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        
        <View style={styles.menuItem}>
          <Text style={styles.menuItemText}>Display Name</Text>
          <Text style={styles.menuItemValue}>
            {profile?.display_name || user?.user_metadata?.display_name || 'Not set'}
          </Text>
        </View>
        
        <View style={styles.menuItem}>
          <Text style={styles.menuItemText}>Email</Text>
          <Text style={styles.menuItemValue}>{user?.email}</Text>
        </View>
        
        <View style={styles.menuItem}>
          <Text style={styles.menuItemText}>Role</Text>
          <Text style={styles.menuItemValue}>
            {profile?.role === 'admin' ? '👑 Admin' : '👤 Member'}
          </Text>
        </View>
        
        <View style={styles.menuItem}>
          <Text style={styles.menuItemText}>Member Since</Text>
          <Text style={styles.menuItemValue}>
            {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Stats</Text>
        
        <View style={styles.menuItem}>
          <Text style={styles.menuItemText}>Current Streak</Text>
          <Text style={styles.menuItemValue}>{profile?.current_streak || 0} days</Text>
        </View>
        
        <View style={styles.menuItem}>
          <Text style={styles.menuItemText}>Total Points</Text>
          <Text style={styles.menuItemValue}>{profile?.total_points || 0} pts</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Settings</Text>
        
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuItemText}>Language</Text>
          <Text style={styles.menuItemValue}>English</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuItemText}>Notifications</Text>
          <Text style={styles.menuItemValue}>Enabled</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Household</Text>
        
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuItemText}>Household Info</Text>
          <Text style={styles.menuItemValue}>View Details</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuItemText}>Invite Members</Text>
          <Text style={styles.menuItemValue}>Share Code</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.logoutSection}>
        <TouchableOpacity 
          style={[styles.logoutButton, logoutMutation.isPending && styles.disabledButton]}
          onPress={handleLogout}
          disabled={logoutMutation.isPending}
        >
          <Text style={styles.logoutButtonText}>
            {logoutMutation.isPending ? 'Logging out...' : 'Logout'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.debugSection}>
        <Text style={styles.debugTitle}>Debug Info</Text>
        <Text style={styles.debugText}>User ID: {user?.id}</Text>
        <Text style={styles.debugText}>Session: {session ? 'Active' : 'None'}</Text>
        <Text style={styles.debugText}>Email: {user?.email}</Text>
        <Text style={styles.debugText}>Household ID: {profile?.household_id || 'None'}</Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
  header: {
    alignItems: 'center',
    padding: 24,
    paddingTop: 60,
    backgroundColor: '#FFFFFF',
    marginBottom: 24,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    backgroundColor: '#FF6B4D',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatar: {
    fontSize: 32,
    color: '#FFFFFF',
  },
  displayName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2D3748',
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    color: '#4A5568',
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 24,
    marginBottom: 16,
    borderRadius: 12,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3748',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F7FAFC',
  },
  menuItemText: {
    fontSize: 16,
    color: '#2D3748',
  },
  menuItemValue: {
    fontSize: 14,
    color: '#4A5568',
  },
  logoutSection: {
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  logoutButton: {
    backgroundColor: '#E53E3E',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  debugSection: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#718096',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    color: '#A0AEC0',
    fontFamily: 'monospace',
  },
}) 
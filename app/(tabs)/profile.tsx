import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useAuth } from '../../hooks/useAuth'
import { useLanguage } from '../../hooks/useLanguage'
import { useLogout } from '../../src/hooks/useAuthQuery'
import { formatProfileDate } from '../../src/lib/dateUtils'

export default function ProfileScreen() {
  const { t } = useTranslation()
  const { user, session, profile } = useAuth()
  const { currentLanguage, currentLanguageDisplay, supportedLanguages, changeLanguage } = useLanguage()
  const logoutMutation = useLogout()
  const [showLanguageModal, setShowLanguageModal] = useState(false)

  const handleLogout = async () => {
    Alert.alert(
      t('profile.logout'),
      t('profile.confirmLeave'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('profile.logout'),
          style: 'destructive',
          onPress: () => {
            logoutMutation.mutate()
          },
        },
      ],
    )
  }

  const handleLanguageSelect = async (languageCode: string) => {
    await changeLanguage(languageCode as 'en' | 'fr')
    setShowLanguageModal(false)
    Alert.alert(
      t('language.select'),
      t('language.changeSuccess')
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
        <Text style={styles.sectionTitle}>{t('ui.account')}</Text>
        
        <View style={styles.menuItem}>
          <Text style={styles.menuItemText}>{t('ui.displayName')}</Text>
          <Text style={styles.menuItemValue}>
            {profile?.display_name || user?.user_metadata?.display_name || t('ui.notSet')}
          </Text>
        </View>
        
        <View style={styles.menuItem}>
          <Text style={styles.menuItemText}>{t('ui.email')}</Text>
          <Text style={styles.menuItemValue}>{user?.email}</Text>
        </View>
        
        <View style={styles.menuItem}>
          <Text style={styles.menuItemText}>{t('ui.role')}</Text>
          <Text style={styles.menuItemValue}>
            {profile?.role === 'admin' ? `👑 ${t('profile.adminBadge')}` : `👤 ${t('profile.memberBadge')}`}
          </Text>
        </View>
        
        <View style={styles.menuItem}>
          <Text style={styles.menuItemText}>{t('ui.memberSince')}</Text>
          <Text style={styles.menuItemValue}>
            {user?.created_at ? formatProfileDate(user.created_at) : t('ui.unknown')}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('ui.stats')}</Text>
        
        <View style={styles.menuItem}>
          <Text style={styles.menuItemText}>{t('ui.currentStreak')}</Text>
          <Text style={styles.menuItemValue}>{profile?.current_streak || 0} {t('ui.days')}</Text>
        </View>
        
        <View style={styles.menuItem}>
          <Text style={styles.menuItemText}>{t('ui.totalPoints')}</Text>
          <Text style={styles.menuItemValue}>{profile?.total_points || 0} {t('ui.pts')}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('ui.settings')}</Text>
        
        <TouchableOpacity style={styles.menuItem} onPress={() => setShowLanguageModal(true)}>
          <Text style={styles.menuItemText}>{t('ui.language')}</Text>
          <Text style={styles.menuItemValue}>{currentLanguageDisplay}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuItemText}>{t('ui.notifications')}</Text>
          <Text style={styles.menuItemValue}>{t('ui.enabled')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('ui.household')}</Text>
        
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuItemText}>{t('ui.householdInfo')}</Text>
          <Text style={styles.menuItemValue}>{t('ui.viewDetails')}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuItemText}>{t('ui.inviteMembers')}</Text>
          <Text style={styles.menuItemValue}>{t('ui.shareCode')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.logoutSection}>
        <TouchableOpacity 
          style={[styles.logoutButton, logoutMutation.isPending && styles.disabledButton]}
          onPress={handleLogout}
          disabled={logoutMutation.isPending}
        >
          <Text style={styles.logoutButtonText}>
            {logoutMutation.isPending ? t('common.loading') : t('profile.logout')}
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

      {/* Language Selection Modal */}
      <Modal
        visible={showLanguageModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('language.select')}</Text>
            
            {supportedLanguages.map((language) => (
              <TouchableOpacity
                key={language.code}
                style={styles.languageOption}
                onPress={() => handleLanguageSelect(language.code)}
              >
                <Text style={styles.languageOptionText}>{language.name}</Text>
                {language.code === currentLanguage && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
            
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowLanguageModal(false)}
            >
              <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D3748',
    marginBottom: 20,
  },
  languageOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F7FAFC',
  },
  languageOptionText: {
    fontSize: 16,
    color: '#2D3748',
  },
  checkmark: {
    fontSize: 18,
    color: '#4299E1',
  },
  modalCancelButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#E53E3E',
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
}) 
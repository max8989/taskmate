import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

export function WelcomeScreen() {
  const { t } = useTranslation()
  const router = useRouter()

  return (
    <View style={styles.container}>
      {/* Gradient Background */}
      <LinearGradient
        colors={['#FFF8F0', '#FFE8D6']}
        style={styles.gradient}
      />
      
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header Section */}
        <View style={styles.headerSection}>
          {/* Logo/Icon Area */}
          <View style={styles.logoContainer}>
            <Text style={styles.logo}>🏠</Text>
          </View>

          {/* Welcome Text */}
          <View style={styles.welcomeTextContainer}>
            <Text style={styles.title}>
              {t('auth.welcome')}
            </Text>
            <Text style={styles.subtitle}>
              {t('auth.subtitle')}
            </Text>
          </View>

          {/* Feature Cards */}
          <View style={styles.featuresContainer}>
            {/* Task Management Card */}
            <View style={styles.featureCard}>
              <View style={[styles.featureIcon, { backgroundColor: '#8B7FFF' }]}>
                <Text style={styles.featureEmoji}>📝</Text>
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Task Management</Text>
                <Text style={styles.featureDescription}>Create and assign household tasks</Text>
              </View>
            </View>

            {/* Rotation Card */}
            <View style={styles.featureCard}>
              <View style={[styles.featureIcon, { backgroundColor: '#FFD93D' }]}>
                <Text style={[styles.featureEmoji, { color: '#2D3748' }]}>🔄</Text>
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Auto Rotation</Text>
                <Text style={styles.featureDescription}>Fair task distribution</Text>
              </View>
            </View>

            {/* Gamification Card */}
            <View style={styles.featureCard}>
              <View style={[styles.featureIcon, { backgroundColor: '#FF6B4D' }]}>
                <Text style={styles.featureEmoji}>🏆</Text>
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Gamification</Text>
                <Text style={styles.featureDescription}>Points, streaks & leaderboards</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Bottom Action Buttons */}
        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/auth/signup')}
          >
            <Text style={styles.primaryButtonText}>
              {t('auth.signup')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/auth/login')}
          >
            <Text style={styles.secondaryButtonText}>
              {t('auth.login')}
            </Text>
          </TouchableOpacity>
        </View>
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
    height: '60%',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  headerSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    width: 120,
    height: 120,
    backgroundColor: '#FF6B4D',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  logo: {
    fontSize: 48,
    color: 'white',
    fontWeight: 'bold',
  },
  welcomeTextContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2D3748',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 18,
    color: '#4A5568',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 280,
  },
  featuresContainer: {
    gap: 16,
    width: '100%',
    maxWidth: 300,
    marginBottom: 32,
  },
  featureCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featureEmoji: {
    fontSize: 20,
    color: 'white',
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#4A5568',
  },
  buttonsContainer: {
    paddingBottom: 24,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#FF6B4D',
    borderRadius: 16,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#FF6B4D',
    borderRadius: 16,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#FF6B4D',
    fontSize: 18,
    fontWeight: '600',
  },
}) 
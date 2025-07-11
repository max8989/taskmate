import React from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

export default function TasksScreen() {
  const { t } = useTranslation()

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tasks</Text>
        <Text style={styles.subtitle}>Manage your household tasks</Text>
      </View>

      <View style={styles.actionContainer}>
        <TouchableOpacity style={styles.createButton}>
          <Text style={styles.createButtonText}>+ Create Task</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Today's Tasks</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No tasks for today</Text>
          <Text style={styles.emptySubtext}>All caught up! 🎉</Text>
        </View>
      </View>

      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Upcoming Tasks</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No upcoming tasks</Text>
          <Text style={styles.emptySubtext}>Create recurring tasks to see them here</Text>
        </View>
      </View>

      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Completed Tasks</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No completed tasks</Text>
          <Text style={styles.emptySubtext}>Complete tasks to build your streak!</Text>
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
})

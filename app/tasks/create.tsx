import { Stack } from 'expo-router'
import React from 'react'
import { TaskCreateScreen } from '../../src/components/tasks/TaskCreateScreen'

export default function TaskCreateRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <TaskCreateScreen />
    </>
  )
}
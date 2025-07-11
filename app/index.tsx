import { Redirect } from 'expo-router'

export default function Index() {
  // Simply redirect to tabs - the _layout.tsx handles auth state
  return <Redirect href="/(tabs)" />
} 
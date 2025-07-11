import { Redirect } from 'expo-router'
import { useAuth } from '../hooks/useAuth'

export default function Index() {
  const { isLoading, isAuthenticated, hasHousehold } = useAuth()
  
  // Show loading state while checking authentication
  if (isLoading) {
    return null // Let the splash screen handle loading state
  }
  
  // Redirect based on authentication state
  if (!isAuthenticated) {
    return <Redirect href="/auth/welcome" />
  }
  
  if (!hasHousehold) {
    return <Redirect href="/auth/household" />
  }
  
  // User is authenticated and has household - go to tabs
  return <Redirect href="/(tabs)" />
} 
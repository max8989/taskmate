import { TamaguiProvider } from '@tamagui/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useFonts } from 'expo-font'
import { SplashScreen } from 'expo-router'
import React, { useEffect } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { useAuth } from '../hooks/useAuth'
import '../src/lib/i18n'
import tamaguiConfig from '../tamagui.config'

// Prevent the splash screen from auto-hiding before asset loading is complete
SplashScreen.preventAutoHideAsync()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
})

function AppContent() {
  const { isLoading, isAuthenticated, hasHousehold } = useAuth()

  const [fontsLoaded] = useFonts({
    Inter: require('@tamagui/font-inter/otf/Inter-Medium.otf'),
    InterBold: require('@tamagui/font-inter/otf/Inter-Bold.otf'),
  })

  useEffect(() => {
    if (fontsLoaded && !isLoading) {
      SplashScreen.hideAsync()
    }
  }, [fontsLoaded, isLoading])

  if (!fontsLoaded || isLoading) {
    return null
  }

  console.log('Render state:', { 
    isAuthenticated, 
    hasHousehold, 
    isLoading 
  })

  // Determine which layout to show
  if (!isAuthenticated) {
    console.log('Rendering AuthLayout - not authenticated')
    return <AuthLayout />
  }

  if (!hasHousehold) {
    console.log('Rendering HouseholdSetupLayout - authenticated but no household')
    return <HouseholdSetupLayout />
  }

  console.log('Rendering AuthenticatedLayout - authenticated with household')
  return <AuthenticatedLayout />
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <TamaguiProvider config={tamaguiConfig}>
        <SafeAreaProvider>
          <AppContent />
        </SafeAreaProvider>
      </TamaguiProvider>
    </QueryClientProvider>
  )
}

function AuthenticatedLayout() {
  const Stack = require('expo-router').Stack
  return (
    <Stack>
      <Stack.Screen 
        name="(tabs)" 
        options={{ headerShown: false }} 
      />
    </Stack>
  )
}

function HouseholdSetupLayout() {
  const Stack = require('expo-router').Stack
  return (
    <Stack>
      <Stack.Screen 
        name="auth/household" 
        options={{ headerShown: false }} 
      />
    </Stack>
  )
}

function AuthLayout() {
  const Stack = require('expo-router').Stack
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
        animationTypeForReplace: 'push',
      }}
    >
      <Stack.Screen 
        name="auth/welcome" 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="auth/login" 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="auth/signup" 
        options={{ headerShown: false }} 
      />
    </Stack>
  )
}


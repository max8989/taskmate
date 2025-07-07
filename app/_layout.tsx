import { Session } from '@supabase/supabase-js'
import { TamaguiProvider } from '@tamagui/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useFonts } from 'expo-font'
import { SplashScreen } from 'expo-router'
import React, { useEffect, useState } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import '../src/lib/i18n'
import { supabase } from '../src/lib/supabase'
import tamaguiConfig from '../tamagui.config'

// Prevent the splash screen from auto-hiding before asset loading is complete
SplashScreen.preventAutoHideAsync()

const queryClient = new QueryClient()

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const [fontsLoaded] = useFonts({
    Inter: require('@tamagui/font-inter/otf/Inter-Medium.otf'),
    InterBold: require('@tamagui/font-inter/otf/Inter-Bold.otf'),
  })

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setIsLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (fontsLoaded && !isLoading) {
      SplashScreen.hideAsync()
    }
  }, [fontsLoaded, isLoading])

  if (!fontsLoaded || isLoading) {
    return null
  }

  return (
    <TamaguiProvider config={tamaguiConfig}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          {session ? (
            // User is authenticated - show main app
            <AuthenticatedLayout />
          ) : (
            // User is not authenticated - show auth screens
            <AuthLayout />
          )}
        </SafeAreaProvider>
      </QueryClientProvider>
    </TamaguiProvider>
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

function AuthLayout() {
  const Stack = require('expo-router').Stack
  return (
    <Stack>
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
      <Stack.Screen 
        name="auth/household" 
        options={{ headerShown: false }} 
      />
    </Stack>
  )
}

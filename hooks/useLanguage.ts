import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Localization from 'expo-localization'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

const LANGUAGE_STORAGE_KEY = 'userLanguage'

type SupportedLanguage = 'en' | 'fr'

export function useLanguage() {
  const { t, i18n: i18nInstance } = useTranslation()
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>(i18nInstance.language as SupportedLanguage)

  // Get the display name for the current language
  const getCurrentLanguageDisplay = useCallback(() => {
    switch (currentLanguage) {
      case 'fr':
        return t('language.french')
      case 'en':
      default:
        return t('language.english')
    }
  }, [currentLanguage, t])

  // Get device locale
  const getDeviceLanguage = useCallback((): SupportedLanguage => {
    const deviceLocale = Localization.getLocales()[0]?.languageCode || 'en'
    return deviceLocale === 'fr' ? 'fr' : 'en'
  }, [])

  // Load saved language preference or use device language
  const loadLanguage = useCallback(async () => {
    try {
      const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
      if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'fr')) {
        await changeLanguage(savedLanguage)
      } else {
        // No saved preference, use device language
        const deviceLang = getDeviceLanguage()
        await changeLanguage(deviceLang)
      }
    } catch (error) {
      console.warn('Failed to load language preference:', error)
      // Fallback to device language
      const deviceLang = getDeviceLanguage()
      await changeLanguage(deviceLang)
    }
  }, [getDeviceLanguage])

  // Change language and save preference
  const changeLanguage = useCallback(async (language: SupportedLanguage) => {
    try {
      await i18nInstance.changeLanguage(language)
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language)
      setCurrentLanguage(language)
    } catch (error) {
      console.error('Failed to change language:', error)
    }
  }, [i18nInstance])

  // Toggle between English and French
  const toggleLanguage = useCallback(async () => {
    const newLanguage: SupportedLanguage = currentLanguage === 'en' ? 'fr' : 'en'
    await changeLanguage(newLanguage)
  }, [currentLanguage, changeLanguage])

  // Initialize language on mount
  useEffect(() => {
    loadLanguage()
  }, [loadLanguage])

  // Listen for language changes
  useEffect(() => {
    const handleLanguageChange = (language: string) => {
      setCurrentLanguage(language as SupportedLanguage)
    }

    i18nInstance.on('languageChanged', handleLanguageChange)
    return () => {
      i18nInstance.off('languageChanged', handleLanguageChange)
    }
  }, [i18nInstance])

  return {
    currentLanguage,
    currentLanguageDisplay: getCurrentLanguageDisplay(),
    changeLanguage,
    toggleLanguage,
    isEnglish: currentLanguage === 'en',
    isFrench: currentLanguage === 'fr',
    supportedLanguages: [
      { code: 'en', name: t('language.english') },
      { code: 'fr', name: t('language.french') }
    ] as Array<{ code: SupportedLanguage; name: string }>
  }
} 
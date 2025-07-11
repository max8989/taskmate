import { format } from 'date-fns'
import { enUS, fr } from 'date-fns/locale'
import i18n from './i18n'

/**
 * Get the appropriate date-fns locale based on current language
 */
export function getDateLocale() {
  const currentLang = i18n.language
  switch (currentLang) {
    case 'fr':
      return fr
    case 'en':
    default:
      return enUS
  }
}

/**
 * Format a date using the current language locale
 */
export function formatDate(date: Date | string, formatString: string = 'PP'): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  const locale = getDateLocale()
  
  return format(dateObj, formatString, { locale })
}

/**
 * Format a date for display in the profile (short format)
 */
export function formatProfileDate(date: Date | string): string {
  return formatDate(date, 'PP') // Medium date format
}

/**
 * Format a date for task due dates
 */
export function formatTaskDate(date: Date | string): string {
  const now = new Date()
  const dateObj = typeof date === 'string' ? new Date(date) : date
  
  // Check if it's today
  if (dateObj.toDateString() === now.toDateString()) {
    return i18n.t('common.today')
  }
  
  // Check if it's yesterday
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (dateObj.toDateString() === yesterday.toDateString()) {
    return i18n.t('common.yesterday')
  }
  
  // Check if it's tomorrow
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (dateObj.toDateString() === tomorrow.toDateString()) {
    return i18n.t('common.tomorrow')
  }
  
  // Otherwise, use regular formatting
  return formatDate(date, 'PP')
} 
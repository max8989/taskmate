import { config } from '@tamagui/config'
import { createTamagui } from '@tamagui/core'

// Use the default Tamagui config with our custom overrides
export const tamaguiConfig = createTamagui({
  ...config,
  tokens: {
    ...config.tokens,
    color: {
      ...config.tokens.color,
      // Primary orange/coral color from the design
      primary: '#FF6B4D',
      primaryDark: '#E5553A',
      primaryLight: '#FF8A73',
      
      // Secondary purple color
      secondary: '#8B7FFF',
      secondaryDark: '#7369E6',
      secondaryLight: '#A599FF',
      
      // Accent yellow
      accent: '#FFD93D',
      accentDark: '#E6C024',
      accentLight: '#FFE156',
      
      // Background colors
      background: '#FFF8F0',
      backgroundDark: '#F5EDE3',
      surface: '#FFFFFF',
      
      // Text colors
      textPrimary: '#2D3748',
      textSecondary: '#4A5568',
      textLight: '#718096',
      
      // Status colors
      success: '#48BB78',
      warning: '#ED8936',
      error: '#E53E3E',
    },
  },
})

export default tamaguiConfig

export type Conf = typeof tamaguiConfig

declare module '@tamagui/core' {
  interface TamaguiCustomConfig extends Conf {}
} 
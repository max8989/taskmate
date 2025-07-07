import { YStack, type YStackProps } from '@tamagui/stacks'
import React from 'react'

export interface CardProps extends YStackProps {
  variant?: 'elevated' | 'outlined' | 'ghost'
  size?: 'small' | 'medium' | 'large'
  pressable?: boolean
}

export const Card: React.FC<CardProps> = ({ 
  variant = 'elevated', 
  size = 'medium', 
  pressable = false,
  children,
  ...props 
}) => {
  const getSizeProps = () => {
    switch (size) {
      case 'small':
        return { padding: '$3', borderRadius: '$4' }
      case 'large':
        return { padding: '$5', borderRadius: '$6' }
      default:
        return { padding: '$4', borderRadius: '$5' }
    }
  }

  const getVariantProps = () => {
    switch (variant) {
      case 'outlined':
        return {
          backgroundColor: '$backgroundStrong',
          borderWidth: 1,
          borderColor: '$borderColor',
        }
      case 'ghost':
        return {
          backgroundColor: 'transparent',
        }
      default:
        return {
          backgroundColor: '$backgroundStrong',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 4,
        }
    }
  }

  const pressableProps = pressable ? {
    cursor: 'pointer' as const,
    hoverStyle: {
      scale: 1.02,
      backgroundColor: '$backgroundHover',
    },
    pressStyle: {
      scale: 0.98,
      backgroundColor: '$backgroundPress',
    },
  } : {}

  return (
    <YStack
      {...getSizeProps()}
      {...getVariantProps()}
      {...pressableProps}
      {...props}
    >
      {children}
    </YStack>
  )
} 
/**
 * Global Theme Configuration
 * Dark Gradient Futuristic Theme for IT Asset Management
 * Inspired by Vercel, Datadog, Linear, Cisco Meraki
 */

export const theme = {
  // Base surface colors
  colors: {
    surface: '#0C1024',
    surfaceLight: '#161B3A',
    surfaceLighter: '#1E293B',
    
    // Primary gradient colors
    primary: '#3B82F6',
    primaryLight: '#60A5FA',
    primaryDark: '#2563EB',
    
    // Accent colors
    accent: '#60A5FA',
    accentGlow: '#818CF8',
    
    // Text colors
    textPrimary: '#E5E7EB',
    textSecondary: '#9CA3AF',
    textMuted: '#6B7280',
    textWhite: '#FFFFFF',
    
    // Status colors with gradient variants
    success: '#10B981',
    successLight: '#34D399',
    warning: '#F59E0B',
    warningLight: '#FBBF24',
    danger: '#EF4444',
    dangerLight: '#F87171',
    info: '#06B6D4',
    infoLight: '#22D3EE',
    
    // Border and glow
    borderGlow: 'rgba(59, 130, 246, 0.1)',
    borderStrong: 'rgba(59, 130, 246, 0.3)',
    shadowGlow: 'rgba(59, 130, 246, 0.5)',
  },
  
  // Gradient definitions
  gradients: {
    primary: 'linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)',
    primaryHover: 'linear-gradient(135deg, #2563EB 0%, #4F46E5 100%)',
    surface: 'linear-gradient(180deg, #0C1024 0%, #161B3A 100%)',
    card: 'linear-gradient(135deg, rgba(12, 16, 36, 0.7) 0%, rgba(22, 27, 58, 0.7) 100%)',
    glow: 'radial-gradient(circle at 50% 0%, rgba(59, 130, 246, 0.15) 0%, transparent 70%)',
    accent: 'linear-gradient(135deg, #60A5FA 0%, #818CF8 100%)',
    success: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)',
    warning: 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)',
    danger: 'linear-gradient(135deg, #EF4444 0%, #F87171 100%)',
  },
  
  // Shadows
  shadows: {
    glow: '0 0 30px -10px rgba(59, 130, 246, 0.5)',
    glowStrong: '0 0 40px -5px rgba(59, 130, 246, 0.7)',
    card: '0 4px 20px -8px rgba(0, 0, 0, 0.5)',
    cardHover: '0 8px 30px -10px rgba(59, 130, 246, 0.4)',
    inner: 'inset 0 1px 2px rgba(0, 0, 0, 0.3)',
  },
  
  // Border radius
  radius: {
    sm: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.25rem',
    full: '9999px',
  },
  
  // Spacing
  spacing: {
    cardPadding: '1.5rem',
    cardPaddingSm: '1rem',
    cardPaddingLg: '2rem',
    gap: '1rem',
    gapSm: '0.5rem',
    gapLg: '1.5rem',
  },
  
  // Typography
  typography: {
    fontFamily: {
      sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      display: "'Poppins', 'Inter', sans-serif",
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
  
  // Animations
  animations: {
    fadeIn: 'fadeIn 0.3s ease-in-out',
    slideUp: 'slideUp 0.3s ease-out',
    slideDown: 'slideDown 0.3s ease-out',
    pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
    glow: 'glow 2s ease-in-out infinite alternate',
    shimmer: 'shimmer 2s linear infinite',
  },
  
  // Transitions
  transitions: {
    fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    base: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
    smooth: '400ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as const;

// CSS variable exports for global usage
export const cssVariables = `
:root {
  /* Colors */
  --bg-surface: ${theme.colors.surface};
  --bg-surface-light: ${theme.colors.surfaceLight};
  --bg-surface-lighter: ${theme.colors.surfaceLighter};
  
  --color-primary: ${theme.colors.primary};
  --color-primary-light: ${theme.colors.primaryLight};
  --color-primary-dark: ${theme.colors.primaryDark};
  
  --color-accent: ${theme.colors.accent};
  --color-accent-glow: ${theme.colors.accentGlow};
  
  --text-primary: ${theme.colors.textPrimary};
  --text-secondary: ${theme.colors.textSecondary};
  --text-muted: ${theme.colors.textMuted};
  --text-white: ${theme.colors.textWhite};
  
  /* Status colors */
  --color-success: ${theme.colors.success};
  --color-success-light: ${theme.colors.successLight};
  --color-warning: ${theme.colors.warning};
  --color-warning-light: ${theme.colors.warningLight};
  --color-danger: ${theme.colors.danger};
  --color-danger-light: ${theme.colors.dangerLight};
  --color-info: ${theme.colors.info};
  --color-info-light: ${theme.colors.infoLight};
  
  /* Borders and shadows */
  --border-glow: ${theme.colors.borderGlow};
  --border-strong: ${theme.colors.borderStrong};
  --shadow-glow: ${theme.shadows.glow};
  
  /* Spacing */
  --card-radius: ${theme.radius.lg};
  --card-padding: ${theme.spacing.cardPadding};
  
  /* Transitions */
  --transition-fast: ${theme.transitions.fast};
  --transition-base: ${theme.transitions.base};
  --transition-slow: ${theme.transitions.slow};
  --transition-smooth: ${theme.transitions.smooth};
}
`;

export type Theme = typeof theme;

import React, { createContext, useState, useContext, ReactNode } from 'react';
import { useColorScheme } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'auto';

export interface Theme {
  colors: {
    primary: string;
    background: string;
    card: string;
    text: string;
    textSecondary: string;
    border: string;
    error: string;
    success: string;
    warning: string;
    info: string;
    // Status colors
    rssiGood: string;
    rssiMedium: string;
    rssiBad: string;
    // UI elements
    buttonPrimary: string;
    buttonSecondary: string;
    buttonDanger: string;
    buttonDisabled: string;
    inputBackground: string;
    inputBorder: string;
    modalBackground: string;
    modalOverlay: string;
  };
  dark: boolean;
}

const lightTheme: Theme = {
  colors: {
    primary: '#007AFF',
    background: '#F2F2F7',
    card: '#FFFFFF',
    text: '#000000',
    textSecondary: '#666666',
    border: '#E5E5EA',
    error: '#FF3B30',
    success: '#34C759',
    warning: '#FF9500',
    info: '#5AC8FA',
    rssiGood: '#34C759',
    rssiMedium: '#FF9500',
    rssiBad: '#FF3B30',
    buttonPrimary: '#007AFF',
    buttonSecondary: '#8E8E93',
    buttonDanger: '#FF3B30',
    buttonDisabled: '#C7C7CC',
    inputBackground: '#FFFFFF',
    inputBorder: '#E5E5EA',
    modalBackground: '#FFFFFF',
    modalOverlay: 'rgba(0, 0, 0, 0.5)',
  },
  dark: false,
};

const darkTheme: Theme = {
  colors: {
    primary: '#0A84FF',
    background: '#000000',
    card: '#1C1C1E',
    text: '#FFFFFF',
    textSecondary: '#98989D',
    border: '#38383A',
    error: '#FF453A',
    success: '#30D158',
    warning: '#FF9F0A',
    info: '#64D2FF',
    rssiGood: '#30D158',
    rssiMedium: '#FF9F0A',
    rssiBad: '#FF453A',
    buttonPrimary: '#0A84FF',
    buttonSecondary: '#636366',
    buttonDanger: '#FF453A',
    buttonDisabled: '#48484A',
    inputBackground: '#1C1C1E',
    inputBorder: '#38383A',
    modalBackground: '#2C2C2E',
    modalOverlay: 'rgba(0, 0, 0, 0.7)',
  },
  dark: true,
};

interface ThemeContextType {
  theme: Theme;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<ThemeMode>('auto');

  const getActiveTheme = (): Theme => {
    if (themeMode === 'auto') {
      return systemColorScheme === 'dark' ? darkTheme : lightTheme;
    }
    return themeMode === 'dark' ? darkTheme : lightTheme;
  };

  const theme = getActiveTheme();
  const isDark = theme.dark;

  return (
    <ThemeContext.Provider value={{ theme, themeMode, setThemeMode, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

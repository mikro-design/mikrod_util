import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface FavoriteDevice {
  id: string;
  name: string;
  type: 'ble' | 'nfc';
  addedAt: number;
}

interface FavoritesContextType {
  favorites: FavoriteDevice[];
  addFavorite: (device: FavoriteDevice) => Promise<void>;
  removeFavorite: (deviceId: string) => Promise<void>;
  isFavorite: (deviceId: string) => boolean;
  toggleFavorite: (device: FavoriteDevice) => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(
  undefined,
);

const FAVORITES_STORAGE_KEY = '@mikrod_util_favorites';

interface FavoritesProviderProps {
  children: ReactNode;
}

export const FavoritesProvider: React.FC<FavoritesProviderProps> = ({
  children,
}) => {
  const [favorites, setFavorites] = useState<FavoriteDevice[]>([]);

  // Load favorites from storage on mount
  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      const stored = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY);
      if (stored) {
        setFavorites(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load favorites:', error);
    }
  };

  const saveFavorites = async (newFavorites: FavoriteDevice[]) => {
    try {
      await AsyncStorage.setItem(
        FAVORITES_STORAGE_KEY,
        JSON.stringify(newFavorites),
      );
      setFavorites(newFavorites);
    } catch (error) {
      console.error('Failed to save favorites:', error);
    }
  };

  const addFavorite = async (device: FavoriteDevice) => {
    const newFavorites = [...favorites, { ...device, addedAt: Date.now() }];
    await saveFavorites(newFavorites);
  };

  const removeFavorite = async (deviceId: string) => {
    const newFavorites = favorites.filter(f => f.id !== deviceId);
    await saveFavorites(newFavorites);
  };

  const isFavorite = (deviceId: string): boolean => {
    return favorites.some(f => f.id === deviceId);
  };

  const toggleFavorite = async (device: FavoriteDevice) => {
    if (isFavorite(device.id)) {
      await removeFavorite(device.id);
    } else {
      await addFavorite(device);
    }
  };

  return (
    <FavoritesContext.Provider
      value={{
        favorites,
        addFavorite,
        removeFavorite,
        isFavorite,
        toggleFavorite,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
};

export const useFavorites = (): FavoritesContextType => {
  const context = useContext(FavoritesContext);
  if (context === undefined) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
};

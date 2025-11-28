'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { Hub } from 'aws-amplify/utils';
import { getUser } from '@/lib/aws/auth';
import '@/lib/aws/amplify-config';

interface User {
  userId: string;
  username: string;
  email?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAuthenticated: false,
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkUser = async () => {
    try {
      const currentUser = await getUser();
      if (currentUser) {
        setUser({
          userId: currentUser.userId,
          username: currentUser.username,
          email: currentUser.signInDetails?.loginId,
        });
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkUser();

    const hubListener = Hub.listen('auth', ({ payload }) => {
      switch (payload.event) {
        case 'signedIn':
          checkUser();
          break;
        case 'signedOut':
          setUser(null);
          break;
      }
    });

    return () => hubListener();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        refreshUser: checkUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

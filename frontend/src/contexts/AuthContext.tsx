import React, { createContext, useContext, useState, useEffect } from 'react';

interface AuthContextType {
  token: string | null;
  userID: string | null;
  username: string | null;
  profilePicture: string | null;
  login: (token: string, userID: string, username: string, profilePicture?: string) => Promise<void>;
  logout: () => void;
  updateProfilePicture: (url: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [userID, setUserID] = useState<string | null>(localStorage.getItem('userID'));
  const [username, setUsername] = useState<string | null>(localStorage.getItem('username'));
  const [profilePicture, setProfilePicture] = useState<string | null>(localStorage.getItem('style_engine_profile_picture'));

  const login = async (newToken: string, newUserID: string, newUsername: string, newProfilePicture?: string) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('userID', newUserID);
    localStorage.setItem('username', newUsername);
    
    setToken(newToken);
    setUserID(newUserID);
    setUsername(newUsername);

    if (newProfilePicture) {
      localStorage.setItem('style_engine_profile_picture', newProfilePicture);
      setProfilePicture(newProfilePicture);
    } else {
      try {
        const res = await fetch('https://zkb6w7wk-8001.inc1.devtunnels.ms/api/profile', {
          headers: { 'Authorization': `Bearer ${newToken}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.profile_picture_url) {
            localStorage.setItem('style_engine_profile_picture', data.profile_picture_url);
            setProfilePicture(data.profile_picture_url);
          }
          if (data.body_shape) localStorage.setItem('style_engine_body_shape', data.body_shape);
          if (data.skin_tone) localStorage.setItem('style_engine_skin_tone', data.skin_tone);
        }
      } catch (err) {
        console.error("Failed to fetch profile on login", err);
      }
    }
  };

  const updateProfilePicture = (url: string) => {
    localStorage.setItem('style_engine_profile_picture', url);
    setProfilePicture(url);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userID');
    localStorage.removeItem('username');
    localStorage.removeItem('style_engine_profile_picture');
    localStorage.removeItem('style_engine_body_shape');
    localStorage.removeItem('style_engine_skin_tone');
    localStorage.removeItem('style_engine_onboarded');
    setToken(null);
    setUserID(null);
    setUsername(null);
    setProfilePicture(null);
  };

  return (
    <AuthContext.Provider value={{ token, userID, username, profilePicture, login, logout, updateProfilePicture }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

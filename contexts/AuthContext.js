// contexts/AuthContext.js
'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { getAdmins, subscribeClubPermissions } from '@/lib/firestore';
import { DEFAULT_PERMISSIONS } from '@/lib/permissions';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [permissions, setPermissions] = useState(DEFAULT_PERMISSIONS);

  useEffect(() => {
    const unsubPerms = subscribeClubPermissions((p) => {
      if (p) setPermissions(p);
    });
    return () => unsubPerms();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u && u.email) {
        if (u.email === 'leeky1537@gmail.com') {
          setIsSuperAdmin(true);
          setIsAdmin(true);
        } else {
          setIsSuperAdmin(false);
          try {
            const admins = await getAdmins();
            const found = admins.some(a => a.email === u.email);
            setIsAdmin(found);
          } catch (e) {
            console.error('Error fetching admins', e);
            setIsAdmin(false);
          }
        }
      } else {
        setIsAdmin(false);
        setIsSuperAdmin(false);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signup = (email, password, displayName) =>
    createUserWithEmailAndPassword(auth, email, password).then((cred) =>
      updateProfile(cred.user, { displayName })
    );

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);

  const loginWithGoogle = () => signInWithPopup(auth, googleProvider);

  const logout = () => signOut(auth);

  const can = (permissionKey) => {
    if (isAdmin || isSuperAdmin) return true;
    return Boolean(permissions[permissionKey]);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAdmin,
      isSuperAdmin,
      permissions,
      can,
      loading,
      signup,
      login,
      loginWithGoogle,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

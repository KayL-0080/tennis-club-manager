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
import { getAdmins, getClubs, getJoinRequestsByUser } from '@/lib/firestore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [currentClubId, setCurrentClubId] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [clubs, setClubs] = useState([]);
  const [myClubs, setMyClubs] = useState([]);
  const [myJoinRequests, setMyJoinRequests] = useState([]);

  // 클럽 목록 불러오기 (한 번만)
  useEffect(() => {
    async function loadClubs() {
      try {
        const c = await getClubs();
        setClubs(c);
      } catch (e) {
        console.error('Error loading clubs', e);
      }
    }
    loadClubs();
  }, []);

  // 현재 클럽이 변경되면 로컬스토리지에 저장 또는 삭제
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('currentClubId');
      if (saved && !currentClubId && !isInitialized) {
        setCurrentClubId(saved);
      }
      setIsInitialized(true);
    }
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    if (currentClubId) {
      localStorage.setItem('currentClubId', currentClubId);
    } else {
      localStorage.removeItem('currentClubId');
    }
  }, [currentClubId, isInitialized]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      
      // Super admin check
      if (u && u.email === 'leeky1537@gmail.com') {
        setIsSuperAdmin(true);
        setIsAdmin(true);
      } else {
        setIsSuperAdmin(false);
      }
      
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // 유저와 클럽 목록이 준비되면 myClubs와 권한 계산
  useEffect(() => {
    const loadUserClubs = async () => {
      if (!user || !user.email || clubs.length === 0) {
        setMyClubs([]);
        setMyJoinRequests([]);
        if (user && user.email !== 'leeky1537@gmail.com') setIsAdmin(false);
        return;
      }
      
      try {
        let reqs = [];
        try {
          reqs = await getJoinRequestsByUser(user.email);
        } catch (e) {
          console.warn('[loadUserClubs] Failed to get join requests:', e);
        }
        setMyJoinRequests(reqs);

        let amIAdminInCurrentClub = false;
        const myClubIds = new Set(reqs.filter(r => r.status === 'approved').map(r => r.clubId));

        const adminChecks = await Promise.all(
          clubs.map(async club => {
            try {
              const admins = await getAdmins(club.id);
              const isAdm = admins.some(a => a.email === user.email);
              return { clubId: club.id, isAdm };
            } catch (err) {
              console.warn(`[getAdmins] Error for club ${club.id}:`, err);
              return { clubId: club.id, isAdm: false };
            }
          })
        );
        
        adminChecks.forEach(check => {
          if (check.isAdm || user.email === 'leeky1537@gmail.com') {
            myClubIds.add(check.clubId);
          }
          if (currentClubId && check.clubId === currentClubId && check.isAdm) {
            amIAdminInCurrentClub = true;
          }
        });

        if (user.email !== 'leeky1537@gmail.com') {
          setIsAdmin(amIAdminInCurrentClub);
        }

        const myC = clubs.filter(c => myClubIds.has(c.id));
        setMyClubs(myC);

      } catch (e) {
        console.error('Error loading user clubs', e);
      }
    };
    
    if (!loading) {
      loadUserClubs();
    }
  }, [user, clubs, currentClubId, loading]);

  const signup = (email, password, displayName) =>
    createUserWithEmailAndPassword(auth, email, password).then((cred) =>
      updateProfile(cred.user, { displayName })
    );

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);

  const loginWithGoogle = () => signInWithPopup(auth, googleProvider);

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ 
      user, isAdmin, isSuperAdmin, loading, 
      currentClubId, setCurrentClubId, 
      clubs, setClubs, 
      myClubs, myJoinRequests,
      signup, login, loginWithGoogle, logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// components/Navbar.js
'use client';
import { useAuth } from '@/contexts/AuthContext';
import { usePathname, useRouter } from 'next/navigation';
import styles from './Navbar.module.css';

export default function Navbar() {
  const { user, isSuperAdmin, logout, clubs, currentClubId, setCurrentClubId } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isHome = pathname === '/';

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  const currentClub = clubs.find(c => c.id === currentClubId);
  const clubName = currentClub ? currentClub.name : '클럽 로딩중...';

  return (
    <>
    <nav className={`no-print ${styles.nav}`}>
      <div className={styles.inner}>
        <div className={styles.logoContainer}>
          <button className={styles.logo} onClick={() => router.push('/dashboard')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className={styles.logoCircle}>
                <span className={styles.logoIcon}>🎾</span>
              </div>
              <div className={styles.logoTextGroup}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className={styles.logoText}>TCM</span>
                  <span className={styles.logoSub}>{isHome ? '홈' : clubName}</span>
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--txt3)', marginTop: '2px' }}>Ver.20260831-02</div>
              </div>
            </div>
          </button>
        </div>
        
        {!isHome && (
          <div style={{ marginBottom: '8px' }}>
            <button 
              className="btn btn-secondary btn-sm" 
              style={{ width: '100%', fontSize: '12px' }}
              onClick={() => {
                setCurrentClubId(null);
                router.push('/');
              }}
            >
              ⬅️ 목록으로
            </button>
          </div>
        )}

        {!isHome && (
          <div className={styles.desktopMenu}>
            <button 
              className={`btn btn-sm ${pathname.startsWith('/dashboard') ? 'btn-primary' : 'btn-secondary'}`} 
              style={{ width: '100%', justifyContent: 'flex-start', padding: '10px 16px', borderRadius: 'var(--radius-full)', fontSize: '13px', margin: '3px 0', fontWeight: pathname.startsWith('/dashboard') ? '700' : '500' }}
              onClick={() => router.push('/dashboard')}
            >
              🎾 대진표
            </button>
            <button 
              className={`btn btn-sm ${pathname.startsWith('/stats') ? 'btn-primary' : 'btn-secondary'}`} 
              style={{ width: '100%', justifyContent: 'flex-start', padding: '10px 16px', borderRadius: 'var(--radius-full)', fontSize: '13px', margin: '3px 0', fontWeight: pathname.startsWith('/stats') ? '700' : '500' }}
              onClick={() => router.push('/stats')}
            >
              📊 통계
            </button>
            <button 
              className={`btn btn-sm ${pathname.startsWith('/votes') ? 'btn-primary' : 'btn-secondary'}`} 
              style={{ width: '100%', justifyContent: 'flex-start', padding: '10px 16px', borderRadius: 'var(--radius-full)', fontSize: '13px', margin: '3px 0', fontWeight: pathname.startsWith('/votes') ? '700' : '500' }}
              onClick={() => router.push('/votes')}
            >
              🗓️ 투표
            </button>
            <button 
              className={`btn btn-sm ${pathname.startsWith('/members') ? 'btn-primary' : 'btn-secondary'}`} 
              style={{ width: '100%', justifyContent: 'flex-start', padding: '10px 16px', borderRadius: 'var(--radius-full)', fontSize: '13px', margin: '3px 0', fontWeight: pathname.startsWith('/members') ? '700' : '500' }}
              onClick={() => router.push('/members')}
            >
              👥 회원
            </button>
          </div>
        )}

        <div className={styles.userSection}>
          {user ? (
            <div className={styles.userContainer}>
              {isSuperAdmin && (
                <button 
                  className="badge badge-gold" 
                  onClick={() => router.push('/admin')} 
                  title="슈퍼 관리자" 
                  style={{ border: 'none', padding: '6px 10px', fontSize: '0.8rem', cursor: 'pointer', width: '100%', marginBottom: '4px' }}
                >
                  👑 Admin
                </button>
              )}
              <div className={styles.userInfo}>
                <span className={styles.avatar}>{(user.displayName || user.email)?.[0]?.toUpperCase()}</span>
                <span className={styles.displayName}>{user.displayName || user.email}</span>
              </div>
              <button 
                className="btn btn-secondary btn-sm" 
                style={{ width: '100%', marginTop: '4px', fontSize: '12px' }}
                onClick={handleLogout}
              >
                로그아웃
              </button>
            </div>
          ) : (
            <button 
              className="btn btn-primary btn-sm" 
              style={{ width: '100%', fontSize: '12px' }}
              onClick={() => router.push('/login')}
            >
              관리자 로그인
            </button>
          )}
        </div>
      </div>
    </nav>
    
    {!isHome && (
      <div className={`no-print ${styles.mobileBottomTab}`}>
          <button className={`${styles.tabBtn} ${pathname.startsWith('/dashboard') ? styles.active : ''}`} onClick={() => router.push('/dashboard')}>
            <div className={styles.tabIcon}>🎾</div>
            <span>홈</span>
          </button>
          <button className={`${styles.tabBtn} ${pathname.startsWith('/stats') ? styles.active : ''}`} onClick={() => router.push('/stats')}>
            <div className={styles.tabIcon}>📊</div>
            <span>통계</span>
          </button>
          <button className={`${styles.tabBtn} ${pathname.startsWith('/votes') ? styles.active : ''}`} onClick={() => router.push('/votes')}>
            <div className={styles.tabIcon}>🗓️</div>
            <span>투표</span>
          </button>
          <button className={`${styles.tabBtn} ${pathname.startsWith('/members') ? styles.active : ''}`} onClick={() => router.push('/members')}>
            <div className={styles.tabIcon}>👥</div>
            <span>회원</span>
          </button>
        </div>
    )}
    </>
  );
}

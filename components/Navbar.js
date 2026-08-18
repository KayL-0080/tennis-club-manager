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
        <button className={styles.logo} onClick={() => router.push('/dashboard')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className={styles.logoTitle}>{isHome ? 'Tennis Club Manager' : `TCM (${clubName})`}</span>
          </div>
          <div className={styles.version}>Ver.20260818-03</div>
        </button>
        
        <div className={styles.right}>
          {!isHome && (
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={() => {
                setCurrentClubId(null);
                router.push('/');
              }}
            >
              ⬅️ 목록으로
            </button>
          )}

          {!isHome && (
            <div className={styles.desktopMenu}>
              <button className={`${styles.navTab} ${pathname.startsWith('/dashboard') ? styles.active : ''}`} onClick={() => router.push('/dashboard')}>
                🎾 대진표
              </button>
              <button className={`${styles.navTab} ${pathname.startsWith('/stats') ? styles.active : ''}`} onClick={() => router.push('/stats')}>
                📊 통계
              </button>
              <button className={`${styles.navTab} ${pathname.startsWith('/votes') ? styles.active : ''}`} onClick={() => router.push('/votes')}>
                🗓️ 투표
              </button>
              <button className={`${styles.navTab} ${pathname.startsWith('/members') ? styles.active : ''}`} onClick={() => router.push('/members')}>
                👥 회원
              </button>
            </div>
          )}
          {user ? (
            <>
              {isSuperAdmin && (
                <button className="badge badge-gold" onClick={() => router.push('/admin')} title="슈퍼 관리자" style={{ border: 'none', padding: '6px 10px', fontSize: '0.8rem', cursor: 'pointer' }}>
                  👑 Admin
                </button>
              )}
              <span className={styles.userInfo}>
                <span className={styles.avatar}>{(user.displayName || user.email)?.[0]?.toUpperCase()}</span>
                <span className={styles.displayName}>{user.displayName || user.email}</span>
              </span>
              <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
                로그아웃
              </button>
            </>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={() => router.push('/login')}>
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

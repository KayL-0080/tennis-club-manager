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
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M4 20l5 -5" />
            <ellipse cx="14" cy="10" rx="4" ry="7" transform="rotate(45 14 10)" />
            <path d="M12 12l4 -4M11 9l4 4M13 13l4 -4" opacity="0.4" />
            <path d="M20 20l-5 -5" />
            <ellipse cx="10" cy="10" rx="4" ry="7" transform="rotate(-45 10 10)" />
            <path d="M12 12l-4 -4M13 9l-4 4M11 13l-4 -4" opacity="0.4" />
          </svg>
          <span>{isHome ? 'Tennis Match (내 클럽)' : `Tennis Match(${clubName})`}</span>
        </button>
        <div className={styles.right}>
          {!isHome && (
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={() => {
                setCurrentClubId(null);
                router.push('/');
              }} 
              style={{ marginRight: '15px', backgroundColor: '#e2e8f0', color: '#1e293b' }}
            >
              ⬅️ 클럽 목록으로
            </button>
          )}

          {!isHome && (
            <div className={styles.desktopMenu}>
              <button className="btn btn-secondary btn-sm" onClick={() => router.push('/dashboard')} style={{ marginRight: '8px' }}>
                🎾 대진표 목록
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => router.push('/stats')} style={{ marginRight: '8px' }}>
                📊 통계 대시보드
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => router.push('/votes')} style={{ marginRight: '8px' }}>
                🗓️ 참석 투표
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => router.push('/members')} style={{ marginRight: '8px' }}>
                👥 회원 관리
              </button>
            </div>
          )}
          {user ? (
            <>
              {isSuperAdmin && (
                <button className="btn btn-secondary btn-sm" onClick={() => router.push('/admin')} style={{ marginRight: '8px', backgroundColor: '#ffd700', color: '#000', padding: '4px 8px' }} title="슈퍼 관리자">
                  👑
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
            <button className="btn btn-secondary btn-sm" onClick={() => router.push('/login')} style={{ fontSize: '11px', opacity: 0.7 }}>
              관리자 로그인
            </button>
          )}
        </div>
      </div>
    </nav>
    {!isHome && (
      <div className={`no-print ${styles.mobileBottomTab}`}>
          <button className={styles.tabBtn} onClick={() => router.push('/dashboard')}>
            <div className={styles.tabIcon}>🎾</div>
            <span>홈</span>
          </button>
          <button className={styles.tabBtn} onClick={() => router.push('/stats')}>
            <div className={styles.tabIcon}>📊</div>
            <span>통계</span>
          </button>
          <button className={styles.tabBtn} onClick={() => router.push('/votes')}>
            <div className={styles.tabIcon}>🗓️</div>
            <span>투표</span>
          </button>
          <button className={styles.tabBtn} onClick={() => router.push('/members')}>
            <div className={styles.tabIcon}>👥</div>
            <span>회원</span>
          </button>
        </div>
    )}
    </>
  );
}

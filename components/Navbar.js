// components/Navbar.js
'use client';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import styles from './Navbar.module.css';

export default function Navbar() {
  const { user, isSuperAdmin, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  const menuItems = [
    { name: '🎾 대진표 목록', path: '/dashboard' },
    { name: '📊 통계 대시보드', path: '/stats' },
    { name: '🗓️ 참석 투표', path: '/votes' },
    { name: '🏆 정기 대회', path: '/tournaments' },
    { name: '👥 회원 관리', path: '/members' },
  ];

  return (
    <>
      <nav className={`no-print ${styles.nav}`}>
        <div className={styles.inner}>
          {/* Logo Section */}
          <div className={styles.logoContainer}>
            <button className={styles.logo} onClick={() => router.push('/dashboard')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img src="/apple-touch-icon.png" alt="테친회" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span className={styles.logoText}>Tennis Match</span>
                  <span className={styles.logoSub}>테친회</span>
                </div>
              </div>
            </button>
          </div>

          {/* Desktop Menu - Stacked vertically on PC */}
          <div className={styles.desktopMenu}>
            {menuItems.map((item) => {
              const active = pathname === item.path || pathname.startsWith(item.path + '/');
              return (
                <button
                  key={item.path}
                  className={`btn btn-sm ${active ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ 
                    width: '100%', 
                    justifyContent: 'flex-start', 
                    padding: '10px 16px', 
                    borderRadius: 'var(--radius-full)', 
                    fontSize: '13px', 
                    margin: '3px 0',
                    fontWeight: active ? '700' : '500'
                  }}
                  onClick={() => router.push(item.path)}
                >
                  {item.name}
                </button>
              );
            })}

            {user && isSuperAdmin && (
              <button
                className={`btn btn-sm ${pathname === '/admins' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ 
                  width: '100%', 
                  justifyContent: 'flex-start', 
                  padding: '10px 16px', 
                  borderRadius: 'var(--radius-full)', 
                  fontSize: '13px', 
                  margin: '3px 0',
                  fontWeight: pathname === '/admins' ? '700' : '500'
                }}
                onClick={() => router.push('/admins')}
              >
                👑 운영진 관리
              </button>
            )}
          </div>

          {/* User Profile and Control Section */}
          <div className={styles.userSection}>
            {user ? (
              <div className={styles.userContainer}>
                <div className={styles.userInfo}>
                  <span className={styles.avatar}>{(user.displayName || user.email)?.[0]?.toUpperCase()}</span>
                  <span className={styles.displayName}>{user.displayName || user.email}</span>
                </div>
                <button 
                  className="btn btn-secondary btn-sm" 
                  style={{ width: '100%', marginTop: '8px', fontSize: '12px' }}
                  onClick={handleLogout}
                >
                  로그아웃
                </button>
              </div>
            ) : (
              <button 
                className="btn btn-secondary btn-sm" 
                style={{ width: '100%', fontSize: '11px', opacity: 0.8 }}
                onClick={() => router.push('/login')}
              >
                관리자 로그인
              </button>
            )}
            <div style={{ marginTop: '8px', textAlign: 'center', fontSize: '10px', color: 'var(--txt3)' }}>
              Ver.20260903-02
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Tab */}
      <div className={`no-print ${styles.mobileBottomTab}`}>
        <button className={`${styles.tabBtn} ${pathname === '/dashboard' ? styles.active : ''}`} onClick={() => router.push('/dashboard')}>
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
        <button className={`${styles.tabBtn} ${pathname.startsWith('/tournaments') ? styles.active : ''}`} onClick={() => router.push('/tournaments')}>
          <div className={styles.tabIcon}>🏆</div>
          <span>대회</span>
        </button>
        <button className={`${styles.tabBtn} ${pathname.startsWith('/members') ? styles.active : ''}`} onClick={() => router.push('/members')}>
          <div className={styles.tabIcon}>👥</div>
          <span>회원</span>
        </button>
      </div>
    </>
  );
}

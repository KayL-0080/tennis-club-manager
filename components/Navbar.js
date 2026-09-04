// components/Navbar.js
'use client';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import ManualModal from './ManualModal';
import styles from './Navbar.module.css';

export default function Navbar() {
  const { user, isSuperAdmin, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [showManual, setShowManual] = useState(false);

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
    { name: '📖 이용 매뉴얼', path: '/manual' },
  ];

  return (
    <>
      <nav className={`no-print ${styles.nav}`}>
        <div className={styles.inner}>
          {/* Logo Section & Manual Button Icon */}
          <div className={styles.logoContainer}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '6px' }}>
              <button className={styles.logo} onClick={() => router.push('/dashboard')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <img 
                    src="/apple-touch-icon.png" 
                    alt="테친회" 
                    style={{ 
                      width: '32px', 
                      height: '32px', 
                      borderRadius: '50%', 
                      objectFit: 'cover',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                      border: '1.5px solid #fff',
                      flexShrink: 0
                    }} 
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span className={styles.logoText}>Tennis Match</span>
                    <span className={styles.logoSub}>테친회</span>
                  </div>
                </div>
              </button>

              {/* 📖 Tennis Match 오른쪽 옆 매뉴얼 버튼 아이콘 */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowManual(true);
                }}
                title="사용자 & 운영자 이용 매뉴얼"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: 800,
                  color: '#1e293b',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  transition: 'all 0.15s ease',
                  flexShrink: 0
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#eff6ff';
                  e.currentTarget.style.borderColor = '#93c5fd';
                  e.currentTarget.style.color = '#1d4ed8';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#ffffff';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.color = '#1e293b';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <span style={{ fontSize: '12px' }}>📖</span>
                <span>매뉴얼</span>
              </button>
            </div>
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

          {/* User Profile and Control Section (Desktop) */}
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
                🔐 운영자 로그인
              </button>
            )}
          </div>

          {/* User Profile and Control Section (Mobile Header) */}
          <div className={styles.mobileUserSection}>
            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className={styles.avatar} style={{ width: '26px', height: '26px', fontSize: '11px' }}>
                  {(user.displayName || user.email)?.[0]?.toUpperCase()}
                </span>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '11px', padding: '3px 8px', height: '28px', whiteSpace: 'nowrap' }}
                  onClick={handleLogout}
                >
                  로그아웃
                </button>
              </div>
            ) : (
              <button
                className="btn btn-primary btn-sm"
                style={{ 
                  fontSize: '11px', 
                  padding: '4px 10px', 
                  height: '28px', 
                  whiteSpace: 'nowrap',
                  fontWeight: 'bold',
                  backgroundColor: '#2563eb',
                  borderColor: '#2563eb'
                }}
                onClick={() => router.push('/login')}
              >
                🔐 운영자 로그인
              </button>
            )}
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

      {/* 📖 통합 매뉴얼 팝업 모달 */}
      <ManualModal 
        isOpen={showManual} 
        onClose={() => setShowManual(false)} 
        initialTab={user ? 'admin' : 'user'} 
      />
    </>
  );
}

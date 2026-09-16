// components/Navbar.js
'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import ManualModal from './ManualModal';
import InstallAppModal from './InstallAppModal';
import styles from './Navbar.module.css';

export default function Navbar() {
  const { user, isSuperAdmin, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [showManual, setShowManual] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  // PWA Service Worker 등록 및 beforeinstallprompt 리스너
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Service Worker 등록 (PWA 설치 요구조건)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.log('SW registration error:', err);
      });
    }

    // 2. Standalone 모드 체크
    const isStandaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    setIsStandalone(isStandaloneMode);

    // 3. beforeinstallprompt 이벤트 가로채기
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    // 4. 설치 완료 이벤트
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async (e) => {
    e.stopPropagation();

    // 이미 홈 화면 웹/앱으로 실행 중인 경우
    if (isStandalone) {
      setShowInstallModal(true);
      return;
    }

    // 안드로이드 / 크롬 네이티브 A2HS 프롬프트가 지원되는 경우 즉각 트리거
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setDeferredPrompt(null);
          setIsInstalled(true);
          alert('🎉 홈 화면에 테친회 앱이 성공적으로 추가되었습니다!');
          return;
        }
      } catch (err) {
        console.log('Install prompt error:', err);
      }
    }

    // iOS Safari, 카카오톡 인앱, 또는 안내가 필요한 경우 모달 오픈
    setShowInstallModal(true);
  };

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
          {/* Logo Section & Action Buttons (매뉴얼 & 홈화면추가) */}
          <div className={styles.logoContainer}>
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

            {/* 상단 액션 버튼군: 📖 매뉴얼 & 📲 홈화면추가 */}
            <div className={styles.topActionsRow}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowManual(true);
                }}
                className={styles.headerActionBtn}
                title="사용자 & 운영자 이용 매뉴얼"
              >
                <span style={{ fontSize: '12px' }}>📖</span>
                <span>매뉴얼</span>
              </button>

              <button
                type="button"
                onClick={handleInstallClick}
                className={`${styles.headerActionBtn} ${styles.headerInstallBtn}`}
                title="모바일 홈 화면에 바로가기 앱 추가"
              >
                <span style={{ fontSize: '12px' }}>📲</span>
                <span>홈화면추가</span>
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

      {/* 📲 홈 화면 앱 추가 안내 모달 */}
      <InstallAppModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
        deferredPrompt={deferredPrompt}
        onInstallSuccess={() => {
          setIsInstalled(true);
          setDeferredPrompt(null);
          alert('🎉 홈 화면에 테친회 앱이 성공적으로 추가되었습니다!');
        }}
      />
    </>
  );
}

// app/login/page.js — 로그인 / 랜딩 페이지
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import styles from './page.module.css';

export default function AuthPage() {
  const { user, loading, login, signup, loginWithGoogle } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace('/');
  }, [user, loading, router]);

  const handle = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (mode === 'signup' && form.password !== form.confirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'login') await login(form.email, form.password);
      else await signup(form.email, form.password, form.name);
      router.replace('/');
    } catch (err) {
      const msg = {
        'auth/user-not-found': '등록되지 않은 이메일입니다.',
        'auth/wrong-password': '비밀번호가 올바르지 않습니다.',
        'auth/email-already-in-use': '이미 사용 중인 이메일입니다.',
        'auth/weak-password': '비밀번호는 6자 이상이어야 합니다.',
        'auth/invalid-email': '올바른 이메일 형식이 아닙니다.',
        'auth/invalid-credential': '이메일 또는 비밀번호가 올바르지 않습니다.',
      }[err.code] || '오류가 발생했습니다. 다시 시도해주세요.';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const googleLogin = async () => {
    setBusy(true);
    setError('');
    try {
      await loginWithGoogle();
      router.replace('/');
    } catch (err) {
      console.error('Google login error:', err);
      if (err.code === 'auth/unauthorized-domain') {
        setError('Firebase 승인된 도메인에 현재 URL이 없습니다.');
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError('로그인 창이 닫혔습니다.');
      } else {
        setError('Google 로그인 실패: ' + err.message);
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.page} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="spinner" />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* 동적 애니메이션 배경 (Kyushu Aesthetic) */}
      <div className={styles.heroBg} aria-hidden />
      <div className={styles.heroParticles} aria-hidden />

      {/* 상단 네비게이션 바 */}
      <header className={styles.header}>
        <div className={styles.headerLogo}>
          <div className={styles.headerIcon}>🎾</div>
          <h1 className={styles.headerTitle}>Tennis Club Manager</h1>
        </div>
        <div className={styles.headerActions}>
          <button className="btn btn-secondary btn-sm" onClick={() => router.push('/guide')}>
            서비스 소개 및 가이드
          </button>
          <button className={styles.topLoginBtn} onClick={() => {
            document.getElementById('auth-section').scrollIntoView({ behavior: 'smooth' });
          }}>
            로그인 / 가입
          </button>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main className={styles.mainContent}>
        {/* 상단 히어로 섹션 */}
        <section className={styles.heroSection}>
          <span className={styles.heroFlag}>🏆</span>
          <div className={styles.heroLabel}>Tennis Club Management Platform</div>
          <h2 className={styles.heroTitle}>Tennis Club Manager</h2>
          <p className={styles.heroDesc}>
            모임 일정부터 참석 투표, 복잡한 대진표 자동 매칭까지.<br/>
            클럽 관리를 하나의 플랫폼에서 손쉽게 자동화하세요.
          </p>
        </section>

        {/* 가이드 캐러셀 섹션 */}
        <section className={styles.carouselSection}>
          <div className={styles.carouselContainer}>
            <div className={styles.carouselCard}>
              <div className={styles.cardIcon}>📱</div>
              <div className={styles.cardStep}>STEP 1. 시작하기</div>
              <h3 className={styles.cardTitle}>클럽 개설 및 가입</h3>
              <p className={styles.cardDesc}>누구나 쉽게 무료로 클럽을 만들고 관리할 수 있습니다. 검색을 통해 기존 모임에 간편하게 가입해보세요.</p>
              <div><span className={styles.cardHighlight}>무제한 클럽 생성</span></div>
            </div>
            
            <div className={styles.carouselCard}>
              <div className={styles.cardIcon}>🎾</div>
              <div className={styles.cardStep}>STEP 2. 대진표</div>
              <h3 className={styles.cardTitle}>자동 대진표 매칭</h3>
              <p className={styles.cardDesc}>참가 인원, 코트 수, 종목을 입력하면 실력 밸런스를 맞추고 파트너 중복을 최소화한 최적의 대진표가 완성됩니다.</p>
              <div><span className={styles.cardHighlight}>목표 게임수 균등배분 기능</span></div>
            </div>

            <div className={styles.carouselCard}>
              <div className={styles.cardIcon}>📊</div>
              <div className={styles.cardStep}>STEP 3. 결과 기록</div>
              <h3 className={styles.cardTitle}>실시간 점수 및 순위표</h3>
              <p className={styles.cardDesc}>대진표에 경기 결과를 입력하면 실시간으로 순위표가 업데이트됩니다. 승점과 득실차를 기반으로 클럽 랭킹을 관리하세요.</p>
              <div><span className={styles.cardHighlight}>누적 랭킹 시스템</span></div>
            </div>

            <div className={styles.carouselCard}>
              <div className={styles.cardIcon}>🗓️</div>
              <div className={styles.cardStep}>STEP 4. 일정 관리</div>
              <h3 className={styles.cardTitle}>원클릭 참석 투표</h3>
              <p className={styles.cardDesc}>모임 일정을 등록하고 회원들의 참석 여부를 빠르게 취합하여 참석자 기반 대진표 작성의 번거로움을 줄입니다.</p>
              <div><span className={styles.cardHighlight}>스마트 일정 공유</span></div>
            </div>
          </div>
        </section>

        {/* 하단 로그인/회원가입 폼 */}
        <section className={styles.authSection} id="auth-section">
          <div className={`card ${styles.authCard}`}>
            <div className={styles.tabs}>
              <button
                className={`${styles.tab} ${mode === 'login' ? styles.tabActive : ''}`}
                onClick={() => { setMode('login'); setError(''); }}
                type="button"
              >
                로그인
              </button>
              <button
                className={`${styles.tab} ${mode === 'signup' ? styles.tabActive : ''}`}
                onClick={() => { setMode('signup'); setError(''); }}
                type="button"
              >
                회원가입
              </button>
            </div>

            <form onSubmit={submit} className={styles.form}>
              {mode === 'signup' && (
                <div className="form-group">
                  <label className="form-label">이름</label>
                  <input
                    className="input"
                    type="text"
                    placeholder="홍길동"
                    value={form.name}
                    onChange={handle('name')}
                    required
                    autoComplete="name"
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">이메일</label>
                <input
                  className="input"
                  type="email"
                  placeholder="example@email.com"
                  value={form.email}
                  onChange={handle('email')}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="form-group">
                <label className="form-label">비밀번호</label>
                <input
                  className="input"
                  type="password"
                  placeholder="6자 이상"
                  value={form.password}
                  onChange={handle('password')}
                  required
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
              </div>

              {mode === 'signup' && (
                <div className="form-group">
                  <label className="form-label">비밀번호 확인</label>
                  <input
                    className="input"
                    type="password"
                    placeholder="비밀번호 재입력"
                    value={form.confirm}
                    onChange={handle('confirm')}
                    required
                    autoComplete="new-password"
                  />
                </div>
              )}

              {error && <div className="alert alert-error" style={{ marginTop: '10px' }}>{error}</div>}

              <button className="btn btn-primary btn-full btn-lg" type="submit" disabled={busy} style={{ marginTop: '10px' }}>
                {busy ? <span className="spinner spinner-white" /> : mode === 'login' ? '로그인' : '회원가입'}
              </button>
            </form>

            <div className="divider mt-3 mb-3">또는</div>

            <button className={`btn btn-google ${styles.googleBtn}`} onClick={googleLogin} disabled={busy} type="button">
              <GoogleIcon />
              Google 계정으로 시작하기
            </button>
            
            <p className={styles.footer}>
              Tennis Club Manager — 스마트한 테니스 모임 관리
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.712A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.712V4.956H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.044l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.956L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

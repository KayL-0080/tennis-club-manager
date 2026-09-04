// app/page.js — 로그인 / 회원가입 페이지
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
    if (!loading && user) router.replace('/dashboard');
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
      router.replace('/dashboard');
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
      router.replace('/dashboard');
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
      <div className={styles.centered}>
        <span className="spinner" />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* 배경 테니스 코트 패턴 */}
      <div className={styles.courtBg} aria-hidden />

      <div className={styles.container}>
        {/* 로고 */}
        <div className={styles.logo}>
          <img 
            src="/apple-touch-icon.png" 
            alt="테친회 로고" 
            style={{ 
              width: '68px', 
              height: '68px', 
              borderRadius: '50%', 
              objectFit: 'cover',
              boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
              border: '2px solid #fff',
              marginBottom: '10px'
            }} 
          />
          <h1 className={styles.logoTitle}>Tennis Match</h1>
          <p className={styles.logoSub}>NTRP 밸런스 대진표 자동 생성</p>
        </div>

        {/* 탭 */}
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

            {error && <div className="alert alert-error">{error}</div>}

            <button className="btn btn-primary btn-full btn-lg" type="submit" disabled={busy}>
              {busy ? <span className="spinner" /> : mode === 'login' ? '로그인' : '회원가입'}
            </button>
          </form>

          <div className="divider mt-3 mb-3">또는</div>

          <button className={`btn btn-google ${styles.googleBtn}`} onClick={googleLogin} disabled={busy} type="button">
            <GoogleIcon />
            Google로 계속하기
          </button>
        </div>

        <p className={styles.footer}>
          Tennis Match — NTRP 기반 대진표 생성 서비스
        </p>
      </div>
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

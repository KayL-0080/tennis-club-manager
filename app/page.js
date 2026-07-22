'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createJoinRequest } from '@/lib/firestore';
import Navbar from '@/components/Navbar';
import Link from 'next/link';
import styles from './dashboard/dashboard.module.css';

export default function Home() {
  const { user, loading, clubs, myClubs, myJoinRequests, setCurrentClubId } = useAuth();
  const router = useRouter();

  const [searchTerm, setSearchTerm] = useState('');
  const [requestingId, setRequestingId] = useState(null);

  const handleJoin = async (club) => {
    if (!confirm(`'${club.name}'에 가입을 신청하시겠습니까?`)) return;
    setRequestingId(club.id);
    try {
      await createJoinRequest({
        clubId: club.id,
        clubName: club.name,
        userEmail: user.email,
        userName: user.displayName || user.email.split('@')[0],
      });
      alert('가입 신청이 완료되었습니다. 관리자 승인을 기다려주세요.');
      // Optionally reload the page to refresh myJoinRequests, but for now just show alert
      window.location.reload();
    } catch (e) {
      console.error(e);
      alert('가입 신청에 실패했습니다: ' + e.message);
    } finally {
      setRequestingId(null);
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="spinner" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className={styles.page}>
      <Navbar />
      <main className={styles.main}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>👋 환영합니다, {user.displayName || user.email?.split('@')[0]}님!</h1>
            <p className={styles.sub}>관리할 클럽을 선택해주세요.</p>
          </div>
        </div>

        {myClubs.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>🎾</div>
            <p className={styles.emptyTitle}>소속된 클럽이 없습니다</p>
            <p className={styles.emptySub}>아래에서 클럽을 검색하고 가입 신청을 해보세요.</p>
          </div>
        ) : (
          <>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>내 클럽 목록</h2>
            <div className={styles.grid} style={{ marginBottom: '40px' }}>
              {myClubs.map(club => (
                <div 
                  key={club.id} 
                  className={`card ${styles.schedCard}`}
                  style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s', borderTop: '4px solid var(--primary)', height: '100%' }}
                  onClick={() => {
                    setCurrentClubId(club.id);
                    localStorage.setItem('currentClubId', club.id); // 즉시 저장
                    // Force a browser navigation in case Next.js client router is failing silently
                    window.location.href = '/dashboard';
                  }}
                  onMouseOver={e => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 12px 24px rgba(26,61,124,0.15)';
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.05)';
                  }}
                >
                  <div className={styles.schedTop}>
                    <div className={styles.schedIcon} style={{ fontSize: '32px' }}>🏟️</div>
                    <div className={styles.schedInfo}>
                      <h2 className={styles.schedTitle} style={{ fontSize: '20px' }}>{club.name}</h2>
                      <p className={styles.schedMeta} style={{ marginTop: '8px' }}>
                        클럽에 입장하여 대진표, 일정, 통계 관리하기 &rarr;
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* 클럽 찾기 영역 */}
        <hr style={{ margin: '40px 0', border: 'none', borderTop: '1px solid var(--border)' }} />
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>🔍 클럽 찾기</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            가입하고자 하는 클럽을 검색하고 신청해보세요.
          </p>
          <input 
            type="text" 
            className="input" 
            placeholder="클럽 이름 검색..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ maxWidth: '400px', marginBottom: '24px' }}
          />

          <div className={styles.grid}>
            {clubs
              .filter(c => !myClubs.find(mc => mc.id === c.id))
              .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
              .map(club => {
                const isPending = myJoinRequests.some(r => r.clubId === club.id && r.status === 'pending');
                return (
                  <div key={club.id} className={`card ${styles.schedCard}`} style={{ opacity: isPending ? 0.7 : 1 }}>
                    <div className={styles.schedTop}>
                      <div className={styles.schedIcon} style={{ fontSize: '24px' }}>🎾</div>
                      <div className={styles.schedInfo}>
                        <h2 className={styles.schedTitle} style={{ fontSize: '16px' }}>{club.name}</h2>
                      </div>
                    </div>
                    <div style={{ marginTop: '16px', textAlign: 'right' }}>
                      {isPending ? (
                        <button className="btn btn-secondary btn-sm" disabled>가입 대기 중</button>
                      ) : (
                        <button 
                          className="btn btn-primary btn-sm"
                          onClick={() => handleJoin(club)}
                          disabled={requestingId === club.id}
                        >
                          {requestingId === club.id ? '신청 중...' : '가입 신청'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
          {clubs.filter(c => !myClubs.find(mc => mc.id === c.id)).length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>가입할 수 있는 새로운 클럽이 없습니다.</p>
          )}
        </div>

      </main>
    </div>
  );
}

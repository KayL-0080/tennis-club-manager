'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createJoinRequest, createClub, addAdmin, getMembers, addMember } from '@/lib/firestore';
import Navbar from '@/components/Navbar';
import Link from 'next/link';
import styles from './dashboard/dashboard.module.css';

export default function Home() {
  const { user, loading, clubs, myClubs, myJoinRequests, setCurrentClubId, setClubs, isSuperAdmin } = useAuth();
  const router = useRouter();

  const [searchTerm, setSearchTerm] = useState('');
  const [requestingId, setRequestingId] = useState(null);
  const [clubStats, setClubStats] = useState({});
  const [inviteClub, setInviteClub] = useState(null);
  const [joiningInvite, setJoiningInvite] = useState(false);

  // Club Creation
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newClubName, setNewClubName] = useState('');
  const [newClubDesc, setNewClubDesc] = useState('');
  const [creating, setCreating] = useState(false);

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
      window.location.reload();
    } catch (e) {
      console.error(e);
      alert('가입 신청에 실패했습니다: ' + e.message);
    } finally {
      setRequestingId(null);
    }
  };

  const handleCreateClub = async (e) => {
    e.preventDefault();
    if (!newClubName.trim()) return;
    setCreating(true);
    try {
      const clubName = newClubName.trim();
      const clubDesc = newClubDesc.trim();
      const id = await createClub({ name: clubName, description: clubDesc });
      
      if (user && user.email) {
        await addAdmin(id, user.email);
      }
      
      const newClub = { id, name: clubName, description: clubDesc };
      setClubs(prev => [...prev, newClub]);
      setShowCreateModal(false);
      setNewClubName('');
      setNewClubDesc('');
      
      alert('클럽이 생성되었습니다! 새 클럽 대시보드로 이동합니다.');
      
      setCurrentClubId(id);
      localStorage.setItem('currentClubId', id);
      window.location.href = '/dashboard';
    } catch (err) {
      console.error(err);
      alert('클럽 생성 실패: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchStats = async () => {
      const stats = {};
      const targetClubs = clubs.filter(c => !myClubs.find(mc => mc.id === c.id));
      for (const club of targetClubs) {
        try {
          const mbrs = await getMembers(club.id);
          const total = mbrs.length;
          const male = mbrs.filter(m => m.gender === 'M').length;
          const female = mbrs.filter(m => m.gender === 'F').length;
          stats[club.id] = { total, male, female };
        } catch(e) {
          console.warn('Failed to fetch members for club', club.id);
        }
      }
      setClubStats(stats);
    };
    if (clubs.length > 0 && user) {
      fetchStats();
      
      // 초대 링크 처리
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const inviteId = params.get('invite');
        if (inviteId) {
          const found = clubs.find(c => c.id === inviteId);
          if (found) {
            const alreadyMember = myClubs.some(mc => mc.id === inviteId);
            if (!alreadyMember) {
              setInviteClub(found);
            } else {
              alert('이미 가입된 클럽입니다.');
              window.history.replaceState({}, '', '/');
            }
          }
        }
      }
    }
  }, [clubs, myClubs, user]);

  const handleAcceptInvite = async () => {
    if (!inviteClub || !user) return;
    setJoiningInvite(true);
    try {
      await addMember(inviteClub.id, {
        name: user.displayName || user.email.split('@')[0],
        email: user.email,
        role: '정회원',
        gender: 'M',
        ntrp: 2.0
      });
      alert(`'${inviteClub.name}'에 성공적으로 가입되었습니다!`);
      window.history.replaceState({}, '', '/');
      window.location.reload();
    } catch (e) {
      console.error(e);
      alert('초대 수락에 실패했습니다: ' + e.message);
    } finally {
      setJoiningInvite(false);
    }
  };

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
            <h2 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '16px', color: 'var(--txt)' }}>내 클럽 목록</h2>
            <div className={styles.grid} style={{ marginBottom: '40px' }}>
              {myClubs.map(club => (
                <div 
                  key={club.id} 
                  className={styles.schedCard}
                  onClick={() => {
                    setCurrentClubId(club.id);
                    localStorage.setItem('currentClubId', club.id);
                    window.location.href = '/dashboard';
                  }}
                >
                  <div className={styles.schedTop}>
                    <div className={styles.schedIcon}>🏟️</div>
                    <div className={styles.schedInfo}>
                      <h2 className={styles.schedTitle}>{club.name}</h2>
                      <p className={styles.schedMeta}>
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
        <hr style={{ margin: '40px 0', border: 'none', borderTop: '1px dashed var(--border)' }} />
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--txt)' }}>🔍 클럽 찾기 및 생성</h2>
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreateModal(true)}>
              ➕ 새 클럽 만들기
            </button>
          </div>
          <p style={{ fontSize: '0.88rem', color: 'var(--txt3)', marginBottom: '20px', fontWeight: '600' }}>
            가입하고자 하는 클럽을 검색하거나 새로운 클럽을 만들어 운영해보세요.
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
                const stats = clubStats[club.id] || { total: 0, male: 0, female: 0 };
                return (
                  <div key={club.id} className={styles.schedCard} style={{ opacity: isPending ? 0.7 : 1 }}>
                    <div className={styles.schedTop}>
                      <div className={styles.schedIcon}>🎾</div>
                      <div className={styles.schedInfo}>
                        <h2 className={styles.schedTitle}>{club.name}</h2>
                        {club.description && (
                          <p style={{ fontSize: '0.8rem', color: 'var(--txt2)', marginBottom: '8px', wordBreak: 'keep-all', fontWeight: '600' }}>
                            {club.description}
                          </p>
                        )}
                        <div style={{ display: 'inline-flex', gap: '6px', fontSize: '0.72rem', color: 'var(--txt3)', background: 'var(--glass)', border: '1px solid var(--border)', padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontWeight: '700' }}>
                          <span>👥 총 {stats.total}명</span>
                          <span>(남 {stats.male} / 여 {stats.female})</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ marginTop: '20px', textAlign: 'right' }}>
                      {isPending ? (
                         <button className="btn btn-secondary btn-sm" style={{ width: '100%' }} disabled>가입 대기 중</button>
                      ) : (
                        <button 
                          className="btn btn-primary btn-sm"
                          style={{ width: '100%' }}
                          onClick={(e) => { e.stopPropagation(); handleJoin(club); }}
                          disabled={requestingId === club.id}
                        >
                          {requestingId === club.id ? '신청 중...' : '가입 신청하기'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
          {clubs.filter(c => !myClubs.find(mc => mc.id === c.id)).length === 0 && (
            <div className={styles.empty} style={{ padding: '40px 24px' }}>
              <p className={styles.emptyTitle}>가입할 수 있는 새로운 클럽이 없습니다.</p>
            </div>
          )}
        </div>

      </main>

      {/* 새 클럽 만들기 모달 */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', width: '100%' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '16px', color: 'var(--txt)' }}>➕ 새 클럽 만들기</h2>
            <form onSubmit={handleCreateClub}>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: '700', marginBottom: '8px', color: 'var(--txt2)' }}>클럽 이름 (필수)</label>
                <input 
                  className="input" 
                  placeholder="예: 강남 테니스 클럽" 
                  value={newClubName} 
                  onChange={e => setNewClubName(e.target.value)} 
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: '700', marginBottom: '8px', color: 'var(--txt2)' }}>클럽 설명 (선택)</label>
                <input 
                  className="input" 
                  placeholder="클럽에 대한 짧은 소개" 
                  value={newClubDesc} 
                  onChange={e => setNewClubDesc(e.target.value)} 
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>취소</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? '생성 중...' : '클럽 생성하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 초대 수락 모달 */}
      {inviteClub && (
        <div className="modal-overlay" onClick={() => { setInviteClub(null); window.history.replaceState({}, '', '/'); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '16px', color: 'var(--blue)' }}>💌 초대장 도착</h2>
            <p style={{ fontSize: '0.95rem', marginBottom: '24px', color: 'var(--txt2)' }}>
              <strong style={{ color: 'var(--txt)' }}>{inviteClub.name}</strong> 클럽에서 회원님을 초대했습니다.<br/>
              지금 바로 가입하시겠습니까?
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button type="button" className="btn btn-secondary" onClick={() => { setInviteClub(null); window.history.replaceState({}, '', '/'); }}>
                거절
              </button>
              <button type="button" className="btn btn-primary" onClick={handleAcceptInvite} disabled={joiningInvite}>
                {joiningInvite ? '가입 처리 중...' : '수락 및 가입하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

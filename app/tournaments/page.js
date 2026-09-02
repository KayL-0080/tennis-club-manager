'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getTournaments, createTournament, deleteTournament, getEvents, getMembers } from '@/lib/firestore';
import Navbar from '@/components/Navbar';
import styles from '../dashboard/dashboard.module.css';

export default function TournamentsPage() {
  const { currentClubId, user, isAdmin } = useAuth();
  const router = useRouter();
  
  const [tournaments, setTournaments] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newType, setNewType] = useState('team');
  const [events, setEvents] = useState([]);
  const [members, setMembers] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [tList, eList, mList] = await Promise.all([
          getTournaments(currentClubId),
          getEvents(currentClubId),
          getMembers(currentClubId)
        ]);
        setTournaments(tList);
        setEvents(eList);
        setMembers(mList);
      } catch (err) {
        console.error('Failed to load tournaments:', err);
      } finally {
        setFetching(false);
      }
    })();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!newTitle.trim() || !newDate) {
      alert('대회명과 날짜를 입력해주세요.');
      return;
    }

    const selectedEvent = events.find(ev => ev.date === newDate);
    let initialAttendees = [];
    if (selectedEvent && selectedEvent.attendees) {
      initialAttendees = members
        .filter(m => selectedEvent.attendees[m.id] === 'Y')
        .filter(m => m.role !== '준회원' && m.role !== '게스트')
        .map(m => m.id);
    }

    const payload = {
      title: newTitle.trim(),
      date: newDate,
      type: newType,
      status: 'draft',
      attendees: initialAttendees,
      teams: [],
      matches: [],
      scores: {}
    };

    try {
      const id = await createTournament(currentClubId, payload);
      router.push('/tournaments/' + id);
    } catch (err) {
      console.error(err);
      alert('대회 생성 중 오류가 발생했습니다.');
    }
  };

  const handleDelete = async (id, title) => {
    if (!isAdmin) return;
    if (!confirm('정말로 대회 [' + title + ']을 삭제하시겠습니까?')) return;
    try {
      await deleteTournament(currentClubId, id);
      setTournaments(prev => prev.filter(t => t.id !== id));
    } catch (e) {
      console.error(e);
      alert('삭제에 실패했습니다.');
    }
  };

  if (fetching) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="spinner" />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Navbar />
      <main className={styles.main}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>🏆 정기 대회 관리</h1>
            <p className={styles.sub}>동호회 자체 대회를 개설하고 팀/개인전 대진표를 관리합니다.</p>
          </div>
          {isAdmin && (
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
              + 새 대회 생성
            </button>
          )}
        </div>

        <div className={styles.list}>
          {tournaments.length === 0 ? (
            <div className="card" style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--txt2)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🏆</div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--txt)', marginBottom: '6px' }}>아직 개설된 정기 대회가 없습니다</h3>
              <p style={{ fontSize: '0.85rem' }}>새 대회 생성 버튼을 눌러 첫 번째 토너먼트를 개설해 보세요.</p>
            </div>
          ) : (
            tournaments.map(t => (
              <div 
                key={t.id} 
                className="card" 
                style={{ 
                  padding: '20px 22px', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  cursor: 'pointer', 
                  marginBottom: '16px',
                  position: 'relative'
                }} 
                onClick={() => router.push('/tournaments/' + t.id)}
              >
                <div>
                  <h3 style={{ margin: '0 0 10px 0', fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--txt)' }}>
                    🏆 {t.title}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      <span className="hero-chip" style={{ fontSize: '11px', padding: '3px 12px' }}>
                        📅 {t.date} {t.time && `⏰ ${t.time}`}
                      </span>
                      <span className="hero-chip" style={{ fontSize: '11px', padding: '3px 12px' }}>
                        🎾 {t.courtDetails ? t.courtDetails.map(c => c.name).join(', ') : `${t.courts}코트`}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      <span className={t.type === 'team' ? 'badge badge-blue' : t.type === 'fixed_pair' ? 'badge badge-green' : 'badge badge-purple'}>
                        {t.type === 'team' ? '👥 팀전' : t.type === 'fixed_pair' ? '👫 개인전(고정페어)' : '👤 개인전(순환)'}
                      </span>
                      <span className={
                        t.status === 'draft' ? 'badge badge-gold' :
                        t.status === 'picking' ? 'badge badge-blue' :
                        t.status === 'playing' ? 'badge badge-green' : 'badge'
                      } style={t.status === 'completed' ? { background: 'rgba(0,0,0,0.06)', color: 'var(--txt2)' } : {}}>
                        {t.status === 'draft' ? '📝 참가자 모집중' :
                         t.status === 'picking' ? '🤝 선수 선발중' :
                         t.status === 'playing' ? '🎾 경기 진행중' : '✅ 대회 종료'}
                      </span>
                    </div>
                  </div>
                </div>
                {isAdmin && (
                  <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); handleDelete(t.id, t.title); }}>삭제</button>
                )}
              </div>
            ))
          )}
        </div>

        {showAddModal && (
          <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <h2 style={{ marginTop: 0 }}>새 대회 만들기</h2>
              <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>대회명</label>
                  <input type="text" className="input" style={{ width: '100%' }} value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="예: 2026년 8월 정기 대회" required />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>대회 날짜 (투표 연동)</label>
                  <input type="date" className="input" style={{ width: '100%', maxWidth: '100%', minWidth: '0', boxSizing: 'border-box', WebkitBoxSizing: 'border-box', display: 'block', margin: 0, WebkitAppearance: 'none', appearance: 'none' }} value={newDate} onChange={e => setNewDate(e.target.value)} required />
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>선택한 날짜의 투표 참석자 명단이 자동 연동됩니다.</p>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>대회 방식</label>
                  <select className="input" style={{ width: '100%' }} value={newType} onChange={e => setNewType(e.target.value)}>
                    <option value="team">👥 팀전 (조장 선발 후 선수 뽑기)</option>
                    <option value="individual">👤 개인전 (NTRP 기반 파트너 순환 매칭)</option>
                    <option value="fixed_pair">👫 개인전 (고정 파트너 / 고정 페어 리그전)</option>
                  </select>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>취소</button>
                  <button type="submit" className="btn btn-primary">생성하기</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

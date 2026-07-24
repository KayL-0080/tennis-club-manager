// app/dashboard/page.js — 대진표 목록 대시보드
'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getSchedules, createSchedule, deleteSchedule, getMembers, getEvents, updateClub } from '@/lib/firestore';
import Navbar from '@/components/Navbar';
import SettingsTab from '@/components/tabs/SettingsTab';
import styles from './dashboard.module.css';

export default function Dashboard() {
  const { user, isAdmin, isSuperAdmin, loading, currentClubId, clubs, setClubs } = useAuth();
  const currentClub = clubs.find(c => c.id === currentClubId);
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'settings'
  const [schedules, setSchedules] = useState([]);
  const [members, setMembers] = useState([]);
  const [events, setEvents] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  // Settings state
  const defaultDate = new Date().toLocaleDateString('en-CA');
  const [matchDate, setMatchDate] = useState(defaultDate);
  const [participants, setParticipants] = useState([]);
  const [groups, setGroups] = useState([]);
  const [rounds, setRounds] = useState(6);
  const [courts, setCourts] = useState(2);
  const [mensDoublesCount, setMensDoublesCount] = useState(0);
  const [womensDoublesCount, setWomensDoublesCount] = useState(0);
  const [mixedCount, setMixedCount] = useState(0);
  const [jointCount, setJointCount] = useState(0);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('12:00');

  const load = useCallback(async () => {
    if (!currentClubId) {
      setFetching(false);
      return;
    }
    setFetching(true);
    try {
      try {
        const mbrs = await getMembers(currentClubId);
        setMembers(mbrs);
      } catch(e) {
        console.warn('getMembers failed', e);
      }
      
      try {
        const data = await getSchedules(currentClubId);
        setSchedules(data);
      } catch(e) {
        console.warn('getSchedules failed', e);
      }

      try {
        const evts = await getEvents(currentClubId);
        setEvents(evts.filter(e => !e.isCancelled));
      } catch(e) {
        console.warn('getEvents failed', e);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setFetching(false);
    }
  }, [currentClubId, isAdmin]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!loading && !fetching && !currentClubId) {
      router.replace('/');
    }
  }, [loading, fetching, currentClubId, router]);

  const handleScheduleGenerated = async (schedRounds, genStats) => {
    setCreating(true);
    try {
      const r = schedRounds.length;
      const c = schedRounds[0]?.length ?? 0;
      
      const payload = {
        title: `대진표 ${matchDate || new Date().toLocaleDateString('ko-KR')}`,
        matchDate,
        participants,
        groups,
        rounds,
        courts,
        mensDoublesCount,
        womensDoublesCount,
        mixedCount,
        jointCount,
        startTime,
        endTime,
        schedule: schedRounds,
        scores: {},
        scheduleRounds_: r,
        scheduleCourts_: c,
        lastGenStats: genStats,
        history: [],
        createdBy: user?.displayName || user?.email?.split('@')[0] || '알 수 없음',
      };
      
      const id = await createSchedule(currentClubId, payload);
      alert('대진표가 생성되어 목록에 추가되었습니다.');
      
      // Reset settings
      setParticipants([]);
      setGroups([]);
      
      // Reload list and switch tab
      await load();
      setActiveTab('list');
    } catch (error) {
      console.error(error);
      alert('대진표 생성 중 오류가 발생했습니다: ' + error.message);
    } finally {
      setCreating(false);
    }
  };

  const handleRenameClub = async () => {
    if (!isAdmin || !currentClub) return;
    const newName = prompt('새 클럽 이름을 입력하세요:', currentClub.name);
    if (newName && newName.trim() !== '' && newName !== currentClub.name) {
      try {
        await updateClub(currentClubId, { name: newName.trim() });
        setClubs(prev => prev.map(c => c.id === currentClubId ? { ...c, name: newName.trim() } : c));
      } catch (err) {
        console.error(err);
        alert('이름 변경에 실패했습니다.');
      }
    }
  };

  const handleScheduleManual = async (schedRounds) => {
    setCreating(true);
    try {
      const r = schedRounds.length;
      const c = schedRounds[0]?.length ?? 0;
      
      const payload = {
        title: `대진표 ${matchDate || new Date().toLocaleDateString('ko-KR')}`,
        matchDate,
        participants,
        groups,
        rounds,
        courts,
        mensDoublesCount,
        womensDoublesCount,
        mixedCount,
        jointCount,
        startTime,
        endTime,
        schedule: schedRounds,
        scores: {},
        scheduleRounds_: r,
        scheduleCourts_: c,
        lastGenStats: null,
        history: [],
        createdBy: user?.displayName || user?.email?.split('@')[0] || '알 수 없음',
      };
      
      const id = await createSchedule(currentClubId, payload);
      alert('빈 대진표가 생성되어 목록에 추가되었습니다.');
      
      setParticipants([]);
      setGroups([]);
      await load();
      setActiveTab('list');
    } catch (error) {
      console.error(error);
      alert('대진표 생성 중 오류가 발생했습니다: ' + error.message);
    } finally {
      setCreating(false);
    }
  };

  const remove = async (id, title) => {
    if (!confirm(`"${title}" 대진표를 삭제할까요?`)) return;
    await deleteSchedule(currentClubId, id);
    setSchedules((prev) => prev.filter((s) => s.id !== id));
  };

  if (fetching && schedules.length === 0) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="spinner" />
      </div>
    );
  }

  const todayStr = new Date().toLocaleDateString('en-CA');
  const isCompleted = (s) => s.matchDate && s.matchDate < todayStr;
  
  const upcomingSchedules = schedules.filter(s => !isCompleted(s)).sort((a, b) => {
    const da = a.matchDate || '9999-12-31';
    const db = b.matchDate || '9999-12-31';
    return da.localeCompare(db);
  });
  
  const completedSchedules = schedules.filter(isCompleted).sort((a, b) => {
    const da = a.matchDate || '0000-00-00';
    const db = b.matchDate || '0000-00-00';
    return db.localeCompare(da);
  });

  return (
    <div className={styles.page}>
      <Navbar />
      <main className={styles.main}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              Tennis Club Manager({currentClub?.name || '로딩 중...'})
              {isAdmin && (
                <button 
                  className="btn btn-secondary btn-sm" 
                  style={{ padding: '2px 8px', fontSize: '16px' }} 
                  onClick={handleRenameClub}
                  title="클럽 이름 변경"
                >
                  ✏️
                </button>
              )}
            </h1>
            <p className={styles.sub}>저장된 대진표를 열거나 새 날짜의 대진표를 만드세요</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className={`btn ${activeTab === 'list' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('list')}>
              📊 대진표 목록
            </button>
            {isAdmin && (
              <button className={`btn ${activeTab === 'settings' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('settings')}>
                + 대진표 만들기
              </button>
            )}
          </div>
        </div>

        {!currentClubId ? (
          <div className={styles.center}>
            <span className="spinner" />
          </div>
        ) : fetching ? (
          <div className={styles.center}><span className="spinner" /></div>
        ) : activeTab === 'list' ? (
          schedules.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🎾</div>
              <p className={styles.emptyTitle}>아직 저장된 대진표가 없습니다</p>
              <p className={styles.emptySub}>대진표 만들기 탭에서 시작하세요</p>
            </div>
          ) : (
            <div>
              {upcomingSchedules.length > 0 && (
                <>
                  <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--navy)', marginBottom: '12px' }}>다가오는 경기</h2>
                  <div className={styles.grid}>
                    {upcomingSchedules.map((s) => (
                      <ScheduleCard key={s.id} s={s} isAdmin={isAdmin} onOpen={() => router.push(`/editor/${s.id}`)} onDelete={() => remove(s.id, s.title)} />
                    ))}
                  </div>
                </>
              )}
              
              {completedSchedules.length > 0 && (
                <div style={{ marginTop: '24px' }}>
                  <button 
                    className="btn btn-secondary" 
                    style={{ width: '100%', marginBottom: '12px', justifyContent: 'center' }}
                    onClick={() => setShowCompleted(!showCompleted)}
                  >
                    {showCompleted ? '완료된 경기 접기' : `완료된 경기 보기 (${completedSchedules.length}건)`}
                  </button>
                  
                  {showCompleted && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {completedSchedules.map(s => {
                        const dateObj = s.matchDate ? new Date(s.matchDate) : (s.updatedAt?.toDate?.() ?? new Date());
                        const dateStr = dateObj.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
                        return (
                          <div 
                            key={s.id} 
                            className="card" 
                            style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'box-shadow 0.15s', marginBottom: 0 }}
                            onClick={() => router.push(`/editor/${s.id}`)}
                            onMouseOver={(e) => e.currentTarget.style.boxShadow = '0 4px 16px rgba(26,61,124,0.12)'}
                            onMouseOut={(e) => e.currentTarget.style.boxShadow = 'none'}
                          >
                            <div>
                              <div style={{ fontWeight: 'bold', fontSize: '16px', color: 'var(--navy)', marginBottom: '4px' }}>{s.title}</div>
                              <div style={{ fontSize: '16px', color: 'var(--text-muted)' }}>{dateStr}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span style={{ fontSize: '16px', color: 'var(--text-muted)' }}>{s.participants?.length ?? 0}명 참여</span>
                              {isSuperAdmin && (
                                <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); remove(s.id, s.title); }}>삭제</button>
                              )}
                              <span style={{ color: 'var(--primary)' }}>&rarr;</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        ) : (
          <div style={{ marginTop: '20px' }}>
            <SettingsTab
              events={events}
              matchDate={matchDate} setMatchDate={setMatchDate}
              members={members}
              participants={participants} setParticipants={setParticipants}
              rounds={rounds} setRounds={setRounds}
              courts={courts} setCourts={setCourts}
              mensDoublesCount={mensDoublesCount} setMensDoublesCount={setMensDoublesCount}
              womensDoublesCount={womensDoublesCount} setWomensDoublesCount={setWomensDoublesCount}
              mixedCount={mixedCount} setMixedCount={setMixedCount}
              jointCount={jointCount} setJointCount={setJointCount}
              startTime={startTime} setStartTime={setStartTime}
              endTime={endTime} setEndTime={setEndTime}
              groups={groups} setGroups={setGroups}
              onScheduleGenerated={handleScheduleGenerated}
              onScheduleManual={handleScheduleManual}
              onSave={() => { alert('대진표 목록에 저장되었습니다.'); setActiveTab('list'); }}
              onSaveAndExit={() => setActiveTab('list')}
              onGoto={() => {}}
            />
          </div>
        )}
      </main>
    </div>
  );
}

function ScheduleCard({ s, isAdmin, onOpen, onDelete }) {
  const dateObj = s.matchDate ? new Date(s.matchDate) : (s.updatedAt?.toDate?.() ?? new Date());
  const dateStr = dateObj.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = !s.matchDate ? dateObj.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div className={`card ${styles.schedCard}`} onClick={onOpen}>
      <div className={styles.schedTop}>
        <div className={styles.schedIcon}>🎾</div>
        <div className={styles.schedInfo}>
          <h2 className={styles.schedTitle}>{s.title}</h2>
          <p className={styles.schedMeta}>
            {s.participants?.length ?? 0}명 · {s.rounds ?? 0}라운드 · {s.courts ?? 0}코트
          </p>
        </div>
      </div>
      <div className={styles.schedBadges}>
        {s.schedule ? (
          <span className="badge badge-green">✓ 생성됨</span>
        ) : (
          <span className="badge badge-gold">미생성</span>
        )}
        {s.mensDoublesCount > 0 && <span className="badge badge-blue">남복 {s.mensDoublesCount}게임</span>}
        {s.womensDoublesCount > 0 && <span className="badge badge-purple">여복 {s.womensDoublesCount}게임</span>}
        {s.mixedCount > 0 && <span className="badge badge-purple">혼복 {s.mixedCount}게임</span>}
      </div>
      {(s.startTime || s.endTime) && (
        <div style={{ fontSize: '15px', color: 'var(--text-muted)', marginBottom: '8px' }}>
          ⏱ 경기시간: {s.startTime || '?'} ~ {s.endTime || '?'}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p className={styles.schedDate}>{dateStr} {timeStr}</p>
        <span style={{ fontSize: '16px', color: 'var(--text-muted)' }}>생성자: {s.createdBy || '알 수 없음'}</span>
      </div>
      <div className={styles.schedActions}>
        <button className="btn btn-secondary" onClick={(e) => { e.stopPropagation(); onOpen(); }}>기록/입력</button>
        {isAdmin && <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); onDelete(); }}>삭제</button>}
      </div>
    </div>
  );
}

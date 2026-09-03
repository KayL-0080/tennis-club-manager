// app/dashboard/page.js — 대진표 목록 대시보드
'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getSchedules, createSchedule, deleteSchedule, getMembers, initDefaultMembers, getEvents } from '@/lib/firestore';
import Navbar from '@/components/Navbar';
import SettingsTab from '@/components/tabs/SettingsTab';
import styles from './dashboard.module.css';

export default function Dashboard() {
  const { user, isAdmin, loading } = useAuth();
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
  const [allowSingles, setAllowSingles] = useState(false);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('12:00');

  const load = useCallback(async () => {
    setFetching(true);
    try {
      await initDefaultMembers('shared');
      const mbrs = await getMembers('shared');
      setMembers(mbrs);
      
      const data = await getSchedules('shared');
      setSchedules(data);

      const evts = await getEvents('shared');
      setEvents(evts);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      alert('데이터를 불러오지 못했습니다. Firestore 권한 설정을 확인해주세요.');
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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
        allowSingles,
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
      
      const id = await createSchedule('shared', payload);
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
        allowSingles,
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
      
      const id = await createSchedule('shared', payload);
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
    await deleteSchedule('shared', id);
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
        {/* Eutripus Hero Banner */}
        <section className={styles.hero}>
          <div className={styles.heroBg}></div>
          <div className={styles.heroInner}>
            <div className={styles.heroContent}>
              <div className={styles.heroTag}>
                <span>🎾</span>
                <span>TENNIS CRAZY CLUB</span>
              </div>
              <h1 className={styles.heroTitle}>테니스 매치 & 대진표 매니저</h1>
              <p className={styles.heroSub}>NTRP 밸런스를 고려한 스마트 대진표 자동 생성 및 정기 대회 관리</p>
              <div className={styles.heroChips}>
                <span className={styles.heroChip}>👥 등록 회원 {members.length}명</span>
                <span className={styles.heroChip}>🎾 등록 대진표 {schedules.length}개</span>
                <span className={styles.heroChip}>🏆 정기 대회 진행중</span>
              </div>
            </div>
            <div className={styles.heroActions}>
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
        </section>

        {fetching ? (
          <div className={styles.center}><span className="spinner" /></div>
        ) : activeTab === 'list' ? (
          schedules.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🎾</div>
              <p className={styles.emptyTitle}>아직 저장된 대진표가 없습니다</p>
              <p className={styles.emptySub}>대진표 만들기 탭에서 새 매치를 시작하세요</p>
            </div>
          ) : (
            <div>
              {upcomingSchedules.length > 0 && (
                <>
                  <div className="section-head">
                    <span>🎾 다가오는 경기 일정</span>
                  </div>
                  <div className={styles.grid}>
                    {upcomingSchedules.map((s) => (
                      <ScheduleCard key={s.id} s={s} members={members} isAdmin={isAdmin} onOpen={() => router.push(`/editor/${s.id}`)} onDelete={() => remove(s.id, s.title)} />
                    ))}
                  </div>
                </>
              )}
              
              {completedSchedules.length > 0 && (
                <div style={{ marginTop: '32px' }}>
                  <div className="section-head" style={{ marginBottom: '14px' }}>
                    <span>🏁 지난 경기 기록</span>
                  </div>
                  <button 
                    className="btn btn-secondary" 
                    style={{ width: '100%', marginBottom: '14px', justifyContent: 'center' }}
                    onClick={() => setShowCompleted(!showCompleted)}
                  >
                    {showCompleted ? '완료된 경기 목록 접기 ▲' : `완료된 경기 보기 (${completedSchedules.length}건) ▼`}
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
                              <div style={{ fontWeight: 'bold', fontSize: '14px', color: 'var(--navy)', marginBottom: '4px' }}>{s.title}</div>
                              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{dateStr}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{s.participants?.length ?? 0}명 참여</span>
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
              allowSingles={allowSingles} setAllowSingles={setAllowSingles}
              startTime={startTime} setStartTime={setStartTime}
              endTime={endTime} setEndTime={setEndTime}
              groups={groups} setGroups={setGroups}
              onScheduleGenerated={handleScheduleGenerated}
              onScheduleManual={handleScheduleManual}
              onSave={() => { alert('대진표 목록에 저장되었습니다.'); setActiveTab('list'); }}
              onSaveAndExit={() => setActiveTab('list')}
              onGoto={() => {}}
              onReloadMembers={load}
            />
          </div>
        )}
      </main>
    </div>
  );
}

function ScheduleCard({ s, members, isAdmin, onOpen, onDelete }) {
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
        {(() => {
          let totalMens = 0, totalWomens = 0, totalMixed = 0, totalJoint = 0, totalSingles = 0;
          if (s.schedule) {
            const memberMap = new Map((members || []).map(m => [m.id, m]));
            s.schedule.forEach(round => {
              round.forEach(m => {
                const getPlayers = (teamIds) => (teamIds || []).map(id => memberMap.get(id)).filter(Boolean);
                const pA = getPlayers(m.teamA);
                const pB = getPlayers(m.teamB);
                const allPlayers = [...pA, ...pB];
                
                if (allPlayers.length === 2) {
                  totalSingles++;
                } else if (allPlayers.length === 4) {
                  const aMales = pA.filter(p => p.gender === 'M').length;
                  const aFemales = pA.filter(p => p.gender === 'F').length;
                  const bMales = pB.filter(p => p.gender === 'M').length;
                  const bFemales = pB.filter(p => p.gender === 'F').length;
                  
                  if (aMales === 2 && bMales === 2) totalMens++;
                  else if (aFemales === 2 && bFemales === 2) totalWomens++;
                  else if (aMales === 1 && aFemales === 1 && bMales === 1 && bFemales === 1) totalMixed++;
                  else totalJoint++;
                } else {
                  totalJoint++; // 3명 등 기타 불완전 매치
                }
              });
            });
          } else {
            totalMens = (s.mensDoublesCount || 0) * (s.rounds || 0);
            totalWomens = (s.womensDoublesCount || 0) * (s.rounds || 0);
            totalMixed = (s.mixedCount || 0) * (s.rounds || 0);
            const isSinglesActive = s.allowSingles && s.participants && s.participants.length < s.courts * 4 && s.participants.length > 0;
            const singlesPerRound = isSinglesActive ? Math.min(s.courts, Math.ceil((s.courts * 4 - s.participants.length) / 2)) : 0;
            totalSingles = singlesPerRound * (s.rounds || 0);
            const doublesPerRound = s.courts - singlesPerRound;
            totalJoint = Math.max(0, (s.rounds || 0) * doublesPerRound - totalMens - totalWomens - totalMixed);
          }

          return (
            <>
              {totalMens > 0 && <span className="badge badge-blue">남복 {totalMens}경기</span>}
              {totalWomens > 0 && <span className="badge badge-red">여복 {totalWomens}경기</span>}
              {totalMixed > 0 && <span className="badge badge-purple">혼복 {totalMixed}경기</span>}
              {totalJoint > 0 && <span className="badge badge-green">잡복 {totalJoint}경기</span>}
              {totalSingles > 0 && <span className="badge badge-gold">단식 {totalSingles}경기</span>}
            </>
          );
        })()}
      </div>
      {(s.startTime || s.endTime) && (
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
          ⏱ 경기시간: {s.startTime || '?'} ~ {s.endTime || '?'}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p className={styles.schedDate}>{dateStr} {timeStr}</p>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>생성자: {s.createdBy || '알 수 없음'}</span>
      </div>
      <div className={styles.schedActions}>
        <button className="btn btn-secondary" onClick={(e) => { e.stopPropagation(); onOpen(); }}>기록/입력</button>
        {isAdmin && <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); onDelete(); }}>삭제</button>}
      </div>
    </div>
  );
}

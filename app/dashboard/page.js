// app/dashboard/page.js — 대진표 목록 대시보드
'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getSchedules, createSchedule, deleteSchedule, getMembers, initDefaultMembers, getEvents } from '@/lib/firestore';
import Navbar from '@/components/Navbar';
import SettingsTab from '@/components/tabs/SettingsTab';
import styles from './dashboard.module.css';

const formatDateToYMD = (d = new Date()) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export default function Dashboard() {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'settings'
  const [schedules, setSchedules] = useState([]);
  const [members, setMembers] = useState([]);
  const [events, setEvents] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [creating, setCreating] = useState(false);
  const [completedSelectedMonth, setCompletedSelectedMonth] = useState(() => formatDateToYMD().substring(0, 7));

  // Settings state
  const defaultDate = formatDateToYMD();
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

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

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

  const currentMonth = formatDateToYMD().substring(0, 7);
  const completedAvailableMonths = [...new Set([
    currentMonth,
    ...completedSchedules.map(s => {
      if (s.matchDate) return s.matchDate.substring(0, 7);
      const d = s.updatedAt?.toDate?.() ?? new Date();
      return d.toISOString().substring(0, 7);
    })
  ])].filter(Boolean).sort().reverse();

  const filteredCompletedSchedules = completedSelectedMonth === 'ALL'
    ? completedSchedules
    : completedSchedules.filter(s => {
        const ym = s.matchDate ? s.matchDate.substring(0, 7) : (s.updatedAt?.toDate?.() ?? new Date()).toISOString().substring(0, 7);
        return ym === completedSelectedMonth;
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
              <div className={styles.heroTag} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <img 
                  src="/apple-touch-icon.png" 
                  alt="테친회" 
                  style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }} 
                />
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
                  <div className="section-head" style={{ marginBottom: '12px' }}>
                    <span>🎾 다가오는 경기 일정</span>
                  </div>
                  <div className={styles.grid}>
                    {upcomingSchedules.map((s) => (
                      <ScheduleCard 
                        key={s.id} 
                        s={s} 
                        members={members} 
                        isAdmin={isAdmin} 
                        isCompleted={false}
                        onOpen={() => router.push(`/editor/${s.id}`)} 
                        onDelete={() => remove(s.id, s.title)} 
                      />
                    ))}
                  </div>
                </>
              )}
              
              {completedSchedules.length > 0 && (
                <div style={{ marginTop: '28px' }}>
                  <div className="card" style={{ padding: '12px 16px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--txt)', letterSpacing: '-0.02em' }}>
                          🏁 지난 경기 기록
                        </h2>
                        <span className="badge badge-blue" style={{ fontSize: '12px', padding: '2px 8px' }}>
                          총 {filteredCompletedSchedules.length}건
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--txt2)' }}>조회 년월:</label>
                        <select 
                          className="input input-sm" 
                          style={{ width: 'auto', padding: '5px 12px', fontSize: '13px' }} 
                          value={completedSelectedMonth} 
                          onChange={e => setCompletedSelectedMonth(e.target.value)}
                        >
                          <option value="ALL">전체 보기 ({completedSchedules.length}건)</option>
                          {completedAvailableMonths.map(m => {
                            const count = completedSchedules.filter(s => {
                              const ym = s.matchDate ? s.matchDate.substring(0, 7) : (s.updatedAt?.toDate?.() ?? new Date()).toISOString().substring(0, 7);
                              return ym === m;
                            }).length;
                            const [yyyy, mm] = m.split('-');
                            return <option key={m} value={m}>{yyyy}년 {mm}월 ({count}건)</option>;
                          })}
                        </select>
                      </div>
                    </div>
                  </div>

                  {filteredCompletedSchedules.length === 0 ? (
                    <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                      선택한 기간에 기록된 지난 경기가 없습니다.
                    </div>
                  ) : (
                    <>
                      {/* 모바일 화면용 카드 뷰 (연한 회색 배경 적용) */}
                      <div className={styles.mobileView}>
                        {filteredCompletedSchedules.map((s) => (
                          <ScheduleCard 
                            key={s.id} 
                            s={s} 
                            members={members} 
                            isAdmin={isAdmin} 
                            isCompleted={true}
                            onOpen={() => router.push(`/editor/${s.id}`)} 
                            onDelete={() => remove(s.id, s.title)} 
                          />
                        ))}
                      </div>

                      {/* PC 및 대형 화면용 테이블 뷰 */}
                      <div className={`card ${styles.desktopView}`} style={{ padding: '16px 20px', marginBottom: 0 }}>
                        <div className="table-wrap">
                          <table>
                            <thead>
                              <tr>
                                <th style={{ width: 50 }}>No.</th>
                                <th style={{ minWidth: 125 }}>경기 일자</th>
                                <th>대진표 제목</th>
                                <th>경기 시간</th>
                                <th>코트/라운드</th>
                                <th>참여 인원</th>
                                <th>매치 구성</th>
                                <th>생성자</th>
                                {isAdmin && <th style={{ width: 65 }}>관리</th>}
                              </tr>
                            </thead>
                            <tbody>
                              {filteredCompletedSchedules.map((s, idx) => {
                                const dateObj = s.matchDate ? new Date(s.matchDate) : (s.updatedAt?.toDate?.() ?? new Date());
                                const dateStr = s.matchDate || dateObj.toISOString().substring(0, 10);
                                const dayOfWeek = dayNames[new Date(dateStr).getDay()] || '';
                                const timeDisplay = (s.startTime || s.endTime) ? `${s.startTime || '?'} ~ ${s.endTime || '?'}` : '-';

                                let totalMens = 0, totalWomens = 0, totalMixed = 0, totalJoint = 0, totalSingles = 0;
                                if (s.schedule) {
                                  const memberMap = new Map((members || []).map(m => [m.id, m]));
                                  s.schedule.forEach(round => {
                                    round.forEach(m => {
                                      const getPlayers = (teamIds) => (teamIds || []).map(id => memberMap.get(id)).filter(Boolean);
                                      const pA = getPlayers(m.teamA);
                                      const pB = getPlayers(m.teamB);
                                      const allPlayers = [...pA, ...pB];
                                      if (allPlayers.length === 2) totalSingles++;
                                      else if (allPlayers.length === 4) {
                                        const aMales = pA.filter(p => p.gender === 'M').length;
                                        const aFemales = pA.filter(p => p.gender === 'F').length;
                                        const bMales = pB.filter(p => p.gender === 'M').length;
                                        const bFemales = pB.filter(p => p.gender === 'F').length;
                                        if (aMales === 2 && bMales === 2) totalMens++;
                                        else if (aFemales === 2 && bFemales === 2) totalWomens++;
                                        else if (aMales === 1 && aFemales === 1 && bMales === 1 && bFemales === 1) totalMixed++;
                                        else totalJoint++;
                                      } else {
                                        totalJoint++;
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
                                  <tr 
                                    key={s.id} 
                                    style={{ cursor: 'pointer', transition: 'background 0.15s' }} 
                                    onClick={() => router.push(`/editor/${s.id}`)}
                                  >
                                    <td><strong>{idx + 1}</strong></td>
                                    <td>
                                      <button
                                        type="button"
                                        style={{
                                          background: 'rgba(0, 122, 255, 0.08)',
                                          color: 'var(--ios-blue)',
                                          border: '1px solid rgba(0, 122, 255, 0.22)',
                                          padding: '3px 8px',
                                          borderRadius: '6px',
                                          fontWeight: 700,
                                          fontSize: '12px',
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px'
                                        }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          router.push(`/editor/${s.id}`);
                                        }}
                                      >
                                        📅 {dateStr} {dayOfWeek ? `(${dayOfWeek})` : ''} ↗
                                      </button>
                                    </td>
                                    <td style={{ fontWeight: 700, color: 'var(--txt)', wordBreak: 'keep-all' }}>
                                      {s.title}
                                    </td>
                                    <td style={{ fontSize: '12px', color: 'var(--txt2)', whiteSpace: 'nowrap' }}>
                                      {timeDisplay}
                                    </td>
                                    <td style={{ fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                                      <strong>{s.rounds ?? 0}R</strong> / {s.courts ?? 0}코트
                                    </td>
                                    <td style={{ whiteSpace: 'nowrap' }}>
                                      <span style={{ fontWeight: 600 }}>{s.participants?.length ?? 0}명</span>
                                    </td>
                                    <td>
                                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                        {totalMens > 0 && <span className="badge badge-blue" style={{ fontSize: '10.5px', padding: '1px 5px' }}>남복 {totalMens}</span>}
                                        {totalWomens > 0 && <span className="badge badge-red" style={{ fontSize: '10.5px', padding: '1px 5px' }}>여복 {totalWomens}</span>}
                                        {totalMixed > 0 && <span className="badge badge-purple" style={{ fontSize: '10.5px', padding: '1px 5px' }}>혼복 {totalMixed}</span>}
                                        {totalJoint > 0 && <span className="badge badge-green" style={{ fontSize: '10.5px', padding: '1px 5px' }}>잡복 {totalJoint}</span>}
                                        {totalSingles > 0 && <span className="badge badge-gold" style={{ fontSize: '10.5px', padding: '1px 5px' }}>단식 {totalSingles}</span>}
                                        {!s.schedule && <span className="badge badge-gold" style={{ fontSize: '10.5px', padding: '1px 5px' }}>미생성</span>}
                                      </div>
                                    </td>
                                    <td style={{ fontSize: '12px', color: 'var(--txt3)', whiteSpace: 'nowrap' }}>
                                      {s.createdBy || '-'}
                                    </td>
                                    {isAdmin && (
                                      <td onClick={e => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                                        <button
                                          className="btn btn-danger btn-sm"
                                          style={{ padding: '2px 8px', fontSize: '11px' }}
                                          onClick={() => remove(s.id, s.title)}
                                        >
                                          삭제
                                        </button>
                                      </td>
                                    )}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
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

function ScheduleCard({ s, members, isAdmin, onOpen, onDelete, isCompleted }) {
  const dateObj = s.matchDate ? new Date(s.matchDate) : (s.updatedAt?.toDate?.() ?? new Date());
  const dateStr = dateObj.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = !s.matchDate ? dateObj.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div className={`card ${styles.schedCard} ${isCompleted ? styles.completedSchedCard : ''}`} onClick={onOpen}>
      <div className={styles.schedTop}>
        <div className={styles.schedIcon} style={isCompleted ? { background: 'rgba(156, 163, 175, 0.12)', borderColor: 'rgba(156, 163, 175, 0.3)' } : {}}>
          {isCompleted ? '🏁' : '🎾'}
        </div>
        <div className={styles.schedInfo}>
          <h2 className={styles.schedTitle} style={isCompleted ? { color: '#374151' } : {}}>{s.title}</h2>
          <p className={styles.schedMeta}>
            {s.participants?.length ?? 0}명 · {s.rounds ?? 0}R · {s.courts ?? 0}코트
          </p>
        </div>
      </div>
      <div className={styles.schedBadges}>
        {isCompleted && (
          <span className="badge badge-gray" style={{ padding: '2px 6px', fontSize: '11px', backgroundColor: '#e2e8f0', color: '#475569' }}>
            종료
          </span>
        )}
        {s.schedule ? (
          <span className="badge badge-green" style={{ padding: '2px 6px', fontSize: '11px' }}>✓ 생성됨</span>
        ) : (
          <span className="badge badge-gold" style={{ padding: '2px 6px', fontSize: '11px' }}>미생성</span>
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
                  totalJoint++;
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
              {totalMens > 0 && <span className="badge badge-blue" style={{ padding: '2px 6px', fontSize: '11px' }}>남복 {totalMens}</span>}
              {totalWomens > 0 && <span className="badge badge-red" style={{ padding: '2px 6px', fontSize: '11px' }}>여복 {totalWomens}</span>}
              {totalMixed > 0 && <span className="badge badge-purple" style={{ padding: '2px 6px', fontSize: '11px' }}>혼복 {totalMixed}</span>}
              {totalJoint > 0 && <span className="badge badge-green" style={{ padding: '2px 6px', fontSize: '11px' }}>잡복 {totalJoint}</span>}
              {totalSingles > 0 && <span className="badge badge-gold" style={{ padding: '2px 6px', fontSize: '11px' }}>단식 {totalSingles}</span>}
            </>
          );
        })()}
      </div>
      <div style={{ fontSize: '11.5px', color: 'var(--txt2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
        <span>📅 {dateStr}</span>
        {(s.startTime || s.endTime) ? (
          <span>⏰ {s.startTime || '?'}~{s.endTime || '?'}</span>
        ) : (
          <span>{timeStr}</span>
        )}
      </div>
      <div className={styles.schedActions}>
        <button className="btn btn-secondary btn-sm" style={{ padding: '3px 9px', fontSize: '12px' }} onClick={(e) => { e.stopPropagation(); onOpen(); }}>
          {isCompleted ? '기록 보기' : '기록/입력'}
        </button>
        {isAdmin && <button className="btn btn-danger btn-sm" style={{ padding: '3px 8px', fontSize: '11px' }} onClick={(e) => { e.stopPropagation(); onDelete(); }}>삭제</button>}
      </div>
    </div>
  );
}

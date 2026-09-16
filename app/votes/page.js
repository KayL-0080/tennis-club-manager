'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  getMembers, getEvents, getEvent, createEvent, updateEventAttendees, updateEvent, deleteEvent,
  getMeetingRules, updateMeetingRules
} from '@/lib/firestore';
import Navbar from '@/components/Navbar';
import styles from '../dashboard/dashboard.module.css';

const formatDateToYMD = (d = new Date()) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export default function VotesPage() {
  const { isAdmin } = useAuth();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [members, setMembers] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Overall Status State
  const [showVoters, setShowVoters] = useState(false);
  const [showNonVoters, setShowNonVoters] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => formatDateToYMD().substring(0, 7));
  
  // Reminder Modal State
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderText, setReminderText] = useState('');

  // For Edit Mode
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editLocation, setEditLocation] = useState('');
  
  // Meeting Rules State (클럽 정기 모임 설정)
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [meetingRules, setMeetingRules] = useState([]);
  const [newRuleDay, setNewRuleDay] = useState(2); // 2 = 화요일
  const [newRuleTitle, setNewRuleTitle] = useState('정기 모임 (화)');
  const [newRuleStartTime, setNewRuleStartTime] = useState('18:00');
  const [newRuleEndTime, setNewRuleEndTime] = useState('20:00');
  const [newRuleLocation, setNewRuleLocation] = useState('별도 테니스장');
  const [savingRules, setSavingRules] = useState(false);

  const DAY_NAMES = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  const DAY_SHORT = ['일', '월', '화', '수', '목', '금', '토'];

  const openModal = useCallback((e, updateUrl = true) => {
    setSelectedEvent(e);
    setIsEditing(false);
    setEditTitle(e?.title || '');
    setEditDate(e?.date || '');
    setEditStartTime(e?.startTime || '');
    setEditEndTime(e?.endTime || '');
    setEditLocation(e?.location || '');
    if (updateUrl && typeof window !== 'undefined' && e?.id) {
      window.history.replaceState(null, '', `/votes?id=${e.id}`);
    }
  }, []);

  const closeModal = useCallback(() => {
    setSelectedEvent(null);
    setIsEditing(false);
    setShowSettingsModal(false);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '/votes');
    }
  }, []);

  // 1. 카카오톡 공유 링크 및 캐시 고속 로드
  useEffect(() => {
    setMounted(true);
    try {
      const cachedEvts = localStorage.getItem('tcm_cached_events');
      const cachedMbrs = localStorage.getItem('tcm_cached_members');
      let restoredEvents = [];
      if (cachedEvts) {
        restoredEvents = JSON.parse(cachedEvts);
        if (Array.isArray(restoredEvents) && restoredEvents.length > 0) {
          setEvents(restoredEvents);
          setFetching(false);
        }
      }
      if (cachedMbrs) {
        setMembers(JSON.parse(cachedMbrs));
      }

      // 카카오톡 URL 파라미터(?id=... 또는 ?eventId=...) 감지 시 즉시 타겟 이벤트 오픈
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const targetId = params.get('id') || params.get('eventId');
        if (targetId) {
          const found = restoredEvents.find(e => e.id === targetId);
          if (found) {
            if (found.date) setSelectedMonth(found.date.substring(0, 7));
            openModal(found, false);
          } else {
            // 캐시에 없으면 단일 문서만 즉시 직접 조회 (100ms 이내 초고속 모달 오픈)
            getEvent('shared', targetId).then(target => {
              if (target) {
                setEvents(prev => prev.some(e => e.id === target.id) ? prev : [target, ...prev]);
                if (target.date) setSelectedMonth(target.date.substring(0, 7));
                openModal(target, false);
                setFetching(false);
              }
            }).catch(console.warn);
          }
        }
      }
    } catch (e) {
      console.warn('Cache restoration error:', e);
    }
  }, [openModal]);

  // 2. 최신 일정 및 회원 데이터를 병렬(Promise.all)로 고속 갱신
  const loadData = useCallback(async () => {
    try {
      const [mbrs, evts, rules] = await Promise.all([
        getMembers('shared'),
        getEvents('shared'),
        getMeetingRules()
      ]);

      const validMembers = mbrs.filter(m => m.role !== '준회원' && m.role !== '게스트');
      validMembers.sort((a, b) => a.name.localeCompare(b.name));
      setMembers(validMembers);
      setMeetingRules(rules);

      const sortedEvts = evts.sort((a, b) => (a.date > b.date ? 1 : -1));
      setEvents(sortedEvts);

      // 캐시 저장
      try {
        localStorage.setItem('tcm_cached_events', JSON.stringify(sortedEvts));
        localStorage.setItem('tcm_cached_members', JSON.stringify(validMembers));
      } catch (e) {
        console.warn('Cache save error:', e);
      }

      // 정기 모임 자동 생성은 화면 렌더링을 차단하지 않도록 비동기 백그라운드 처리
      if (isAdmin && rules && rules.length > 0) {
        (async () => {
          try {
            const now = new Date();
            const toCreate = [];
            for (let i = 0; i < 42; i++) {
              const d = new Date(now);
              d.setDate(d.getDate() + i);
              const day = d.getDay();
              const matchingRules = rules.filter(r => r.enabled !== false && Number(r.day) === day);
              for (const rule of matchingRules) {
                const dateStr = d.toLocaleDateString('en-CA');
                if (!evts.find(e => e.date === dateStr && (e.title === rule.title || !rule.title))) {
                  toCreate.push({
                    date: dateStr,
                    title: rule.title || `정기 모임 (${rule.dayName || DAY_SHORT[day]})`,
                    startTime: rule.startTime || '19:00',
                    endTime: rule.endTime || '22:00',
                    location: rule.location || '그린테니스장',
                    attendees: {}
                  });
                }
              }
            }
            if (toCreate.length > 0) {
              const created = await Promise.all(toCreate.map(async item => {
                const id = await createEvent('shared', item);
                return { id, ...item };
              }));
              setEvents(prev => [...prev, ...created].sort((a, b) => (a.date > b.date ? 1 : -1)));
            }
          } catch (e) {
            console.warn('Background event generator error:', e);
          }
        })();
      }

    } catch (err) {
      console.error('Failed to load votes data:', err);
    } finally {
      setFetching(false);
    }
  }, [isAdmin]);

  const handleAddMeetingRule = () => {
    if (!newRuleStartTime || !newRuleEndTime) {
      alert('시작 시간과 종료 시간을 입력해주세요.');
      return;
    }
    const dayNum = Number(newRuleDay);
    const newRule = {
      id: 'rule_' + Date.now(),
      day: dayNum,
      dayName: DAY_NAMES[dayNum],
      title: newRuleTitle || `정기 모임 (${DAY_SHORT[dayNum]})`,
      startTime: newRuleStartTime,
      endTime: newRuleEndTime,
      location: newRuleLocation || '그린테니스장',
      enabled: true
    };
    setMeetingRules(prev => [...prev, newRule].sort((a, b) => a.day - b.day));
  };

  const handleRemoveMeetingRule = (ruleId) => {
    if (!confirm('이 모임 요일 설정을 삭제하시겠습니까?')) return;
    setMeetingRules(prev => prev.filter(r => r.id !== ruleId));
  };

  const handleSaveMeetingRules = async () => {
    setSavingRules(true);
    try {
      await updateMeetingRules(meetingRules);
      alert('클럽 정기 모임 설정이 저장되었습니다.\n향후 6주간의 일정이 새로 갱신됩니다.');
      setShowSettingsModal(false);
      await loadData();
    } catch (err) {
      console.error('Failed to save meeting rules:', err);
      alert('설정 저장 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setSavingRules(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleAttendance = async (memberId, status) => {
    if (!selectedEvent) return;
    
    const currentStatus = selectedEvent.attendees?.[memberId];
    if (currentStatus === status) return; // No change

    // Check deadline (일반 사용자는 마감 이후 변경 불가, 운영진은 마감 이후에도 언제든 수정 가능)
    if (selectedEvent.date) {
      const [y, m, d] = selectedEvent.date.split('-');
      const deadline = new Date(y, m - 1, d);
      deadline.setDate(deadline.getDate() - 1);
      deadline.setHours(18, 0, 0, 0);
      const isClosed = new Date() > deadline;

      if (!isAdmin && isClosed) {
        alert('투표가 마감되었습니다. (운영진만 마감 후 수정이 가능합니다)');
        return;
      }
    }

    const newAttendees = { ...(selectedEvent.attendees || {}) };
    newAttendees[memberId] = status;

    setSelectedEvent({ ...selectedEvent, attendees: newAttendees });
    
    // Optimistically update list
    setEvents(prev => prev.map(e => e.id === selectedEvent.id ? { ...e, attendees: newAttendees } : e));
    
    // Save to DB
    await updateEvent('shared', selectedEvent.id, { attendees: newAttendees });
  };

  const saveEdit = async () => {
    const updates = {
      title: editTitle,
      date: editDate,
      startTime: editStartTime,
      endTime: editEndTime,
      location: editLocation
    };
    if (selectedEvent) {
      await updateEvent('shared', selectedEvent.id, updates);
      setSelectedEvent({ ...selectedEvent, ...updates });
      setEvents(prev => prev.map(e => e.id === selectedEvent.id ? { ...e, ...updates } : e));
    } else {
      updates.attendees = {};
      const id = await createEvent('shared', updates);
      setEvents(prev => [...prev, { id, ...updates }].sort((a, b) => (a.date > b.date ? 1 : -1)));
    }
    setIsEditing(false);
  };

  const removeEvent = async () => {
    if (!selectedEvent) return;
    if (!confirm('이 일정을 삭제하시겠습니까?')) return;
    await deleteEvent('shared', selectedEvent.id);
    setEvents(prev => prev.filter(e => e.id !== selectedEvent.id));
    closeModal();
  };

  // URL 쿼리 파라미터(?id=... 또는 ?eventId=...)로 접속 시 해당 모임 투표 모달 자동 오픈
  useEffect(() => {
    if (typeof window === 'undefined' || events.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const targetId = params.get('id') || params.get('eventId');
    const targetDate = params.get('date');

    if (targetId) {
      if (selectedEvent && selectedEvent.id === targetId) return;
      const target = events.find(e => e.id === targetId);
      if (target) {
        if (target.date) {
          const monthStr = target.date.substring(0, 7);
          setSelectedMonth(prev => (prev === 'ALL' ? prev : monthStr));
        }
        openModal(target, false);
      }
    } else if (targetDate) {
      if (selectedEvent && selectedEvent.date === targetDate) return;
      const target = events.find(e => e.date === targetDate);
      if (target) {
        setSelectedMonth(prev => (prev === 'ALL' ? prev : targetDate.substring(0, 7)));
        openModal(target, false);
      }
    }
  }, [events, selectedEvent, openModal]);

  const handleShare = () => {
    if (!selectedEvent) return;
    
    const attendees = members.filter(m => selectedEvent.attendees?.[m.id] === 'Y').map(m => m.name);
    const absentees = members.filter(m => selectedEvent.attendees?.[m.id] === 'N').map(m => m.name);
    const unknowns = members.filter(m => !selectedEvent.attendees?.[m.id] || selectedEvent.attendees?.[m.id] === '?').map(m => m.name);

    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://tcmngr.vercel.app';
    const shareUrl = `${origin}/votes?id=${selectedEvent.id}`;

    const text = `[투표 현황] ${selectedEvent.title}
📅 ${selectedEvent.date}
⏰ ${selectedEvent.startTime} ~ ${selectedEvent.endTime}
📍 ${selectedEvent.location}

✅ 참석 (${attendees.length}명): ${attendees.length ? attendees.join(', ') : '없음'}
❌ 불참 (${absentees.length}명): ${absentees.length ? absentees.join(', ') : '없음'}
❓ 미정 (${unknowns.length}명): ${unknowns.length ? unknowns.join(', ') : '없음'}

🔗 투표 바로가기: ${shareUrl}`;

    setReminderText(text);
    setShowReminderModal(true);
  };

  if (!mounted || (fetching && events.length === 0 && !selectedEvent)) {
    return (
      <div className={styles.page}>
        <Navbar />
        <main className={styles.main}>
          <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="spinner" />
          </div>
        </main>
      </div>
    );
  }

  // Filter events from current month onwards
  const todayStr = formatDateToYMD();
  const currentMonthStr = todayStr.substring(0, 7);
  
  const upcomingEvents = events.filter(e => e.date.substring(0, 7) >= currentMonthStr);

  const availableMonths = [...new Set(upcomingEvents.map(e => e.date.substring(0, 7)))].sort();
  let displayEvents = selectedMonth === 'ALL' 
    ? [...upcomingEvents] 
    : upcomingEvents.filter(e => e.date.startsWith(selectedMonth));

  displayEvents = displayEvents.sort((a, b) => {
    const isAPast = a.date < todayStr;
    const isBPast = b.date < todayStr;

    if (isAPast && !isBPast) return 1;
    if (!isAPast && isBPast) return -1;
    
    if (!isAPast && !isBPast) {
      return a.date.localeCompare(b.date);
    } else {
      return b.date.localeCompare(a.date);
    }
  });

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div className={styles.page}>
      <Navbar />
      <main className={styles.main}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>🗓️ 참석 투표</h1>
            <p className={styles.sub}>다가오는 정기 모임 일정을 확인하고 참석 여부를 투표하세요</p>
          </div>
          <div className="votes-controls-bar">
            <div className="votes-month-select-wrap">
              <select 
                className="votes-month-select" 
                value={selectedMonth} 
                onChange={e => setSelectedMonth(e.target.value)}
              >
                <option value="ALL">🗓️ 전체 일정</option>
                {availableMonths.map(m => (
                  <option key={m} value={m}>
                    🗓️ {m.split('-')[0]}년 {m.split('-')[1]}월
                  </option>
                ))}
              </select>
            </div>
            {isAdmin && (
              <div className="votes-action-buttons">
                <button 
                  type="button"
                  className="btn btn-secondary votes-action-btn" 
                  onClick={() => setShowSettingsModal(true)}
                >
                  ⚙️ 클럽 모임 설정
                </button>
                <button 
                  type="button"
                  className="btn btn-primary votes-action-btn" 
                  style={{ 
                    boxShadow: '0 2px 8px rgba(0, 122, 255, 0.25)',
                    fontWeight: 700
                  }} 
                  onClick={() => {
                    setSelectedEvent(null);
                    setEditTitle('새 투표');
                    setEditDate(formatDateToYMD());
                    setEditStartTime('19:00');
                    setEditEndTime('22:00');
                    setEditLocation('그린테니스장');
                    setIsEditing(true);
                  }}
                >
                  + 새 투표 만들기
                </button>
              </div>
            )}
          </div>
        </div>

        {fetching ? (
          <div className={styles.center}><span className="spinner" /></div>
        ) : (
          <>
            <div className={styles.voteGrid}>
            {displayEvents.map(e => {
              const attCount = Object.values(e.attendees || {}).filter(v => v === 'Y').length;
              const absCount = Object.values(e.attendees || {}).filter(v => v === 'N').length;
              const unkCount = members.length - attCount - absCount;

              const [y, m, d] = e.date.split('-').map(Number);
              const dl = new Date(y, m - 1, d);
              dl.setDate(dl.getDate() - 1);
              dl.setHours(18, 0, 0, 0);
              const isClosed = new Date() > dl;
              const dlStr = `${dl.getMonth() + 1}/${dl.getDate()} 18:00`;
              const eventDayName = dayNames[new Date(y, m - 1, d).getDay()];
              
              const isPast = e.date < todayStr;
              
              return (
                <div 
                  key={e.id} 
                  className={`card card-hoverable ${isPast ? styles.pastVoteCard : ''}`} 
                  style={{
                    padding: 0,
                    marginBottom: '12px',
                    position: 'relative',
                    background: isPast ? '#f8fafc' : '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '14px',
                    cursor: 'pointer',
                    boxShadow: isPast ? 'none' : '0 2px 8px rgba(0, 0, 0, 0.04)',
                    overflow: 'hidden'
                  }}
                  onClick={() => openModal(e)}
                >
                  {/* 상단 액센트 그라데이션 라인 (진행중인 투표에만 표시) */}
                  {!isPast && (
                    <div 
                      style={{ 
                        height: '3.5px', 
                        width: '100%', 
                        background: 'linear-gradient(90deg, #007aff 0%, #34c759 100%)' 
                      }} 
                    />
                  )}

                  <div style={{ padding: isPast ? '14px 16px' : '12px 16px 14px 16px' }}>
                    {/* Row 1: 아이콘 & 타이틀 & 날짜 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          background: isPast ? '#e2e8f0' : '#e0f2fe',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '19px',
                          flexShrink: 0
                        }}>
                          {isPast ? '🏁' : '📝'}
                        </div>
                        <span style={{ 
                          fontSize: '15.5px', 
                          fontWeight: 800, 
                          color: isPast ? '#334155' : '#0f172a',
                          letterSpacing: '-0.02em'
                        }}>
                          {e.title}
                        </span>
                      </div>

                      <div style={{
                        fontSize: '14px',
                        fontWeight: 800,
                        color: isPast ? '#475569' : '#0066ff',
                        letterSpacing: '-0.01em',
                        flexShrink: 0
                      }}>
                        {e.date} ({eventDayName})
                      </div>
                    </div>

                    {/* Row 2: 시간 & 장소 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', fontSize: '12.5px', color: '#475569', fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>⏰</span>
                        <span>{e.startTime} ~ {e.endTime}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>📍</span>
                        <span>{e.location || '그린테니스장'}</span>
                      </div>
                    </div>

                    {/* Row 3: 투표 현황 & 마감 상태 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {isPast ? (
                          <>
                            <span style={{ color: '#334155', fontWeight: 700 }}>참석: {attCount}명</span>
                            <span style={{ color: '#64748b', fontWeight: 600 }}>불참: {absCount}명</span>
                            <span style={{ color: '#94a3b8', fontWeight: 500 }}>미정: {unkCount}명</span>
                          </>
                        ) : (
                          <>
                            <span style={{ color: '#0066ff', fontWeight: 700 }}>참석: {attCount}명</span>
                            <span style={{ color: '#ef4444', fontWeight: 700 }}>불참: {absCount}명</span>
                            <span style={{ color: '#94a3b8', fontWeight: 500 }}>미정: {unkCount}명</span>
                          </>
                        )}
                      </div>

                      <div style={{ flexShrink: 0 }}>
                        {isPast ? (
                          <span style={{ color: '#64748b', fontWeight: 600, fontSize: '12px' }}>종료됨</span>
                        ) : isClosed ? (
                          <span style={{ color: '#ef4444', fontWeight: 700, fontSize: '12.5px' }}>마감됨</span>
                        ) : (
                          <span style={{ color: '#ea580c', fontWeight: 800, fontSize: '12.5px' }}>마감 : {dlStr}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          </>
        )}

      </main>

      {/* 투표 / 설정 / 수정 모달 */}
      {(selectedEvent || isEditing || showSettingsModal) && (
        <div className="modal-overlay" onClick={closeModal}>
          <div 
            className="modal-content" 
            onClick={e => e.stopPropagation()} 
            style={{ 
              maxWidth: '500px', 
              width: '100%', 
              display: 'flex', 
              flexDirection: 'column',
              padding: '20px 18px 16px 18px'
            }}
          >
            
            {showSettingsModal ? (
              <div style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: 'var(--txt)' }}>⚙️ 클럽 정기 모임 설정</h2>
                  <button className="modal-close" onClick={closeModal} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</button>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', marginBottom: '16px', lineHeight: '1.5' }}>
                  정기 모임의 요일, 시간, 기본 장소를 추가하거나 삭제할 수 있습니다. 저장 시 설정된 규칙에 따라 <strong>향후 6주간의 투표 일정</strong>이 자동으로 생성·관리됩니다.
                </p>
                
                {/* 현재 설정된 정기 모임 목록 */}
                <div style={{ marginBottom: '18px' }}>
                  <label style={{ display: 'block', fontWeight: 700, fontSize: '13.5px', marginBottom: '8px', color: 'var(--txt)' }}>
                    📅 현재 설정된 정기 모임 요일 ({meetingRules.length}개)
                  </label>
                  
                  {meetingRules.length === 0 ? (
                    <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      설정된 정기 모임이 없습니다. 아래에서 새 모임 요일을 추가해주세요.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {meetingRules.map((rule) => {
                        const isWeekend = rule.day === 0 || rule.day === 6;
                        return (
                          <div 
                            key={rule.id}
                            style={{ 
                              background: '#ffffff', 
                              padding: '10px 14px', 
                              borderRadius: '8px', 
                              border: '1px solid var(--border)', 
                              boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: '8px'
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className={isWeekend ? 'badge badge-green' : 'badge badge-blue'} style={{ fontSize: '11px', padding: '2px 7px' }}>
                                  {rule.dayName || DAY_NAMES[rule.day]}
                                </span>
                                <strong style={{ fontSize: '14px', color: 'var(--txt)' }}>{rule.title}</strong>
                              </div>
                              <div style={{ fontSize: '12.5px', color: 'var(--txt2)', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                <span>⏰ {rule.startTime} ~ {rule.endTime}</span>
                                <span>📍 {rule.location}</span>
                              </div>
                            </div>
                            <button 
                              className="btn btn-danger btn-sm" 
                              style={{ padding: '3px 8px', fontSize: '11.5px' }}
                              onClick={() => handleRemoveMeetingRule(rule.id)}
                            >
                              삭제
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 새 정기 모임 추가 폼 */}
                <div style={{ background: 'rgba(0, 122, 255, 0.04)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(0, 122, 255, 0.2)', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 10px 0', color: 'var(--ios-blue)' }}>
                    + 새 정기 모임 요일 추가
                  </h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: '8px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '3px' }}>요일</label>
                      <select 
                        className="input input-sm" 
                        value={newRuleDay} 
                        onChange={e => {
                          const d = Number(e.target.value);
                          setNewRuleDay(d);
                          setNewRuleTitle(`정기 모임 (${DAY_SHORT[d]})`);
                        }}
                      >
                        {DAY_NAMES.map((name, idx) => (
                          <option key={idx} value={idx}>{name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '3px' }}>일정 제목</label>
                      <input 
                        className="input input-sm" 
                        value={newRuleTitle} 
                        onChange={e => setNewRuleTitle(e.target.value)} 
                        placeholder="예: 정기 모임 (화)" 
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '3px' }}>시작 시간</label>
                      <input 
                        className="input input-sm" 
                        type="time" 
                        value={newRuleStartTime} 
                        onChange={e => setNewRuleStartTime(e.target.value)} 
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '3px' }}>종료 시간</label>
                      <input 
                        className="input input-sm" 
                        type="time" 
                        value={newRuleEndTime} 
                        onChange={e => setNewRuleEndTime(e.target.value)} 
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '160px' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '3px' }}>기본 장소</label>
                      <input 
                        className="input input-sm" 
                        value={newRuleLocation} 
                        onChange={e => setNewRuleLocation(e.target.value)} 
                        placeholder="예: 그린테니스장" 
                      />
                    </div>
                    <button 
                      type="button"
                      className="btn btn-primary btn-sm" 
                      style={{ padding: '6px 14px', fontSize: '12.5px' }}
                      onClick={handleAddMeetingRule}
                    >
                      + 요일 추가
                    </button>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <button className="btn btn-secondary" onClick={closeModal}>닫기</button>
                  <button 
                    className="btn btn-primary" 
                    disabled={savingRules}
                    onClick={handleSaveMeetingRules}
                  >
                    {savingRules ? '저장 및 생성 중...' : '💾 설정 저장 & 일정 적용'}
                  </button>
                </div>
              </div>
            ) : isEditing ? (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>{selectedEvent ? '일정 수정' : '새 투표 만들기'}</h2>
                  <button className="modal-close" onClick={closeModal} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</button>
                </div>
                <div className="form-group">
                  <label>제목</label>
                  <input className="input" value={editTitle} onChange={e => setEditTitle(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>날짜</label>
                  <input className="input" type="date" value={editDate} onChange={e => setEditDate(e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>시작 시간</label>
                    <input className="input" type="time" value={editStartTime} onChange={e => setEditStartTime(e.target.value)} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>종료 시간</label>
                    <input className="input" type="time" value={editEndTime} onChange={e => setEditEndTime(e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label>장소</label>
                  <input className="input" value={editLocation} onChange={e => setEditLocation(e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <button className="btn btn-secondary" onClick={closeModal}>취소</button>
                  <button className="btn btn-primary" onClick={saveEdit}>저장</button>
                </div>
              </div>
            ) : selectedEvent ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--navy)', marginBottom: '4px', wordBreak: 'keep-all' }}>
                      {selectedEvent.title}
                    </h2>
                    <p style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--navy)', wordBreak: 'keep-all', marginBottom: '8px' }}>
                      {selectedEvent.date} ({dayNames[new Date(selectedEvent.date.split('-')[0], selectedEvent.date.split('-')[1] - 1, selectedEvent.date.split('-')[2]).getDay()]})
                    </p>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', wordBreak: 'keep-all' }}>
                      ⏰ {selectedEvent.startTime} ~ {selectedEvent.endTime} <br/> 📍 {selectedEvent.location}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0, alignItems: 'center' }}>
                    {isAdmin && (
                      <>
                        <button className="btn btn-secondary btn-sm" onClick={() => setIsEditing(true)}>수정</button>
                        <button className="btn btn-danger btn-sm" onClick={removeEvent}>삭제</button>
                      </>
                    )}
                    <button className="modal-close" onClick={closeModal} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--text-muted)', marginLeft: '4px' }}>&times;</button>
                  </div>
                </div>

                <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg)', borderRadius: '8px', fontSize: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <strong>✅ 참석</strong>
                    <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>
                      {Object.values(selectedEvent.attendees || {}).filter(v => v === 'Y').length}명
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <strong>❌ 불참</strong>
                    <span style={{ color: '#e53e3e', fontWeight: 'bold' }}>
                      {Object.values(selectedEvent.attendees || {}).filter(v => v === 'N').length}명
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>❓ 미정</strong>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>
                      {members.length - Object.values(selectedEvent.attendees || {}).filter(v => v === 'Y' || v === 'N').length}명
                    </span>
                  </div>
                </div>

                <div style={{ flex: '1 1 auto', overflowY: 'auto', overflowX: 'hidden', paddingRight: '2px', margin: '0 -4px', paddingLeft: '4px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>투표 명단</span>
                    {(() => {
                      const [y, m, d] = selectedEvent.date.split('-');
                      const deadline = new Date(y, m - 1, d);
                      deadline.setDate(deadline.getDate() - 1);
                      deadline.setHours(18, 0, 0, 0);
                      const isClosed = new Date() > deadline;
                      if (!isClosed) return null;
                      return (
                        <span style={{ color: isAdmin ? 'var(--ios-blue)' : 'var(--danger)', fontSize: '12.5px', fontWeight: 600 }}>
                          {isAdmin ? '마감됨 (운영진 수정 가능)' : '투표 마감됨'}
                        </span>
                      );
                    })()}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {members.map(m => {
                      const status = selectedEvent.attendees?.[m.id] || '?';
                      const [y, mm, d] = selectedEvent.date.split('-');
                      const deadline = new Date(y, mm - 1, d);
                      deadline.setDate(deadline.getDate() - 1);
                      deadline.setHours(18, 0, 0, 0);
                      const isClosed = new Date() > deadline;
                      const isVoteDisabled = !isAdmin && isClosed;
                      
                      return (
                        <div key={m.id} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: '6px', gap: '6px' }}>
                          <span style={{ fontWeight: '600', fontSize: '13.5px', flex: '1 1 auto', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
                          <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                            <button 
                              className={`btn btn-sm ${status === 'Y' ? 'btn-primary' : 'btn-secondary'}`}
                              style={{ opacity: status === 'Y' ? 1 : 0.6, padding: '4px 10px', fontSize: '12px' }}
                              disabled={isVoteDisabled}
                              onClick={() => handleToggleAttendance(m.id, 'Y')}
                            >참석</button>
                            <button 
                              className={`btn btn-sm ${status === 'N' ? 'btn-danger' : 'btn-secondary'}`}
                              style={{ opacity: status === 'N' ? 1 : 0.6, padding: '4px 10px', fontSize: '12px' }}
                              disabled={isVoteDisabled}
                              onClick={() => handleToggleAttendance(m.id, 'N')}
                            >불참</button>
                            <button 
                              className={`btn btn-sm ${status === '?' ? '' : 'btn-secondary'}`}
                              style={{ opacity: status === '?' ? 1 : 0.6, background: status === '?' ? '#e2e8f0' : undefined, color: status === '?' ? '#1e293b' : undefined, padding: '4px 10px', fontSize: '12px' }}
                              disabled={isVoteDisabled}
                              onClick={() => handleToggleAttendance(m.id, '?')}
                            >미정</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                <div style={{ 
                  marginTop: '16px', 
                  paddingTop: '12px',
                  borderTop: '1px solid rgba(0, 0, 0, 0.08)', 
                  display: 'flex', 
                  justifyContent: 'flex-end', 
                  gap: '8px',
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(10px)',
                  position: 'sticky',
                  bottom: 0,
                  zIndex: 10
                }}>
                  <button className="btn btn-secondary" style={{ padding: '10px 18px', fontWeight: 700, fontSize: '0.9rem' }} onClick={handleShare}>📤 공유하기</button>
                  <button className="btn btn-primary" style={{ padding: '10px 22px', fontWeight: 700, fontSize: '0.9rem' }} onClick={closeModal}>닫기</button>
                </div>
              </>
            ) : null}

          </div>
        </div>
      )}

      {/* 투표 독려 모달 */}
      {showReminderModal && (
        <div className="modal-overlay" onClick={() => setShowReminderModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', width: '100%' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>투표 독려 메시지 공유</h2>
              <button className="modal-close" onClick={() => setShowReminderModal(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '15px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                아래 메시지를 확인하고 복사하거나 공유하여 미투표자에게 알려주세요.
              </p>
              <textarea
                className="input"
                style={{ width: '100%', height: '220px', resize: 'vertical', padding: '12px', lineHeight: '1.5', fontFamily: 'inherit' }}
                value={reminderText}
                onChange={(e) => setReminderText(e.target.value)}
              />
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button className="btn btn-secondary" onClick={() => setShowReminderModal(false)}>닫기</button>
              <button className="btn btn-primary" onClick={() => {
                navigator.clipboard.writeText(reminderText)
                  .then(() => alert('복사되었습니다.'))
                  .catch(() => alert('복사에 실패했습니다.'));
              }}>복사하기</button>
              {typeof navigator !== 'undefined' && navigator.share && (
                <button className="btn btn-primary" style={{ background: '#fef01b', color: '#3a1d1d', borderColor: '#fef01b', fontWeight: 'bold' }} onClick={() => {
                  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://tcmngr.vercel.app';
                  const shareUrl = selectedEvent ? `${origin}/votes?id=${selectedEvent.id}` : `${origin}/votes`;
                  navigator.share({ title: '투표 참여 안내', text: reminderText, url: shareUrl }).catch(console.error);
                }}>공유하기</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

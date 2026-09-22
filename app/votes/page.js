'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  getMembers, getEvents, getEvent, createEvent, updateEventAttendees, updateEvent, deleteEvent,
  getMeetingRules, updateMeetingRules, updateEventMemberAttendance, subscribeEvents
} from '@/lib/firestore';
import Navbar from '@/components/Navbar';
import { PageHeaderIcon, VoteIcon } from '@/components/Icons';
import styles from '../dashboard/dashboard.module.css';

const formatDateToYMD = (d = new Date()) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatVoteTime = (isoString) => {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}.${mm}.${dd} ${hh}:${min}`;
  } catch {
    return '';
  }
};

const formatVoteTimeFull = (isoString) => {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
  } catch {
    return '';
  }
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
  
  // Member List Filter & Sort in Vote Modal
  const [memberFilter, setMemberFilter] = useState('ALL'); // 'ALL' | 'Y' | 'N' | '?'
  const [sortMode, setSortMode] = useState('default');     // 'default' | 'latest'

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
    setMemberFilter('ALL');
    setSortMode('default');
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
      setSelectedEvent(prev => {
        if (!prev?.id) return prev;
        const fresh = sortedEvts.find(e => e.id === prev.id);
        return fresh || prev;
      });

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
                // 해당 일자에 이미 등록된 일정이 있으면 중복 생성하지 않음 (대회나 변경된 제목 일정 보호)
                if (!evts.find(e => e.date === dateStr)) {
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

  // Firestore 실시간 리스너 (onSnapshot): 다른 사용자가 투표할 때 실시간으로 즉시 반영
  useEffect(() => {
    const unsubscribe = subscribeEvents('shared', (freshEvents) => {
      const sorted = freshEvents.sort((a, b) => (a.date > b.date ? 1 : -1));
      setEvents(sorted);
      setSelectedEvent(prev => {
        if (!prev?.id) return prev;
        const fresh = sorted.find(e => e.id === prev.id);
        return fresh || prev;
      });
      try {
        localStorage.setItem('tcm_cached_events', JSON.stringify(sorted));
      } catch (e) {
        console.warn('Cache save error:', e);
      }
      setFetching(false);
    });

    return () => unsubscribe();
  }, []);

  const handleToggleAttendance = async (memberId, status) => {
    if (!selectedEvent) return;
    
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

    const eventId = selectedEvent.id;
    const currentStatus = selectedEvent.attendees?.[memberId] || '?';
    if (currentStatus === status) return; // No change

    const now = new Date().toISOString();

    // 1. 낙관적 로컬 상태 업데이트: 오직 해당 회원(memberId)의 상태 및 일시만 갱신
    const newAttendees = { ...(selectedEvent.attendees || {}), [memberId]: status };
    const newTimestamps = { ...(selectedEvent.attendanceTimestamps || {}), [memberId]: now };

    setSelectedEvent(prev => (prev && prev.id === eventId ? { ...prev, attendees: newAttendees, attendanceTimestamps: newTimestamps } : prev));
    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, attendees: newAttendees, attendanceTimestamps: newTimestamps } : e));

    // 2. Firestore 원자적 갱신(Atomic update):
    // attendees 전체 객체를 덮어쓰지 않고 `attendees.<memberId>` 및 `attendanceTimestamps.<memberId>` 단일 필드만 수정하여 타 회원 투표 유실 원천 방지
    try {
      await updateEventMemberAttendance('shared', eventId, memberId, status, now);
    } catch (err) {
      console.error('Failed to update attendance atomically:', err);
      try {
        await updateEvent('shared', eventId, { 
          [`attendees.${memberId}`]: status,
          [`attendanceTimestamps.${memberId}`]: now
        });
      } catch (fallbackErr) {
        console.error('Fallback attendance update error:', fallbackErr);
        alert('투표 반영 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      }
    }
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

  // URL 쿼리 파라미터(?id=... 또는 ?eventId=...)로 접속 시 해당 모임 투표 모달 자동 오픈 및 실시간 동기화
  useEffect(() => {
    if (typeof window === 'undefined' || events.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const targetId = params.get('id') || params.get('eventId');
    const targetDate = params.get('date');

    if (targetId) {
      const target = events.find(e => e.id === targetId);
      if (target) {
        if (target.date) {
          const monthStr = target.date.substring(0, 7);
          setSelectedMonth(prev => (prev === 'ALL' ? prev : monthStr));
        }
        if (!selectedEvent || selectedEvent.id !== targetId) {
          openModal(target, false);
        } else if (selectedEvent && selectedEvent !== target) {
          setSelectedEvent(target);
        }
      }
    } else if (targetDate) {
      const target = events.find(e => e.date === targetDate);
      if (target) {
        setSelectedMonth(prev => (prev === 'ALL' ? prev : targetDate.substring(0, 7)));
        if (!selectedEvent || selectedEvent.date !== targetDate) {
          openModal(target, false);
        } else if (selectedEvent && selectedEvent !== target) {
          setSelectedEvent(target);
        }
      }
    }
  }, [events, selectedEvent, openModal]);

  const handleShare = () => {
    const currentEvt = (selectedEvent?.id ? events.find(e => e.id === selectedEvent.id) : null) || selectedEvent;
    if (!currentEvt) return;
    
    const attendees = members.filter(m => currentEvt.attendees?.[m.id] === 'Y').map(m => m.name);
    const absentees = members.filter(m => currentEvt.attendees?.[m.id] === 'N').map(m => m.name);
    const unknowns = members.filter(m => !currentEvt.attendees?.[m.id] || currentEvt.attendees?.[m.id] === '?').map(m => m.name);

    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://tcmngr.vercel.app';
    const shareUrl = `${origin}/votes?id=${currentEvt.id}`;

    const text = `[투표 현황] ${currentEvt.title}
📅 ${currentEvt.date}
⏰ ${currentEvt.startTime} ~ ${currentEvt.endTime}
📍 ${currentEvt.location}

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
            <h1 className={styles.title} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PageHeaderIcon type="votes" />
              <span>참석 투표</span>
            </h1>
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
                          {isPast ? '🏁' : <VoteIcon size={20} color="#0284c7" active />}
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
                            <span style={{ color: '#16a34a', fontWeight: 700 }}>참석: {attCount}명</span>
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
              (() => {
                const activeEvent = events.find(e => e.id === selectedEvent.id) || selectedEvent;
                const activeAttendees = activeEvent.attendees || {};
                const activeTimestamps = activeEvent.attendanceTimestamps || {};
                const [y, m, d] = (activeEvent.date || '').split('-');
                const deadline = new Date(y, m - 1, d);
                deadline.setDate(deadline.getDate() - 1);
                deadline.setHours(18, 0, 0, 0);
                const isClosed = new Date() > deadline;

                const attCount = Object.values(activeAttendees).filter(v => v === 'Y').length;
                const absCount = Object.values(activeAttendees).filter(v => v === 'N').length;
                const unkCount = members.length - Object.values(activeAttendees).filter(v => v === 'Y' || v === 'N').length;

                // Filter members by status
                let displayedMembers = members.filter(mem => {
                  if (memberFilter === 'ALL') return true;
                  const s = activeAttendees[mem.id] || '?';
                  if (memberFilter === 'Y') return s === 'Y';
                  if (memberFilter === 'N') return s === 'N';
                  if (memberFilter === '?') return s === '?' || !activeAttendees[mem.id];
                  return true;
                });

                // Sort members
                if (sortMode === 'latest') {
                  displayedMembers = [...displayedMembers].sort((a, b) => {
                    const timeA = activeTimestamps[a.id] ? new Date(activeTimestamps[a.id]).getTime() : 0;
                    const timeB = activeTimestamps[b.id] ? new Date(activeTimestamps[b.id]).getTime() : 0;
                    if (timeA !== timeB) return timeB - timeA;
                    return a.name.localeCompare(b.name, 'ko');
                  });
                }

                return (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                        <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--navy)', marginBottom: '4px', wordBreak: 'keep-all' }}>
                          {activeEvent.title}
                        </h2>
                        <p style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--navy)', wordBreak: 'keep-all', marginBottom: '8px' }}>
                          {activeEvent.date} ({dayNames[new Date(y, m - 1, d).getDay()]})
                        </p>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', wordBreak: 'keep-all' }}>
                          ⏰ {activeEvent.startTime} ~ {activeEvent.endTime} <br/> 📍 {activeEvent.location}
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

                    {/* 투표 현황 요약 및 원클릭 필터 탭 */}
                    <div style={{ marginBottom: '14px', padding: '10px', background: 'var(--bg)', borderRadius: '10px', fontSize: '13px', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', textAlign: 'center' }}>
                        <div 
                          onClick={() => setMemberFilter(prev => prev === 'Y' ? 'ALL' : 'Y')}
                          style={{ 
                            padding: '8px 4px', 
                            borderRadius: '8px', 
                            cursor: 'pointer',
                            backgroundColor: memberFilter === 'Y' ? 'rgba(34, 197, 94, 0.18)' : 'rgba(34, 197, 94, 0.08)',
                            border: memberFilter === 'Y' ? '1.5px solid #16a34a' : '1px solid transparent',
                            transition: 'all 0.15s'
                          }}
                          title="클릭하여 참석자만 보기"
                        >
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#15803d' }}>✅ 참석</div>
                          <div style={{ fontSize: '17px', fontWeight: 800, color: '#15803d', marginTop: '2px' }}>
                            {attCount}명
                          </div>
                        </div>

                        <div 
                          onClick={() => setMemberFilter(prev => prev === 'N' ? 'ALL' : 'N')}
                          style={{ 
                            padding: '8px 4px', 
                            borderRadius: '8px', 
                            cursor: 'pointer',
                            backgroundColor: memberFilter === 'N' ? 'rgba(239, 68, 68, 0.18)' : 'rgba(239, 68, 68, 0.08)',
                            border: memberFilter === 'N' ? '1.5px solid #dc2626' : '1px solid transparent',
                            transition: 'all 0.15s'
                          }}
                          title="클릭하여 불참자만 보기"
                        >
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#b91c1c' }}>❌ 불참</div>
                          <div style={{ fontSize: '17px', fontWeight: 800, color: '#b91c1c', marginTop: '2px' }}>
                            {absCount}명
                          </div>
                        </div>

                        <div 
                          onClick={() => setMemberFilter(prev => prev === '?' ? 'ALL' : '?')}
                          style={{ 
                            padding: '8px 4px', 
                            borderRadius: '8px', 
                            cursor: 'pointer',
                            backgroundColor: memberFilter === '?' ? '#e2e8f0' : 'rgba(100, 116, 139, 0.08)',
                            border: memberFilter === '?' ? '1.5px solid #64748b' : '1px solid transparent',
                            transition: 'all 0.15s'
                          }}
                          title="클릭하여 미정/미투표자만 보기"
                        >
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>❓ 미정</div>
                          <div style={{ fontSize: '17px', fontWeight: 800, color: '#475569', marginTop: '2px' }}>
                            {unkCount}명
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={{ flex: '1 1 auto', overflowY: 'auto', overflowX: 'hidden', paddingRight: '2px', margin: '0 -4px', paddingLeft: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <h3 style={{ fontSize: '15.5px', fontWeight: 'bold', margin: 0 }}>
                            투표 명단
                          </h3>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            ({displayedMembers.length}/{members.length}명)
                          </span>
                          {memberFilter !== 'ALL' && (
                            <button 
                              type="button"
                              onClick={() => setMemberFilter('ALL')}
                              style={{ fontSize: '11px', background: 'none', border: 'none', color: 'var(--ios-blue)', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                            >
                              전체보기
                            </button>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          {isClosed && (
                            <span style={{ color: isAdmin ? 'var(--ios-blue)' : 'var(--danger)', fontSize: '12px', fontWeight: 600, marginRight: '4px' }}>
                              {isAdmin ? '마감됨 (운영진 수정 가능)' : '투표 마감됨'}
                            </span>
                          )}
                          <button
                            type="button"
                            className={`btn btn-sm ${sortMode === 'default' ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ fontSize: '11.5px', padding: '3px 8px', height: '26px' }}
                            onClick={() => setSortMode('default')}
                          >
                            기본순
                          </button>
                          <button
                            type="button"
                            className={`btn btn-sm ${sortMode === 'latest' ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ fontSize: '11.5px', padding: '3px 8px', height: '26px' }}
                            onClick={() => setSortMode('latest')}
                            title="최근 투표/수정한 순서대로 정렬"
                          >
                            🕒 최신순
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {displayedMembers.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-muted)', fontSize: '13px' }}>
                            해당 상태의 회원이 없습니다.
                          </div>
                        ) : (
                          displayedMembers.map(m => {
                            const status = activeAttendees[m.id] || '?';
                            const isVoteDisabled = !isAdmin && isClosed;
                            const timeIso = activeTimestamps[m.id];
                            const timeStr = formatVoteTime(timeIso);
                            const fullTimeStr = formatVoteTimeFull(timeIso);
                            
                            return (
                              <div 
                                key={m.id} 
                                style={{ 
                                  display: 'flex', 
                                  flexWrap: 'wrap', 
                                  justifyContent: 'space-between', 
                                  alignItems: 'center', 
                                  padding: '7px 10px', 
                                  border: '1px solid var(--border)', 
                                  borderRadius: '8px', 
                                  gap: '6px',
                                  backgroundColor: status === 'Y' ? 'rgba(34, 197, 94, 0.04)' : status === 'N' ? 'rgba(239, 68, 68, 0.04)' : '#ffffff'
                                }}
                              >
                                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: '1 1 auto', gap: '1px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontWeight: '700', fontSize: '13.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--txt)' }}>
                                      {m.name}
                                    </span>
                                    {status === 'Y' && (
                                      <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', backgroundColor: 'rgba(34, 197, 94, 0.15)', color: '#15803d', fontWeight: 800 }}>
                                        참석
                                      </span>
                                    )}
                                    {status === 'N' && (
                                      <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#b91c1c', fontWeight: 800 }}>
                                        불참
                                      </span>
                                    )}
                                    {status === '?' && timeIso && (
                                      <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', backgroundColor: '#f1f5f9', color: '#64748b', fontWeight: 700 }}>
                                        미정
                                      </span>
                                    )}
                                  </div>
                                  {timeStr ? (
                                    <span 
                                      style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 500 }}
                                      title={`최종 투표/수정 일시: ${fullTimeStr || timeStr}`}
                                    >
                                      <span style={{ fontSize: '10px', opacity: 0.8 }}>🕒</span> {timeStr}
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                                      미투표
                                    </span>
                                  )}
                                </div>

                                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                  <button 
                                    className={`btn btn-sm ${status === 'Y' ? 'btn-success' : 'btn-secondary'}`}
                                    style={{ 
                                      opacity: status === 'Y' ? 1 : 0.6, 
                                      padding: '4px 10px', 
                                      fontSize: '12px', 
                                      fontWeight: 700,
                                      ...(status === 'Y' ? {
                                        background: 'linear-gradient(135deg, var(--ios-green) 0%, #16a34a 100%)',
                                        borderColor: 'rgba(22, 163, 74, 0.4)',
                                        color: '#ffffff',
                                        boxShadow: '0 2px 8px rgba(34, 197, 94, 0.35)'
                                      } : {})
                                    }}
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
                                    style={{ opacity: status === '?' ? 1 : 0.6, background: status === '?' ? '#e2e8f0' : undefined, color: status === '?' ? '#1e293b' : undefined, padding: '4px 10px', fontSize: '12px', fontWeight: 700 }}
                                    disabled={isVoteDisabled}
                                    onClick={() => handleToggleAttendance(m.id, '?')}
                                  >미정</button>
                                </div>
                              </div>
                            );
                          })
                        )}
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
                );
              })()
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

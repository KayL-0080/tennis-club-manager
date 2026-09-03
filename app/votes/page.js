'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { 
  getMembers, 
  getEvents, 
  createEvent, 
  updateEventAttendees, 
  updateEvent, 
  deleteEvent, 
  getClub, 
  updateClub,
  getMonthlyFinance,
  updateMonthlyFinance
} from '@/lib/firestore';
import Navbar from '@/components/Navbar';
import styles from '../dashboard/dashboard.module.css';

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

const formatDateToYMD = (d = new Date()) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export default function VotesPage() {
  const { isAdmin, currentClubId, loading } = useAuth();
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

  // Monthly Table Modal State
  const [showMonthlyTableModal, setShowMonthlyTableModal] = useState(false);
  const [monthlyFinance, setMonthlyFinance] = useState({ totalCourtFee: 0 });

  // Settings & Creation states
  const [clubMeetings, setClubMeetings] = useState([]);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // For Edit/Create Mode
  const [isEditing, setIsEditing] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editLocation, setEditLocation] = useState('');

  // For Settings Mode
  const [tempMeetings, setTempMeetings] = useState([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadData = useCallback(async () => {
    if (!currentClubId) {
      setFetching(false);
      return;
    }
    setFetching(true);
    try {
      const clubData = await getClub(currentClubId);
      const regMeetings = clubData?.regularMeetings || [];
      setClubMeetings(regMeetings);

      const mbrs = await getMembers(currentClubId);
      const validMembers = mbrs.filter(m => m.role !== '준회원' && m.role !== '게스트');
      validMembers.sort((a, b) => a.name.localeCompare(b.name));
      setMembers(validMembers);
      
      const evts = await getEvents(currentClubId);
      
      // Auto-generate missing events for the next 8 weeks (56 days) based on regularMeetings
      const now = new Date();
      const generated = [];
      if (regMeetings.length > 0) {
        for (let i = 0; i < 56; i++) {
          const d = new Date(now);
          d.setDate(d.getDate() + i);
          const day = d.getDay();
          
          const matchingMeeting = regMeetings.find(rm => rm.dayOfWeek === day);
          if (matchingMeeting) {
            const dateStr = d.toLocaleDateString('en-CA'); // YYYY-MM-DD
            if (!evts.find(e => e.date === dateStr)) {
              const newEvent = {
                date: dateStr,
                title: matchingMeeting.title || `정기 모임 (${DAYS[day]})`,
                startTime: matchingMeeting.startTime || '19:00',
                endTime: matchingMeeting.endTime || '22:00',
                location: matchingMeeting.location || '테니스장',
                attendees: {}
              };
              const id = await createEvent(currentClubId, newEvent);
              generated.push({ id, ...newEvent });
            }
          }
        }
      }
      
      if (generated.length > 0) {
        setEvents([...evts, ...generated].sort((a, b) => (a.date > b.date ? 1 : -1)));
      } else {
        setEvents(evts.sort((a, b) => (a.date > b.date ? 1 : -1)));
      }

    } catch (err) {
      console.error('Failed to load votes data:', err);
      alert('데이터를 불러오지 못했습니다. Firestore 권한 설정을 확인해주세요.');
    } finally {
      setFetching(false);
    }
  }, [currentClubId]);

  useEffect(() => {
    if (showMonthlyTableModal && selectedMonth !== 'ALL' && currentClubId) {
      getMonthlyFinance(currentClubId, selectedMonth).then(data => {
        setMonthlyFinance(data || { totalCourtFee: 0 });
      });
    }
  }, [showMonthlyTableModal, selectedMonth, currentClubId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!loading && !fetching && !currentClubId) {
      router.replace('/');
    }
  }, [loading, fetching, currentClubId, router]);

  const handleToggleAttendance = async (memberId, status) => {
    if (!selectedEvent || !currentClubId) return;
    
    const currentStatus = selectedEvent.attendees?.[memberId];
    if (currentStatus === status) return; // No change

    const isInitialVote = currentStatus === undefined;
    const prevChanges = selectedEvent.voteChanges?.[memberId] || 0;

    if (!isAdmin && !isInitialVote && prevChanges >= 1) {
      alert('일반 사용자는 최초 투표 이후 1회만 변경 가능합니다.');
      return;
    }

    const newAttendees = { ...(selectedEvent.attendees || {}) };
    newAttendees[memberId] = status;

    const newVoteChanges = { ...(selectedEvent.voteChanges || {}) };
    if (!isInitialVote) {
      newVoteChanges[memberId] = prevChanges + 1;
    }

    setSelectedEvent({ ...selectedEvent, attendees: newAttendees, voteChanges: newVoteChanges });
    
    // Optimistically update list
    setEvents(prev => prev.map(e => e.id === selectedEvent.id ? { ...e, attendees: newAttendees, voteChanges: newVoteChanges } : e));
    
    // Save to DB
    await updateEventAttendees(currentClubId, selectedEvent.id, newAttendees);
    await updateEvent(currentClubId, selectedEvent.id, { voteChanges: newVoteChanges });
  };

  const saveEdit = async () => {
    if (!selectedEvent || !currentClubId) return;
    const updates = {
      title: editTitle,
      startTime: editStartTime,
      endTime: editEndTime,
      location: editLocation
    };
    await updateEvent(currentClubId, selectedEvent.id, updates);
    setSelectedEvent({ ...selectedEvent, ...updates });
    setEvents(prev => prev.map(e => e.id === selectedEvent.id ? { ...e, ...updates } : e));
    setIsEditing(false);
  };

  const createCustomEvent = async () => {
    if (!editTitle || !editDate || !currentClubId) {
      alert('제목과 날짜를 입력해주세요.');
      return;
    }
    const newEvent = {
      date: editDate,
      title: editTitle,
      startTime: editStartTime || '19:00',
      endTime: editEndTime || '22:00',
      location: editLocation || '테니스장',
      attendees: {}
    };
    await createEvent(currentClubId, newEvent);
    setShowCreateModal(false);
    await loadData();
  };

  const removeEvent = async () => {
    if (!selectedEvent || !currentClubId) return;
    if (!confirm('이 일정을 삭제하시겠습니까?')) return;
    await updateEvent(currentClubId, selectedEvent.id, { isCancelled: true });
    setEvents(prev => prev.map(e => e.id === selectedEvent.id ? { ...e, isCancelled: true } : e));
    setSelectedEvent(null);
  };

  const openModal = (e) => {
    setSelectedEvent(e);
    setIsEditing(false);
    setEditTitle(e.title);
    setEditStartTime(e.startTime);
    setEditEndTime(e.endTime);
    setEditLocation(e.location);
  };

  const generateResultText = () => {
    if (!selectedEvent) return '';
    const attList = [];
    const absList = [];
    const unkList = [];
    members.forEach(m => {
      const status = selectedEvent.attendees?.[m.id] || '?';
      if (status === 'Y') attList.push(m.name);
      else if (status === 'N') absList.push(m.name);
      else unkList.push(m.name);
    });

    const dateStr = `${selectedEvent.date} (${new Date(selectedEvent.date).toLocaleDateString('ko-KR', { weekday: 'short' })})`;
    let text = `[${selectedEvent.title}]\n일시: ${dateStr} ${selectedEvent.startTime}~${selectedEvent.endTime}\n장소: ${selectedEvent.location}\n\n`;
    text += `✅ 참석 (${attList.length}명):\n${attList.length > 0 ? attList.join(', ') : '없음'}\n\n`;
    text += `❌ 불참 (${absList.length}명):\n${absList.length > 0 ? absList.join(', ') : '없음'}\n\n`;
    text += `❓ 미정 (${unkList.length}명):\n${unkList.length > 0 ? unkList.join(', ') : '없음'}`;
    return text;
  };

  const copyVoteResults = () => {
    const text = generateResultText();
    navigator.clipboard.writeText(text)
      .then(() => alert('투표 결과가 클립보드에 복사되었습니다.'))
      .catch(() => alert('복사에 실패했습니다.'));
  };

  const shareNativeVote = () => {
    const text = generateResultText();
    if (navigator.share) {
      navigator.share({
        title: selectedEvent.title,
        text: text,
      }).catch(err => console.log('공유 취소 또는 실패', err));
    } else {
      alert('이 브라우저에서는 기본 공유 기능을 지원하지 않습니다. 텍스트 복사를 이용해주세요.');
    }
  };

  const openSettingsModal = () => {
    setTempMeetings([...clubMeetings]);
    setShowSettingsModal(true);
  };

  const saveSettings = async () => {
    if (!currentClubId) return;
    await updateClub(currentClubId, { regularMeetings: tempMeetings });
    setShowSettingsModal(false);
    await loadData();
  };

  const getDayColor = (dateStr) => {
    const day = new Date(dateStr).getDay();
    const colors = [
      '#fff1f0', // 일 (연빨강)
      '#f6ffed', // 월 (연초록)
      '#e6f7ff', // 화 (연파랑)
      '#f9f0ff', // 수 (연보라)
      '#fffbe6', // 목 (연노랑)
      '#e6fffb', // 금 (연민트)
      '#fcffe6'  // 토 (연라임)
    ];
    return colors[day];
  };

  const getDeadline = (dateStr) => {
    const d = new Date(dateStr + 'T18:00:00');
    d.setDate(d.getDate() - 1);
    return d;
  };

  const isVotingClosed = (dateStr) => {
    return new Date() > getDeadline(dateStr);
  };

  if (!mounted || !currentClubId) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="spinner" />
      </div>
    );
  }

  const todayStr = formatDateToYMD();
  const validEvents = events.filter(e => !e.isCancelled);
  const upcomingEvents = validEvents.filter(e => e.date >= todayStr);
  const pastEvents = validEvents.filter(e => e.date < todayStr).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className={styles.page}>
      <Navbar />
      <main className={styles.main}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>참석 투표</h1>
            <p className={styles.sub}>모임 날짜를 선택하여 참석 여부를 투표하세요</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button 
              className="btn btn-secondary" 
              style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid var(--border)' }}
              onClick={() => setShowMonthlyTableModal(true)}
            >
              📊 월별 정산 현황
            </button>
            {isAdmin && (
              <>
                <button 
                  className="btn btn-secondary" 
                  style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid var(--border)' }}
                  onClick={openSettingsModal}
                >
                  ⚙️ 정기 모임 설정
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={() => {
                    setEditDate(formatDateToYMD());
                    setEditTitle('임시 모임');
                    setEditStartTime('19:00');
                    setEditEndTime('22:00');
                    setEditLocation('테니스장');
                    setShowCreateModal(true);
                  }}
                >
                  + 직접 일정 추가
                </button>
              </>
            )}
          </div>
        </div>

        {fetching && events.length === 0 ? (
          <div className={styles.center}><span className="spinner" /></div>
        ) : (
          <>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: 'var(--navy)' }}>
              다가오는 모임 ({upcomingEvents.length})
            </h2>
            <div className={styles.grid}>
              {upcomingEvents.map(e => {
                const attCount = Object.values(e.attendees || {}).filter(v => v === 'Y').length;
                const absCount = Object.values(e.attendees || {}).filter(v => v === 'N').length;
                const unkCount = members.length - (attCount + absCount);
                const deadline = getDeadline(e.date);
                const closed = isVotingClosed(e.date);

                return (
                  <div 
                    key={e.id} 
                    className={`card ${styles.schedCard}`}
                    style={{ 
                      cursor: 'pointer',
                      borderLeft: `6px solid ${getDayColor(e.date)}`,
                      background: 'var(--surface)'
                    }}
                    onClick={() => openModal(e)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 8px 0', color: 'var(--navy)' }}>
                        {e.title}
                      </h3>
                      <span className="badge badge-blue" style={{ fontSize: '12px' }}>
                        {new Date(e.date).toLocaleDateString('ko-KR', { weekday: 'short' })}요일
                      </span>
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                      📅 {e.date} <br/>
                      ⏰ {e.startTime} ~ {e.endTime} <br/>
                      📍 {e.location}
                    </div>
                    <div style={{ marginTop: '12px', fontSize: '14px', display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>참석: {attCount}명</span>
                        <span style={{ color: 'var(--danger, #ff4d4f)' }}>불참: {absCount}명</span>
                        <span style={{ color: 'var(--text-muted)' }}>미정: {unkCount}명</span>
                      </div>
                      <div style={{ fontSize: '12px', color: closed ? '#e53e3e' : 'var(--text-muted)' }}>
                        {closed ? '투표 마감됨' : `마감: ${deadline.getMonth() + 1}/${deadline.getDate()} 18:00`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {pastEvents.length > 0 && (
              <div style={{ marginTop: '40px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: 'var(--text-muted)' }}>
                  지난 모임 ({pastEvents.length})
                </h2>
                <div className={styles.grid} style={{ opacity: 0.8 }}>
                  {pastEvents.map(e => {
                    const attCount = Object.values(e.attendees || {}).filter(v => v === 'Y').length;
                    return (
                      <div 
                        key={e.id} 
                        className={`card ${styles.schedCard}`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => openModal(e)}
                      >
                        <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 6px 0' }}>{e.title}</h3>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                          📅 {e.date} | ⏰ {e.startTime}~{e.endTime}
                        </div>
                        <div style={{ marginTop: '8px', fontSize: '14px', fontWeight: 'bold', color: 'var(--primary)' }}>
                          참석: {attCount}명
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* 정기 모임 설정 모달 */}
      {showSettingsModal && (
        <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', width: '100%' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>⚙️ 정기 모임 요일 설정</h2>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              클럽의 정기 모임 요일을 지정하면 향후 8주간의 일정이 자동으로 생성됩니다.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              {tempMeetings.map((tm, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'var(--bg)', padding: '10px', borderRadius: '8px' }}>
                  <select 
                    className="select" 
                    style={{ width: '80px' }} 
                    value={tm.dayOfWeek}
                    onChange={e => {
                      const next = [...tempMeetings];
                      next[idx].dayOfWeek = Number(e.target.value);
                      setTempMeetings(next);
                    }}
                  >
                    {DAYS.map((d, i) => <option key={i} value={i}>{d}요일</option>)}
                  </select>
                  <input 
                    className="input" 
                    placeholder="모임 제목" 
                    value={tm.title}
                    onChange={e => {
                      const next = [...tempMeetings];
                      next[idx].title = e.target.value;
                      setTempMeetings(next);
                    }}
                  />
                  <input 
                    className="input" 
                    type="time" 
                    style={{ width: '100px' }}
                    value={tm.startTime}
                    onChange={e => {
                      const next = [...tempMeetings];
                      next[idx].startTime = e.target.value;
                      setTempMeetings(next);
                    }}
                  />
                  <input 
                    className="input" 
                    type="time" 
                    style={{ width: '100px' }}
                    value={tm.endTime}
                    onChange={e => {
                      const next = [...tempMeetings];
                      next[idx].endTime = e.target.value;
                      setTempMeetings(next);
                    }}
                  />
                  <button 
                    className="btn btn-danger btn-sm" 
                    onClick={() => setTempMeetings(tempMeetings.filter((_, i) => i !== idx))}
                  >
                    삭제
                  </button>
                </div>
              ))}

              <button 
                className="btn btn-secondary btn-sm" 
                style={{ alignSelf: 'flex-start' }}
                onClick={() => setTempMeetings([...tempMeetings, { dayOfWeek: 2, title: '정기 모임', startTime: '19:00', endTime: '22:00', location: '테니스장' }])}
              >
                + 정기 모임 요일 추가
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowSettingsModal(false)}>취소</button>
              <button className="btn btn-primary" onClick={saveSettings}>설정 저장 및 자동 생성</button>
            </div>
          </div>
        </div>
      )}

      {/* 직접 일정 추가 모달 */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', width: '100%' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>+ 새 일정 직접 추가</h2>
            <div className="form-group">
              <label>모임 날짜</label>
              <input className="input" type="date" value={editDate} onChange={e => setEditDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label>모임 제목</label>
              <input className="input" value={editTitle} onChange={e => setEditTitle(e.target.value)} />
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
              <label>장소(코트명)</label>
              <input className="input" placeholder="테니스장 이름" value={editLocation} onChange={e => setEditLocation(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>취소</button>
              <button className="btn btn-primary" onClick={createCustomEvent}>생성</button>
            </div>
          </div>
        </div>
      )}

      {/* 개별 투표 수정 / 명단 모달 */}
      {selectedEvent && (
        <div className="modal-overlay" onClick={() => setSelectedEvent(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', width: '100%', maxHeight: '90vh', overflowY: 'auto', overflowX: 'hidden' }}>
            
            {isEditing ? (
              <div style={{ marginBottom: '20px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>일정 수정</h2>
                <div className="form-group">
                  <label>제목</label>
                  <input className="input" value={editTitle} onChange={e => setEditTitle(e.target.value)} />
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
                  <button className="btn btn-secondary" onClick={() => setIsEditing(false)}>취소</button>
                  <button className="btn btn-primary" onClick={saveEdit}>저장</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--navy)', marginBottom: '4px', wordBreak: 'keep-all' }}>
                      {selectedEvent.title}
                    </h2>
                    <p style={{ fontSize: '14px', color: 'var(--text-muted)', wordBreak: 'keep-all' }}>
                      {selectedEvent.date} ({new Date(selectedEvent.date).toLocaleDateString('ko-KR', { weekday: 'short' })}) <br/>
                      ⏰ {selectedEvent.startTime} ~ {selectedEvent.endTime} <br/> 📍 {selectedEvent.location}
                    </p>
                  </div>
                  {isAdmin && (
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setIsEditing(true)}>수정</button>
                      <button className="btn btn-danger btn-sm" onClick={removeEvent}>삭제</button>
                    </div>
                  )}
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

                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={copyVoteResults}>
                    📋 카톡 공유 텍스트 복사
                  </button>
                  <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={shareNativeVote}>
                    📤 기기 기본 공유
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>투표 명단</h3>
                  <div style={{ fontSize: '13px', color: isVotingClosed(selectedEvent.date) ? '#e53e3e' : 'var(--text-muted)', fontWeight: 'bold' }}>
                    {isVotingClosed(selectedEvent.date) ? '투표가 마감되었습니다.' : `마감: ${getDeadline(selectedEvent.date).getMonth() + 1}/${getDeadline(selectedEvent.date).getDate()} 18:00`}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {members.map(m => {
                    const status = selectedEvent.attendees?.[m.id] || '?';
                    const closed = isVotingClosed(selectedEvent.date);
                    return (
                      <div key={m.id} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', padding: '10px', border: '1px solid var(--border)', borderRadius: '6px', gap: '8px', opacity: closed ? 0.7 : 1 }}>
                        <span style={{ fontWeight: '500', flex: '1 1 auto', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
                        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                          <button 
                            className={`btn btn-sm ${status === 'Y' ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ opacity: status === 'Y' ? 1 : 0.6 }}
                            onClick={() => !closed && handleToggleAttendance(m.id, 'Y')}
                            disabled={closed}
                          >참석</button>
                          <button 
                            className={`btn btn-sm ${status === 'N' ? 'btn-danger' : 'btn-secondary'}`}
                            style={{ opacity: status === 'N' ? 1 : 0.6 }}
                            onClick={() => !closed && handleToggleAttendance(m.id, 'N')}
                            disabled={closed}
                          >불참</button>
                          <button 
                            className={`btn btn-sm ${status === '?' ? '' : 'btn-secondary'}`}
                            style={{ opacity: status === '?' ? 1 : 0.6, background: status === '?' ? '#e2e8f0' : undefined, color: status === '?' ? '#1e293b' : undefined }}
                            onClick={() => !closed && handleToggleAttendance(m.id, '?')}
                            disabled={closed}
                          >미정</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div style={{ marginTop: '24px', textAlign: 'right' }}>
                  <button className="btn btn-primary" onClick={() => setSelectedEvent(null)}>닫기</button>
                </div>
              </>
            )}

          </div>
        </div>
      )}

      {/* 월별 정산 현황 모달 */}
      {showMonthlyTableModal && (
        <div className="modal-overlay" onClick={() => setShowMonthlyTableModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '95vw', width: '1200px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>📊 월별 참석 및 코트비 정산</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowMonthlyTableModal(false)}>닫기</button>
            </div>

            {/* 월 선택 탭 */}
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '16px' }}>
              {Array.from(new Set(events.filter(e => !e.isCancelled).map(e => e.date.substring(0, 7)))).sort().map(m => (
                <button
                  key={m}
                  className={`btn btn-sm ${selectedMonth === m ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSelectedMonth(m)}
                >
                  {m}
                </button>
              ))}
              <button
                className={`btn btn-sm ${selectedMonth === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedMonth('ALL')}
              >
                전체 누적
              </button>
            </div>

            {/* 코트비 입력 (관리자 전용) */}
            {selectedMonth !== 'ALL' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg)', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                <span style={{ fontWeight: 'bold' }}>💰 {selectedMonth} 총 코트비:</span>
                {isAdmin ? (
                  <input
                    type="number"
                    className="input input-sm"
                    style={{ width: '120px' }}
                    placeholder="0"
                    value={monthlyFinance.totalCourtFee || ''}
                    onChange={e => setMonthlyFinance({ ...monthlyFinance, totalCourtFee: parseInt(e.target.value) || 0 })}
                    onBlur={() => updateMonthlyFinance(currentClubId, selectedMonth, { totalCourtFee: monthlyFinance.totalCourtFee })}
                  />
                ) : (
                  <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
                    {(monthlyFinance.totalCourtFee || 0).toLocaleString()}원
                  </span>
                )}
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  (모임 1회당: {(() => {
                    const mEvents = events.filter(e => !e.isCancelled && e.date.startsWith(selectedMonth));
                    return mEvents.length > 0 ? Math.floor((monthlyFinance.totalCourtFee || 0) / mEvents.length).toLocaleString() : 0;
                  })()}원)
                </span>
              </div>
            )}

            {/* 정산 테이블 */}
            {(() => {
              const filteredEvents = events
                .filter(e => !e.isCancelled && (selectedMonth === 'ALL' || e.date.startsWith(selectedMonth)))
                .sort((a, b) => a.date.localeCompare(b.date));

              if (filteredEvents.length === 0) {
                return <p className="text-muted" style={{ padding: '20px', textAlign: 'center' }}>해당 월에 등록된 모임이 없습니다.</p>;
              }

              const feePerEvent = filteredEvents.length > 0 && selectedMonth !== 'ALL' 
                ? Math.floor((monthlyFinance.totalCourtFee || 0) / filteredEvents.length) 
                : 0;

              return (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>이름</th>
                        {filteredEvents.map(e => (
                          <th key={e.id} style={{ textAlign: 'center', minWidth: '50px' }}>
                            {e.date.substring(5)}<br/>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              ({new Date(e.date).toLocaleDateString('ko-KR', { weekday: 'short' })})
                            </span>
                          </th>
                        ))}
                        <th style={{ textAlign: 'center' }}>참석 일수</th>
                        {selectedMonth !== 'ALL' && <th style={{ textAlign: 'right' }}>정산 금액</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {members.map(m => {
                        let attendedDays = 0;
                        return (
                          <tr key={m.id}>
                            <td><strong>{m.name}</strong></td>
                            {filteredEvents.map(e => {
                              const st = e.attendees?.[m.id];
                              if (st === 'Y') attendedDays++;
                              return (
                                <td key={e.id} style={{ textAlign: 'center' }}>
                                  {st === 'Y' ? (
                                    <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>O</span>
                                  ) : st === 'N' ? (
                                    <span style={{ color: '#ff4d4f' }}>X</span>
                                  ) : (
                                    <span style={{ color: 'var(--text-muted)' }}>-</span>
                                  )}
                                </td>
                              );
                            })}
                            <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{attendedDays}일</td>
                            {selectedMonth !== 'ALL' && (
                              <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--primary)' }}>
                                {(() => {
                                  let totalFee = 0;
                                  filteredEvents.forEach(e => {
                                    if (e.attendees?.[m.id] === 'Y') {
                                      const totalAtt = Object.values(e.attendees || {}).filter(v => v === 'Y').length;
                                      if (totalAtt > 0) {
                                        totalFee += Math.round(feePerEvent / totalAtt);
                                      }
                                    }
                                  });
                                  return totalFee.toLocaleString() + '원';
                                })()}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* 투표 독려 메시지 모달 */}
      {showReminderModal && (
        <div className="modal-overlay" onClick={() => setShowReminderModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', width: '100%' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>💬 투표 독려 메시지 복사</h2>
            <textarea 
              className="input" 
              style={{ width: '100%', height: '180px', marginBottom: '16px', resize: 'none', fontSize: '14px' }} 
              value={reminderText} 
              onChange={e => setReminderText(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowReminderModal(false)}>닫기</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => {
                navigator.clipboard.writeText(reminderText)
                  .then(() => alert('메시지가 복사되었습니다. 카카오톡 단톡방 등에 붙여넣기 하세요!'))
                  .catch(() => alert('복사에 실패했습니다.'));
              }}>복사하기</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

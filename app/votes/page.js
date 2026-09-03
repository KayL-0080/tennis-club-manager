'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getMembers, getEvents, createEvent, updateEventAttendees, updateEvent, deleteEvent, getMonthlyFinance, updateMonthlyFinance } from '@/lib/firestore';
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
  
  const [showMonthlyTableModal, setShowMonthlyTableModal] = useState(false);
  const [monthlyFinance, setMonthlyFinance] = useState({ totalCourtFee: 0 });

  // For Edit Mode
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editLocation, setEditLocation] = useState('');
  
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadData = useCallback(async () => {
    setFetching(true);
    try {
      const mbrs = await getMembers('shared');
      const validMembers = mbrs.filter(m => m.role !== '준회원' && m.role !== '게스트');
      validMembers.sort((a, b) => a.name.localeCompare(b.name));
      setMembers(validMembers);
      
      const evts = await getEvents('shared');
      
      // Auto-generate missing events for the next 6 weeks
      const now = new Date();
      const generated = [];
      for (let i = 0; i < 42; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() + i);
        const day = d.getDay(); // 2=Tue, 4=Thu
        if (day === 2 || day === 4) {
          const dateStr = d.toLocaleDateString('en-CA'); // YYYY-MM-DD
          // Check if event exists
          if (!evts.find(e => e.date === dateStr)) {
            // Auto create
            const newEvent = {
              date: dateStr,
              title: `정기 모임 (${day === 2 ? '화' : '목'})`,
              startTime: day === 2 ? '18:00' : '19:00',
              endTime: day === 2 ? '20:00' : '22:00',
              location: day === 2 ? '별도 테니스장' : '그린테니스장',
              attendees: {}
            };
            const id = await createEvent('shared', newEvent);
            generated.push({ id, ...newEvent });
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
  }, []);

  useEffect(() => {
    if (showMonthlyTableModal && selectedMonth !== 'ALL') {
      getMonthlyFinance(selectedMonth).then(data => {
        setMonthlyFinance(data || { totalCourtFee: 0 });
      });
    }
  }, [showMonthlyTableModal, selectedMonth]);

  useEffect(() => {
    loadData(); }, [loadData]);

  const handleToggleAttendance = async (memberId, status) => {
    if (!selectedEvent) return;
    
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
    
    // Save to DB (using updateEvent to update both fields)
    await updateEvent('shared', selectedEvent.id, { attendees: newAttendees, voteChanges: newVoteChanges });
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
    setSelectedEvent(null);
  };

  const openModal = (e) => {
    setSelectedEvent(e);
    setIsEditing(false);
    setEditTitle(e.title);
    setEditDate(e.date || '');
    setEditStartTime(e.startTime);
    setEditEndTime(e.endTime);
    setEditLocation(e.location);
  };

  const exportToExcel = () => {
    const modalBody = document.querySelector('#printable-monthly-table .modal-body');
    if (!modalBody) return;
    
    const clone = modalBody.cloneNode(true);
    
    // Replace inputs with their values
    const inputs = clone.querySelectorAll('input');
    inputs.forEach(input => {
      const span = document.createElement('span');
      span.innerText = input.value;
      input.parentNode.replaceChild(span, input);
    });

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <style>
          table { border-collapse: collapse; }
          th, td { border: 1px solid #cbd5e1; }
        </style>
      </head>
      <body>
        ${clone.innerHTML}
      </body>
      </html>
    `;
    
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedMonth.split('-')[1]}월_투표현황표.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleShare = () => {
    if (!selectedEvent) return;
    
    const attendees = members.filter(m => selectedEvent.attendees?.[m.id] === 'Y').map(m => m.name);
    const absentees = members.filter(m => selectedEvent.attendees?.[m.id] === 'N').map(m => m.name);
    const unknowns = members.filter(m => !selectedEvent.attendees?.[m.id] || selectedEvent.attendees?.[m.id] === '?').map(m => m.name);

    const text = `[투표 현황] ${selectedEvent.title}
📅 ${selectedEvent.date}
⏰ ${selectedEvent.startTime} ~ ${selectedEvent.endTime}
📍 ${selectedEvent.location}

✅ 참석 (${attendees.length}명): ${attendees.length ? attendees.join(', ') : '없음'}
❌ 불참 (${absentees.length}명): ${absentees.length ? absentees.join(', ') : '없음'}
❓ 미정 (${unknowns.length}명): ${unknowns.length ? unknowns.join(', ') : '없음'}

🔗 접속 링크: https://tmradal.vercel.app`;

    setReminderText(text);
    setShowReminderModal(true);
  };

  if (!mounted || (fetching && events.length === 0)) {
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
            <p style={{ color: 'var(--ios-red)', fontSize: '13px', marginTop: '6px', fontWeight: '700' }}>
              ※ 일반 사용자는 최초 투표 이후 1회 추가 변경만 가능합니다.
            </p>
          </div>
          {isAdmin && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={() => setShowSettingsModal(true)}>⚙️ 클럽 모임 설정</button>
              <button className="btn btn-primary" onClick={() => {
                setSelectedEvent(null);
                setEditTitle('새 투표');
                setEditDate(formatDateToYMD());
                setEditStartTime('19:00');
                setEditEndTime('22:00');
                setEditLocation('그린테니스장');
                setIsEditing(true);
              }}>+ 새 투표 만들기</button>
            </div>
          )}
        </div>

        {fetching ? (
          <div className={styles.center}><span className="spinner" /></div>
        ) : (
          <>
            {!fetching && displayEvents.length > 0 && (
              <div className="card" style={{ marginBottom: '24px', padding: '18px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--txt)', margin: 0, letterSpacing: '-0.02em' }}>
                    📊 {selectedMonth === 'ALL' ? '전체' : `${selectedMonth.split('-')[1]}월`} 일정 투표 현황
                  </h2>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {selectedMonth !== 'ALL' && isAdmin && (
                      <button className="btn btn-secondary btn-sm" onClick={() => setShowMonthlyTableModal(true)}>
                        📅 월별 현황표
                      </button>
                    )}
                    <select 
                      className="input input-sm" 
                      style={{ width: 'auto', padding: '6px 12px', fontSize: '13px' }} 
                      value={selectedMonth} 
                      onChange={e => setSelectedMonth(e.target.value)}
                    >
                      <option value="ALL">전체 보기</option>
                      {availableMonths.map(m => <option key={m} value={m}>{m.split('-')[0]}년 {m.split('-')[1]}월</option>)}
                    </select>
                  </div>
                </div>
                {(() => {
                  const voters = [];
                  const nonVoters = [];
                  members.forEach(m => {
                    const hasVoted = displayEvents.some(e => e.attendees?.[m.id] === 'Y' || e.attendees?.[m.id] === 'N');
                    if (hasVoted) voters.push(m);
                    else nonVoters.push(m);
                  });

                  return (
                    <>
                      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '12px' }}>
                        <div 
                          style={{ flex: 1, padding: '14px', background: 'rgba(255, 255, 255, 0.6)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', border: showVoters ? '2px solid var(--ios-blue)' : '1px solid rgba(0,0,0,0.06)', transition: 'all 0.2s' }}
                          onClick={() => { setShowVoters(!showVoters); setShowNonVoters(false); }}
                        >
                          <div style={{ fontSize: '13px', color: 'var(--txt2)', fontWeight: 600, marginBottom: '4px' }}>투표참여자</div>
                          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--ios-blue)' }}>{voters.length}명</div>
                        </div>
                        <div 
                          style={{ flex: 1, padding: '14px', background: 'rgba(255, 255, 255, 0.6)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', border: showNonVoters ? '2px solid var(--ios-red)' : '1px solid rgba(0,0,0,0.06)', transition: 'all 0.2s' }}
                          onClick={() => { setShowNonVoters(!showNonVoters); setShowVoters(false); }}
                        >
                          <div style={{ fontSize: '13px', color: 'var(--txt2)', fontWeight: 600, marginBottom: '4px' }}>투표미참여자</div>
                          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--ios-red)' }}>{nonVoters.length}명</div>
                        </div>
                      </div>
                      
                      {showVoters && (
                        <div style={{ padding: '14px', background: 'rgba(0, 122, 255, 0.06)', borderRadius: 'var(--radius-sm)', fontSize: '14px', marginBottom: '12px', border: '1px solid rgba(0, 122, 255, 0.15)' }}>
                          <strong style={{ display: 'block', marginBottom: '6px', color: 'var(--ios-blue)' }}>참여자 명단 ({voters.length}명)</strong>
                          {voters.length > 0 ? voters.map(m => m.name).join(', ') : '없음'}
                        </div>
                      )}
                      
                      {showNonVoters && (
                        <div style={{ padding: '14px', background: 'rgba(255, 59, 48, 0.06)', borderRadius: 'var(--radius-sm)', fontSize: '14px', marginBottom: '12px', border: '1px solid rgba(255, 59, 48, 0.15)' }}>
                          <strong style={{ display: 'block', marginBottom: '6px', color: 'var(--ios-red)' }}>미참여자 명단 ({nonVoters.length}명)</strong>
                          {nonVoters.length > 0 ? nonVoters.map(m => m.name).join(', ') : '없음'}
                        </div>
                      )}

                      {isAdmin && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                          <button className="btn btn-primary btn-sm" onClick={() => {
                            const text = `[투표 참여 안내]\n현재 게시된 모임 일정에 한 번도 투표하지 않으신 분들이 있습니다!\n\n미투표자: ${nonVoters.map(m=>m.name).join(', ')}\n\n테니스 앱에 접속하셔서 다가오는 일정들에 대한 참석 여부를 꼭 투표해 주세요!\n\n🔗 접속 링크: https://tmradal.vercel.app`;
                            setReminderText(text);
                            setShowReminderModal(true);
                          }}>
                            💬 투표 독려 메시지 만들기
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
            <div className={styles.grid}>
            {displayEvents.map(e => {
              const attCount = Object.values(e.attendees || {}).filter(v => v === 'Y').length;
              const absCount = Object.values(e.attendees || {}).filter(v => v === 'N').length;
              const unkCount = members.length - attCount - absCount;

              const [y, m, d] = e.date.split('-').map(Number);
              const dl = new Date(y, m - 1, d);
              dl.setDate(dl.getDate() - 1);
              const dlStr = `${dl.getMonth() + 1}/${dl.getDate()} 18:00`;
              const eventDayName = dayNames[new Date(y, m - 1, d).getDay()];
              
              return (
                <div key={e.id} className={`card ${styles.schedCard}`} onClick={() => openModal(e)}>
                  <div className={styles.schedTop}>
                    <div className={styles.schedIcon}>🗓️</div>
                    <div className={styles.schedInfo}>
                      <h2 className={styles.schedTitle}>{e.title}</h2>
                      <p className={styles.schedTitle} style={{ marginTop: '3px', fontSize: '0.88rem', color: 'var(--ios-blue)', fontWeight: 700 }}>
                        {e.date} ({eventDayName})
                      </p>
                    </div>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--txt2)', lineHeight: 1.5 }}>
                    ⏰ {e.startTime} ~ {e.endTime} <br/>
                    📍 {e.location}
                  </div>
                  <div style={{ marginTop: '12px', fontSize: '13px', display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <span style={{ fontWeight: '700', color: 'var(--ios-blue)' }}>참석: {attCount}명</span>
                      <span style={{ fontWeight: '600', color: 'var(--ios-red)' }}>불참: {absCount}명</span>
                      <span style={{ color: 'var(--txt3)' }}>미정: {unkCount}명</span>
                    </div>
                    <div style={{ color: 'var(--ios-orange)', fontSize: '11px', fontWeight: '700' }}>
                      마감 : {dlStr}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          </>
        )}

      </main>

      {/* 투표 모달 */}
      {(selectedEvent || isEditing || showSettingsModal) && (
        <div className="modal-overlay" onClick={() => { setIsEditing(false); setShowSettingsModal(false); setSelectedEvent(null); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', width: '100%', maxHeight: '90vh', overflowY: 'auto', overflowX: 'hidden' }}>
            
            {showSettingsModal && (
              <div style={{ marginBottom: '20px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>클럽 모임 설정</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px' }}>정기 모임 일정 자동 생성 규칙 및 기본 설정을 변경합니다.</p>
                
                <div className="form-group">
                  <label>정기 모임 요일</label>
                  <input className="input" defaultValue="화요일, 목요일" disabled />
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>※ 현재 요일 변경은 시스템 관리자에게 문의하세요.</p>
                </div>
                
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <button className="btn btn-secondary" onClick={() => setShowSettingsModal(false)}>닫기</button>
                  <button className="btn btn-primary" onClick={() => { alert('저장되었습니다.'); setShowSettingsModal(false); }}>저장</button>
                </div>
              </div>
            )}

            {isEditing && !showSettingsModal ? (
              <div style={{ marginBottom: '20px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>일정 수정</h2>
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
                    <p style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--navy)', wordBreak: 'keep-all', marginBottom: '8px' }}>
                      {selectedEvent.date} ({dayNames[new Date(selectedEvent.date.split('-')[0], selectedEvent.date.split('-')[1] - 1, selectedEvent.date.split('-')[2]).getDay()]})
                    </p>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', wordBreak: 'keep-all' }}>
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

                <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
                  투표 명단
                  {(() => {
                    const [y, m, d] = selectedEvent.date.split('-');
                    const deadline = new Date(y, m - 1, d);
                    deadline.setDate(deadline.getDate() - 1);
                    deadline.setHours(18, 0, 0, 0);
                    const isClosed = new Date() > deadline;
                    return isClosed ? <span style={{ color: 'var(--danger)', fontSize: '13px' }}>마감됨</span> : null;
                  })()}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {members.map(m => {
                    const status = selectedEvent.attendees?.[m.id] || '?';
                    const [y, mm, d] = selectedEvent.date.split('-');
                    const deadline = new Date(y, mm - 1, d);
                    deadline.setDate(deadline.getDate() - 1);
                    deadline.setHours(18, 0, 0, 0);
                    const isClosed = new Date() > deadline;
                    
                    return (
                      <div key={m.id} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', padding: '10px', border: '1px solid var(--border)', borderRadius: '6px', gap: '8px' }}>
                        <span style={{ fontWeight: '500', flex: '1 1 auto', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
                        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                          <button 
                            className={`btn btn-sm ${status === 'Y' ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ opacity: status === 'Y' ? 1 : 0.6 }}
                            disabled={isClosed}
                            onClick={() => handleToggleAttendance(m.id, 'Y')}
                          >참석</button>
                          <button 
                            className={`btn btn-sm ${status === 'N' ? 'btn-danger' : 'btn-secondary'}`}
                            style={{ opacity: status === 'N' ? 1 : 0.6 }}
                            disabled={isClosed}
                            onClick={() => handleToggleAttendance(m.id, 'N')}
                          >불참</button>
                          <button 
                            className={`btn btn-sm ${status === '?' ? '' : 'btn-secondary'}`}
                            style={{ opacity: status === '?' ? 1 : 0.6, background: status === '?' ? '#e2e8f0' : undefined, color: status === '?' ? '#1e293b' : undefined }}
                            disabled={isClosed}
                            onClick={() => handleToggleAttendance(m.id, '?')}
                          >미정</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button className="btn btn-secondary" onClick={handleShare}>📤 공유하기</button>
                  <button className="btn btn-primary" onClick={() => setSelectedEvent(null)}>닫기</button>
                </div>
              </>
            )}

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
                <button className="btn btn-primary" style={{ background: '#fef01b', color: '#3a1d1d', borderColor: '#fef01b' }} onClick={() => {
                  navigator.share({ title: '투표 참여 안내', text: reminderText }).catch(console.error);
                }}>공유하기</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 월별 투표 현황표 모달 */}
      {showMonthlyTableModal && (
        <div className="modal-overlay" onClick={() => setShowMonthlyTableModal(false)}>
          <div className="modal-content" id="printable-monthly-table" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <style>{`
              @media print {
                html, body {
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                nav, main { display: none !important; }
                .modal-overlay { 
                  position: static !important; 
                  background: transparent !important; 
                  padding: 0 !important;
                  display: block !important;
                }
                .modal-content {
                  box-shadow: none !important;
                  width: 100% !important;
                  max-width: none !important;
                  margin: 0 !important;
                  border: none !important;
                }
                .no-print { display: none !important; }
                .modal-body { overflow: visible !important; max-height: none !important; }
              }
            `}</style>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>{selectedMonth.split('-')[1]}월 투표 현황표</h2>
                <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                  <label style={{ fontWeight: 'bold', color: 'var(--text-muted)' }}>월 총 코트비:</label>
                  <input 
                    type="number" 
                    step="1000"
                    className="input" 
                    style={{ width: '100px', padding: '4px 8px', textAlign: 'right' }} 
                    value={monthlyFinance.totalCourtFee || ''}
                    onChange={e => setMonthlyFinance({ ...monthlyFinance, totalCourtFee: parseInt(e.target.value) || 0 })}
                    onBlur={() => updateMonthlyFinance(selectedMonth, { totalCourtFee: monthlyFinance.totalCourtFee })}
                    placeholder="0"
                  />
                  <span>원</span>
                </div>
              </div>
              <div className="no-print" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button className="btn btn-secondary btn-sm" onClick={exportToExcel}>📊 엑셀 저장</button>
                <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>🖨️ 인쇄</button>
                <button className="modal-close" onClick={() => setShowMonthlyTableModal(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</button>
              </div>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
              {(() => {
                // Prepare data
                const sortedEvents = [...displayEvents].sort((a, b) => a.date.localeCompare(b.date));
                const eventAttendees = sortedEvents.map(e => members.filter(m => e.attendees?.[m.id] === 'Y'));
                const maxAtt = Math.max(0, ...eventAttendees.map(list => list.length));
                const rows = Array.from({ length: maxAtt });
                
                const memberStats = members.map(m => {
                  return {
                    name: m.name,
                    count: sortedEvents.filter(e => e.attendees?.[m.id] === 'Y').length
                  };
                }).sort((a, b) => b.count - a.count);

                return (
                  <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <div style={{ flex: '1 1 auto', overflowX: 'auto' }}>
                      <table className="table" style={{ whiteSpace: 'nowrap', textAlign: 'center', minWidth: '400px', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            <th rowSpan={3} style={{ border: '1px solid var(--border)', background: '#f8fafc', padding: '4px' }}>일자</th>
                            {sortedEvents.map(e => (
                              <th key={e.id} style={{ border: '1px solid var(--border)', background: '#f8fafc', padding: '4px' }}>
                                {parseInt(e.date.split('-')[1])}월{parseInt(e.date.split('-')[2])}일({new Date(e.date).toLocaleDateString('ko-KR', { weekday: 'short' })})
                              </th>
                            ))}
                          </tr>
                          <tr>
                            <th style={{ border: '1px solid var(--border)', background: '#f8fafc', padding: '4px', display: 'none' }}>시간</th>
                            {sortedEvents.map(e => (
                              <th key={`t-${e.id}`} style={{ border: '1px solid var(--border)', background: '#f8fafc', padding: '4px', fontWeight: 'normal', fontSize: '12px' }}>
                                {e.startTime}~{e.endTime}
                              </th>
                            ))}
                          </tr>
                          <tr>
                            <th style={{ border: '1px solid var(--border)', background: '#f8fafc', padding: '4px', display: 'none' }}>장소</th>
                            {sortedEvents.map(e => (
                              <th key={`l-${e.id}`} style={{ border: '1px solid var(--border)', background: '#f8fafc', padding: '4px', fontWeight: 'normal', fontSize: '12px' }}>
                                {e.location}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((_, rIdx) => (
                            <tr key={rIdx}>
                              <td style={{ border: '1px solid var(--border)', background: '#f8fafc', padding: '4px', fontWeight: 'bold', fontSize: '12px' }}>{rIdx + 1}</td>
                              {sortedEvents.map((e, cIdx) => {
                                const member = eventAttendees[cIdx][rIdx];
                                const isSelected = e.settlementAttendees?.[member?.id];
                                return (
                                  <td 
                                    key={`${e.id}-${rIdx}`} 
                                    style={{ 
                                      border: '1px solid var(--border)', 
                                      padding: '4px', 
                                      fontSize: '14px',
                                      background: isSelected ? '#e0f2fe' : undefined,
                                      cursor: member ? 'pointer' : 'default'
                                    }}
                                    onClick={async () => {
                                      if (!member) return;
                                      const newStatus = !isSelected;
                                      
                                      if (newStatus) {
                                        const isAlreadySelected = sortedEvents.some(otherEvent => otherEvent.id !== e.id && otherEvent.settlementAttendees?.[member.id] && otherEvent.attendees?.[member.id] === 'Y');
                                        if (isAlreadySelected) {
                                          alert('이미 다른 일정에서 선택된 참석자입니다. 한 월에 중복 선택은 불가합니다.');
                                          return;
                                        }
                                      }

                                      setEvents(prev => prev.map(ev => ev.id === e.id ? { ...ev, settlementAttendees: { ...(ev.settlementAttendees || {}), [member.id]: newStatus } } : ev));
                                      await updateEvent('shared', e.id, { [`settlementAttendees.${member.id}`]: newStatus });
                                    }}
                                  >
                                    {member?.name || ''}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                          <tr>
                            <td colSpan={sortedEvents.length + 1} style={{ border: 'none', height: '8px' }}></td>
                          </tr>
                          <tr>
                            <td style={{ border: '1px solid var(--border)', background: '#f8fafc', padding: '4px', fontWeight: 'bold', fontSize: '12px' }}>지원금</td>
                            {sortedEvents.map(e => {
                              const count = Object.keys(e.settlementAttendees || {}).filter(id => e.settlementAttendees[id] === true && e.attendees?.[id] === 'Y').length;
                              const subsidy = count * 30000;
                              return <td key={`sub-${e.id}`} style={{ border: '1px solid var(--border)', padding: '4px', fontSize: '14px', textAlign: 'right' }}>{subsidy.toLocaleString()}</td>
                            })}
                          </tr>
                          <tr>
                            <td style={{ border: '1px solid var(--border)', background: '#f8fafc', padding: '4px', fontWeight: 'bold', fontSize: '12px' }}>코트비</td>
                            {sortedEvents.map(e => {
                              const feePerEvent = sortedEvents.length > 0 ? Math.floor(monthlyFinance.totalCourtFee / sortedEvents.length) : 0;
                              return <td key={`crt-${e.id}`} style={{ border: '1px solid var(--border)', padding: '4px', fontSize: '14px', textAlign: 'right' }}>{feePerEvent.toLocaleString()}</td>
                            })}
                          </tr>
                          <tr>
                            <td style={{ border: '1px solid var(--border)', background: '#f8fafc', padding: '4px', fontWeight: 'bold', fontSize: '12px' }}>간식비</td>
                            {sortedEvents.map(e => {
                              const totalAttendees = Object.values(e.attendees || {}).filter(v => v === 'Y').length;
                              const snackPerPerson = e.snackFeePerPerson !== undefined ? e.snackFeePerPerson : 6000;
                              const totalSnack = totalAttendees * snackPerPerson;
                              return (
                                <td key={`snk-${e.id}`} style={{ border: '1px solid var(--border)', padding: '4px', fontSize: '14px', textAlign: 'right' }}>
                                  <input 
                                    type="number" 
                                    step="100"
                                    style={{ width: '60px', textAlign: 'right', border: '1px solid var(--border)', borderRadius: '4px', marginBottom: '2px', padding: '2px' }}
                                    value={snackPerPerson}
                                    onChange={(ev) => {
                                      const val = parseInt(ev.target.value) || 0;
                                      setEvents(prev => prev.map(evt => evt.id === e.id ? { ...evt, snackFeePerPerson: val } : evt));
                                    }}
                                    onBlur={(ev) => {
                                      const val = parseInt(ev.target.value) || 0;
                                      updateEvent('shared', e.id, { snackFeePerPerson: val });
                                    }}
                                  />
                                  <br/>
                                  <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{totalSnack.toLocaleString()}</span>
                                </td>
                              )
                            })}
                          </tr>
                          <tr>
                            <td style={{ border: '1px solid var(--border)', background: '#f8fafc', padding: '4px', fontWeight: 'bold', fontSize: '12px' }}>잔액</td>
                            {sortedEvents.map(e => {
                              const settlementCount = Object.keys(e.settlementAttendees || {}).filter(id => e.settlementAttendees[id] && e.attendees?.[id] === 'Y').length;
                              const totalAttendees = Object.values(e.attendees || {}).filter(v => v === 'Y').length;
                              const subsidy = settlementCount * 30000;
                              const feePerEvent = sortedEvents.length > 0 ? Math.floor(monthlyFinance.totalCourtFee / sortedEvents.length) : 0;
                              const snackPerPerson = e.snackFeePerPerson !== undefined ? e.snackFeePerPerson : 6000;
                              const totalSnack = totalAttendees * snackPerPerson;
                              const balance = subsidy - feePerEvent - totalSnack;
                              return <td key={`bal-${e.id}`} style={{ border: '1px solid var(--border)', padding: '4px', fontSize: '14px', textAlign: 'right', color: balance < 0 ? 'var(--error)' : 'inherit' }}>{balance.toLocaleString()}</td>
                            })}
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: '1 1 auto' }}>
                      {(() => {
                        const chunks = [];
                        for (let i = 0; i < memberStats.length; i += 5) {
                          chunks.push(memberStats.slice(i, i + 5));
                        }
                        return chunks.map((chunk, idx) => (
                          <div key={idx} style={{ width: '160px' }}>
                            <table className="table" style={{ whiteSpace: 'nowrap', textAlign: 'center', width: '100%', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr>
                                  <th style={{ border: '1px solid var(--border)', background: '#f8fafc', padding: '4px' }}>성명</th>
                                  <th style={{ border: '1px solid var(--border)', background: '#f8fafc', padding: '4px' }}>참석신청</th>
                                </tr>
                              </thead>
                              <tbody>
                                {chunk.map(m => (
                                  <tr key={m.name}>
                                    <td style={{ border: '1px solid var(--border)', padding: '4px', fontSize: '14px' }}>{m.name}</td>
                                    <td style={{ border: '1px solid var(--border)', padding: '4px', fontSize: '14px', background: m.count === 0 ? '#fef3c7' : undefined }}>{m.count}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                );
              })()}
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button className="btn btn-secondary" onClick={() => setShowMonthlyTableModal(false)}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

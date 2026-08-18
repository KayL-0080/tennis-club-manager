'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getMembers, getEvents, createEvent, updateEventAttendees, updateEvent, deleteEvent, getClub, updateClub } from '@/lib/firestore';
import Navbar from '@/components/Navbar';
import styles from '../dashboard/dashboard.module.css';

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

export default function VotesPage() {
  const { isAdmin, currentClubId, loading } = useAuth();
  const router = useRouter();

  const [fetching, setFetching] = useState(true);
  const [members, setMembers] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Overall Status State
  const [showVoters, setShowVoters] = useState(false);
  const [showNonVoters, setShowNonVoters] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toLocaleDateString('en-CA').substring(0, 7));

  // Reminder Modal State
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderText, setReminderText] = useState('');

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

  const loadData = useCallback(async () => {
    if (!currentClubId) return;
    setFetching(true);
    try {
      const clubData = await getClub(currentClubId);
      const regMeetings = clubData?.regularMeetings || [];
      setClubMeetings(regMeetings);

      const mbrs = await getMembers(currentClubId);
      mbrs.sort((a, b) => a.name.localeCompare(b.name));
      setMembers(mbrs);
      
      const evts = await getEvents(currentClubId);
      
      // Auto-generate missing events for the next 8 weeks based on settings
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

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!loading && !fetching && !currentClubId) {
      router.replace('/');
    }
  }, [loading, fetching, currentClubId, router]);

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
    
    // Save to DB
    await updateEvent(currentClubId, selectedEvent.id, { attendees: newAttendees, voteChanges: newVoteChanges });
  };

  const saveEdit = async () => {
    if (!selectedEvent) return;
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
    if (!editTitle || !editDate) {
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
    if (!selectedEvent) return;
    if (!confirm('이 일정을 삭제하시겠습니까?')) return;
    // 실제 삭제 대신 취소 상태로 변경하여 자동 생성을 방지합니다.
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
    await updateClub(currentClubId, { regularMeetings: tempMeetings });
    setShowSettingsModal(false);
    await loadData();
  };

  if (!currentClubId) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="spinner" />
      </div>
    );
  }

  if (fetching && events.length === 0) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="spinner" />
      </div>
    );
  }

  const todayStr = new Date().toLocaleDateString('en-CA');
  const currentMonthStr = todayStr.substring(0, 7);
  
  const upcomingEvents = events.filter(e => e.date.substring(0, 7) >= currentMonthStr && !e.isCancelled);

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

  const getPastelColorByDay = (dateStr) => {
    const day = new Date(dateStr).getDay();
    const colors = [
      '#fff0f5', // 일 - 파스텔 핑크/레드
      '#fff5e6', // 월 - 파스텔 오렌지
      '#ffffe6', // 화 - 파스텔 옐로우
      '#f0fff0', // 수 - 파스텔 그린
      '#f0f8ff', // 목 - 파스텔 블루
      '#e6e6fa', // 금 - 파스텔 라벤더(인디고)
      '#f5f0ff', // 토 - 파스텔 바이올렛
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

  return (
    <div className={styles.page}>
      <Navbar />
      <main className={styles.main}>
        <div className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 className={styles.title}>🗓️ 참석 투표</h1>
            <p className={styles.sub}>다가오는 정기 모임 일정을 확인하고 참석 여부를 투표하세요</p>
            <p style={{ color: '#e53e3e', fontSize: '14px', marginTop: '8px', fontWeight: 'bold' }}>
              ※ 일반 사용자는 최초 투표 이후 1회 추가 변경만 가능합니다.
            </p>
          </div>
          {isAdmin && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={openSettingsModal}>⚙️ 클럽 모임 설정</button>
              <button className="btn btn-primary" onClick={() => {
                setEditDate(todayStr);
                setEditTitle('');
                setEditStartTime('19:00');
                setEditEndTime('22:00');
                setEditLocation('');
                setShowCreateModal(true);
              }}>➕ 새 투표 만들기</button>
            </div>
          )}
        </div>

        {fetching ? (
          <div className={styles.center}><span className="spinner" /></div>
        ) : (
          <>
            {!fetching && displayEvents.length > 0 && (
              <div className="card" style={{ marginBottom: '24px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--navy)', margin: 0 }}>
                    📊 {selectedMonth === 'ALL' ? '전체' : `${selectedMonth.split('-')[1]}월`} 일정 투표 현황
                  </h2>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <select 
                      className="input" 
                      style={{ width: 'auto', padding: '4px 8px', height: 'auto', fontSize: '14px' }} 
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
                      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '12px' }}>
                        <div 
                          style={{ flex: 1, padding: '12px', background: 'var(--bg)', borderRadius: '8px', cursor: 'pointer', border: showVoters ? '2px solid var(--primary)' : '1px solid var(--border)' }}
                          onClick={() => { setShowVoters(!showVoters); setShowNonVoters(false); }}
                        >
                          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>투표참여자</div>
                          <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--primary)' }}>{voters.length}명</div>
                        </div>
                        <div 
                          style={{ flex: 1, padding: '12px', background: 'var(--bg)', borderRadius: '8px', cursor: 'pointer', border: showNonVoters ? '2px solid var(--danger)' : '1px solid var(--border)' }}
                          onClick={() => { setShowNonVoters(!showNonVoters); setShowVoters(false); }}
                        >
                          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>투표미참여자</div>
                          <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--danger)' }}>{nonVoters.length}명</div>
                        </div>
                      </div>
                      
                      {showVoters && (
                        <div style={{ padding: '12px', background: 'var(--bg)', borderRadius: '8px', fontSize: '14px', marginBottom: '12px' }}>
                          <strong style={{ display: 'block', marginBottom: '8px' }}>참여자 명단 ({voters.length}명)</strong>
                          {voters.length > 0 ? voters.map(m => m.name).join(', ') : '없음'}
                        </div>
                      )}
                      
                      {showNonVoters && (
                        <div style={{ padding: '12px', background: 'var(--bg)', borderRadius: '8px', fontSize: '14px', marginBottom: '12px' }}>
                          <strong style={{ display: 'block', marginBottom: '8px' }}>미참여자 명단 ({nonVoters.length}명)</strong>
                          {nonVoters.length > 0 ? nonVoters.map(m => m.name).join(', ') : '없음'}
                        </div>
                      )}

                      {isAdmin && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <button className="btn btn-primary btn-sm" onClick={() => {
                            const linkUrl = typeof window !== 'undefined' ? window.location.origin + '/votes' : '';
                            const text = `[투표 참여 안내]\n현재 게시된 모임 일정에 한 번도 투표하지 않으신 분들이 있습니다!\n\n미투표자: ${nonVoters.map(m=>m.name).join(', ')}\n\n매니저 앱에 접속하셔서 다가오는 일정들에 대한 참석 여부를 꼭 투표해 주세요!\n\n🔗 접속 링크: ${linkUrl}`;
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
                const deadline = getDeadline(e.date);
                const closed = isVotingClosed(e.date);
                return (
                  <div 
                    key={e.id} 
                    className={`card ${styles.schedCard}`} 
                    style={{ backgroundColor: getPastelColorByDay(e.date), transition: 'transform 0.15s, box-shadow 0.15s' }}
                    onClick={() => openModal(e)}
                    onMouseOver={(ev) => {
                      ev.currentTarget.style.transform = 'translateY(-2px)';
                      ev.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.1)';
                    }}
                    onMouseOut={(ev) => {
                      ev.currentTarget.style.transform = 'none';
                      ev.currentTarget.style.boxShadow = 'var(--shadow)';
                    }}
                  >
                    <div className={styles.schedTop}>
                      <div className={styles.schedIcon}>🗓️</div>
                      <div className={styles.schedInfo}>
                        <h2 className={styles.schedTitle}>{e.title}</h2>
                        <p className={styles.schedDate}>{e.date} ({new Date(e.date).toLocaleDateString('ko-KR', { weekday: 'short' })})</p>
                      </div>
                    </div>
                    <div style={{ fontSize: '15px', color: 'var(--text-muted)' }}>
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
          </>
        )}

      </main>

      {/* 설정 모달 */}
      {showSettingsModal && (
        <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>⚙️ 정기 모임 설정</h2>
            <p style={{ fontSize: '15px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              여기서 설정한 요일과 시간에 맞춰 8주간의 투표 일정이 자동으로 생성됩니다.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
              {tempMeetings.map((m, idx) => (
                <div key={idx} style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'flex-end' }}>
                  <div>
                    <label style={{ fontSize: '16px', display: 'block', marginBottom: '4px' }}>요일</label>
                    <select className="input input-sm" value={m.dayOfWeek} onChange={e => {
                      const newM = [...tempMeetings];
                      newM[idx].dayOfWeek = parseInt(e.target.value, 10);
                      setTempMeetings(newM);
                    }}>
                      {DAYS.map((day, i) => <option key={i} value={i}>{day}요일</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '16px', display: 'block', marginBottom: '4px' }}>제목</label>
                    <input className="input input-sm" style={{ width: '120px' }} value={m.title || ''} placeholder="기본 제목" onChange={e => {
                      const newM = [...tempMeetings];
                      newM[idx].title = e.target.value;
                      setTempMeetings(newM);
                    }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '16px', display: 'block', marginBottom: '4px' }}>시작 시간</label>
                    <input className="input input-sm" type="time" value={m.startTime} onChange={e => {
                      const newM = [...tempMeetings];
                      newM[idx].startTime = e.target.value;
                      setTempMeetings(newM);
                    }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '16px', display: 'block', marginBottom: '4px' }}>종료 시간</label>
                    <input className="input input-sm" type="time" value={m.endTime} onChange={e => {
                      const newM = [...tempMeetings];
                      newM[idx].endTime = e.target.value;
                      setTempMeetings(newM);
                    }} />
                  </div>
                  <div style={{ flex: '1 1 auto' }}>
                    <label style={{ fontSize: '16px', display: 'block', marginBottom: '4px' }}>장소(코트명)</label>
                    <input className="input input-sm" style={{ width: '100%' }} value={m.location} onChange={e => {
                      const newM = [...tempMeetings];
                      newM[idx].location = e.target.value;
                      setTempMeetings(newM);
                    }} />
                  </div>
                  <button className="btn btn-danger btn-sm" onClick={() => {
                    setTempMeetings(tempMeetings.filter((_, i) => i !== idx));
                  }}>삭제</button>
                </div>
              ))}
            </div>

            <button className="btn btn-secondary btn-sm" style={{ marginBottom: '24px' }} onClick={() => {
              setTempMeetings([...tempMeetings, { dayOfWeek: 0, title: '정기 모임 (일)', startTime: '19:00', endTime: '22:00', location: '기본 테니스장' }]);
            }}>+ 요일 추가</button>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowSettingsModal(false)}>취소</button>
              <button className="btn btn-primary" onClick={saveSettings}>저장</button>
            </div>
          </div>
        </div>
      )}

      {/* 새 투표 만들기 모달 */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', width: '100%' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>➕ 새 투표 만들기</h2>
            <div className="form-group">
              <label>날짜</label>
              <input className="input" type="date" value={editDate} onChange={e => setEditDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label>제목</label>
              <input className="input" placeholder="예: 번개 모임, 월례대회" value={editTitle} onChange={e => setEditTitle(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '15px', marginBottom: '4px' }}>시작 시간</label>
                <input className="input" type="time" value={editStartTime} onChange={e => setEditStartTime(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '15px', marginBottom: '4px' }}>종료 시간</label>
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

      {/* 개별 투표 수정 모달 */}
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
                    <label style={{ display: 'block', fontSize: '15px', marginBottom: '4px' }}>시작 시간</label>
                    <input className="input" type="time" value={editStartTime} onChange={e => setEditStartTime(e.target.value)} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '15px', marginBottom: '4px' }}>종료 시간</label>
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
                    <p style={{ fontSize: '15px', color: 'var(--text-muted)', wordBreak: 'keep-all' }}>
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

                <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg)', borderRadius: '8px', fontSize: '16px' }}>
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

import { useState, useMemo } from 'react';

export default function DraftPhase({ tournament, members, onUpdate, isAdmin }) {
  const isIndividual = tournament.type === 'individual';
  const [draftStep, setDraftStep] = useState(1);
  const [attendees, setAttendees] = useState(tournament.attendees || []);
  const [captains, setCaptains] = useState(tournament.captains || []);
  const [participantCount, setParticipantCount] = useState(
    tournament.participantCount || (tournament.attendees?.length > 0 ? tournament.attendees.length : 12)
  );
  const [date, setDate] = useState(tournament.date || new Date().toLocaleDateString('en-CA'));
  const [startTime, setStartTime] = useState(tournament.startTime || tournament.time || '19:00');
  const [endTime, setEndTime] = useState(tournament.endTime || '22:00');
  const [gamesPerTeam, setGamesPerTeam] = useState(tournament.gamesPerTeam || 4);

  const [courtDetails, setCourtDetails] = useState(() => {
    return tournament.courtDetails || [
      { id: 'c1', name: '1코트', games: 4 },
      { id: 'c2', name: '2코트', games: 4 }
    ];
  });

  const calcAutoValues = (start, end, courtsList, customParticipantCount) => {
    if (!start || !end) return { autoSets: 2, autoGames: 4, diff: 120 };
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    let diff = (eH * 60 + eM) - (sH * 60 + sM);
    if (diff <= 0) diff += 24 * 60;
    const autoSets = Math.max(1, Math.floor(diff / 30));
    const numCourts = courtsList?.length || 2;
    const totalCourtGames = courtsList ? courtsList.reduce((acc, c) => acc + (c.games || autoSets), 0) : numCourts * autoSets;

    let autoGames;
    if (isIndividual) {
      const pCount = customParticipantCount !== undefined ? customParticipantCount : participantCount;
      const validPCount = Math.max(4, pCount || 12);
      autoGames = Math.max(1, Math.floor((totalCourtGames * 4) / validPCount));
    } else {
      const numTeams = captains.length > 0 ? captains.length : 4;
      autoGames = Math.max(1, Math.floor((totalCourtGames * 2) / numTeams));
    }

    return { autoSets, autoGames, diff };
  };

  const durationInfo = useMemo(() => {
    const { diff } = calcAutoValues(startTime, endTime, courtDetails);
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    return {
      hours,
      mins,
      text: `${hours > 0 ? `${hours}시간 ` : ''}${mins > 0 ? `${mins}분` : ''}`.trim()
    };
  }, [startTime, endTime, courtDetails]);

  const maxAllowedSets = useMemo(() => {
    return calcAutoValues(startTime, endTime, courtDetails).autoSets;
  }, [startTime, endTime, courtDetails]);

  const updateTimeAndAutoCalculate = (newStart, newEnd) => {
    setStartTime(newStart);
    setEndTime(newEnd);
    const { autoSets, autoGames } = calcAutoValues(newStart, newEnd, courtDetails);
    setCourtDetails(prev => prev.map(c => ({ ...c, games: autoSets })));
    setGamesPerTeam(autoGames);
  };

  const handleParticipantCountChange = (newCount) => {
    const val = Math.max(4, parseInt(newCount) || 4);
    setParticipantCount(val);
    const { autoGames } = calcAutoValues(startTime, endTime, courtDetails, val);
    setGamesPerTeam(autoGames);
  };

  const handleAddCourt = () => {
    if (!isAdmin) return;
    if (courtDetails.length >= 10) {
      alert('코트는 최대 10개까지 등록 가능합니다.');
      return;
    }
    const nextIdx = courtDetails.length + 1;
    const { autoSets } = calcAutoValues(startTime, endTime, courtDetails);
    const updated = [
      ...courtDetails,
      { id: `c-${Date.now()}`, name: `${nextIdx}코트`, games: autoSets }
    ];
    setCourtDetails(updated);
    const { autoGames } = calcAutoValues(startTime, endTime, updated);
    setGamesPerTeam(autoGames);
  };

  const handleRemoveCourt = (id) => {
    if (!isAdmin) return;
    if (courtDetails.length <= 1) {
      alert('최소 1개 이상의 코트가 필요합니다.');
      return;
    }
    const updated = courtDetails.filter(c => c.id !== id);
    setCourtDetails(updated);
    const { autoGames } = calcAutoValues(startTime, endTime, updated);
    setGamesPerTeam(autoGames);
  };

  const handleUpdateCourt = (id, field, val) => {
    if (!isAdmin) return;
    setCourtDetails(prev => {
      const updated = prev.map(c => {
        if (c.id === id) {
          return { ...c, [field]: val };
        }
        return c;
      });
      if (field === 'games') {
        const { autoGames } = calcAutoValues(startTime, endTime, updated);
        setGamesPerTeam(autoGames);
      }
      return updated;
    });
  };

  const toggleAttendee = (memberId) => {
    if (!isAdmin) return;
    setAttendees(prev => {
      const isSelected = prev.includes(memberId);
      if (isSelected) {
        setCaptains(c => c.filter(id => id !== memberId));
        return prev.filter(id => id !== memberId);
      }
      return [...prev, memberId];
    });
  };

  const toggleCaptain = (memberId) => {
    if (!isAdmin || isIndividual) return;
    setCaptains(prev => {
      const updated = prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId];
      if (updated.length > 0) {
        const totalCourtGames = courtDetails.reduce((acc, c) => acc + (c.games || 2), 0);
        const autoGames = Math.max(1, Math.floor((totalCourtGames * 2) / updated.length));
        setGamesPerTeam(autoGames);
      }
      return updated;
    });
  };

  const handleGoToStep2 = () => {
    if (courtDetails.some(c => !c.name.trim())) {
      alert('코트명을 빈 칸 없이 작성해주세요.');
      return;
    }
    setDraftStep(2);
  };

  const handleConfirm = async () => {
    if (!isAdmin) return;
    if (attendees.length < 4) {
      alert('참가자가 너무 적습니다 (최소 4명).');
      return;
    }
    
    if (isIndividual) {
      await onUpdate({
        attendees,
        participantCount: attendees.length || participantCount,
        date,
        startTime,
        endTime,
        courts: courtDetails.length,
        courtDetails,
        gamesPerTeam,
        status: 'picking'
      });
    } else {
      const generatedTeams = captains.map((captainId, idx) => ({
        id: `team-${idx + 1}`,
        name: `${String.fromCharCode(65 + idx)}조`,
        captain: captainId,
        players: [captainId]
      }));
      
      await onUpdate({
        attendees,
        captains,
        teams: generatedTeams,
        date,
        startTime,
        endTime,
        courts: courtDetails.length,
        courtDetails,
        gamesPerTeam,
        status: 'picking'
      });
    }
  };

  const memberList = members.filter(m => m.role !== '준회원' && m.role !== '게스트');

  return (
    <div className="card" style={{ padding: '20px' }}>
      {draftStep === 1 ? (
        <>
          <h2 style={{ marginTop: 0, color: 'var(--navy)', fontSize: '18px', marginBottom: '16px' }}>1단계. 대회 환경설정</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
              
              {/* 1. 대회 일정 */}
              <div style={{ width: '100%', maxWidth: '100%' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px', color: 'var(--txt)' }}>대회 일정</label>
                <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} disabled={!isAdmin} style={{ width: '100%', maxWidth: '100%', minWidth: '0', boxSizing: 'border-box', WebkitBoxSizing: 'border-box', display: 'block', margin: 0, WebkitAppearance: 'none', appearance: 'none' }} />
              </div>
              
              {/* 2. 대회 시간 */}
              <div style={{ width: '100%', maxWidth: '100%', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '4px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 'bold', margin: 0, color: 'var(--txt)' }}>대회 시간</label>
                  <span style={{ fontSize: '11px', color: 'var(--blue)', background: '#e0f2fe', padding: '2px 8px', borderRadius: '12px' }}>
                    ⏰ 총 {durationInfo.text} (1경기 30분 기준, 코트당 {maxAllowedSets}경기 자동 계산)
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                   <input type="time" className="input" value={startTime} onChange={e => updateTimeAndAutoCalculate(e.target.value, endTime)} disabled={!isAdmin} style={{ flex: 1, minWidth: '0', maxWidth: '100%', boxSizing: 'border-box' }} />
                   <span>~</span>
                   <input type="time" className="input" value={endTime} onChange={e => updateTimeAndAutoCalculate(startTime, e.target.value)} disabled={!isAdmin} style={{ flex: 1, minWidth: '0', maxWidth: '100%', boxSizing: 'border-box' }} />
                </div>
              </div>

              {/* 3. 참여 인원수 (개인전일 경우에만 표시) */}
              {isIndividual && (
                <div style={{ width: '100%', maxWidth: '100%', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '4px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 'bold', margin: 0, color: 'var(--txt)' }}>참여 인원수</label>
                    <span style={{ fontSize: '11px', color: 'var(--blue)', background: '#e0f2fe', padding: '2px 8px', borderRadius: '12px' }}>
                      👤 개인전 복식 기준 (1코트 4명 출전)
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                    <input
                      type="number"
                      min="4"
                      max="64"
                      className="input"
                      value={participantCount}
                      onChange={e => handleParticipantCountChange(e.target.value)}
                      disabled={!isAdmin}
                      style={{ flex: 1, minWidth: '0', maxWidth: '100%', boxSizing: 'border-box' }}
                      placeholder="참여 인원수 입력"
                    />
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--txt2)', whiteSpace: 'nowrap' }}>명</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                    {[8, 10, 12, 14, 16, 20, 24].map(num => (
                      <button
                        key={num}
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ 
                          padding: '2px 8px', 
                          fontSize: '11px', 
                          backgroundColor: participantCount === num ? 'var(--blue)' : '#fff',
                          color: participantCount === num ? '#fff' : 'var(--txt2)',
                          borderColor: participantCount === num ? 'var(--blue)' : 'var(--border)'
                        }}
                        onClick={() => handleParticipantCountChange(num)}
                        disabled={!isAdmin}
                      >
                        {num}명
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. 코트 설정 */}
              <div style={{ width: '100%', maxWidth: '100%', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '4px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 'bold', margin: 0, color: 'var(--txt)' }}>코트 설정 (코트명 및 코트당 경기수)</label>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    자동 세팅: {maxAllowedSets}경기/코트
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {courtDetails.map((court, index) => (
                    <div key={court.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }}>
                      <input
                        type="text"
                        className="input input-sm"
                        style={{ flex: 2, padding: '6px 10px', boxSizing: 'border-box', minWidth: '0' }}
                        value={court.name}
                        placeholder="코트명 (예: 1코트)"
                        disabled={!isAdmin}
                        onChange={e => handleUpdateCourt(court.id, 'name', e.target.value)}
                      />
                      <select
                        className="input input-sm"
                        style={{ flex: 1, padding: '6px 10px', boxSizing: 'border-box', minWidth: '0' }}
                        value={Math.min(court.games || 2, maxAllowedSets)}
                        disabled={!isAdmin}
                        onChange={e => handleUpdateCourt(court.id, 'games', Math.min(parseInt(e.target.value) || 2, maxAllowedSets))}
                      >
                        {Array.from({ length: maxAllowedSets }, (_, i) => i + 1).map(g => (
                          <option key={g} value={g}>{g}경기</option>
                        ))}
                      </select>
                      {isAdmin && courtDetails.length > 1 && (
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '6px 12px', background: '#fee2e2', color: '#ef4444', border: '1px solid #fca5a5', boxShadow: 'none', flexShrink: 0 }}
                          onClick={() => handleRemoveCourt(court.id)}
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  ))}
                  {isAdmin && courtDetails.length < 10 && (
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ width: '100%', marginTop: '4px', border: '1px dashed var(--border)' }}
                      onClick={handleAddCourt}
                    >
                      ➕ 코트 추가
                    </button>
                  )}
                </div>
              </div>

              {/* 5. 경기수 설정 (개인전: 개인별 경기수, 팀전: 조별 경기수) */}
              <div style={{ width: '100%', maxWidth: '100%', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '4px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 'bold', margin: 0, color: 'var(--txt)' }}>
                    {isIndividual ? '개인별 경기수 (1인당 경기수)' : '조별 경기수 (팀당 경기수)'}
                  </label>
                  <span style={{ fontSize: '11px', color: '#16a34a', background: '#dcfce7', padding: '2px 8px', borderRadius: '12px' }}>
                    💡 {isIndividual ? `시간/코트/인원수(${participantCount}명) 기반 자동 추천: ${gamesPerTeam}경기` : `시간/코트 기반 자동 추천: ${gamesPerTeam}경기`}
                  </span>
                </div>
                <select className="input" value={gamesPerTeam} onChange={e => setGamesPerTeam(parseInt(e.target.value) || 3)} disabled={!isAdmin} style={{ width: '100%', maxWidth: '100%', minWidth: '0', boxSizing: 'border-box', display: 'block' }}>
                  {[1,2,3,4,5,6,7,8,9,10,11,12,14,16].map(g => <option key={g} value={g}>{g}경기</option>)}
                </select>
              </div>

            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={handleGoToStep2}>설정 완료 (다음 👉)</button>
          </div>
        </>
      ) : (
        <>
          <h2 style={{ marginTop: 0, color: 'var(--navy)', fontSize: '18px', marginBottom: '16px' }}>
            2단계. {isIndividual ? '참가자 명단 확정' : '참가자 및 조장 확정'}
          </h2>
          
          <div style={{ marginBottom: '16px', padding: '12px 16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', fontSize: '13px', color: '#166534' }}>
            <strong>⚙️ 설정 완료 정보:</strong> {date} | {startTime}~{endTime} | {isIndividual ? `개인별 ${gamesPerTeam}경기` : `조별 ${gamesPerTeam}경기`} | 코트: {courtDetails.map(c => `${c.name}(${c.games}경기)`).join(', ')} {isIndividual && `| 참여 인원: ${participantCount}명`}
          </div>

          <p style={{ color: 'var(--text-muted)', marginBottom: '12px', fontSize: '13px' }}>
            {isIndividual ? (
              <>투표 참석자를 기반으로 참가 명단을 체크해주세요. (설정한 참여 인원수: <strong>{participantCount}명</strong>)</>
            ) : (
              <>투표 참석자를 기반으로 참가 명단을 체크해주세요. 참석자 목록 중에서 팀의 조장이 될 선수를 왕관(👑) 아이콘을 눌러 지정할 수 있습니다.</>
            )}
          </p>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '13px' }}>
            현재 선택된 참가자: <strong>{attendees.length}명</strong>
            {!isIndividual && (
              <> | 선택된 조장: <strong>{captains.length}명</strong> (다음 단계에서 {captains.length}개 조가 생성됩니다.)</>
            )}
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
            {memberList.map(m => {
              const isSelected = attendees.includes(m.id);
              const isCaptain = captains.includes(m.id);
              return (
                <div 
                  key={m.id} 
                  style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 12px', 
                    border: '1px solid',
                    borderColor: isSelected ? 'var(--primary)' : 'var(--border)',
                    backgroundColor: isSelected ? '#e0f2fe' : '#fff',
                    borderRadius: '8px',
                    userSelect: 'none'
                  }}
                >
                  <span 
                    onClick={() => toggleAttendee(m.id)}
                    style={{ 
                      cursor: isAdmin ? 'pointer' : 'default',
                      fontWeight: isSelected ? 'bold' : 'normal'
                    }}
                  >
                    {m.name}
                  </span>
                  
                  {isSelected && !isIndividual && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCaptain(m.id);
                      }}
                      disabled={!isAdmin}
                      style={{
                        border: 'none',
                        background: isCaptain ? '#fef3c7' : '#e2e8f0',
                        color: isCaptain ? '#d97706' : '#64748b',
                        borderRadius: '4px',
                        padding: '2px 6px',
                        fontSize: '11px',
                        cursor: isAdmin ? 'pointer' : 'default',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px',
                        fontWeight: isCaptain ? 'bold' : 'normal'
                      }}
                    >
                      👑 {isCaptain ? '조장' : '조장 지정'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button className="btn btn-secondary" onClick={() => setDraftStep(1)}>👈 이전 (설정 변경)</button>
            {isAdmin && (
              <button className="btn btn-primary" onClick={handleConfirm}>명단 확정 (다음 👉)</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

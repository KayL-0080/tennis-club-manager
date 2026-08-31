import { useState, useMemo } from 'react';
import { TEAM_COLORS } from './PickingPhase';

export default function PlayingPhase({ tournament, members, onUpdate, isAdmin }) {
  const { type, matches, teams } = tournament;
  const byId = {};
  members.forEach(m => byId[m.id] = m);

  const teamMap = {};
  const teamIndexMap = {};
  if (teams) {
    teams.forEach((t, idx) => {
      teamMap[t.id] = t;
      teamIndexMap[t.id] = idx;
    });
  }

  const [localMatches, setLocalMatches] = useState(matches || []);
  const [maxGames, setMaxGames] = useState(tournament.maxGames || 6);
  const [courtSets, setCourtSets] = useState(() => {
    const init = {};
    const courtDetails = tournament.courtDetails || [
      { id: 'c1', name: '1코트', games: 2 },
      { id: 'c2', name: '2코트', games: 2 }
    ];
    courtDetails.forEach((court, cIdx) => {
      const cId = court.id || `c-${cIdx+1}`;
      init[cId] = tournament.courtSets?.[cId] || court.games || 2;
    });
    return init;
  });

  const maxAllowedSets = useMemo(() => {
    const start = tournament.startTime || tournament.time || '19:00';
    const end = tournament.endTime || '22:00';
    if (!start || !end) return 10;
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    let diff = (eH * 60 + eM) - (sH * 60 + sM);
    if (diff <= 0) diff += 24 * 60;
    return Math.max(1, Math.floor(diff / 30));
  }, [tournament.startTime, tournament.time, tournament.endTime]);

  const handleAddSet = (courtId, courtName, courtMaxGames) => {
    const current = courtSets[courtId] || 2;
    if (current >= courtMaxGames) {
      alert(`${courtName || '해당 코트'}는 1단계 환경설정에서 지정한 최대 경기수(${courtMaxGames}경기)를 초과하여 세트를 추가할 수 없습니다.`);
      return;
    }
    setCourtSets(prev => ({
      ...prev,
      [courtId]: current + 1
    }));
  };

  const handleRemoveSet = (courtId) => {
    const current = courtSets[courtId] || 2;
    if (current <= 1) {
      alert('최소 1개 이상의 세트가 필요합니다.');
      return;
    }
    setCourtSets(prev => ({
      ...prev,
      [courtId]: current - 1
    }));
  };

  const handleCourtSetsChange = (courtId, val, courtName, courtMaxGames) => {
    if (val > courtMaxGames) {
      alert(`${courtName || '해당 코트'}는 1단계 환경설정에서 지정한 최대 경기수(${courtMaxGames}경기)를 초과할 수 없습니다.`);
      setCourtSets(prev => ({
        ...prev,
        [courtId]: courtMaxGames
      }));
      return;
    }
    setCourtSets(prev => ({
      ...prev,
      [courtId]: Math.max(1, val)
    }));
  };

  const updateMatchScore = (matchIdx, field, val) => {
    const newMatches = [...localMatches];
    newMatches[matchIdx][field] = val !== '' ? parseInt(val) : null;
    setLocalMatches(newMatches);
  };

  const handleUpdateMatchSlot = (courtId, courtName, setIdx, field, val) => {
    const parsedVal = (field === 'scoreA' || field === 'scoreB')
      ? (val !== '' ? parseInt(val) : null)
      : (val !== '' ? val : null);

    // If changing a player, verify no duplicates in the same set or same match
    if (['playerA1', 'playerA2', 'playerB1', 'playerB2'].includes(field) && parsedVal) {
      const currentMatch = localMatches.find(m => (m.courtId === courtId || m.court === courtName) && m.setIndex === setIdx);
      
      // 1. Check duplicate within the same match
      if (currentMatch) {
        const otherSlotsInSameMatch = {
          playerA1: ['playerA2', 'playerB1', 'playerB2'],
          playerA2: ['playerA1', 'playerB1', 'playerB2'],
          playerB1: ['playerB2', 'playerA1', 'playerA2'],
          playerB2: ['playerB1', 'playerA1', 'playerA2']
        }[field] || [];

        for (const slotKey of otherSlotsInSameMatch) {
          if (currentMatch[slotKey] === parsedVal) {
            const playerName = byId[parsedVal]?.name || '선수';
            alert(`[${playerName}] 선수는 현재 경기(${courtName} ${setIdx}세트)에 이미 배정되어 있습니다.`);
            return;
          }
        }
      }

      // 2. Check duplicate across other courts in the same set
      const otherMatchesInSameSet = localMatches.filter(m => 
        (m.courtId !== courtId && m.court !== courtName) && 
        m.setIndex === setIdx
      );

      for (const otherMatch of otherMatchesInSameSet) {
        const activePlayers = [otherMatch.playerA1, otherMatch.playerA2, otherMatch.playerB1, otherMatch.playerB2].filter(Boolean);
        if (activePlayers.includes(parsedVal)) {
          const playerName = byId[parsedVal]?.name || '선수';
          const otherCourtName = otherMatch.court || otherMatch.courtId || '다른 코트';
          alert(`[${playerName}] 선수는 동일 시간대(${setIdx}세트, ${otherCourtName})에 이미 출전 중입니다.\n동일 시간대 중복 출전은 불가합니다.`);
          return;
        }
      }
    }

    setLocalMatches(prev => {
      const idx = prev.findIndex(m => (m.courtId === courtId || m.court === courtName) && m.setIndex === setIdx);

      if (idx !== -1) {
        const newMatches = [...prev];
        newMatches[idx] = { ...newMatches[idx], [field]: parsedVal };
        return newMatches;
      } else {
        const newSlot = {
          id: `court-${courtId}-set-${setIdx}`,
          court: courtName,
          courtId: courtId,
          setIndex: setIdx,
          teamAId: '',
          teamBId: '',
          playerA1: null,
          playerA2: null,
          playerB1: null,
          playerB2: null,
          scoreA: null,
          scoreB: null,
          [field]: parsedVal
        };
        return [...prev, newSlot];
      }
    });
  };

  const handleSave = async () => {
    if (!isAdmin) return;
    await onUpdate({ matches: localMatches, maxGames, courtSets });
    alert('저장되었습니다.');
  };

  const handleFinish = async () => {
    if (!isAdmin) return;
    if (!confirm('대회를 종료하고 결과를 정산하시겠습니까? (이후 점수 수정 불가)')) return;
    await onUpdate({ matches: localMatches, maxGames, courtSets, status: 'completed' });
  };

  const handleSwapMatches = (courtId, courtName, setIndexA, setIndexB) => {
    if (!isAdmin) return;

    const m1 = localMatches.find(m => (m.courtId === courtId || m.court === courtName) && m.setIndex === setIndexA);
    const m2 = localMatches.find(m => (m.courtId === courtId || m.court === courtName) && m.setIndex === setIndexB);

    const m1Players = m1 ? [m1.playerA1, m1.playerA2, m1.playerB1, m1.playerB2].filter(Boolean) : [];
    const m2Players = m2 ? [m2.playerA1, m2.playerA2, m2.playerB1, m2.playerB2].filter(Boolean) : [];

    if (m1Players.length > 0) {
      const otherMatchesAtB = localMatches.filter(m => 
        (m.courtId !== courtId && m.court !== courtName) && 
        m.setIndex === setIndexB
      );
      for (const m of otherMatchesAtB) {
        const activePlayers = [m.playerA1, m.playerA2, m.playerB1, m.playerB2].filter(Boolean);
        const overlap = m1Players.filter(p => activePlayers.includes(p));
        if (overlap.length > 0) {
          const names = overlap.map(pid => byId[pid]?.name || '알수없음').join(', ');
          alert(`경기 순서를 변경할 수 없습니다.\n[${names}] 선수가 다른 코트의 ${setIndexB}세트에 이미 출전 중입니다.`);
          return;
        }
      }
    }

    if (m2Players.length > 0) {
      const otherMatchesAtA = localMatches.filter(m => 
        (m.courtId !== courtId && m.court !== courtName) && 
        m.setIndex === setIndexA
      );
      for (const m of otherMatchesAtA) {
        const activePlayers = [m.playerA1, m.playerA2, m.playerB1, m.playerB2].filter(Boolean);
        const overlap = m2Players.filter(p => activePlayers.includes(p));
        if (overlap.length > 0) {
          const names = overlap.map(pid => byId[pid]?.name || '알수없음').join(', ');
          alert(`경기 순서를 변경할 수 없습니다.\n[${names}] 선수가 다른 코트의 ${setIndexA}세트에 이미 출전 중입니다.`);
          return;
        }
      }
    }

    setLocalMatches(prev => {
      const idx1 = prev.findIndex(m => (m.courtId === courtId || m.court === courtName) && m.setIndex === setIndexA);
      const idx2 = prev.findIndex(m => (m.courtId === courtId || m.court === courtName) && m.setIndex === setIndexB);

      const newMatches = [...prev];

      const stub1 = idx1 !== -1 ? newMatches[idx1] : {
        court: courtName,
        courtId: courtId,
        setIndex: setIndexA,
        teamAId: '',
        teamBId: '',
        playerA1: null,
        playerA2: null,
        playerB1: null,
        playerB2: null,
        scoreA: null,
        scoreB: null
      };

      const stub2 = idx2 !== -1 ? newMatches[idx2] : {
        court: courtName,
        courtId: courtId,
        setIndex: setIndexB,
        teamAId: '',
        teamBId: '',
        playerA1: null,
        playerA2: null,
        playerB1: null,
        playerB2: null,
        scoreA: null,
        scoreB: null
      };

      const m1Data = {
        teamAId: stub1.teamAId,
        teamBId: stub1.teamBId,
        playerA1: stub1.playerA1,
        playerA2: stub1.playerA2,
        playerB1: stub1.playerB1,
        playerB2: stub1.playerB2,
        scoreA: stub1.scoreA,
        scoreB: stub1.scoreB
      };

      const m2Data = {
        teamAId: stub2.teamAId,
        teamBId: stub2.teamBId,
        playerA1: stub2.playerA1,
        playerA2: stub2.playerA2,
        playerB1: stub2.playerB1,
        playerB2: stub2.playerB2,
        scoreA: stub2.scoreA,
        scoreB: stub2.scoreB
      };

      if (idx1 !== -1) {
        newMatches[idx1] = { ...newMatches[idx1], ...m2Data };
      } else {
        newMatches.push({ ...stub1, ...m2Data });
      }

      if (idx2 !== -1) {
        newMatches[idx2] = { ...newMatches[idx2], ...m1Data };
      } else {
        newMatches.push({ ...stub2, ...m1Data });
      }

      return newMatches;
    });
  };

  const updateMatchCourt = (matchIdx, val) => {
    const newMatches = [...localMatches];
    newMatches[matchIdx].court = val;
    setLocalMatches(newMatches);
  };

  const getSetTimeSlot = (startTime, setIdx) => {
    if (!startTime) return `${setIdx}`;
    try {
      const [h, m] = startTime.split(':').map(Number);
      const startMins = h * 60 + m + (setIdx - 1) * 30;
      
      const format = (mins) => {
        const hh = String(Math.floor(mins / 60) % 24).padStart(2, '0');
        const mm = String(mins % 60).padStart(2, '0');
        return `${hh}:${mm}`;
      };
      return format(startMins);
    } catch (e) {
      return `${setIdx}`;
    }
  };

  const updateTeamSetPlayer = (matchIdx, setIdx, field, val) => {
    const newMatches = [...localMatches];
    newMatches[matchIdx].sets[setIdx][field] = val !== '' ? val : null;
    setLocalMatches(newMatches);
  };

  const updateTeamSetScore = (matchIdx, setIdx, field, val) => {
    const newMatches = [...localMatches];
    newMatches[matchIdx].sets[setIdx][field] = val !== '' ? parseInt(val) : null;
    setLocalMatches(newMatches);
  };

  const renderTeamMatch = (m) => (
    <div key={m.id} style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#fff' }}>
      <div style={{ backgroundColor: '#f8fafc', padding: '8px 12px', fontWeight: 'bold', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ flex: 1, textAlign: 'center', fontSize: '13px' }}>
          {teamMap[m.teamAId]?.name} <span style={{ color: 'var(--text-muted)', margin: '0 8px' }}>VS</span> {teamMap[m.teamBId]?.name}
        </div>
        <div>
          <select className="input input-sm" style={{ width: '75px', fontSize: '12px', padding: '2px 4px' }} value={m.court || ''} onChange={e => updateMatchCourt(m._originalIdx, e.target.value)} disabled={!isAdmin}>
            <option value="">코트 미정</option>
            {Array.from({length: tournament.courts || 2}).map((_, i) => <option key={i+1} value={i+1}>{i+1}코트</option>)}
          </select>
        </div>
      </div>
      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {m.sets.map((s, sIdx) => {
           const teamAPlayers = teamMap[m.teamAId]?.players || [];
           const teamBPlayers = teamMap[m.teamBId]?.players || [];
           return (
             <div key={sIdx} style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderBottom: sIdx < 2 ? '1px dashed var(--border)' : 'none', paddingBottom: sIdx < 2 ? '8px' : '0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{sIdx + 1}세트</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <select
                      className="input input-sm"
                      style={{ width: '55px', textAlign: 'center' }}
                      value={s.scoreA !== null ? s.scoreA : ''}
                      onChange={e => updateTeamSetScore(m._originalIdx, sIdx, 'scoreA', e.target.value)}
                      disabled={!isAdmin}
                    >
                      <option value="">-</option>
                      {Array.from({ length: maxGames + 3 }).map((_, i) => (
                        <option key={i} value={i}>{i}</option>
                      ))}
                    </select>
                    <span>:</span>
                    <select
                      className="input input-sm"
                      style={{ width: '55px', textAlign: 'center' }}
                      value={s.scoreB !== null ? s.scoreB : ''}
                      onChange={e => updateTeamSetScore(m._originalIdx, sIdx, 'scoreB', e.target.value)}
                      disabled={!isAdmin}
                    >
                      <option value="">-</option>
                      {Array.from({ length: maxGames + 3 }).map((_, i) => (
                        <option key={i} value={i}>{i}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{teamMap[m.teamAId]?.name}</div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <select
                        className="input input-sm"
                        style={{ flex: 1, fontSize: '12px', padding: '2px' }}
                        value={s.playerA1 || ''}
                        onChange={e => updateTeamSetPlayer(m._originalIdx, sIdx, 'playerA1', e.target.value)}
                        disabled={!isAdmin}
                      >
                        <option value="">선수1</option>
                        {teamAPlayers.map(pid => <option key={pid} value={pid}>{byId[pid]?.name}</option>)}
                      </select>
                      <select
                        className="input input-sm"
                        style={{ flex: 1, fontSize: '12px', padding: '2px' }}
                        value={s.playerA2 || ''}
                        onChange={e => updateTeamSetPlayer(m._originalIdx, sIdx, 'playerA2', e.target.value)}
                        disabled={!isAdmin}
                      >
                        <option value="">선수2</option>
                        {teamAPlayers.map(pid => <option key={pid} value={pid}>{byId[pid]?.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right' }}>{teamMap[m.teamBId]?.name}</div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <select
                        className="input input-sm"
                        style={{ flex: 1, fontSize: '12px', padding: '2px' }}
                        value={s.playerB1 || ''}
                        onChange={e => updateTeamSetPlayer(m._originalIdx, sIdx, 'playerB1', e.target.value)}
                        disabled={!isAdmin}
                      >
                        <option value="">선수1</option>
                        {teamBPlayers.map(pid => <option key={pid} value={pid}>{byId[pid]?.name}</option>)}
                      </select>
                      <select
                        className="input input-sm"
                        style={{ flex: 1, fontSize: '12px', padding: '2px' }}
                        value={s.playerB2 || ''}
                        onChange={e => updateTeamSetPlayer(m._originalIdx, sIdx, 'playerB2', e.target.value)}
                        disabled={!isAdmin}
                      >
                        <option value="">선수2</option>
                        {teamBPlayers.map(pid => <option key={pid} value={pid}>{byId[pid]?.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
             </div>
           );
        })}
      </div>
    </div>
  );

  const renderIndividualMatch = (m) => (
     <div key={m.id} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <select className="input input-sm" style={{ width: '80px', fontSize: '11px', padding: '2px 4px', height: '22px' }} value={m.court || ''} onChange={e => updateMatchCourt(m._originalIdx, e.target.value)} disabled={!isAdmin}>
            <option value="">코트 미정</option>
            {courtDetails.map((c, idx) => <option key={c.id || idx} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <div style={{ flex: 1, textAlign: 'center', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
            <span style={{ fontWeight: 'bold' }}>{byId[m.playerA1]?.name || '선수1'}</span>
            {m.playerA2 && <span style={{ fontWeight: 'bold' }}>{byId[m.playerA2]?.name || '선수2'}</span>}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
             <select
               className="input input-sm"
               style={{ width: '36px', height: '36px', textAlign: 'center', fontSize: '13px', fontWeight: 'bold', padding: 0 }}
               value={m.scoreA !== null ? m.scoreA : ''}
               onChange={e => updateMatchScore(m._originalIdx, 'scoreA', e.target.value)}
               disabled={!isAdmin}
             >
               <option value="">-</option>
               {Array.from({ length: maxGames + 3 }).map((_, i) => (
                 <option key={i} value={i}>{i}</option>
               ))}
             </select>
             <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--txt3)' }}>vs</span>
             <select
               className="input input-sm"
               style={{ width: '36px', height: '36px', textAlign: 'center', fontSize: '13px', fontWeight: 'bold', padding: 0 }}
               value={m.scoreB !== null ? m.scoreB : ''}
               onChange={e => updateMatchScore(m._originalIdx, 'scoreB', e.target.value)}
               disabled={!isAdmin}
             >
               <option value="">-</option>
               {Array.from({ length: maxGames + 3 }).map((_, i) => (
                 <option key={i} value={i}>{i}</option>
               ))}
             </select>
          </div>

          <div style={{ flex: 1, textAlign: 'center', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
            <span style={{ fontWeight: 'bold' }}>{byId[m.playerB1]?.name || '선수1'}</span>
            {m.playerB2 && <span style={{ fontWeight: 'bold' }}>{byId[m.playerB2]?.name || '선수2'}</span>}
          </div>
        </div>
     </div>
  );

  const teamStats = useMemo(() => {
    if (type !== 'team') return [];
    const stats = {};
    teams.forEach(t => stats[t.id] = { ...t, matchWin: 0, matchDraw: 0, matchLoss: 0, setWin: 0, setLoss: 0, points: 0 });

    localMatches.forEach(m => {
      if (m.teamAId && m.teamBId && m.scoreA !== null && m.scoreB !== null) {
        const sA = m.scoreA;
        const sB = m.scoreB;
        stats[m.teamAId].setWin += sA;
        stats[m.teamAId].setLoss += sB;
        stats[m.teamBId].setWin += sB;
        stats[m.teamBId].setLoss += sA;

        if (sA > sB) {
          stats[m.teamAId].matchWin++;
          stats[m.teamBId].matchLoss++;
          stats[m.teamAId].points += 3;
          stats[m.teamBId].points += 1;
        } else if (sB > sA) {
          stats[m.teamBId].matchWin++;
          stats[m.teamAId].matchLoss++;
          stats[m.teamBId].points += 3;
          stats[m.teamAId].points += 1;
        } else {
          stats[m.teamAId].matchDraw++;
          stats[m.teamBId].matchDraw++;
          stats[m.teamAId].points += 2;
          stats[m.teamBId].points += 2;
        }
      }
    });

    const arr = Object.values(stats);
    arr.sort((a, b) => {
       if (b.points !== a.points) return b.points - a.points;
       return (b.setWin - b.setLoss) - (a.setWin - a.setLoss);
    });
    return arr;
  }, [localMatches, teams, type]);

  const indStats = useMemo(() => {
    if (type !== 'individual') return [];
    const stats = {};
    const ensure = (id) => {
      if (!id) return null;
      if (!stats[id]) stats[id] = { id, name: byId[id]?.name || '알수없음', win: 0, draw: 0, loss: 0, points: 0, diff: 0 };
      return stats[id];
    };

    localMatches.forEach(m => {
      if (m.scoreA === null || m.scoreB === null) return;
      const sA = m.scoreA;
      const sB = m.scoreB;
      const diff = sA - sB;

      [m.playerA1, m.playerA2].forEach(pid => {
        const p = ensure(pid);
        if (!p) return;
        p.diff += diff;
        if (sA > sB) { p.win++; p.points += 3; }
        else if (sA < sB) { p.loss++; p.points += 1; }
        else { p.draw++; p.points += 2; }
      });

      [m.playerB1, m.playerB2].forEach(pid => {
        const p = ensure(pid);
        if (!p) return;
        p.diff -= diff;
        if (sB > sA) { p.win++; p.points += 3; }
        else if (sB < sA) { p.loss++; p.points += 1; }
        else { p.draw++; p.points += 2; }
      });
    });

    const arr = Object.values(stats);
    arr.sort((a, b) => {
       if (b.points !== a.points) return b.points - a.points;
       return b.diff - a.diff;
    });
    return arr;
  }, [localMatches, type, byId]);

  const matchesForRender = useMemo(() => {
    return localMatches.map((m, i) => ({ ...m, _originalIdx: i })).sort((a, b) => {
      const courtA = a.court ? parseInt(a.court) : 999;
      const courtB = b.court ? parseInt(b.court) : 999;
      return courtA - courtB;
    });
  }, [localMatches]);

  const courtDetails = tournament.courtDetails || [
    { id: 'c1', name: '1코트', games: 2 },
    { id: 'c2', name: '2코트', games: 2 }
  ];

  return (
    <div className="card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <h2 style={{ margin: 0, color: 'var(--navy)', fontSize: '18px' }}>
          4단계. 실시간 순위 및 {isAdmin ? '점수 입력' : '경기 현황'}
        </h2>
        {isAdmin && (
          <div style={{ display: 'flex', gap: '4px' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => {
              if (confirm('대진표 생성 단계로 돌아가시겠습니까? 현재 점수는 보존됩니다.')) onUpdate({ status: 'picking' });
            }}>👈 이전</button>
            <button className="btn btn-secondary btn-sm" onClick={handleSave}>저장</button>
            <button className="btn btn-primary btn-sm" onClick={handleFinish}>종료</button>
          </div>
        )}
      </div>

      {isAdmin && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '16px', padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: 'bold', margin: 0 }}>경기 방식(게임수):</label>
            <select className="input input-sm" style={{ width: '100px' }} value={maxGames} onChange={e => setMaxGames(parseInt(e.target.value) || 6)}>
              {[4, 5, 6, 7, 8].map(g => <option key={g} value={g}>{g}게임 선승</option>)}
            </select>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Group by Court */}
        {type === 'team' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {courtDetails.map((court, cIdx) => {
              const courtId = court.id || `c-${cIdx+1}`;
              const courtNum = court.name;
              const courtMaxGames = court.games || 2;
              return (
                <div key={courtId} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', backgroundColor: '#f8fafc', overflowX: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      🎾 {courtNum} 대진
                    </h3>
                    {isAdmin && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{
                            padding: '3px 8px',
                            fontSize: '11px',
                            height: '26px',
                            color: '#b91c1c',
                            borderColor: '#fca5a5',
                            backgroundColor: (courtSets[courtId] || courtMaxGames) <= 1 ? '#f1f5f9' : '#fff',
                            cursor: (courtSets[courtId] || courtMaxGames) <= 1 ? 'not-allowed' : 'pointer'
                          }}
                          onClick={() => handleRemoveSet(courtId)}
                          disabled={(courtSets[courtId] || courtMaxGames) <= 1}
                          title="세트 삭제"
                        >
                          ➖ 세트 삭제
                        </button>
                        
                        <select 
                          className="input input-sm" 
                          style={{ width: '74px', padding: '2px 4px', fontSize: '12px', fontWeight: 'bold', textAlign: 'center', height: '26px' }} 
                          value={courtSets[courtId] || courtMaxGames} 
                          onChange={e => handleCourtSetsChange(courtId, parseInt(e.target.value) || 2, courtNum, courtMaxGames)}
                        >
                          {Array.from({ length: courtMaxGames }, (_, i) => i + 1).map(s => (
                            <option key={s} value={s}>{s}세트</option>
                          ))}
                        </select>

                        <button
                          className="btn btn-secondary btn-sm"
                          style={{
                            padding: '3px 8px',
                            fontSize: '11px',
                            height: '26px',
                            color: '#0369a1',
                            borderColor: '#7dd3fc',
                            backgroundColor: (courtSets[courtId] || courtMaxGames) >= courtMaxGames ? '#f1f5f9' : '#fff',
                            cursor: (courtSets[courtId] || courtMaxGames) >= courtMaxGames ? 'not-allowed' : 'pointer'
                          }}
                          onClick={() => handleAddSet(courtId, courtNum, courtMaxGames)}
                          disabled={(courtSets[courtId] || courtMaxGames) >= courtMaxGames}
                          title={`세트 추가 (1단계 설정 최대: ${courtMaxGames}세트)`}
                        >
                          ➕ 세트 추가
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <table className="table" style={{ width: '100%', minWidth: '320px', textAlign: 'center', fontSize: '12px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#edf2f7' }}>
                        <th style={{ width: '48px', padding: '6px 2px', fontSize: '11px' }}>시간</th>
                        <th style={{ width: '38px', padding: '6px 2px', fontSize: '11px' }}>세트</th>
                        <th style={{ padding: '6px 4px', fontSize: '11px' }}>대진</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: courtSets[courtId] || court.games || 2 }).map((_, idx) => {
                        const setIdx = idx + 1;
                        const m = localMatches.find(match => (match.courtId === courtId || match.court === courtNum) && match.setIndex === setIdx) || {
                          court: courtNum,
                          courtId: courtId,
                          setIndex: setIdx,
                          teamAId: '',
                          teamBId: '',
                          playerA1: null,
                          playerA2: null,
                          playerB1: null,
                          playerB2: null,
                          scoreA: null,
                          scoreB: null
                        };
                        
                        const teamAPlayers = teamMap[m.teamAId]?.players || [];
                        const teamBPlayers = teamMap[m.teamBId]?.players || [];

                        const teamAIdx = m.teamAId ? teamIndexMap[m.teamAId] : undefined;
                        const teamATheme = (teamAIdx !== undefined && teamAIdx >= 0) ? TEAM_COLORS[teamAIdx % TEAM_COLORS.length] : { bg: '#f8fafc', border: '#e2e8f0', text: 'var(--txt)', badgeBg: 'var(--blue)' };

                        const teamBIdx = m.teamBId ? teamIndexMap[m.teamBId] : undefined;
                        const teamBTheme = (teamBIdx !== undefined && teamBIdx >= 0) ? TEAM_COLORS[teamBIdx % TEAM_COLORS.length] : { bg: '#f8fafc', border: '#e2e8f0', text: 'var(--txt)', badgeBg: 'var(--red)' };
                        
                        return (
                          <tr 
                            key={setIdx} 
                            style={{ 
                              borderBottom: '1px solid #e2e8f0',
                              cursor: isAdmin ? 'grab' : 'default',
                              transition: 'background-color 0.2s'
                            }}
                            draggable={isAdmin}
                            onDragStart={(e) => {
                              if (!isAdmin) return;
                              e.dataTransfer.setData('courtId', courtId);
                              e.dataTransfer.setData('courtNum', courtNum);
                              e.dataTransfer.setData('setIndex', setIdx);
                              e.currentTarget.style.opacity = '0.5';
                            }}
                            onDragEnd={(e) => {
                              e.currentTarget.style.opacity = '1';
                            }}
                            onDragOver={(e) => {
                              if (isAdmin) e.preventDefault();
                            }}
                            onDragEnter={(e) => {
                              if (isAdmin) e.currentTarget.style.backgroundColor = '#e0f2fe';
                            }}
                            onDragLeave={(e) => {
                              if (isAdmin) e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                            onDrop={(e) => {
                              if (!isAdmin) return;
                              e.currentTarget.style.backgroundColor = 'transparent';
                              const sourceCourtId = e.dataTransfer.getData('courtId');
                              const sourceCourtNum = e.dataTransfer.getData('courtNum');
                              const sourceSetIndex = parseInt(e.dataTransfer.getData('setIndex'));
                              
                              if (sourceCourtId !== courtId) {
                                alert('다른 코트로는 경기를 이동할 수 없습니다.');
                                return;
                              }
                              if (sourceSetIndex !== setIdx) {
                                handleSwapMatches(courtId, courtNum, sourceSetIndex, setIdx);
                              }
                            }}
                          >
                            <td style={{ padding: '6px 2px', fontSize: '11px', whiteSpace: 'nowrap', color: 'var(--txt2)' }}>
                              {getSetTimeSlot(tournament.startTime, setIdx)}
                            </td>
                            <td style={{ padding: '6px 2px', fontWeight: 'bold', fontSize: '12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                                {isAdmin && <span style={{ color: '#94a3b8', cursor: 'grab', fontSize: '11px', userSelect: 'none' }}>☰</span>}
                                <span>{setIdx}</span>
                              </div>
                            </td>
                            
                            <td style={{ padding: '6px 2px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', width: '100%' }}>
                                {/* Team A Block: Team on top, Player 1 & Player 2 stacked vertically */}
                                <div style={{ 
                                  flex: 1, 
                                  minWidth: '70px', 
                                  display: 'flex', 
                                  flexDirection: 'column', 
                                  gap: '3px', 
                                  border: `1.5px solid ${teamATheme.border}`, 
                                  borderRadius: '6px', 
                                  padding: '3px', 
                                  backgroundColor: teamATheme.bg 
                                }}>
                                  <select
                                    className="input input-sm"
                                    style={{ 
                                      width: '100%', 
                                      fontWeight: 'bold', 
                                      fontSize: '12px', 
                                      padding: '2px 4px', 
                                      height: '26px', 
                                      lineHeight: 'normal',
                                      textAlign: 'center',
                                      textAlignLast: 'center',
                                      backgroundColor: '#fff',
                                      borderColor: teamATheme.border,
                                      color: teamATheme.text,
                                      opacity: 1,
                                      cursor: isAdmin ? 'pointer' : 'default',
                                      pointerEvents: isAdmin ? 'auto' : 'none',
                                      appearance: isAdmin ? 'auto' : 'none'
                                    }}
                                    value={m.teamAId || ''}
                                    onChange={e => handleUpdateMatchSlot(courtId, courtNum, setIdx, 'teamAId', e.target.value)}
                                    disabled={!isAdmin}
                                  >
                                    <option value="">A팀</option>
                                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                  </select>
                                  
                                  <select
                                    className="input input-sm"
                                    style={{ width: '100%', fontSize: '12px', padding: '2px 4px', height: '25px', lineHeight: 'normal', textAlign: 'center', textAlignLast: 'center', backgroundColor: '#fff', borderColor: teamATheme.border, opacity: 1, cursor: isAdmin ? 'pointer' : 'default', pointerEvents: isAdmin ? 'auto' : 'none', appearance: isAdmin ? 'auto' : 'none' }}
                                    value={m.playerA1 || ''}
                                    onChange={e => handleUpdateMatchSlot(courtId, courtNum, setIdx, 'playerA1', e.target.value)}
                                    disabled={!isAdmin || !m.teamAId}
                                  >
                                    <option value="">선수1</option>
                                    {teamAPlayers.map(pid => <option key={pid} value={pid}>{byId[pid]?.name}</option>)}
                                  </select>
                                  
                                  <select
                                    className="input input-sm"
                                    style={{ width: '100%', fontSize: '12px', padding: '2px 4px', height: '25px', lineHeight: 'normal', textAlign: 'center', textAlignLast: 'center', backgroundColor: '#fff', borderColor: teamATheme.border, opacity: 1, cursor: isAdmin ? 'pointer' : 'default', pointerEvents: isAdmin ? 'auto' : 'none', appearance: isAdmin ? 'auto' : 'none' }}
                                    value={m.playerA2 || ''}
                                    onChange={e => handleUpdateMatchSlot(courtId, courtNum, setIdx, 'playerA2', e.target.value)}
                                    disabled={!isAdmin || !m.teamAId}
                                  >
                                    <option value="">선수2</option>
                                    {teamAPlayers.map(pid => <option key={pid} value={pid}>{byId[pid]?.name}</option>)}
                                  </select>
                                </div>

                                {/* Score A */}
                                <select
                                  className="input input-sm"
                                  style={{ 
                                    width: '38px', 
                                    height: '54px', 
                                    textAlign: 'center', 
                                    textAlignLast: 'center', 
                                    fontSize: '14px', 
                                    fontWeight: 'bold', 
                                    padding: 0, 
                                    borderRadius: '6px', 
                                    flexShrink: 0,
                                    opacity: 1,
                                    cursor: isAdmin ? 'pointer' : 'default',
                                    pointerEvents: isAdmin ? 'auto' : 'none',
                                    appearance: isAdmin ? 'auto' : 'none',
                                    backgroundColor: m.scoreA !== null ? '#f8fafc' : '#ffffff',
                                    color: m.scoreA !== null ? 'var(--blue)' : 'var(--txt3)'
                                  }}
                                  value={m.scoreA !== null ? m.scoreA : ''}
                                  onChange={e => handleUpdateMatchSlot(courtId, courtNum, setIdx, 'scoreA', e.target.value)}
                                  disabled={!isAdmin || !m.teamAId || !m.teamBId}
                                >
                                  <option value="">-</option>
                                  {Array.from({ length: maxGames + 3 }).map((_, i) => (
                                    <option key={i} value={i}>{i}</option>
                                  ))}
                                </select>

                                <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--txt3)', flexShrink: 0, padding: '0 1px' }}>vs</span>

                                {/* Score B */}
                                <select
                                  className="input input-sm"
                                  style={{ 
                                    width: '38px', 
                                    height: '54px', 
                                    textAlign: 'center', 
                                    textAlignLast: 'center', 
                                    fontSize: '14px', 
                                    fontWeight: 'bold', 
                                    padding: 0, 
                                    borderRadius: '6px', 
                                    flexShrink: 0,
                                    opacity: 1,
                                    cursor: isAdmin ? 'pointer' : 'default',
                                    pointerEvents: isAdmin ? 'auto' : 'none',
                                    appearance: isAdmin ? 'auto' : 'none',
                                    backgroundColor: m.scoreB !== null ? '#f8fafc' : '#ffffff',
                                    color: m.scoreB !== null ? 'var(--red)' : 'var(--txt3)'
                                  }}
                                  value={m.scoreB !== null ? m.scoreB : ''}
                                  onChange={e => handleUpdateMatchSlot(courtId, courtNum, setIdx, 'scoreB', e.target.value)}
                                  disabled={!isAdmin || !m.teamAId || !m.teamBId}
                                >
                                  <option value="">-</option>
                                  {Array.from({ length: maxGames + 3 }).map((_, i) => (
                                    <option key={i} value={i}>{i}</option>
                                  ))}
                                </select>

                                {/* Team B Block: Team on top, Player 1 & Player 2 stacked vertically */}
                                <div style={{ 
                                  flex: 1, 
                                  minWidth: '70px', 
                                  display: 'flex', 
                                  flexDirection: 'column', 
                                  gap: '3px', 
                                  border: `1.5px solid ${teamBTheme.border}`, 
                                  borderRadius: '6px', 
                                  padding: '3px', 
                                  backgroundColor: teamBTheme.bg 
                                }}>
                                  <select
                                    className="input input-sm"
                                    style={{ 
                                      width: '100%', 
                                      fontWeight: 'bold', 
                                      fontSize: '12px', 
                                      padding: '2px 4px', 
                                      height: '26px', 
                                      lineHeight: 'normal',
                                      textAlign: 'center',
                                      textAlignLast: 'center',
                                      backgroundColor: '#fff',
                                      borderColor: teamBTheme.border,
                                      color: teamBTheme.text,
                                      opacity: 1,
                                      cursor: isAdmin ? 'pointer' : 'default',
                                      pointerEvents: isAdmin ? 'auto' : 'none',
                                      appearance: isAdmin ? 'auto' : 'none'
                                    }}
                                    value={m.teamBId || ''}
                                    onChange={e => handleUpdateMatchSlot(courtId, courtNum, setIdx, 'teamBId', e.target.value)}
                                    disabled={!isAdmin}
                                  >
                                    <option value="">B팀</option>
                                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                  </select>
                                  
                                  <select
                                    className="input input-sm"
                                    style={{ width: '100%', fontSize: '12px', padding: '2px 4px', height: '25px', lineHeight: 'normal', textAlign: 'center', textAlignLast: 'center', backgroundColor: '#fff', borderColor: teamBTheme.border, opacity: 1, cursor: isAdmin ? 'pointer' : 'default', pointerEvents: isAdmin ? 'auto' : 'none', appearance: isAdmin ? 'auto' : 'none' }}
                                    value={m.playerB1 || ''}
                                    onChange={e => handleUpdateMatchSlot(courtId, courtNum, setIdx, 'playerB1', e.target.value)}
                                    disabled={!isAdmin || !m.teamBId}
                                  >
                                    <option value="">선수1</option>
                                    {teamBPlayers.map(pid => <option key={pid} value={pid}>{byId[pid]?.name}</option>)}
                                  </select>
                                  
                                  <select
                                    className="input input-sm"
                                    style={{ width: '100%', fontSize: '12px', padding: '2px 4px', height: '25px', lineHeight: 'normal', textAlign: 'center', textAlignLast: 'center', backgroundColor: '#fff', borderColor: teamBTheme.border, opacity: 1, cursor: isAdmin ? 'pointer' : 'default', pointerEvents: isAdmin ? 'auto' : 'none', appearance: isAdmin ? 'auto' : 'none' }}
                                    value={m.playerB2 || ''}
                                    onChange={e => handleUpdateMatchSlot(courtId, courtNum, setIdx, 'playerB2', e.target.value)}
                                    disabled={!isAdmin || !m.teamBId}
                                  >
                                    <option value="">선수2</option>
                                    {teamBPlayers.map(pid => <option key={pid} value={pid}>{byId[pid]?.name}</option>)}
                                  </select>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}

        {type === 'individual' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {courtDetails.map((court, cIdx) => {
              const courtNum = court.name;
              const courtMatches = matchesForRender.filter(m => m.court === courtNum);
              return (
                <div key={court.id || cIdx} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', backgroundColor: '#f8fafc' }}>
                  <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    🎾 {courtNum} 대진 ({courtMatches.length})
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {courtMatches.map(m => renderIndividualMatch(m))}
                    {courtMatches.length === 0 && (
                      <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '10px 0' }}>배정된 대진이 없습니다.</div>
                    )}
                  </div>
                </div>
              );
            })}
            
            {(() => {
              const unassignedMatches = matchesForRender.filter(m => !m.court);
              if (unassignedMatches.length === 0) return null;
              return (
                <div style={{ border: '1px dashed var(--border)', borderRadius: '8px', padding: '12px', backgroundColor: '#fafafa' }}>
                  <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', color: 'var(--text-muted)' }}>
                    ❓ 코트 미정 대진 ({unassignedMatches.length})
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {unassignedMatches.map(m => renderIndividualMatch(m))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Real-time ranking moved to the bottom */}
        {type === 'team' && (
          <div style={{ overflowX: 'auto', marginTop: '24px', border: '1px solid var(--border)', borderRadius: '8px' }}>
            <div style={{ backgroundColor: '#f8fafc', padding: '8px 12px', fontWeight: 'bold', fontSize: '14px', borderBottom: '1px solid var(--border)' }}>실시간 순위</div>
            <table className="table" style={{ width: '100%', textAlign: 'center', minWidth: '400px', margin: 0 }}>
              <thead>
                <tr style={{ fontSize: '13px' }}>
                  <th>순위</th>
                  <th>팀</th>
                  <th>점수</th>
                  <th>전적</th>
                  <th>세트득실</th>
                </tr>
              </thead>
              <tbody>
                {teamStats.map((t, idx) => {
                  const tIdx = teamIndexMap[t.id];
                  const tTheme = (tIdx !== undefined && tIdx >= 0) ? TEAM_COLORS[tIdx % TEAM_COLORS.length] : null;
                  return (
                    <tr key={t.id} style={{ fontWeight: idx === 0 ? 'bold' : 'normal', backgroundColor: idx === 0 ? 'rgba(212, 160, 23, 0.12)' : 'transparent', fontSize: '13px' }}>
                      <td>{idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : idx + 1}</td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}>
                          {tTheme && (
                            <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: tTheme.badgeBg }} />
                          )}
                          {t.name}
                        </span>
                      </td>
                      <td style={{ color: 'var(--blue)', fontWeight: 'bold' }}>{t.points}</td>
                      <td>{t.matchWin}승 {t.matchDraw}무 {t.matchLoss}패</td>
                      <td>{t.setWin > t.setLoss ? '+' : ''}{t.setWin - t.setLoss} ({t.setWin}승 {t.setLoss}패)</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {type === 'individual' && (
          <div style={{ overflowX: 'auto', marginTop: '24px', border: '1px solid var(--border)', borderRadius: '8px' }}>
            <div style={{ backgroundColor: '#f8fafc', padding: '8px 12px', fontWeight: 'bold', fontSize: '14px', borderBottom: '1px solid var(--border)' }}>실시간 순위</div>
            <table className="table" style={{ width: '100%', textAlign: 'center', minWidth: '350px', margin: 0 }}>
              <thead>
                <tr style={{ fontSize: '13px' }}>
                  <th>순위</th>
                  <th>이름</th>
                  <th>점수</th>
                  <th>전적</th>
                  <th>득실</th>
                </tr>
              </thead>
              <tbody>
                {indStats.map((p, idx) => (
                  <tr key={p.id} style={{ fontWeight: idx < 3 ? 'bold' : 'normal', backgroundColor: idx === 0 ? '#fef3c7' : idx === 1 ? '#f1f5f9' : idx === 2 ? '#ffedd5' : 'transparent', fontSize: '13px' }}>
                    <td>{idx + 1}</td>
                    <td>{p.name}</td>
                    <td style={{ color: 'var(--primary)' }}>{p.points}</td>
                    <td>{p.win}승{p.draw}무{p.loss}패</td>
                    <td>{p.diff > 0 ? '+' : ''}{p.diff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

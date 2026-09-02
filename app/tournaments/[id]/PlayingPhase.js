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
  const [showRules, setShowRules] = useState(false);
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

  const handleMaxGamesChange = (newMax) => {
    setMaxGames(newMax);
    setLocalMatches(prev => prev.map(m => {
      let updated = { ...m };
      if (updated.scoreA !== null && updated.scoreA > newMax) {
        updated.scoreA = newMax;
      }
      if (updated.scoreB !== null && updated.scoreB > newMax) {
        updated.scoreB = newMax;
      }
      if (updated.sets && Array.isArray(updated.sets)) {
        updated.sets = updated.sets.map(s => {
          let sCopy = { ...s };
          if (sCopy.scoreA !== null && sCopy.scoreA > newMax) sCopy.scoreA = newMax;
          if (sCopy.scoreB !== null && sCopy.scoreB > newMax) sCopy.scoreB = newMax;
          return sCopy;
        });
      }
      return updated;
    }));
  };

  const updateMatchScore = (matchIdx, field, val) => {
    const newMatches = [...localMatches];
    let scoreVal = val !== '' ? parseInt(val) : null;
    if (scoreVal !== null) {
      scoreVal = Math.max(0, Math.min(maxGames, scoreVal));
    }
    newMatches[matchIdx][field] = scoreVal;
    setLocalMatches(newMatches);
  };

  const handleUpdateMatchSlot = (courtId, courtName, setIdx, field, val) => {
    let parsedVal = val !== '' ? val : null;
    if (field === 'scoreA' || field === 'scoreB') {
      parsedVal = val !== '' ? Math.max(0, Math.min(maxGames, parseInt(val))) : null;
    }

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

  const updateIndividualMatchPlayer = (matchIdx, field, newPlayerId) => {
    if (!isAdmin) return;
    const newMatches = [...localMatches];
    newMatches[matchIdx] = {
      ...newMatches[matchIdx],
      [field]: newPlayerId || null
    };
    setLocalMatches(newMatches);
  };

  const unassignIndividualCourts = () => {
    if (!isAdmin) return;
    if (!confirm('모든 대진의 코트 배정을 해제(초기화)하시겠습니까?')) return;
    const newMatches = localMatches.map(m => ({
      ...m,
      court: '',
      courtId: '',
      setIndex: null
    }));
    setLocalMatches(newMatches);
  };

  const attendeeOptions = useMemo(() => {
    const ids = tournament.attendees || [];
    let list = ids.map(id => byId[id]).filter(Boolean);
    if (list.length === 0) {
      list = members.filter(m => m.role !== '준회원' && m.role !== '게스트');
    }
    return [...list].sort((a, b) => {
      const ntrpA = parseFloat(a.ntrp) || 2.0;
      const ntrpB = parseFloat(b.ntrp) || 2.0;
      if (ntrpB !== ntrpA) return ntrpB - ntrpA;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [tournament.attendees, members, byId]);

  const formatMatchTimeSlot = (startTime, setIndex) => {
    const sIdx = setIndex || 1;
    const base = startTime || tournament.startTime || tournament.time || '19:00';
    try {
      const [h, m] = base.split(':').map(Number);
      const startMins = h * 60 + m + (sIdx - 1) * 30;
      const endMins = startMins + 30;

      const fmt = (mins) => {
        const hh = String(Math.floor(mins / 60) % 24).padStart(2, '0');
        const mm = String(mins % 60).padStart(2, '0');
        return `${hh}:${mm}`;
      };
      return `${fmt(startMins)} ~ ${fmt(endMins)}`;
    } catch (e) {
      return `${sIdx}경기`;
    }
  };

  const autoAssignIndividualCourts = () => {
    if (!isAdmin) return;
    const courtsList = tournament.courtDetails || [
      { id: 'c1', name: '1코트', games: 4 },
      { id: 'c2', name: '2코트', games: 4 }
    ];
    if (courtsList.length === 0) {
      alert('코트 정보가 없습니다.');
      return;
    }

    const newMatches = [...localMatches];
    newMatches.sort((a, b) => (a.round || 1) - (b.round || 1));

    const courtOccupied = {};
    const playerOccupied = {};

    newMatches.forEach((m) => {
      const matchPlayers = [m.playerA1, m.playerA2, m.playerB1, m.playerB2].filter(Boolean);
      let targetSlot = m.round || 1;
      let assignedCourt = null;

      while (!assignedCourt && targetSlot < 100) {
        const hasPlayerConflict = matchPlayers.some(pId => playerOccupied[targetSlot] && playerOccupied[targetSlot].has(pId));
        if (!hasPlayerConflict) {
          for (const court of courtsList) {
            if (!courtOccupied[targetSlot]?.[court.name]) {
              assignedCourt = court;
              break;
            }
          }
        }
        if (!assignedCourt) {
          targetSlot++;
        }
      }

      if (assignedCourt) {
        m.court = assignedCourt.name;
        m.courtId = assignedCourt.id;
        m.setIndex = targetSlot;

        if (!courtOccupied[targetSlot]) courtOccupied[targetSlot] = {};
        courtOccupied[targetSlot][assignedCourt.name] = true;

        if (!playerOccupied[targetSlot]) playerOccupied[targetSlot] = new Set();
        matchPlayers.forEach(pId => playerOccupied[targetSlot].add(pId));
      }
    });

    setLocalMatches(newMatches);
  };

  const conflictMap = useMemo(() => {
    if (type === 'team') return { hasConflict: false, matchConflicts: {}, conflictDetails: [] };

    const slotMap = {};

    localMatches.forEach((m, mIdx) => {
      if (!m.court) return;
      const slot = m.setIndex || m.round || 1;
      if (!slotMap[slot]) slotMap[slot] = {};

      const players = [m.playerA1, m.playerA2, m.playerB1, m.playerB2].filter(Boolean);

      players.forEach(pId => {
        if (!slotMap[slot][pId]) slotMap[slot][pId] = [];
        slotMap[slot][pId].push({
          matchId: m.id,
          matchIdx: mIdx,
          court: m.court,
          round: m.round || 1
        });
      });
    });

    const matchConflicts = {};
    const conflictDetails = [];

    Object.keys(slotMap).forEach(slot => {
      const playersInSlot = slotMap[slot];
      Object.keys(playersInSlot).forEach(pId => {
        const occurrences = playersInSlot[pId];
        if (occurrences.length > 1) {
          const courts = occurrences.map(o => o.court).filter(Boolean);
          const uniqueCourts = Array.from(new Set(courts));
          const pName = byId[pId]?.name || '선수';
          const timeStr = formatMatchTimeSlot(tournament.startTime, parseInt(slot));

          conflictDetails.push({
            playerId: pId,
            playerName: pName,
            slot,
            timeStr,
            courts: uniqueCourts
          });

          occurrences.forEach(occ => {
            if (!matchConflicts[occ.matchId]) matchConflicts[occ.matchId] = {};
            matchConflicts[occ.matchId][pId] = uniqueCourts;
          });
        }
      });
    });

    return {
      hasConflict: conflictDetails.length > 0,
      matchConflicts,
      conflictDetails
    };
  }, [localMatches, type, tournament.startTime, byId]);

  const availableRounds = useMemo(() => {
    const rSet = new Set(localMatches.map(m => m.round || 1));
    return Array.from(rSet).sort((a, b) => a - b);
  }, [localMatches]);

  const [draggingRound, setDraggingRound] = useState(null);
  const [dragOverRound, setDragOverRound] = useState(null);
  const [indViewMode, setIndViewMode] = useState('court'); // 'court' | 'round'

  const handleReorderRounds = (fromRound, toRound) => {
    if (!isAdmin || fromRound === toRound) return;
    const fromIdx = availableRounds.indexOf(fromRound);
    const toIdx = availableRounds.indexOf(toRound);
    if (fromIdx === -1 || toIdx === -1) return;

    const newRoundsOrder = [...availableRounds];
    const [moved] = newRoundsOrder.splice(fromIdx, 1);
    newRoundsOrder.splice(toIdx, 0, moved);

    const roundMapping = {};
    newRoundsOrder.forEach((oldR, newIdx) => {
      roundMapping[oldR] = newIdx + 1;
    });

    const newMatches = localMatches.map(m => {
      const currentR = m.round || 1;
      const newR = roundMapping[currentR] || currentR;
      return {
        ...m,
        round: newR
      };
    });

    newMatches.sort((a, b) => (a.round || 1) - (b.round || 1));
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
    let scoreVal = val !== '' ? parseInt(val) : null;
    if (scoreVal !== null) {
      scoreVal = Math.max(0, Math.min(maxGames, scoreVal));
    }
    newMatches[matchIdx].sets[setIdx][field] = scoreVal;
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
                      {Array.from({ length: maxGames + 1 }).map((_, i) => (
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
                      {Array.from({ length: maxGames + 1 }).map((_, i) => (
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

  const renderIndividualMatch = (m) => {
    const timeStr = formatMatchTimeSlot(tournament.startTime, m.setIndex || m.round);
    const hasScores = m.scoreA !== null && m.scoreB !== null;
    const isWinA = hasScores && m.scoreA > m.scoreB;
    const isWinB = hasScores && m.scoreB > m.scoreA;

    const matchConflictInfo = conflictMap.matchConflicts[m.id] || null;
    const hasConflict = !!matchConflictInfo;

    const renderPlayerSlot = (field, pid, defaultLabel) => {
      const isPlayerConflicting = matchConflictInfo && matchConflictInfo[pid];

      if (isAdmin) {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '100%' }}>
            <select
              className="input input-sm"
              style={{
                width: '100%',
                fontSize: '12px',
                padding: '2px 4px',
                height: '26px',
                fontWeight: 'bold',
                textAlign: 'center',
                textAlignLast: 'center',
                backgroundColor: isPlayerConflicting ? '#fee2e2' : '#fff',
                borderColor: isPlayerConflicting ? '#ef4444' : 'var(--border)',
                color: isPlayerConflicting ? '#b91c1c' : 'var(--txt)'
              }}
              value={pid || ''}
              onChange={e => updateIndividualMatchPlayer(m._originalIdx, field, e.target.value)}
            >
              <option value="">{defaultLabel} 선택</option>
              {attendeeOptions.map(mem => (
                <option key={mem.id} value={mem.id}>
                  {mem.name} ({mem.ntrp || 2.0}/{mem.gender === 'F' ? '여' : '남'})
                </option>
              ))}
            </select>
            {isPlayerConflicting && (
              <span style={{ fontSize: '10px', color: '#dc2626', fontWeight: 'bold' }}>
                ⚠️ 동시간 중복 ({isPlayerConflicting.join(', ')})
              </span>
            )}
          </div>
        );
      }

      return (
        <div style={{
          fontWeight: 800,
          color: isPlayerConflicting ? '#dc2626' : 'var(--txt)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px',
          flexWrap: 'wrap'
        }}>
          <span>{byId[pid]?.name || defaultLabel}</span>
          {pid && <span style={{ fontSize: '11px', color: 'var(--txt3)', fontWeight: 600 }}>({byId[pid]?.ntrp || 2.0})</span>}
          {isPlayerConflicting && (
            <span style={{ fontSize: '10px', color: '#dc2626', background: '#fee2e2', padding: '1px 4px', borderRadius: '4px' }}>
              ⚠️ 중복
            </span>
          )}
        </div>
      );
    };

    const getDisplayCategory = () => {
      if (m.category) return m.category;
      const players = [m.playerA1, m.playerA2, m.playerB1, m.playerB2].filter(Boolean).map(id => byId[id]).filter(Boolean);
      if (players.length < 4) return null;
      const males = players.filter(p => p.gender === 'M').length;
      const females = players.filter(p => p.gender === 'F').length;
      if (males === 4) return '남복';
      if (females === 4) return '여복';
      if (males === 2 && females === 2) return '혼복';
      return '잡복';
    };

    const matchCategory = getDisplayCategory();

    return (
      <div 
        key={m.id} 
        style={{ 
          border: hasConflict ? '1.5px solid #ef4444' : '1px solid var(--border)', 
          borderRadius: '10px', 
          padding: '10px 14px', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '8px', 
          backgroundColor: hasConflict ? '#fffdfd' : '#fff',
          boxShadow: hasConflict ? '0 2px 8px rgba(239, 68, 68, 0.1)' : '0 2px 6px rgba(0,0,0,0.02)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', fontWeight: 'bold', background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '12px' }}>
              R{m.round || 1}
            </span>
            {matchCategory && (
              <span style={{
                fontSize: '11px',
                fontWeight: 'bold',
                padding: '2px 8px',
                borderRadius: '12px',
                backgroundColor: matchCategory === '남복' ? '#dbeafe' : matchCategory === '여복' ? '#fce7f3' : matchCategory === '혼복' ? '#f3e8ff' : '#fef3c7',
                color: matchCategory === '남복' ? '#1d4ed8' : matchCategory === '여복' ? '#be185d' : matchCategory === '혼복' ? '#7e22ce' : '#b45309',
                border: `1px solid ${matchCategory === '남복' ? '#bfdbfe' : matchCategory === '여복' ? '#fbcfe8' : matchCategory === '혼복' ? '#e9d5ff' : '#fde68a'}`
              }}>
                {matchCategory === '남복' && '남복 👨👨'}
                {matchCategory === '여복' && '여복 👩👩'}
                {matchCategory === '혼복' && '혼복 👫'}
                {matchCategory === '잡복' && '잡복 🎾'}
              </span>
            )}
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--txt)' }}>
              ⏰ {timeStr}
            </span>
            {m.setIndex && (
              <span style={{ fontSize: '11px', color: 'var(--txt3)' }}>
                ({m.setIndex}경기)
              </span>
            )}
            {hasConflict && (
              <span style={{ fontSize: '11px', fontWeight: 'bold', background: '#fee2e2', color: '#b91c1c', padding: '2px 8px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                ⚠️ 동시간대 중복
              </span>
            )}
          </div>

          <select 
            className="input input-sm" 
            style={{ 
              width: '90px', 
              fontSize: '11px', 
              padding: '2px 6px', 
              height: '24px',
              fontWeight: 600,
              cursor: isAdmin ? 'pointer' : 'default',
              pointerEvents: isAdmin ? 'auto' : 'none',
              appearance: isAdmin ? 'auto' : 'none',
              opacity: 1,
              backgroundColor: m.court ? '#f0fdf4' : '#fff',
              borderColor: m.court ? '#86efac' : 'var(--border)',
              color: m.court ? '#166534' : 'var(--txt)'
            }} 
            value={m.court || ''} 
            onChange={e => updateMatchCourt(m._originalIdx, e.target.value)} 
            disabled={!isAdmin}
          >
            <option value="">코트 미정</option>
            {courtDetails.map((c, idx) => <option key={c.id || idx} value={c.name}>{c.name}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          {/* Team/Pair A */}
          <div style={{ 
            flex: 1, 
            textAlign: 'center', 
            fontSize: '13px', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '4px',
            padding: '6px 8px',
            borderRadius: '8px',
            backgroundColor: isWinA ? 'rgba(0, 122, 255, 0.08)' : 'rgba(0,0,0,0.02)',
            border: isWinA ? '1px solid rgba(0, 122, 255, 0.3)' : '1px solid transparent'
          }}>
            {type === 'fixed_pair' && (
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#166534', borderBottom: '1px dashed #bbf7d0', paddingBottom: '2px', marginBottom: '2px' }}>
                👫 {m.pairAName || 'A페어'}
              </span>
            )}
            {renderPlayerSlot('playerA1', m.playerA1, '선수1')}
            {renderPlayerSlot('playerA2', m.playerA2, '선수2')}
          </div>
          
          {/* Score inputs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
             <select
               className="input input-sm"
               style={{ 
                 width: '38px', 
                 height: '40px', 
                 textAlign: 'center', 
                 fontSize: '14px', 
                 fontWeight: 800, 
                 padding: 0, 
                 borderRadius: '6px',
                 opacity: 1,
                 cursor: isAdmin ? 'pointer' : 'default',
                 pointerEvents: isAdmin ? 'auto' : 'none',
                 appearance: isAdmin ? 'auto' : 'none',
                 backgroundColor: m.scoreA !== null ? '#f8fafc' : '#ffffff',
                 color: m.scoreA !== null ? 'var(--blue)' : 'var(--txt3)',
                 borderColor: isWinA ? 'var(--blue)' : 'var(--border)'
               }}
               value={m.scoreA !== null ? m.scoreA : ''}
               onChange={e => updateMatchScore(m._originalIdx, 'scoreA', e.target.value)}
               disabled={!isAdmin}
             >
               <option value="">-</option>
               {Array.from({ length: maxGames + 1 }).map((_, i) => (
                 <option key={i} value={i}>{i}</option>
               ))}
             </select>
             <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--txt3)' }}>:</span>
             <select
               className="input input-sm"
               style={{ 
                 width: '38px', 
                 height: '40px', 
                 textAlign: 'center', 
                 fontSize: '14px', 
                 fontWeight: 800, 
                 padding: 0, 
                 borderRadius: '6px',
                 opacity: 1,
                 cursor: isAdmin ? 'pointer' : 'default',
                 pointerEvents: isAdmin ? 'auto' : 'none',
                 appearance: isAdmin ? 'auto' : 'none',
                 backgroundColor: m.scoreB !== null ? '#f8fafc' : '#ffffff',
                 color: m.scoreB !== null ? 'var(--red)' : 'var(--txt3)',
                 borderColor: isWinB ? 'var(--red)' : 'var(--border)'
               }}
               value={m.scoreB !== null ? m.scoreB : ''}
               onChange={e => updateMatchScore(m._originalIdx, 'scoreB', e.target.value)}
               disabled={!isAdmin}
             >
               <option value="">-</option>
               {Array.from({ length: maxGames + 1 }).map((_, i) => (
                 <option key={i} value={i}>{i}</option>
               ))}
             </select>
          </div>

          {/* Team/Pair B */}
          <div style={{ 
            flex: 1, 
            textAlign: 'center', 
            fontSize: '13px', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '4px',
            padding: '6px 8px',
            borderRadius: '8px',
            backgroundColor: isWinB ? 'rgba(255, 59, 48, 0.08)' : 'rgba(0,0,0,0.02)',
            border: isWinB ? '1px solid rgba(255, 59, 48, 0.3)' : '1px solid transparent'
          }}>
            {type === 'fixed_pair' && (
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#166534', borderBottom: '1px dashed #bbf7d0', paddingBottom: '2px', marginBottom: '2px' }}>
                👫 {m.pairBName || 'B페어'}
              </span>
            )}
            {renderPlayerSlot('playerB1', m.playerB1, '선수1')}
            {renderPlayerSlot('playerB2', m.playerB2, '선수2')}
          </div>
        </div>
      </div>
    );
  };

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

  const pairStats = useMemo(() => {
    if (type !== 'fixed_pair') return [];
    const stats = {};
    const pairList = tournament.pairs || [];

    pairList.forEach(p => {
      const p1 = byId[p.player1];
      const p2 = byId[p.player2];
      stats[p.id] = {
        id: p.id,
        name: p.name || '페어',
        player1: p.player1,
        player2: p.player2,
        p1Name: p1?.name || '선수1',
        p2Name: p2?.name || '선수2',
        matchWin: 0,
        matchDraw: 0,
        matchLoss: 0,
        setWin: 0,
        setLoss: 0,
        points: 0,
        diff: 0
      };
    });

    localMatches.forEach(m => {
      if (m.scoreA === null || m.scoreB === null) return;
      const sA = m.scoreA;
      const sB = m.scoreB;
      const diff = sA - sB;

      if (m.pairAId && stats[m.pairAId]) {
        stats[m.pairAId].setWin += sA;
        stats[m.pairAId].setLoss += sB;
        stats[m.pairAId].diff += diff;
        if (sA > sB) { stats[m.pairAId].matchWin++; stats[m.pairAId].points += 3; }
        else if (sA < sB) { stats[m.pairAId].matchLoss++; stats[m.pairAId].points += 1; }
        else { stats[m.pairAId].matchDraw++; stats[m.pairAId].points += 2; }
      }
      if (m.pairBId && stats[m.pairBId]) {
        stats[m.pairBId].setWin += sB;
        stats[m.pairBId].setLoss += sA;
        stats[m.pairBId].diff -= diff;
        if (sB > sA) { stats[m.pairBId].matchWin++; stats[m.pairBId].points += 3; }
        else if (sB < sA) { stats[m.pairBId].matchLoss++; stats[m.pairBId].points += 1; }
        else { stats[m.pairBId].matchDraw++; stats[m.pairBId].points += 2; }
      }
    });

    const arr = Object.values(stats);
    arr.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.diff !== a.diff) return b.diff - a.diff;
      return (b.setWin - b.setLoss) - (a.setWin - a.setLoss);
    });
    return arr;
  }, [localMatches, tournament.pairs, type, byId]);

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
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
            {type !== 'team' && (
              <>
                <button 
                  className="btn btn-secondary btn-sm"
                  style={{ background: '#e0f2fe', color: '#0369a1', borderColor: '#7dd3fc', fontWeight: 'bold' }}
                  onClick={autoAssignIndividualCourts}
                >
                  🎲 코트 자동 배정
                </button>
                <button 
                  className="btn btn-secondary btn-sm"
                  style={{ background: '#fef2f2', color: '#b91c1c', borderColor: '#fca5a5', fontWeight: 'bold' }}
                  onClick={unassignIndividualCourts}
                >
                  🧹 코트 배정 해제
                </button>
              </>
            )}
            <button className="btn btn-secondary btn-sm" onClick={() => {
              if (confirm('이전 설정 단계로 돌아가시겠습니까? 현재 입력된 점수는 보존됩니다.')) {
                onUpdate({ status: type === 'team' ? 'picking' : 'draft' });
              }
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
            <select className="input input-sm" style={{ width: '100px' }} value={maxGames} onChange={e => handleMaxGamesChange(parseInt(e.target.value) || 6)}>
              {[4, 5, 6, 7, 8].map(g => <option key={g} value={g}>{g}게임 선승</option>)}
            </select>
          </div>
        </div>
      )}

      {/* 📜 경기 진행 규칙 안내 배너 */}
      {tournament.matchRules && (
        <div style={{ marginBottom: '16px', border: '1px solid #c7d2fe', borderRadius: '8px', backgroundColor: '#f5f7ff', overflow: 'hidden' }}>
          <div 
            style={{ 
              padding: '9px 14px', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              cursor: 'pointer',
              userSelect: 'none'
            }}
            onClick={() => setShowRules(prev => !prev)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, fontSize: '13px', color: '#3730a3' }}>
              <span>📜 경기 진행 규칙 안내 (복식 핸디캡 / 타이브레이크 / No-Ad)</span>
            </div>
            <span style={{ fontSize: '12px', color: '#4338ca', fontWeight: 700 }}>
              {showRules ? '접기 ▲' : '규칙 보기 ▼'}
            </span>
          </div>

          {showRules && (
            <div style={{ padding: '12px 14px', borderTop: '1px solid #e0e7ff', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px', color: '#1e1b4b', backgroundColor: '#fff' }}>
              {tournament.matchRules.doublesHandicap && (
                <div>
                  <strong style={{ color: '#4338ca' }}>🎾 1. 복식 핸디캡 룰:</strong>
                  <div style={{ whiteSpace: 'pre-line', marginTop: '3px', color: 'var(--txt)', paddingLeft: '8px', lineHeight: '1.5' }}>
                    {tournament.matchRules.doublesHandicap}
                  </div>
                </div>
              )}
              {tournament.matchRules.tiebreak && (
                <div>
                  <strong style={{ color: '#4338ca' }}>⚡ 2. 타이브레이크 룰:</strong>
                  <div style={{ whiteSpace: 'pre-line', marginTop: '3px', color: 'var(--txt)', paddingLeft: '8px', lineHeight: '1.5' }}>
                    {tournament.matchRules.tiebreak}
                  </div>
                </div>
              )}
              {tournament.matchRules.noAd && (
                <div>
                  <strong style={{ color: '#4338ca' }}>🎯 3. No-Ad 룰:</strong>
                  <div style={{ whiteSpace: 'pre-line', marginTop: '3px', color: 'var(--txt)', paddingLeft: '8px', lineHeight: '1.5' }}>
                    {tournament.matchRules.noAd}
                  </div>
                </div>
              )}
              {tournament.matchRules.custom && (
                <div>
                  <strong style={{ color: '#4338ca' }}>📝 4. 추가 수칙:</strong>
                  <div style={{ whiteSpace: 'pre-line', marginTop: '3px', color: 'var(--txt)', paddingLeft: '8px', lineHeight: '1.5' }}>
                    {tournament.matchRules.custom}
                  </div>
                </div>
              )}
            </div>
          )}
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
                                  {Array.from({ length: maxGames + 1 }).map((_, i) => (
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
                                  {Array.from({ length: maxGames + 1 }).map((_, i) => (
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

        {type !== 'team' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* 1. 중복 선수 점검 알림 배너 */}
            {conflictMap.hasConflict ? (
              <div style={{ padding: '12px 16px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '10px', boxShadow: '0 2px 6px rgba(239, 68, 68, 0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', color: '#991b1b', fontSize: '13px', marginBottom: '6px' }}>
                  <span>⚠️ 동시간대 중복 출전 선수 감지 ({conflictMap.conflictDetails.length}건)</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: '#b91c1c' }}>
                  {conflictMap.conflictDetails.map((c, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                      • <strong>{c.playerName}</strong> 선수: <strong>{c.timeStr} ({c.slot}경기)</strong> 시간대에 <strong>{c.courts.join(' & ')}</strong>에 중복 배정되었습니다.
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ padding: '8px 14px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: '#166534', flexWrap: 'wrap', gap: '6px' }}>
                <span style={{ fontWeight: 600 }}>✅ 동시간대 선수 중복 출전 없음 (정상)</span>
                <span style={{ color: 'var(--txt3)' }}>
                  총 {localMatches.length}경기 중 {localMatches.filter(m => m.court).length}경기 코트 배정 완료
                </span>
              </div>
            )}

            {/* 2. 라운드 순서 변경 (드래그 & 드롭) 바 및 보기 모드 탭 */}
            <div style={{ backgroundColor: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--navy)' }}>🔄 라운드 순서 변경</span>
                  <span style={{ fontSize: '11px', color: 'var(--txt3)' }}>
                    {isAdmin ? '라운드 카드를 드래그 & 드롭하여 순서를 변경하세요.' : '라운드 순서'}
                  </span>
                </div>

                {/* 뷰 모드 스위처 */}
                <div style={{ display: 'flex', backgroundColor: '#e2e8f0', borderRadius: '8px', padding: '2px', gap: '2px' }}>
                  <button
                    type="button"
                    onClick={() => setIndViewMode('court')}
                    style={{
                      border: 'none',
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: indViewMode === 'court' ? 'bold' : 'normal',
                      backgroundColor: indViewMode === 'court' ? '#fff' : 'transparent',
                      color: indViewMode === 'court' ? 'var(--navy)' : 'var(--txt3)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      boxShadow: indViewMode === 'court' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                    }}
                  >
                    🎾 코트별 보기
                  </button>
                  <button
                    type="button"
                    onClick={() => setIndViewMode('round')}
                    style={{
                      border: 'none',
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: indViewMode === 'round' ? 'bold' : 'normal',
                      backgroundColor: indViewMode === 'round' ? '#fff' : 'transparent',
                      color: indViewMode === 'round' ? 'var(--navy)' : 'var(--txt3)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      boxShadow: indViewMode === 'round' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                    }}
                  >
                    🔄 라운드별 보기
                  </button>
                </div>
              </div>

              {/* 드래그 가능한 라운드 칩 목록 */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                {availableRounds.map((r) => {
                  const isBeingDragged = draggingRound === r;
                  const isOver = dragOverRound === r;
                  const countInR = localMatches.filter(m => (m.round || 1) === r).length;

                  return (
                    <div
                      key={r}
                      draggable={isAdmin}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', String(r));
                        setDraggingRound(r);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                      }}
                      onDragEnter={() => setDragOverRound(r)}
                      onDragLeave={() => setDragOverRound(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        const fromR = parseInt(e.dataTransfer.getData('text/plain')) || draggingRound;
                        if (fromR && fromR !== r) {
                          handleReorderRounds(fromR, r);
                        }
                        setDraggingRound(null);
                        setDragOverRound(null);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        backgroundColor: isOver ? '#dbeafe' : isBeingDragged ? '#e2e8f0' : '#fff',
                        border: isOver ? '2px dashed #3b82f6' : '1px solid var(--border)',
                        borderRadius: '8px',
                        cursor: isAdmin ? 'grab' : 'default',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                        userSelect: 'none',
                        transition: 'all 0.15s ease'
                      }}
                      title={isAdmin ? `${r}라운드를 드래그하여 다른 라운드 위치로 이동` : `${r}라운드`}
                    >
                      {isAdmin && <span style={{ color: 'var(--txt3)', fontSize: '11px' }}>☰</span>}
                      <span style={{ fontWeight: 800, fontSize: '12px', color: 'var(--txt)' }}>
                        {r}라운드
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--txt3)' }}>
                        ({countInR}경기)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. 모드별 대진 목록 렌더링 */}
            {indViewMode === 'court' ? (
              <>
                {courtDetails.map((court, cIdx) => {
                  const courtNum = court.name;
                  const courtMatches = matchesForRender
                    .filter(m => m.court === courtNum)
                    .sort((a, b) => (a.setIndex || a.round || 0) - (b.setIndex || b.round || 0));

                  return (
                    <div key={court.id || cIdx} style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '14px', backgroundColor: '#f8fafc' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '6px' }}>
                        <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800 }}>
                          🎾 {courtNum} 대진 ({courtMatches.length}경기)
                        </h3>
                        {courtMatches.length > 0 && (
                          <span style={{ fontSize: '12px', color: 'var(--txt3)', fontWeight: 600 }}>
                            시작 시간: ⏰ {formatMatchTimeSlot(tournament.startTime, courtMatches[0].setIndex || 1).split('~')[0].trim()}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {courtMatches.map(m => renderIndividualMatch(m))}
                        {courtMatches.length === 0 && (
                          <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '14px 0' }}>배정된 대진이 없습니다.</div>
                        )}
                      </div>
                    </div>
                  );
                })}
                
                {(() => {
                  const unassignedMatches = matchesForRender.filter(m => !m.court);
                  if (unassignedMatches.length === 0) return null;
                  return (
                    <div style={{ border: '1px dashed var(--border)', borderRadius: '10px', padding: '14px', backgroundColor: '#f8fafc' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                        <h3 style={{ margin: 0, fontSize: '14px', color: 'var(--txt2)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          ❓ 코트 미정 대진 ({unassignedMatches.length}경기)
                        </h3>
                        {isAdmin && (
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <button 
                              className="btn btn-primary btn-sm" 
                              style={{ fontSize: '12px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                              onClick={autoAssignIndividualCourts}
                            >
                              🎲 코트 자동 배정 실행
                            </button>
                            <button 
                              className="btn btn-secondary btn-sm" 
                              style={{ fontSize: '12px', padding: '4px 10px', color: '#b91c1c', borderColor: '#fca5a5' }}
                              onClick={unassignIndividualCourts}
                            >
                              🧹 배정 해제
                            </button>
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {unassignedMatches.map(m => renderIndividualMatch(m))}
                      </div>
                    </div>
                  );
                })()}
              </>
            ) : (
              /* 라운드별 보기 모드 */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {availableRounds.map((r) => {
                  const roundMatches = matchesForRender
                    .filter(m => (m.round || 1) === r)
                    .sort((a, b) => (a.setIndex || a.round || 0) - (b.setIndex || b.round || 0));

                  const isOver = dragOverRound === r;
                  const isBeingDragged = draggingRound === r;

                  return (
                    <div
                      key={r}
                      draggable={isAdmin}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', String(r));
                        setDraggingRound(r);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                      }}
                      onDragEnter={() => setDragOverRound(r)}
                      onDragLeave={() => setDragOverRound(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        const fromR = parseInt(e.dataTransfer.getData('text/plain')) || draggingRound;
                        if (fromR && fromR !== r) {
                          handleReorderRounds(fromR, r);
                        }
                        setDraggingRound(null);
                        setDragOverRound(null);
                      }}
                      style={{
                        border: isOver ? '2px dashed #3b82f6' : '1px solid var(--border)',
                        borderRadius: '10px',
                        padding: '14px',
                        backgroundColor: isOver ? '#eff6ff' : isBeingDragged ? '#f1f5f9' : '#f8fafc',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '6px' }}>
                        <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800 }}>
                          {isAdmin && <span style={{ color: 'var(--txt3)', fontSize: '12px', cursor: 'grab' }}>☰</span>}
                          🔄 {r}라운드 대진 ({roundMatches.length}경기)
                        </h3>
                        <span style={{ fontSize: '11px', color: 'var(--txt3)' }}>
                          {isAdmin ? '드래그하여 라운드 순서 변경 가능' : ''}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {roundMatches.map(m => renderIndividualMatch(m))}
                        {roundMatches.length === 0 && (
                          <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '14px 0' }}>해당 라운드에 대진이 없습니다.</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
            <div style={{ backgroundColor: '#f8fafc', padding: '8px 12px', fontWeight: 'bold', fontSize: '14px', borderBottom: '1px solid var(--border)' }}>실시간 개인 순위</div>
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
                    <td>{idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : idx + 1}</td>
                    <td style={{ fontWeight: 'bold' }}>{p.name}</td>
                    <td style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{p.points}</td>
                    <td>{p.win}승 {p.draw}무 {p.loss}패</td>
                    <td>{p.diff > 0 ? '+' : ''}{p.diff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {type === 'fixed_pair' && (
          <div style={{ overflowX: 'auto', marginTop: '24px', border: '1px solid var(--border)', borderRadius: '8px' }}>
            <div style={{ backgroundColor: '#f8fafc', padding: '8px 12px', fontWeight: 'bold', fontSize: '14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>👫 페어별 실시간 순위</span>
              <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 'normal' }}>승리 3점 / 무승부 2점 / 패배 1점</span>
            </div>
            <table className="table" style={{ width: '100%', textAlign: 'center', minWidth: '400px', margin: 0 }}>
              <thead>
                <tr style={{ fontSize: '13px' }}>
                  <th>순위</th>
                  <th>페어명</th>
                  <th>선수 구성</th>
                  <th>승점</th>
                  <th>전적</th>
                  <th>세트득실</th>
                </tr>
              </thead>
              <tbody>
                {pairStats.map((p, idx) => (
                  <tr key={p.id} style={{ fontWeight: idx < 3 ? 'bold' : 'normal', backgroundColor: idx === 0 ? '#fef3c7' : idx === 1 ? '#f1f5f9' : idx === 2 ? '#ffedd5' : 'transparent', fontSize: '13px' }}>
                    <td>{idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : idx + 1}</td>
                    <td style={{ fontWeight: 'bold', color: '#166534' }}>{p.name}</td>
                    <td>{p.p1Name}, {p.p2Name}</td>
                    <td style={{ color: 'var(--blue)', fontWeight: 'bold' }}>{p.points}</td>
                    <td>{p.matchWin}승 {p.matchDraw}무 {p.matchLoss}패</td>
                    <td>{p.diff > 0 ? '+' : ''}{p.diff} ({p.setWin}득 {p.setLoss}실)</td>
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

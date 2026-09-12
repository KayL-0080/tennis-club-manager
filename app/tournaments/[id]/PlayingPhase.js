import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { TEAM_COLORS, generateTournamentSchedule } from './PickingPhase';
import { generateIndividualTournamentMatches, generateFixedPairTournamentMatches } from './DraftPhase';

// Helper to normalize lineups from object or array format into structured list
export const getNormalizedLineupList = (team) => {
  if (!team || !team.lineups) return [];
  if (Array.isArray(team.lineups)) {
    return team.lineups.map((lu, idx) => {
      const p1 = Array.isArray(lu) ? lu[0] : (lu?.player1 || lu?.p1 || null);
      const p2 = Array.isArray(lu) ? lu[1] : (lu?.player2 || lu?.p2 || null);
      return { gameNum: idx + 1, player1: p1, player2: p2 };
    });
  }
  return Object.keys(team.lineups)
    .sort((a, b) => Number(a) - Number(b))
    .map(g => {
      const lu = team.lineups[g];
      const p1 = Array.isArray(lu) ? lu[0] : (lu?.player1 || lu?.p1 || null);
      const p2 = Array.isArray(lu) ? lu[1] : (lu?.player2 || lu?.p2 || null);
      return { gameNum: Number(g), player1: p1, player2: p2 };
    });
};

// Helper to extract player1 and player2 for a given game number (1-based index)
export const getLineupForTeamGame = (team, gameIndex) => {
  if (!team || !team.lineups) return null;
  const list = getNormalizedLineupList(team);
  const found = list.find(item => item.gameNum === gameIndex);
  if (found) return { player1: found.player1 || null, player2: found.player2 || null };
  if (list.length > 0) {
    const wrappedIdx = (gameIndex - 1) % list.length;
    return { player1: list[wrappedIdx].player1 || null, player2: list[wrappedIdx].player2 || null };
  }
  return null;
};

// Helper to ensure team has valid lineups generated
export const ensureTeamLineups = (team, targetGamesCount = 4) => {
  const existingList = getNormalizedLineupList(team);
  if (existingList.length >= targetGamesCount) {
    return team;
  }
  const roster = team.players || [];
  if (roster.length < 2) return team;
  const playCounts = {};
  roster.forEach(pid => playCounts[pid] = 0);
  existingList.forEach(item => {
    if (item.player1) playCounts[item.player1] = (playCounts[item.player1] || 0) + 1;
    if (item.player2) playCounts[item.player2] = (playCounts[item.player2] || 0) + 1;
  });

  const generatedLineups = { ...(typeof team.lineups === 'object' && !Array.isArray(team.lineups) ? team.lineups : {}) };
  for (let g = 1; g <= targetGamesCount; g++) {
    if (generatedLineups[g] && (generatedLineups[g].player1 || generatedLineups[g].player2)) {
      continue;
    }
    const sorted = [...roster].sort((a, b) => {
      if (playCounts[a] !== playCounts[b]) return playCounts[a] - playCounts[b];
      return Math.random() - 0.5;
    });
    const p1 = sorted[0];
    const p2 = sorted[1] || sorted[0];
    generatedLineups[g] = { player1: p1, player2: p2 !== p1 ? p2 : (sorted.find(p => p !== p1) || p1) };
    if (generatedLineups[g]?.player1) playCounts[generatedLineups[g].player1] = (playCounts[generatedLineups[g].player1] || 0) + 1;
    if (generatedLineups[g]?.player2) playCounts[generatedLineups[g].player2] = (playCounts[generatedLineups[g].player2] || 0) + 1;
  }
  return { ...team, lineups: generatedLineups };
};

export default function PlayingPhase({ tournament, members, onUpdate, isAdmin }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

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
  const [showRostersSummary, setShowRostersSummary] = useState(false);
  const [activeOnlyMode, setActiveOnlyMode] = useState(false);
  const [collapsedCourts, setCollapsedCourts] = useState({});
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [showPlayerStatsModal, setShowPlayerStatsModal] = useState(false);
  const [playerStatsFilterTeam, setPlayerStatsFilterTeam] = useState('ALL');
  const [playerStatsFilterGames, setPlayerStatsFilterGames] = useState('ALL');
  const [playerStatsSort, setPlayerStatsSort] = useState('games_desc');
  const [playerStatsSearch, setPlayerStatsSearch] = useState('');
  const [assignModalData, setAssignModalData] = useState(null);
  const [modalP1, setModalP1] = useState(null);
  const [modalP2, setModalP2] = useState(null);

  const isCourtCollapsed = (courtId) => {
    if (collapsedCourts[courtId] !== undefined) {
      return collapsedCourts[courtId];
    }
    return activeOnlyMode;
  };

  const toggleCourtCollapse = (courtId) => {
    setCollapsedCourts(prev => ({
      ...prev,
      [courtId]: !isCourtCollapsed(courtId)
    }));
  };

  const setGlobalMode = (activeOnly) => {
    setActiveOnlyMode(activeOnly);
    setCollapsedCourts({});
  };

  // 실시간 Firestore 변경사항 동기화 (다른 기기에서 점수/대진/세트 변경 시 자동 반영)
  useEffect(() => {
    if (tournament.matches) {
      setLocalMatches(tournament.matches);
    }
    if (tournament.maxGames !== undefined) {
      setMaxGames(tournament.maxGames);
    }
    if (tournament.courtSets) {
      setCourtSets(tournament.courtSets);
    }
  }, [tournament.matches, tournament.maxGames, tournament.courtSets]);
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
    if (!start || !end) return 12;
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    let diff = (eH * 60 + eM) - (sH * 60 + sM);
    if (diff <= 0) diff += 24 * 60;
    return Math.max(12, Math.floor(diff / 30));
  }, [tournament.startTime, tournament.time, tournament.endTime]);

  const handleAddSet = (courtId, courtName, courtMaxGames) => {
    const current = courtSets[courtId] || 2;
    const limit = Math.max(courtMaxGames || 2, maxAllowedSets || 12, current + 1);
    if (current >= limit) {
      alert(`${courtName || '해당 코트'}는 최대 세트 수(${limit}세트)를 초과하여 세트를 추가할 수 없습니다.`);
      return;
    }
    const nextVal = current + 1;
    setCourtSets(prev => {
      const next = { ...prev, [courtId]: nextVal };
      if (isAdmin && onUpdate) {
        onUpdate({ courtSets: next });
      }
      return next;
    });
  };

  const handleRemoveSet = (courtId) => {
    const current = courtSets[courtId] || 2;
    if (current <= 1) {
      alert('최소 1개 이상의 세트가 필요합니다.');
      return;
    }
    const nextVal = current - 1;
    setCourtSets(prev => {
      const next = { ...prev, [courtId]: nextVal };
      if (isAdmin && onUpdate) {
        onUpdate({ courtSets: next });
      }
      return next;
    });
  };

  const handleCourtSetsChange = (courtId, val, courtName, courtMaxGames) => {
    const limit = Math.max(courtMaxGames || 2, maxAllowedSets || 12, val);
    if (val > limit) {
      alert(`${courtName || '해당 코트'}는 최대 세트 수(${limit}세트)를 초과할 수 없습니다.`);
      setCourtSets(prev => {
        const next = { ...prev, [courtId]: limit };
        if (isAdmin && onUpdate) {
          onUpdate({ courtSets: next });
        }
        return next;
      });
      return;
    }
    const nextVal = Math.max(1, val);
    setCourtSets(prev => {
      const next = { ...prev, [courtId]: nextVal };
      if (isAdmin && onUpdate) {
        onUpdate({ courtSets: next });
      }
      return next;
    });
  };

  const handleMaxGamesChange = (newMax) => {
    setMaxGames(newMax);
    const updatedMatches = localMatches.map(m => {
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
    });
    setLocalMatches(updatedMatches);
    if (isAdmin && onUpdate) {
      onUpdate({ matches: updatedMatches, maxGames: newMax, courtSets });
    }
  };

  const updateMatchScore = (matchIdx, field, val) => {
    const newMatches = [...localMatches];
    let scoreVal = val !== '' ? parseInt(val) : null;
    if (scoreVal !== null) {
      scoreVal = Math.max(0, Math.min(maxGames, scoreVal));
    }
    newMatches[matchIdx] = { ...newMatches[matchIdx], [field]: scoreVal };
    setLocalMatches(newMatches);
    if (isAdmin && onUpdate) {
      onUpdate({ matches: newMatches, maxGames, courtSets });
    }
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
      let newMatches;
      if (idx !== -1) {
        newMatches = [...prev];
        const updatedSlot = { ...newMatches[idx], [field]: parsedVal };
        if (field === 'teamAId') {
          const newTeam = teamMap[parsedVal];
          const preset = newTeam?.lineups?.[setIdx - 1];
          updatedSlot.playerA1 = preset?.[0] || null;
          updatedSlot.playerA2 = preset?.[1] || null;
        } else if (field === 'teamBId') {
          const newTeam = teamMap[parsedVal];
          const preset = newTeam?.lineups?.[setIdx - 1];
          updatedSlot.playerB1 = preset?.[0] || null;
          updatedSlot.playerB2 = preset?.[1] || null;
        }
        newMatches[idx] = updatedSlot;
      } else {
        let pA1 = null, pA2 = null, pB1 = null, pB2 = null;
        if (field === 'teamAId' && parsedVal) {
          const newTeam = teamMap[parsedVal];
          const preset = newTeam?.lineups?.[setIdx - 1];
          pA1 = preset?.[0] || null;
          pA2 = preset?.[1] || null;
        } else if (field === 'teamBId' && parsedVal) {
          const newTeam = teamMap[parsedVal];
          const preset = newTeam?.lineups?.[setIdx - 1];
          pB1 = preset?.[0] || null;
          pB2 = preset?.[1] || null;
        }
        const newSlot = {
          id: `court-${courtId}-set-${setIdx}`,
          court: courtName,
          courtId: courtId,
          setIndex: setIdx,
          teamAId: field === 'teamAId' ? parsedVal : '',
          teamBId: field === 'teamBId' ? parsedVal : '',
          playerA1: pA1,
          playerA2: pA2,
          playerB1: pB1,
          playerB2: pB2,
          scoreA: null,
          scoreB: null,
          [field]: parsedVal
        };
        newMatches = [...prev, newSlot];
      }
      if (isAdmin && onUpdate) {
        onUpdate({ matches: newMatches, maxGames, courtSets });
      }
      return newMatches;
    });
  };

  const openPlayerAssignModal = (courtId, courtNum, setIdx, teamSide, teamId, p1, p2) => {
    if (!teamId) {
      alert('먼저 조(팀)을 선택해 주세요.');
      return;
    }
    setAssignModalData({
      courtId,
      courtNum,
      setIdx,
      teamSide,
      teamId,
      player1: p1 || null,
      player2: p2 || null
    });
    setModalP1(p1 || null);
    setModalP2(p2 || null);
  };

  const handleUpdateTeamPlayers = (courtId, courtName, setIdx, teamSide, p1, p2) => {
    const p1Field = teamSide === 'A' ? 'playerA1' : 'playerB1';
    const p2Field = teamSide === 'A' ? 'playerA2' : 'playerB2';

    setLocalMatches(prev => {
      const idx = prev.findIndex(m => (m.courtId === courtId || m.court === courtName) && m.setIndex === setIdx);
      let newMatches;
      if (idx !== -1) {
        newMatches = [...prev];
        newMatches[idx] = { 
          ...newMatches[idx], 
          [p1Field]: p1 || null, 
          [p2Field]: p2 || null 
        };
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
          [p1Field]: p1 || null,
          [p2Field]: p2 || null
        };
        newMatches = [...prev, newSlot];
      }
      if (isAdmin && onUpdate) {
        onUpdate({ matches: newMatches, maxGames, courtSets });
      }
      return newMatches;
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

      if (isAdmin && onUpdate) {
        onUpdate({ matches: newMatches, maxGames, courtSets });
      }
      return newMatches;
    });
  };

  const updateMatchCourt = (matchIdx, val) => {
    const newMatches = [...localMatches];
    newMatches[matchIdx].court = val;
    setLocalMatches(newMatches);
    if (isAdmin && onUpdate) {
      onUpdate({ matches: newMatches, maxGames, courtSets });
    }
  };

  const updateIndividualMatchPlayer = (matchIdx, field, newPlayerId) => {
    if (!isAdmin) return;
    if (newPlayerId) {
      const currentMatch = localMatches[matchIdx];
      if (currentMatch) {
        // 1. 동일 경기(매치) 내 중복 체크
        const otherSlots = {
          playerA1: ['playerA2', 'playerB1', 'playerB2'],
          playerA2: ['playerA1', 'playerB1', 'playerB2'],
          playerB1: ['playerB2', 'playerA1', 'playerA2'],
          playerB2: ['playerB1', 'playerA1', 'playerA2']
        }[field] || [];
        for (const slotKey of otherSlots) {
          if (currentMatch[slotKey] === newPlayerId) {
            const playerName = byId[newPlayerId]?.name || '선수';
            alert(`[${playerName}] 선수는 현재 경기(매치)에 이미 배정되어 있습니다.`);
            return;
          }
        }

        // 2. 코트 배정 상태에서 동일 시간대(경기/세트) 타 코트 중복 출전 체크
        const slot = currentMatch.setIndex || currentMatch.round;
        if (slot && currentMatch.court) {
          const otherMatchesInSameSlot = localMatches.filter((m, idx) => 
            idx !== matchIdx && 
            m.court && 
            (m.setIndex === slot || (!m.setIndex && m.round === slot))
          );
          for (const om of otherMatchesInSameSlot) {
            const activePlayers = [om.playerA1, om.playerA2, om.playerB1, om.playerB2].filter(Boolean);
            if (activePlayers.includes(newPlayerId)) {
              const playerName = byId[newPlayerId]?.name || '선수';
              const courtName = om.court || '다른 코트';
              alert(`[${playerName}] 선수는 동일 시간대(${slot}경기, ${courtName})에 이미 출전 중입니다.\n동시간대 중복 출전은 불가합니다.`);
              return;
            }
          }
        }
      }
    }
    const newMatches = [...localMatches];
    newMatches[matchIdx] = {
      ...newMatches[matchIdx],
      [field]: newPlayerId || null
    };
    setLocalMatches(newMatches);
    if (isAdmin && onUpdate) {
      onUpdate({ matches: newMatches, maxGames, courtSets });
    }
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
    if (onUpdate) {
      onUpdate({ matches: newMatches, maxGames, courtSets });
    }
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
    const courtMatchCount = {};
    courtsList.forEach(c => courtMatchCount[c.id || c.name] = 0);

    newMatches.forEach((m) => {
      const matchPlayers = [m.playerA1, m.playerA2, m.playerB1, m.playerB2].filter(Boolean);
      let targetSlot = m.round || 1;
      let assignedCourt = null;

      while (!assignedCourt && targetSlot < 100) {
        const hasPlayerConflict = matchPlayers.some(pId => playerOccupied[targetSlot] && playerOccupied[targetSlot].has(pId));
        if (!hasPlayerConflict) {
          const sortedCourts = [...courtsList].sort((a, b) => {
            const countA = courtMatchCount[a.id || a.name] || 0;
            const countB = courtMatchCount[b.id || b.name] || 0;
            return countA - countB;
          });

          for (const court of sortedCourts) {
            const courtId = court.id || 'c-1';
            const maxCourtGames = courtSets?.[courtId] !== undefined ? courtSets[courtId] : (court.games || 4);
            if (!courtOccupied[targetSlot]?.[court.name] && targetSlot <= maxCourtGames) {
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

        courtMatchCount[assignedCourt.id || assignedCourt.name] = (courtMatchCount[assignedCourt.id || assignedCourt.name] || 0) + 1;

        if (!playerOccupied[targetSlot]) playerOccupied[targetSlot] = new Set();
        matchPlayers.forEach(pId => playerOccupied[targetSlot].add(pId));
      }
    });

    setLocalMatches(newMatches);
    if (onUpdate) {
      onUpdate({ matches: newMatches, maxGames, courtSets });
    }
  };

  const conflictMap = useMemo(() => {
    const slotMap = {};
    const matchConflicts = {};
    const conflictDetails = [];

    const courtsList = tournament.courtDetails || [
      { id: 'c1', name: '1코트', games: 2 },
      { id: 'c2', name: '2코트', games: 2 }
    ];

    localMatches.forEach((m, mIdx) => {
      const courtName = m.court || (m.courtId ? courtsList.find(c => c.id === m.courtId)?.name : '') || '';
      const slot = m.setIndex || m.round || 1;

      const players = [m.playerA1, m.playerA2, m.playerB1, m.playerB2].filter(Boolean);

      // 1. Check duplicate within the same single match
      const countInMatch = {};
      players.forEach(pId => {
        countInMatch[pId] = (countInMatch[pId] || 0) + 1;
      });
      Object.keys(countInMatch).forEach(pId => {
        if (countInMatch[pId] > 1) {
          const pName = byId[pId]?.name || '선수';
          const timeStr = formatMatchTimeSlot(tournament.startTime, parseInt(slot));
          conflictDetails.push({
            type: 'same_match',
            playerId: pId,
            playerName: pName,
            slot,
            timeStr,
            courts: [courtName || '미정 코트'],
            description: `[${pName}] 선수가 동일 경기(${courtName || '미정 코트'} ${slot}세트/경기) 내 2개 이상의 출전 자리에 중복 배정되었습니다.`
          });
          if (!matchConflicts[m.id]) matchConflicts[m.id] = {};
          matchConflicts[m.id][pId] = [courtName || '미정 코트'];
        }
      });

      // 2. Map for cross-court duplicates at the same time slot
      if (courtName) {
        if (!slotMap[slot]) slotMap[slot] = {};
        players.forEach(pId => {
          if (!slotMap[slot][pId]) slotMap[slot][pId] = [];
          slotMap[slot][pId].push({
            matchId: m.id,
            matchIdx: mIdx,
            court: courtName,
            setIndex: m.setIndex,
            round: m.round || 1,
            teamAId: m.teamAId,
            teamBId: m.teamBId,
            pairAName: m.pairAName,
            pairBName: m.pairBName
          });
        });
      }
    });

    // Evaluate duplicates across different courts in the same time slot
    Object.keys(slotMap).forEach(slot => {
      const playersInSlot = slotMap[slot];
      Object.keys(playersInSlot).forEach(pId => {
        const occurrences = playersInSlot[pId];
        if (occurrences.length > 1) {
          const courts = occurrences.map(o => o.court).filter(Boolean);
          const uniqueCourts = Array.from(new Set(courts));
          const pName = byId[pId]?.name || '선수';
          const timeStr = formatMatchTimeSlot(tournament.startTime, parseInt(slot));

          const matchDescriptions = occurrences.map(o => {
            if (type === 'team') {
              const tA = teamMap[o.teamAId]?.name || 'A조';
              const tB = teamMap[o.teamBId]?.name || 'B조';
              return `${o.court} (${tA} vs ${tB})`;
            } else if (type === 'fixed_pair') {
              return `${o.court} (${o.pairAName || 'A페어'} vs ${o.pairBName || 'B페어'})`;
            }
            return `${o.court}`;
          }).join(' 및 ');

          conflictDetails.push({
            type: 'cross_court',
            playerId: pId,
            playerName: pName,
            slot,
            timeStr,
            courts: uniqueCourts,
            description: `[${pName}] 선수가 동일 시간대(${timeStr} / ${slot}경기)에 [${matchDescriptions}]에 중복 출전 중입니다.`
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
  }, [localMatches, type, tournament.startTime, tournament.courtDetails, byId, teamMap]);

  // 📊 각 선수별 현재 배정된 총 경기수 집계
  const playerMatchCounts = useMemo(() => {
    const counts = {};
    localMatches.forEach(m => {
      [m.playerA1, m.playerA2, m.playerB1, m.playerB2].filter(Boolean).forEach(pid => {
        counts[pid] = (counts[pid] || 0) + 1;
      });
    });
    return counts;
  }, [localMatches]);

  // 📊 각 선수별 게임수 및 출전 상세 집계
  const playerGameStatsData = useMemo(() => {
    const participantsMap = new Map();

    if (type === 'team' && teams && teams.length > 0) {
      teams.forEach((t, tIdx) => {
        (t.players || []).forEach(pid => {
          const mbr = byId[pid] || { name: '선수' };
          participantsMap.set(pid, {
            id: pid,
            name: mbr.name || '선수',
            ntrp: mbr.ntrp || '-',
            gender: mbr.gender || '',
            teamId: t.id,
            teamName: t.name,
            teamIdx: tIdx,
            isLeader: t.leaderId === pid || t.captain === pid
          });
        });
      });
    } else if (type === 'fixed_pair' && tournament.pairs && tournament.pairs.length > 0) {
      tournament.pairs.forEach(pair => {
        [pair.player1, pair.player2].filter(Boolean).forEach(pid => {
          const mbr = byId[pid] || { name: '선수' };
          participantsMap.set(pid, {
            id: pid,
            name: mbr.name || '선수',
            ntrp: mbr.ntrp || '-',
            gender: mbr.gender || '',
            pairId: pair.id,
            pairName: pair.name || '페어'
          });
        });
      });
    } else if (tournament.attendees && tournament.attendees.length > 0) {
      tournament.attendees.forEach(pid => {
        const mbr = byId[pid] || { name: '선수' };
        participantsMap.set(pid, {
          id: pid,
          name: mbr.name || '선수',
          ntrp: mbr.ntrp || '-',
          gender: mbr.gender || ''
        });
      });
    }

    localMatches.forEach(m => {
      [m.playerA1, m.playerA2, m.playerB1, m.playerB2].filter(Boolean).forEach(pid => {
        if (!participantsMap.has(pid)) {
          const mbr = byId[pid] || { name: '선수' };
          participantsMap.set(pid, {
            id: pid,
            name: mbr.name || '선수',
            ntrp: mbr.ntrp || '-',
            gender: mbr.gender || ''
          });
        }
      });
    });

    const courtsList = tournament.courtDetails || [
      { id: 'c1', name: '1코트', games: 2 },
      { id: 'c2', name: '2코트', games: 2 }
    ];

    const playerStatsList = Array.from(participantsMap.values()).map(p => {
      const pid = p.id;
      const assignedMatches = [];
      let completedCount = 0;
      let pendingCount = 0;
      let wins = 0;
      let draws = 0;
      let losses = 0;
      let pointsScored = 0;
      let pointsAllowed = 0;

      localMatches.forEach(m => {
        const isA1 = m.playerA1 === pid;
        const isA2 = m.playerA2 === pid;
        const isB1 = m.playerB1 === pid;
        const isB2 = m.playerB2 === pid;
        const isPlaying = isA1 || isA2 || isB1 || isB2;

        if (isPlaying) {
          const courtName = m.court || (m.courtId ? courtsList.find(c => c.id === m.courtId)?.name : '') || '코트';
          const setIndex = m.setIndex || m.round || 1;
          const isSideA = isA1 || isA2;
          const partnerId = isSideA ? (isA1 ? m.playerA2 : m.playerA1) : (isB1 ? m.playerB2 : m.playerB1);
          const opp1Id = isSideA ? m.playerB1 : m.playerA1;
          const opp2Id = isSideA ? m.playerB2 : m.playerA2;
          const myTeamId = isSideA ? m.teamAId : m.teamBId;
          const oppTeamId = isSideA ? m.teamBId : m.teamAId;

          const isFinished = m.scoreA !== null && m.scoreB !== null;
          const myScore = isFinished ? (isSideA ? m.scoreA : m.scoreB) : null;
          const oppScore = isFinished ? (isSideA ? m.scoreB : m.scoreA) : null;

          let result = null;
          if (isFinished) {
            completedCount++;
            pointsScored += myScore;
            pointsAllowed += oppScore;
            if (myScore > oppScore) {
              wins++;
              result = 'win';
            } else if (myScore < oppScore) {
              losses++;
              result = 'loss';
            } else {
              draws++;
              result = 'draw';
            }
          } else {
            pendingCount++;
          }

          assignedMatches.push({
            id: m.id || `${courtName}-${setIndex}`,
            courtName,
            setIndex,
            isFinished,
            myScore,
            oppScore,
            result,
            partnerName: byId[partnerId]?.name || (partnerId ? '파트너' : '미정'),
            opp1Name: byId[opp1Id]?.name || (opp1Id ? '상대1' : '미정'),
            opp2Name: byId[opp2Id]?.name || (opp2Id ? '상대2' : '미정'),
            myTeamName: teamMap[myTeamId]?.name || '',
            oppTeamName: teamMap[oppTeamId]?.name || ''
          });
        }
      });

      assignedMatches.sort((a, b) => a.setIndex - b.setIndex);

      const totalGames = assignedMatches.length;
      const winRate = completedCount > 0 ? Math.round((wins / completedCount) * 100) : 0;
      const gameDiff = pointsScored - pointsAllowed;

      return {
        ...p,
        totalGames,
        completedCount,
        pendingCount,
        wins,
        draws,
        losses,
        winRate,
        pointsScored,
        pointsAllowed,
        gameDiff,
        matches: assignedMatches
      };
    });

    const totalPlayers = playerStatsList.length;
    const totalMatchSlots = localMatches.reduce((acc, m) => {
      return acc + [m.playerA1, m.playerA2, m.playerB1, m.playerB2].filter(Boolean).length;
    }, 0);
    const avgGames = totalPlayers > 0 ? (totalMatchSlots / totalPlayers).toFixed(1) : '0';
    const counts = playerStatsList.map(p => p.totalGames);
    const minGames = counts.length > 0 ? Math.min(...counts) : 0;
    const maxGames = counts.length > 0 ? Math.max(...counts) : 0;
    const unassignedPlayers = playerStatsList.filter(p => p.totalGames === 0);

    return {
      playerStatsList,
      totalPlayers,
      totalMatchSlots,
      avgGames,
      minGames,
      maxGames,
      unassignedPlayers
    };
  }, [type, teams, tournament.pairs, tournament.attendees, localMatches, byId, teamMap, tournament.courtDetails]);

  // 필터링 및 정렬된 선수별 통계
  const filteredAndSortedPlayers = useMemo(() => {
    let list = [...(playerGameStatsData?.playerStatsList || [])];

    if (playerStatsFilterTeam !== 'ALL') {
      list = list.filter(p => p.teamId === playerStatsFilterTeam);
    }

    if (playerStatsFilterGames === '0') {
      list = list.filter(p => p.totalGames === 0);
    } else if (playerStatsFilterGames === '1') {
      list = list.filter(p => p.totalGames === 1);
    } else if (playerStatsFilterGames === '2') {
      list = list.filter(p => p.totalGames === 2);
    } else if (playerStatsFilterGames === '3+') {
      list = list.filter(p => p.totalGames >= 3);
    }

    if (playerStatsSearch.trim()) {
      const q = playerStatsSearch.trim().toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      if (playerStatsSort === 'games_desc') {
        if (b.totalGames !== a.totalGames) return b.totalGames - a.totalGames;
        return (a.name || '').localeCompare(b.name || '');
      } else if (playerStatsSort === 'games_asc') {
        if (a.totalGames !== b.totalGames) return a.totalGames - b.totalGames;
        return (a.name || '').localeCompare(b.name || '');
      } else if (playerStatsSort === 'name_asc') {
        return (a.name || '').localeCompare(b.name || '');
      } else if (playerStatsSort === 'ntrp_desc') {
        const nA = parseFloat(a.ntrp) || 0;
        const nB = parseFloat(b.ntrp) || 0;
        if (nB !== nA) return nB - nA;
        return (a.name || '').localeCompare(b.name || '');
      } else if (playerStatsSort === 'winrate_desc') {
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        if (b.wins !== a.wins) return b.wins - a.wins;
        return (a.name || '').localeCompare(b.name || '');
      }
      return 0;
    });

    return list;
  }, [playerGameStatsData, playerStatsFilterTeam, playerStatsFilterGames, playerStatsSearch, playerStatsSort]);

  const handleRegenerateSchedule = async () => {
    if (!isAdmin) return;

    const hasScores = localMatches.some(m => m.scoreA !== null || m.scoreB !== null);
    if (hasScores) {
      if (!confirm('⚠️ 이미 입력된 경기 점수가 있습니다.\n대진표를 새로 작성하면 기존에 입력된 점수가 초기화될 수 있습니다.\n\n동일 시간대 중복 없는 새 대진표로 다시 작성하시겠습니까?')) {
        return;
      }
    } else {
      if (!confirm('동일 시간대에 선수가 겹치지 않도록 대진표를 새로 작성하시겠습니까?')) {
        return;
      }
    }

    const courtsList = tournament.courtDetails || [
      { id: 'c1', name: '1코트', games: 2 },
      { id: 'c2', name: '2코트', games: 2 }
    ];
    const gamesCount = tournament.gamesPerTeam || (type === 'team' ? 3 : 4);

    try {
      if (type === 'team') {
        const teamList = teams || [];
        if (teamList.length < 2) {
          alert('팀이 최소 2개 이상이어야 대진표를 생성할 수 있습니다.');
          return;
        }

        // Clean and regenerate well-balanced lineups for all teams to strictly prevent duplicates
        const updatedTeams = teamList.map(t => {
          const roster = t.players || [];
          if (roster.length < 2) return t;
          const lineups = {};
          const playCounts = {};
          roster.forEach(pid => playCounts[pid] = 0);

          for (let g = 1; g <= gamesCount; g++) {
            const sorted = [...roster].sort((a, b) => {
              if (playCounts[a] !== playCounts[b]) return playCounts[a] - playCounts[b];
              return Math.random() - 0.5;
            });
            const p1 = sorted[0];
            const p2 = sorted[1] || sorted[0];
            lineups[g] = { player1: p1, player2: p2 !== p1 ? p2 : (sorted.find(p => p !== p1) || p1) };
            if (lineups[g]?.player1) playCounts[lineups[g].player1] = (playCounts[lineups[g].player1] || 0) + 1;
            if (lineups[g]?.player2) playCounts[lineups[g].player2] = (playCounts[lineups[g].player2] || 0) + 1;
          }
          return { ...t, lineups };
        });

        const N = updatedTeams.length;
        const numCourts = courtsList.length || 1;
        const targetMatchesPerTeam = gamesCount || (N <= 3 ? Math.max(1, N - 1) : 3);
        const totalMatchesCount = Math.ceil((N * targetMatchesPerTeam) / 2);
        const calculatedSetsPerCourt = Math.max(1, Math.ceil(totalMatchesCount / numCourts));

        const newCourtSets = {};
        courtsList.forEach((court, cIdx) => {
          const cId = court.id || `c-${cIdx+1}`;
          newCourtSets[cId] = court.games !== undefined ? court.games : calculatedSetsPerCourt;
        });

        const newMatches = generateTournamentSchedule(updatedTeams, courtsList, gamesCount, newCourtSets);
        setCourtSets(newCourtSets);
        setLocalMatches(newMatches);
        if (onUpdate) {
          await onUpdate({ teams: updatedTeams, matches: newMatches, maxGames, courtSets: newCourtSets });
        }
      } else if (type === 'fixed_pair') {
        const pairsList = tournament.pairs || [];
        if (pairsList.length < 2) {
          alert('페어가 최소 2개 이상이어야 대진표를 생성할 수 있습니다.');
          return;
        }
        const newMatches = generateFixedPairTournamentMatches(pairsList, byId, gamesCount, courtsList);
        setLocalMatches(newMatches);
        if (onUpdate) {
          await onUpdate({ matches: newMatches, maxGames, courtSets });
        }
      } else {
        // Individual rotation
        const attMembers = tournament.attendees || [];
        if (attMembers.length < 4) {
          alert('참가자가 최소 4명 이상이어야 대진표를 생성할 수 있습니다.');
          return;
        }
        const newMatches = generateIndividualTournamentMatches(attMembers, byId, gamesCount, courtsList);
        setLocalMatches(newMatches);
        if (onUpdate) {
          await onUpdate({ matches: newMatches, maxGames, courtSets });
        }
      }

      setShowDuplicateModal(false);
      alert('✅ 대진표가 동일 시간대 중복 없이 새로 작성되었습니다.');
    } catch (err) {
      console.error('Error regenerating schedule:', err);
      alert('대진표 재생성 중 오류가 발생했습니다: ' + err.message);
    }
  };

  // 1. 단일 조(팀) 사전 라인업 대진 자동 작성
  const handleApplyTeamPresetLineups = async (teamId) => {
    if (!isAdmin) return;
    const targetTeam = teamMap[teamId];
    if (!targetTeam) {
      alert('해당 조를 찾을 수 없습니다.');
      return;
    }

    const gamesCount = tournament.gamesPerTeam || (tournament.maxGames || 4);
    const readyTeam = ensureTeamLineups(targetTeam, gamesCount);
    
    // Find all matches in localMatches containing this team
    const teamMatchesIndices = [];
    localMatches.forEach((m, idx) => {
      if (m.teamAId === teamId || m.teamBId === teamId) {
        teamMatchesIndices.push({ idx, match: m, setIndex: m.setIndex || 1, courtId: m.courtId || m.court || '' });
      }
    });

    if (teamMatchesIndices.length === 0) {
      alert(`대진표에 [${targetTeam.name}]이(가) 배정된 코트/세트가 없습니다.\n먼저 코트 대진표에서 ${targetTeam.name}을(를) 조에 배정해 주세요.`);
      return;
    }

    // Sort chronologically by setIndex ascending, then court
    teamMatchesIndices.sort((a, b) => {
      if (a.setIndex !== b.setIndex) return a.setIndex - b.setIndex;
      return (a.courtId || '').localeCompare(b.courtId || '');
    });

    const newMatches = [...localMatches];
    let appliedCount = 0;

    teamMatchesIndices.forEach((item, matchIdx) => {
      const gameNum = matchIdx + 1;
      const lu = getLineupForTeamGame(readyTeam, gameNum);
      if (lu && (lu.player1 || lu.player2)) {
        const m = { ...newMatches[item.idx] };
        if (m.teamAId === teamId) {
          m.playerA1 = lu.player1 || null;
          m.playerA2 = lu.player2 || null;
        }
        if (m.teamBId === teamId) {
          m.playerB1 = lu.player1 || null;
          m.playerB2 = lu.player2 || null;
        }
        newMatches[item.idx] = m;
        appliedCount++;
      }
    });

    const updatedTeams = (teams || []).map(t => t.id === teamId ? readyTeam : t);

    setLocalMatches(newMatches);
    if (onUpdate) {
      await onUpdate({ matches: newMatches, teams: updatedTeams, maxGames, courtSets });
    }

    alert(`✅ [${targetTeam.name}]의 3단계 사전 배정 라인업(${appliedCount}경기)이 대진표에 자동으로 입력되었습니다.`);
  };

  // 2. 전체 조 사전 라인업 대진 일괄 자동 작성
  const handleApplyAllTeamsPresetLineups = async () => {
    if (!isAdmin) return;
    if (!teams || teams.length === 0) {
      alert('팀(조) 목록이 없습니다.');
      return;
    }

    if (!confirm('모든 조의 3단계 사전 배정 라인업을 대진표 전체에 순서대로 자동 적용하시겠습니까?\n(기존에 수동 입력된 선수 배정은 사전 라인업으로 갱신됩니다.)')) {
      return;
    }

    const gamesCount = tournament.gamesPerTeam || (tournament.maxGames || 4);
    const updatedTeams = teams.map(t => ensureTeamLineups(t, gamesCount));
    const readyTeamMap = {};
    updatedTeams.forEach(t => readyTeamMap[t.id] = t);

    let newMatches = [...localMatches];
    let totalApplied = 0;

    updatedTeams.forEach(t => {
      const teamMatchesIndices = [];
      newMatches.forEach((m, idx) => {
        if (m.teamAId === t.id || m.teamBId === t.id) {
          teamMatchesIndices.push({ idx, match: m, setIndex: m.setIndex || 1, courtId: m.courtId || m.court || '' });
        }
      });

      teamMatchesIndices.sort((a, b) => {
        if (a.setIndex !== b.setIndex) return a.setIndex - b.setIndex;
        return (a.courtId || '').localeCompare(b.courtId || '');
      });

      teamMatchesIndices.forEach((item, matchIdx) => {
        const gameNum = matchIdx + 1;
        const lu = getLineupForTeamGame(t, gameNum);
        if (lu && (lu.player1 || lu.player2)) {
          const m = { ...newMatches[item.idx] };
          if (m.teamAId === t.id) {
            m.playerA1 = lu.player1 || null;
            m.playerA2 = lu.player2 || null;
          }
          if (m.teamBId === t.id) {
            m.playerB1 = lu.player1 || null;
            m.playerB2 = lu.player2 || null;
          }
          newMatches[item.idx] = m;
          totalApplied++;
        }
      });
    });

    setLocalMatches(newMatches);
    if (onUpdate) {
      await onUpdate({ matches: newMatches, teams: updatedTeams, maxGames, courtSets });
    }

    alert(`✅ 모든 조(${updatedTeams.length}개 조, 총 ${totalApplied}경기 슬롯)의 사전 배정 라인업이 대진표에 자동으로 입력되었습니다.`);
  };

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
    if (isAdmin && onUpdate) {
      onUpdate({ matches: newMatches, maxGames, courtSets });
    }
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
    if (!isAdmin) return;
    if (val) {
      const match = localMatches[matchIdx];
      const setObj = match?.sets?.[setIdx];
      if (setObj) {
        const otherSlots = {
          playerA1: ['playerA2', 'playerB1', 'playerB2'],
          playerA2: ['playerA1', 'playerB1', 'playerB2'],
          playerB1: ['playerB2', 'playerA1', 'playerA2'],
          playerB2: ['playerB1', 'playerA1', 'playerA2']
        }[field] || [];
        for (const slotKey of otherSlots) {
          if (setObj[slotKey] === val) {
            const pName = byId[val]?.name || '선수';
            alert(`[${pName}] 선수는 현재 세트(${setIdx + 1}세트)에 이미 배정되어 있습니다.`);
            return;
          }
        }
      }
    }
    const newMatches = [...localMatches];
    newMatches[matchIdx].sets[setIdx][field] = val !== '' ? val : null;
    setLocalMatches(newMatches);
    if (isAdmin && onUpdate) {
      onUpdate({ matches: newMatches, maxGames, courtSets });
    }
  };

  const updateTeamSetScore = (matchIdx, setIdx, field, val) => {
    const newMatches = [...localMatches];
    let scoreVal = val !== '' ? parseInt(val) : null;
    if (scoreVal !== null) {
      scoreVal = Math.max(0, Math.min(maxGames, scoreVal));
    }
    newMatches[matchIdx].sets[setIdx][field] = scoreVal;
    setLocalMatches(newMatches);
    if (isAdmin && onUpdate) {
      onUpdate({ matches: newMatches, maxGames, courtSets });
    }
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, color: 'var(--navy)', fontSize: '18px' }}>
            4단계. 실시간 순위 및 {isAdmin ? '점수 입력' : '경기 현황'}
          </h2>
          <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '2px 8px' }}>
            ⚡ 실시간 동기화 ON
          </span>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button 
            className="btn btn-secondary btn-sm"
            style={{ 
              background: conflictMap.hasConflict ? '#fef2f2' : '#f0fdf4', 
              color: conflictMap.hasConflict ? '#b91c1c' : '#166534', 
              borderColor: conflictMap.hasConflict ? '#fca5a5' : '#86efac', 
              fontWeight: 'bold',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
            onClick={() => setShowDuplicateModal(true)}
            title="동일 시간대 중복 출전 선수를 점검합니다."
          >
            <span>{conflictMap.hasConflict ? '⚠️' : '🔍'}</span>
            <span>중복 체크</span>
            {conflictMap.hasConflict && (
              <span style={{ backgroundColor: '#ef4444', color: '#fff', fontSize: '10px', padding: '1px 5px', borderRadius: '10px' }}>
                {conflictMap.conflictDetails.length}건
              </span>
            )}
          </button>

          {isAdmin && (
            <button
              className="btn btn-secondary btn-sm"
              style={{ background: '#eef2ff', color: '#3730a3', borderColor: '#c7d2fe', fontWeight: 'bold' }}
              onClick={handleRegenerateSchedule}
              title="동일 시간대 중복 없는 새 대진표로 다시 작성합니다."
            >
              🔄 대진 새로 작성
            </button>
          )}

          {isAdmin && type !== 'team' && (
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
        </div>
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
                  <strong style={{ color: '#4338ca' }}>⏱️ 2. 타이브레이크 룰:</strong>
                  <div style={{ whiteSpace: 'pre-line', marginTop: '3px', color: 'var(--txt)', paddingLeft: '8px', lineHeight: '1.5' }}>
                    {tournament.matchRules.tiebreak}
                  </div>
                </div>
              )}
              {tournament.matchRules.noAd && (
                <div>
                  <strong style={{ color: '#4338ca' }}>⚡ 3. No-Ad (노애드) 룰:</strong>
                  <div style={{ whiteSpace: 'pre-line', marginTop: '3px', color: 'var(--txt)', paddingLeft: '8px', lineHeight: '1.5' }}>
                    {tournament.matchRules.noAd}
                  </div>
                </div>
              )}
              {tournament.matchRules.custom && (
                <div>
                  <strong style={{ color: '#4338ca' }}>📌 4. 기타 로컬 룰:</strong>
                  <div style={{ whiteSpace: 'pre-line', marginTop: '3px', color: 'var(--txt)', paddingLeft: '8px', lineHeight: '1.5' }}>
                    {tournament.matchRules.custom}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 👁️ 대진표 보기 모드 컨트롤러 & 📊 선수별 게임수 현황 버튼 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: '8px', 
        padding: '10px 14px', 
        backgroundColor: '#f8fafc', 
        borderRadius: '10px', 
        border: '1px solid var(--border)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        marginBottom: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--navy)' }}>
            👁️ 대진표 보기:
          </span>
          <div style={{ display: 'flex', backgroundColor: '#e2e8f0', borderRadius: '8px', padding: '2px', gap: '2px' }}>
            <button
              type="button"
              style={{
                border: 'none',
                padding: '4px 12px',
                fontSize: '12px',
                fontWeight: !activeOnlyMode ? 'bold' : 'normal',
                backgroundColor: !activeOnlyMode ? '#fff' : 'transparent',
                color: !activeOnlyMode ? 'var(--navy)' : 'var(--txt3)',
                borderRadius: '6px',
                cursor: 'pointer',
                boxShadow: !activeOnlyMode ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
              onClick={() => setGlobalMode(false)}
            >
              📋 전체 대진 펼치기
            </button>
            <button
              type="button"
              style={{
                border: 'none',
                padding: '4px 12px',
                fontSize: '12px',
                fontWeight: activeOnlyMode ? 'bold' : 'normal',
                backgroundColor: activeOnlyMode ? '#2563eb' : 'transparent',
                color: activeOnlyMode ? '#fff' : 'var(--txt3)',
                borderRadius: '6px',
                cursor: 'pointer',
                boxShadow: activeOnlyMode ? '0 1px 3px rgba(37,99,235,0.3)' : 'none'
              }}
              onClick={() => setGlobalMode(true)}
            >
              ⚡ 진행중 경기만 모아보기
            </button>
          </div>

          {activeOnlyMode && (
            <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: 'bold' }}>
              ※ 완료된 세트와 아직 시작하지 않은 대기 세트는 숨겨집니다.
            </span>
          )}
        </div>

        {/* 📊 선수별 게임수 현황 & ⚡ 전체 조 대진 자동 작성 버튼 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {type === 'team' && isAdmin && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{
                padding: '5px 12px',
                fontSize: '12px',
                fontWeight: 800,
                backgroundColor: '#2563eb',
                borderColor: '#1d4ed8',
                color: '#fff',
                borderRadius: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(37,99,235,0.25)'
              }}
              onClick={handleApplyAllTeamsPresetLineups}
              title="모든 조의 사전 배정된 라인업을 대진표에 순서대로 자동 입력"
            >
              <span>⚡ 전체 조 대진 자동 작성</span>
            </button>
          )}

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{
              padding: '5px 12px',
              fontSize: '12px',
              fontWeight: 800,
              backgroundColor: '#eff6ff',
              borderColor: '#bfdbfe',
              color: '#1e40af',
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(37,99,235,0.06)'
            }}
            onClick={() => setShowPlayerStatsModal(true)}
            title="모든 선수의 배정 경기수, 진행 완료/대기 현황, 상세 출전 세트 및 전적 조회"
          >
            <span>📊 선수별 게임수 현황</span>
            <span style={{ backgroundColor: '#2563eb', color: '#fff', fontSize: '11px', padding: '1px 6px', borderRadius: '10px', fontWeight: 800 }}>
              {playerGameStatsData.totalPlayers}명
            </span>
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* ⚠️ 동시간대 중복 선수 점검 알림 배너 (전체 대회 유형 공통) */}
        {conflictMap.hasConflict && (
          <div style={{ padding: '12px 16px', backgroundColor: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: '10px', boxShadow: '0 2px 8px rgba(239, 68, 68, 0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', color: '#991b1b', fontSize: '13.5px' }}>
                <span>⚠️ 동일 시간대 중복 출전 선수 감지 ({conflictMap.conflictDetails.length}건)</span>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button 
                  className="btn btn-secondary btn-sm"
                  style={{ background: '#fff', color: '#b91c1c', borderColor: '#fca5a5', fontSize: '11.5px', padding: '3px 8px' }}
                  onClick={() => setShowDuplicateModal(true)}
                >
                  🔍 상세 보기
                </button>
                {isAdmin && (
                  <button 
                    className="btn btn-primary btn-sm"
                    style={{ background: '#dc2626', borderColor: '#b91c1c', color: '#fff', fontSize: '11.5px', padding: '3px 10px', fontWeight: 'bold' }}
                    onClick={handleRegenerateSchedule}
                  >
                    🔄 대진 새로 작성 (자동 재배정)
                  </button>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: '#b91c1c' }}>
              {conflictMap.conflictDetails.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                  • <strong>{c.playerName}</strong> 선수: <strong>{c.timeStr} ({c.slot}경기/세트)</strong>에 <strong>{c.courts.join(' & ')}</strong> 중복 출전
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 👥 조별 3단계 출전 명단 & 조원 현황 패널 (팀전 전용) */}
        {type === 'team' && teams && teams.length > 0 && (
          <div style={{ border: '1px solid #bfdbfe', borderRadius: '10px', backgroundColor: '#f0f9ff', overflow: 'hidden' }}>
            <div 
              style={{ 
                padding: '10px 14px', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                cursor: 'pointer',
                userSelect: 'none',
                flexWrap: 'wrap',
                gap: '8px'
              }}
              onClick={() => setShowRostersSummary(prev => !prev)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, fontSize: '13.5px', color: '#1e40af', flexWrap: 'wrap' }}>
                <span>👥 3단계 배정 출전 명단 및 조원 현황 ({teams.length}개 조)</span>
                <span style={{ fontSize: '11px', fontWeight: 'normal', color: '#3b82f6' }}>
                  (조장 사전 라인업 확인)
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {isAdmin && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{
                      padding: '3px 10px',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      backgroundColor: '#2563eb',
                      borderColor: '#1d4ed8',
                      color: '#fff',
                      borderRadius: '6px',
                      boxShadow: '0 2px 4px rgba(37,99,235,0.2)'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApplyAllTeamsPresetLineups();
                    }}
                    title="모든 조의 사전 배정된 라인업을 대진표 전체에 순서대로 자동 적용"
                  >
                    ⚡ 전체 조 대진 자동 작성
                  </button>
                )}
                <span style={{ fontSize: '12px', color: '#2563eb', fontWeight: 700 }}>
                  {showRostersSummary ? '접기 ▲' : '명단 보기 ▼'}
                </span>
              </div>
            </div>

            {showRostersSummary && (
              <div style={{ padding: '12px 14px', borderTop: '1px solid #dbeafe', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '10px', backgroundColor: '#fff' }}>
                {teams.map((t, idx) => {
                  const theme = TEAM_COLORS[idx % TEAM_COLORS.length] || { bg: '#f8fafc', border: '#e2e8f0', text: 'var(--txt)', badgeBg: 'var(--blue)' };
                  const roster = t.players || [];
                  const captain = t.captain ? byId[t.captain]?.name : null;
                  const normalizedList = getNormalizedLineupList(t);

                  return (
                    <div key={t.id} style={{ border: `1.5px solid ${theme.border}`, borderRadius: '8px', padding: '10px', backgroundColor: theme.bg, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ color: theme.text, fontSize: '13.5px' }}>{t.name}</strong>
                        {captain && (
                          <span style={{ fontSize: '11px', backgroundColor: '#fff', color: theme.text, padding: '1px 6px', borderRadius: '4px', border: `1px solid ${theme.border}`, fontWeight: 'bold' }}>
                            👑 조장: {captain}
                          </span>
                        )}
                      </div>
                      
                      <div style={{ fontSize: '11.5px', color: 'var(--txt)' }}>
                        <strong>조원 ({roster.length}명):</strong> {roster.map(pid => byId[pid]?.name || '선수').join(', ')}
                      </div>

                      <div style={{ borderTop: `1px dashed ${theme.border}`, paddingTop: '4px', marginTop: '2px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: theme.text }}>📋 3단계 사전 라인업:</span>
                        {normalizedList.length > 0 ? (
                          normalizedList.map(lu => {
                            const p1Name = byId[lu.player1]?.name || '미정';
                            const p2Name = byId[lu.player2]?.name || '미정';
                            return (
                              <div key={lu.gameNum} style={{ fontSize: '11px', color: 'var(--txt2)', display: 'flex', justifyContent: 'space-between' }}>
                                <span>• {lu.gameNum}경기:</span>
                                <span style={{ fontWeight: 600, color: 'var(--txt)' }}>{p1Name} / {p2Name}</span>
                              </div>
                            );
                          })
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--txt3)' }}>사전 라인업 없음 (조원 중 임의 출전)</span>
                        )}
                      </div>

                      {/* 조별 대진 자동 작성 버튼 */}
                      {isAdmin && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          style={{
                            marginTop: '6px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 800,
                            backgroundColor: theme.badgeBg || '#2563eb',
                            borderColor: theme.border || '#1d4ed8',
                            color: '#fff',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            cursor: 'pointer',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                            width: '100%'
                          }}
                          onClick={() => handleApplyTeamPresetLineups(t.id)}
                          title={`${t.name}의 사전 배정된 라인업을 대진표의 모든 ${t.name} 경기에 순서대로 자동 입력`}
                        >
                          <span>⚡ {t.name} 대진 자동 작성</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Group by Court */}
        {type === 'team' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {courtDetails.map((court, cIdx) => {
              const courtId = court.id || `c-${cIdx+1}`;
              const courtNum = court.name;
              const courtMaxGames = court.games || 2;
              const maxCourtCapacity = Math.max(courtMaxGames, courtSets[courtId] || 2, tournament.gamesPerTeam || 4, maxAllowedSets || 12, 12);
              const isCollapsed = isCourtCollapsed(courtId);
              const totalSets = courtSets[courtId] || courtMaxGames;
              const allSetIndices = Array.from({ length: totalSets }, (_, i) => i + 1);

              const matchBySet = {};
              allSetIndices.forEach(setIdx => {
                matchBySet[setIdx] = localMatches.find(match => 
                  (match.courtId === courtId || match.court === courtNum) && match.setIndex === setIdx
                ) || {
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
              });

              const completedSets = allSetIndices.filter(setIdx => {
                const m = matchBySet[setIdx];
                return m.scoreA !== null && m.scoreB !== null;
              });

              const activeSetIdx = allSetIndices.find(setIdx => {
                const m = matchBySet[setIdx];
                return m.scoreA === null || m.scoreB === null;
              }) || null;

              const setsToRender = isCollapsed 
                ? (activeSetIdx !== null ? [activeSetIdx] : [])
                : allSetIndices;

              return (
                <div key={courtId} style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '14px', backgroundColor: '#f8fafc', overflowX: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800 }}>
                        🎾 {courtNum} 대진
                      </h3>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{
                          padding: '2px 8px',
                          fontSize: '11px',
                          height: '24px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          borderRadius: '12px',
                          backgroundColor: isCollapsed ? '#e0f2fe' : '#fff',
                          color: isCollapsed ? '#0369a1' : 'var(--txt)',
                          borderColor: isCollapsed ? '#7dd3fc' : 'var(--border)',
                          fontWeight: isCollapsed ? 'bold' : 'normal'
                        }}
                        onClick={() => toggleCourtCollapse(courtId)}
                      >
                        {isCollapsed ? '⚡ 진행중만 모아보기' : '📋 전체 펼쳐보기'}
                        <span>{isCollapsed ? '▲' : '▼'}</span>
                      </button>
                    </div>

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
                          onChange={e => handleCourtSetsChange(courtId, parseInt(e.target.value) || 2, courtNum, maxCourtCapacity)}
                        >
                          {Array.from({ length: maxCourtCapacity }, (_, i) => i + 1).map(s => (
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
                            backgroundColor: (courtSets[courtId] || courtMaxGames) >= maxCourtCapacity ? '#f1f5f9' : '#fff',
                            cursor: (courtSets[courtId] || courtMaxGames) >= maxCourtCapacity ? 'not-allowed' : 'pointer'
                          }}
                          onClick={() => handleAddSet(courtId, courtNum, maxCourtCapacity)}
                          disabled={(courtSets[courtId] || courtMaxGames) >= maxCourtCapacity}
                          title={`세트 추가 (최대: ${maxCourtCapacity}세트)`}
                        >
                          ➕ 세트 추가
                        </button>
                      </div>
                    )}
                  </div>

                  {isCollapsed && (
                    <div style={{ marginBottom: '10px', padding: '6px 10px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', fontSize: '11px', color: '#166534', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                      <span>
                        {activeSetIdx !== null ? (
                          <>🔥 <strong>{activeSetIdx}세트</strong> 경기 진행 중 ({completedSets.length}세트 완료 / {totalSets - activeSetIdx}세트 대기)</>
                        ) : (
                          <>✅ <strong>모든 경기({totalSets}세트) 완료됨</strong></>
                        )}
                      </span>
                      <button 
                        type="button"
                        onClick={() => toggleCourtCollapse(courtId)} 
                        style={{ background: 'none', border: 'none', color: '#0369a1', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px', textDecoration: 'underline' }}
                      >
                        전체 세트 펼치기 ({totalSets}세트)
                      </button>
                    </div>
                  )}

                  {setsToRender.length > 0 ? (
                    <table className="table" style={{ width: '100%', minWidth: '320px', textAlign: 'center', fontSize: '12px', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#edf2f7' }}>
                          <th style={{ width: '48px', padding: '6px 2px', fontSize: '11px' }}>시간</th>
                          <th style={{ width: '38px', padding: '6px 2px', fontSize: '11px' }}>세트</th>
                          <th style={{ padding: '6px 4px', fontSize: '11px' }}>대진</th>
                        </tr>
                      </thead>
                      <tbody>
                        {setsToRender.map((setIdx) => {
                          const m = matchBySet[setIdx];
                          const teamAPlayers = teamMap[m.teamAId]?.players || [];
                          const teamBPlayers = teamMap[m.teamBId]?.players || [];

                          const teamAIdx = m.teamAId ? teamIndexMap[m.teamAId] : undefined;
                          const teamATheme = (teamAIdx !== undefined && teamAIdx >= 0) ? TEAM_COLORS[teamAIdx % TEAM_COLORS.length] : { bg: '#f8fafc', border: '#e2e8f0', text: 'var(--txt)', badgeBg: 'var(--blue)' };

                          const teamBIdx = m.teamBId ? teamIndexMap[m.teamBId] : undefined;
                          const teamBTheme = (teamBIdx !== undefined && teamBIdx >= 0) ? TEAM_COLORS[teamBIdx % TEAM_COLORS.length] : { bg: '#f8fafc', border: '#e2e8f0', text: 'var(--txt)', badgeBg: 'var(--red)' };

                          const matchConflictInfo = conflictMap.matchConflicts[m.id] || null;
                          const isPlayerA1Conflicting = matchConflictInfo && m.playerA1 && matchConflictInfo[m.playerA1];
                          const isPlayerA2Conflicting = matchConflictInfo && m.playerA2 && matchConflictInfo[m.playerA2];
                          const isPlayerB1Conflicting = matchConflictInfo && m.playerB1 && matchConflictInfo[m.playerB1];
                          const isPlayerB2Conflicting = matchConflictInfo && m.playerB2 && matchConflictInfo[m.playerB2];

                          return (
                            <tr 
                              key={setIdx} 
                              style={{ 
                                borderBottom: '1px solid #e2e8f0',
                                cursor: isAdmin ? 'grab' : 'default',
                                transition: 'background-color 0.2s',
                                backgroundColor: isCollapsed ? '#fff' : 'transparent'
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
                                if (isAdmin) e.currentTarget.style.backgroundColor = isCollapsed ? '#fff' : 'transparent';
                              }}
                              onDrop={(e) => {
                                if (!isAdmin) return;
                                e.currentTarget.style.backgroundColor = isCollapsed ? '#fff' : 'transparent';
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
                              
                              <td style={{ padding: '6px 4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%' }}>
                                  {/* Team A Block */}
                                  <div style={{ 
                                    flex: 1, 
                                    minWidth: '95px', 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    gap: '4px', 
                                    border: `1.5px solid ${teamATheme.border}`, 
                                    borderRadius: '8px', 
                                    padding: '5px 6px', 
                                    backgroundColor: teamATheme.bg 
                                  }}>
                                    {isAdmin ? (
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
                                          borderRadius: '5px'
                                        }}
                                        value={m.teamAId || ''}
                                        onChange={e => handleUpdateMatchSlot(courtId, courtNum, setIdx, 'teamAId', e.target.value)}
                                      >
                                        <option value="">A조(팀)</option>
                                        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                      </select>
                                    ) : (
                                      <div style={{ fontWeight: 'bold', fontSize: '12px', color: teamATheme.text, textAlign: 'center' }}>
                                        {teamMap[m.teamAId]?.name || 'A조'}
</div>
                                    )}
                                    
                                    {/* Players Container & Modal Trigger */}
                                    <div 
                                      onClick={() => {
                                        if (m.teamAId) {
                                          openPlayerAssignModal(courtId, courtNum, setIdx, 'A', m.teamAId, m.playerA1, m.playerA2);
                                        }
                                      }}
                                      style={{ 
                                        display: 'flex', 
                                        flexDirection: 'column', 
                                        alignItems: 'center', 
                                        gap: '2px', 
                                        backgroundColor: '#fff', 
                                        border: (isPlayerA1Conflicting || isPlayerA2Conflicting) ? '1.5px solid #ef4444' : '1px solid #e2e8f0', 
                                        borderRadius: '6px', 
                                        padding: '4px 6px', 
                                        cursor: m.teamAId ? 'pointer' : 'default',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                                        minHeight: '44px',
                                        justifyContent: 'center'
                                      }}
                                      title={m.teamAId ? "클릭하여 출전 선수 지정 또는 변경" : ""}
                                    >
                                      {(m.playerA1 || m.playerA2) ? (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', flexWrap: 'wrap', width: '100%' }}>
                                          <span style={{ 
                                            fontSize: '11.5px', 
                                            fontWeight: 700, 
                                            color: isPlayerA1Conflicting ? '#b91c1c' : 'var(--txt)',
                                            backgroundColor: isPlayerA1Conflicting ? '#fee2e2' : '#f1f5f9',
                                            padding: '1px 4px',
                                            borderRadius: '4px'
                                          }}>
                                            {byId[m.playerA1]?.name || '선수1'} {isPlayerA1Conflicting && '⚠️'}
                                          </span>
                                          <span style={{ fontSize: '10px', color: '#94a3b8' }}>/</span>
                                          <span style={{ 
                                            fontSize: '11.5px', 
                                            fontWeight: 700, 
                                            color: isPlayerA2Conflicting ? '#b91c1c' : 'var(--txt)',
                                            backgroundColor: isPlayerA2Conflicting ? '#fee2e2' : '#f1f5f9',
                                            padding: '1px 4px',
                                            borderRadius: '4px'
                                          }}>
                                            {byId[m.playerA2]?.name || '선수2'} {isPlayerA2Conflicting && '⚠️'}
                                          </span>
                                        </div>
                                      ) : (
                                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>👥 선수 미지정</span>
                                      )}

                                      {m.teamAId && (
                                        <span style={{ fontSize: '10px', color: '#2563eb', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}>
                                          ✏️ {(m.playerA1 || m.playerA2) ? '선수 변경' : '선수 지정'}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Score A */}
                                  <select
                                    className="input input-sm"
                                    style={{ 
                                      width: '38px', 
                                      height: '52px', 
                                      textAlign: 'center', 
                                      textAlignLast: 'center', 
                                      fontSize: '15px', 
                                      fontWeight: 'bold', 
                                      padding: 0, 
                                      borderRadius: '6px', 
                                      flexShrink: 0, 
                                      opacity: 1, 
                                      cursor: isAdmin ? 'pointer' : 'default', 
                                      pointerEvents: isAdmin ? 'auto' : 'none', 
                                      appearance: isAdmin ? 'auto' : 'none', 
                                      backgroundColor: m.scoreA !== null ? '#f8fafc' : '#ffffff', 
                                      color: m.scoreA !== null ? 'var(--blue)' : 'var(--txt3)',
                                      border: '1px solid #cbd5e1'
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

                                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--txt3)', flexShrink: 0, padding: '0 1px' }}>vs</span>

                                  {/* Score B */}
                                  <select
                                    className="input input-sm"
                                    style={{ 
                                      width: '38px', 
                                      height: '52px', 
                                      textAlign: 'center', 
                                      textAlignLast: 'center', 
                                      fontSize: '15px', 
                                      fontWeight: 'bold', 
                                      padding: 0, 
                                      borderRadius: '6px', 
                                      flexShrink: 0, 
                                      opacity: 1, 
                                      cursor: isAdmin ? 'pointer' : 'default', 
                                      pointerEvents: isAdmin ? 'auto' : 'none', 
                                      appearance: isAdmin ? 'auto' : 'none', 
                                      backgroundColor: m.scoreB !== null ? '#f8fafc' : '#ffffff', 
                                      color: m.scoreB !== null ? 'var(--red)' : 'var(--txt3)',
                                      border: '1px solid #cbd5e1'
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

                                  {/* Team B Block */}
                                  <div style={{ 
                                    flex: 1, 
                                    minWidth: '95px', 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    gap: '4px', 
                                    border: `1.5px solid ${teamBTheme.border}`, 
                                    borderRadius: '8px', 
                                    padding: '5px 6px', 
                                    backgroundColor: teamBTheme.bg 
                                  }}>
                                    {isAdmin ? (
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
                                          borderRadius: '5px'
                                        }}
                                        value={m.teamBId || ''}
                                        onChange={e => handleUpdateMatchSlot(courtId, courtNum, setIdx, 'teamBId', e.target.value)}
                                      >
                                        <option value="">B조(팀)</option>
                                        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                      </select>
                                    ) : (
                                      <div style={{ fontWeight: 'bold', fontSize: '12px', color: teamBTheme.text, textAlign: 'center' }}>
                                        {teamMap[m.teamBId]?.name || 'B조'}
                                      </div>
                                    )}
                                    
                                    {/* Players Container & Modal Trigger */}
                                    <div 
                                      onClick={() => {
                                        if (m.teamBId) {
                                          openPlayerAssignModal(courtId, courtNum, setIdx, 'B', m.teamBId, m.playerB1, m.playerB2);
                                        }
                                      }}
                                      style={{ 
                                        display: 'flex', 
                                        flexDirection: 'column', 
                                        alignItems: 'center', 
                                        gap: '2px', 
                                        backgroundColor: '#fff', 
                                        border: (isPlayerB1Conflicting || isPlayerB2Conflicting) ? '1.5px solid #ef4444' : '1px solid #e2e8f0', 
                                        borderRadius: '6px', 
                                        padding: '4px 6px', 
                                        cursor: m.teamBId ? 'pointer' : 'default',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                                        minHeight: '44px',
                                        justifyContent: 'center'
                                      }}
                                      title={m.teamBId ? "클릭하여 출전 선수 지정 또는 변경" : ""}
                                    >
                                      {(m.playerB1 || m.playerB2) ? (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', flexWrap: 'wrap', width: '100%' }}>
                                          <span style={{ 
                                            fontSize: '11.5px', 
                                            fontWeight: 700, 
                                            color: isPlayerB1Conflicting ? '#b91c1c' : 'var(--txt)',
                                            backgroundColor: isPlayerB1Conflicting ? '#fee2e2' : '#f1f5f9',
                                            padding: '1px 4px',
                                            borderRadius: '4px'
                                          }}>
                                            {byId[m.playerB1]?.name || '선수1'} {isPlayerB1Conflicting && '⚠️'}
                                          </span>
                                          <span style={{ fontSize: '10px', color: '#94a3b8' }}>/</span>
                                          <span style={{ 
                                            fontSize: '11.5px', 
                                            fontWeight: 700, 
                                            color: isPlayerB2Conflicting ? '#b91c1c' : 'var(--txt)',
                                            backgroundColor: isPlayerB2Conflicting ? '#fee2e2' : '#f1f5f9',
                                            padding: '1px 4px',
                                            borderRadius: '4px'
                                          }}>
                                            {byId[m.playerB2]?.name || '선수2'} {isPlayerB2Conflicting && '⚠️'}
                                          </span>
                                        </div>
                                      ) : (
                                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>👥 선수 미지정</span>
                                      )}

                                      {m.teamBId && (
                                        <span style={{ fontSize: '10px', color: '#2563eb', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}>
                                          ✏️ {(m.playerB1 || m.playerB2) ? '선수 변경' : '선수 지정'}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '24px', marginBottom: '6px' }}>🏆</div>
                      <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#166534' }}>{courtNum}의 모든 경기({totalSets}세트)가 완료되었습니다!</div>
                      <button 
                        type="button" 
                        className="btn btn-secondary btn-sm" 
                        style={{ marginTop: '8px', fontSize: '11px' }}
                        onClick={() => toggleCourtCollapse(courtId)}
                      >
                        📋 전체 세트 결과 펼쳐보기 ({totalSets}세트)
                      </button>
                    </div>
                  )}
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
                  const courtId = court.id || `c-${cIdx+1}`;
                  const courtNum = court.name;
                  const courtMatches = matchesForRender
                    .filter(m => m.court === courtNum)
                    .sort((a, b) => (a.setIndex || a.round || 0) - (b.setIndex || b.round || 0));

                  const isCollapsed = isCourtCollapsed(courtId);
                  const completedMatches = courtMatches.filter(m => m.scoreA !== null && m.scoreB !== null);
                  const activeMatch = courtMatches.find(m => m.scoreA === null || m.scoreB === null) || null;
                  const activeMatchIdx = activeMatch ? courtMatches.indexOf(activeMatch) + 1 : null;
                  const matchesToRender = isCollapsed
                    ? (activeMatch ? [activeMatch] : [])
                    : courtMatches;

                  return (
                    <div key={court.id || cIdx} style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '14px', backgroundColor: '#f8fafc' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800 }}>
                            🎾 {courtNum} 대진 ({courtMatches.length}경기)
                          </h3>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{
                              padding: '2px 8px',
                              fontSize: '11px',
                              height: '24px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              borderRadius: '12px',
                              backgroundColor: isCollapsed ? '#e0f2fe' : '#fff',
                              color: isCollapsed ? '#0369a1' : 'var(--txt)',
                              borderColor: isCollapsed ? '#7dd3fc' : 'var(--border)',
                              fontWeight: isCollapsed ? 'bold' : 'normal'
                            }}
                            onClick={() => toggleCourtCollapse(courtId)}
                          >
                            {isCollapsed ? '⚡ 진행중만 모아보기' : '📋 전체 펼쳐보기'}
                            <span>{isCollapsed ? '▲' : '▼'}</span>
                          </button>
                        </div>
                        {courtMatches.length > 0 && (
                          <span style={{ fontSize: '12px', color: 'var(--txt3)', fontWeight: 600 }}>
                            시작 시간: ⏰ {formatMatchTimeSlot(tournament.startTime, courtMatches[0].setIndex || 1).split('~')[0].trim()}
                          </span>
                        )}
                      </div>

                      {isCollapsed && (
                        <div style={{ marginBottom: '10px', padding: '6px 10px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', fontSize: '11px', color: '#166534', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                          <span>
                            {activeMatch !== null ? (
                              <>🔥 <strong>{activeMatch.setIndex || activeMatchIdx}경기</strong> 진행 중 ({completedMatches.length}경기 완료 / {courtMatches.length - activeMatchIdx}경기 대기)</>
                            ) : (
                              <>✅ <strong>모든 경기({courtMatches.length}경기) 완료됨</strong></>
                            )}
                          </span>
                          <button 
                            type="button"
                            onClick={() => toggleCourtCollapse(courtId)} 
                            style={{ background: 'none', border: 'none', color: '#0369a1', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px', textDecoration: 'underline' }}
                          >
                            전체 경기 펼치기 ({courtMatches.length}경기)
                          </button>
                        </div>
                      )}

                      {matchesToRender.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {matchesToRender.map(m => renderIndividualMatch(m))}
                        </div>
                      ) : isCollapsed && courtMatches.length > 0 && activeMatch === null ? (
                        <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: '24px', marginBottom: '6px' }}>🏆</div>
                          <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#166534' }}>{courtNum}의 모든 경기({courtMatches.length}경기)가 완료되었습니다!</div>
                          <button 
                            type="button" 
                            className="btn btn-secondary btn-sm" 
                            style={{ marginTop: '8px', fontSize: '11px' }}
                            onClick={() => toggleCourtCollapse(courtId)}
                          >
                            📋 전체 경기 결과 펼쳐보기 ({courtMatches.length}경기)
                          </button>
                        </div>
                      ) : (
                        <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '14px 0' }}>
                          배정된 대진이 없습니다.
                        </div>
                      )}
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
                  const completedInRound = roundMatches.filter(m => m.scoreA !== null && m.scoreB !== null);
                  const activeInRound = roundMatches.filter(m => m.scoreA === null || m.scoreB === null);
                  const isRoundDone = roundMatches.length > 0 && activeInRound.length === 0;

                  const matchesToRender = activeOnlyMode
                    ? activeInRound
                    : roundMatches;

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
                          {isRoundDone && (
                            <span style={{ fontSize: '11px', fontWeight: 'bold', backgroundColor: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '10px' }}>
                              ✅ 완료
                            </span>
                          )}
                        </h3>
                        <span style={{ fontSize: '11px', color: 'var(--txt3)' }}>
                          {isAdmin ? '드래그하여 라운드 순서 변경 가능' : ''}
                        </span>
                      </div>

                      {activeOnlyMode && (
                        <div style={{ marginBottom: '10px', padding: '6px 10px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', fontSize: '11px', color: '#166534', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                          <span>
                            {!isRoundDone ? (
                              <>🔥 <strong>{activeInRound.length}경기 진행 중</strong> ({completedInRound.length}경기 완료)</>
                            ) : (
                              <>✅ <strong>{r}라운드 모든 경기({roundMatches.length}경기) 완료됨</strong></>
                            )}
                          </span>
                        </div>
                      )}

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {matchesToRender.map(m => renderIndividualMatch(m))}
                        {matchesToRender.length === 0 && roundMatches.length > 0 && activeOnlyMode && isRoundDone && (
                          <div style={{ padding: '16px', textAlign: 'center', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12px', color: '#166534', fontWeight: 'bold' }}>
                            🏆 {r}라운드의 모든 경기가 완료되었습니다.
                          </div>
                        )}
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

        {/* 하단 액션 버튼 바 (이전 단계의 버튼 크기와 동일하게 매칭 및 하단 배치) */}
        <div style={{ marginTop: '28px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
          {isAdmin ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  if (confirm('이전 설정 단계로 돌아가시겠습니까? 현재 입력된 점수는 보존됩니다.')) {
                    onUpdate({ status: type === 'team' ? 'picking' : 'draft' });
                  }
                }}
              >
                👈 이전 ({type === 'team' ? '팀원 배정' : '참석자/코트 설정'})
              </button>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button 
                  className="btn btn-secondary" 
                  onClick={handleSave}
                >
                  저장
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={handleFinish}
                >
                  대회 종료 🏁
                </button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--txt2)', padding: '12px', fontSize: '13px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border)' }}>
              🎾 실시간 경기 진행 및 순위 집계 중입니다. (실시간 동기화 중)
            </div>
          )}
        </div>
      </div>

      {/* 🔍 중복 체크 및 대진 새로 작성 모달 */}
      {showDuplicateModal && (() => {
        const modalEl = (
          <div className="modal-overlay" onClick={() => setShowDuplicateModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px', width: '100%', maxHeight: '88dvh', overflowY: 'auto' }}>
              <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '20px' }}>{conflictMap.hasConflict ? '⚠️' : '🔍'}</span>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: 'var(--navy)' }}>
                    선수 중복 출전 점검
                  </h2>
                </div>
                <button 
                  className="modal-close" 
                  onClick={() => setShowDuplicateModal(false)} 
                  style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                  &times;
                </button>
              </div>

              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {conflictMap.hasConflict ? (
                  <>
                    <div style={{ padding: '12px 14px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#991b1b', fontSize: '13px', lineHeight: '1.5' }}>
                      <strong>⚠️ 동일 시간대에 중복 배정된 선수({conflictMap.conflictDetails.length}건)가 발견되었습니다.</strong>
                      <div style={{ fontSize: '12px', marginTop: '4px', color: '#b91c1c' }}>
                        선수가 같은 시간대에 여러 코트에 동시 출전할 수 없습니다. 아래 중복 목록을 확인하고 대진을 새로 작성하거나 수동으로 수정해 주세요.
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
                      {conflictMap.conflictDetails.map((c, idx) => (
                        <div key={idx} style={{ padding: '10px 12px', backgroundColor: '#fff', border: '1px solid #fca5a5', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '4px', boxShadow: '0 1px 3px rgba(239, 68, 68, 0.05)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span style={{ fontWeight: 800, fontSize: '14px', color: '#b91c1c' }}>
                              👤 {c.playerName} {byId[c.playerId]?.ntrp ? `(${byId[c.playerId].ntrp}/${byId[c.playerId].gender === 'F' ? '여' : '남'})` : ''}
                            </span>
                            <span style={{ fontSize: '12px', fontWeight: 700, backgroundColor: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: '12px' }}>
                              ⏰ {c.timeStr} ({c.slot}경기/세트)
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#4b5563' }}>
                            🎾 <strong>중복 코트:</strong> <span style={{ color: '#dc2626', fontWeight: 700 }}>{c.courts.join(' & ')}</span>
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#6b7280', backgroundColor: '#f9fafb', padding: '4px 8px', borderRadius: '4px' }}>
                            {c.description}
                          </div>
                        </div>
                      ))}
                    </div>

                    {isAdmin && (
                      <div style={{ padding: '12px 14px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', fontSize: '12.5px', color: '#1e40af', lineHeight: '1.5' }}>
                        💡 <strong>대진 새로 작성(자동 재배정):</strong><br/>
                        버튼 클릭 시 모든 선수의 출전 횟수, 실력(NTRP), 성별 균형을 고려하여 <strong>동일 시간대 중복이 없는 새로운 대진표</strong>를 자동 편성합니다.
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <div style={{ fontSize: '3rem' }}>✅</div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#166534' }}>
                      동일 시간대 선수 중복이 없습니다!
                    </h3>
                    <p style={{ color: 'var(--txt2)', fontSize: '13px', margin: 0, maxWidth: '380px', lineHeight: 1.5 }}>
                      현재 편성된 모든 코트와 시간대에 선수가 겹치지 않고 정상적으로 배정되어 있습니다. 안심하고 경기를 진행하실 수 있습니다.
                    </p>
                    <div style={{ marginTop: '8px', padding: '8px 16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', fontSize: '12px', color: '#15803d', fontWeight: 600 }}>
                      총 {localMatches.length}경기 ({localMatches.filter(m => m.court).length}경기 코트 배정 완료)
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '18px', borderTop: '1px solid var(--border)', paddingTop: '14px', flexWrap: 'wrap' }}>
                <button className="btn btn-secondary" onClick={() => setShowDuplicateModal(false)}>
                  {conflictMap.hasConflict ? '수동으로 수정' : '확인'}
                </button>
                {isAdmin && (
                  <button 
                    className="btn btn-primary" 
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={handleRegenerateSchedule}
                  >
                    🔄 대진 새로 작성
                  </button>
                )}
              </div>
            </div>
          </div>
        );
        return mounted && typeof document !== 'undefined' ? createPortal(modalEl, document.body) : modalEl;
      })()}

      {/* 👥 조(팀) 출전 선수 지정 모달 */}
      {assignModalData && (() => {
        const selectedTeam = teamMap[assignModalData.teamId] || {};
        const teamPlayers = selectedTeam.players || [];
        const normalizedLineups = getNormalizedLineupList(selectedTeam);
        const teamIdx = teamIndexMap[assignModalData.teamId];
        const teamTheme = (teamIdx !== undefined && teamIdx >= 0) ? TEAM_COLORS[teamIdx % TEAM_COLORS.length] : { bg: '#f8fafc', border: '#e2e8f0', text: 'var(--navy)', badgeBg: '#3b82f6' };

        const handleSelectLineup = (lu) => {
          setModalP1(lu.player1 || null);
          setModalP2(lu.player2 || null);
        };

        const handleTogglePlayer = (pid) => {
          if (modalP1 === pid) {
            setModalP1(null);
          } else if (modalP2 === pid) {
            setModalP2(null);
          } else {
            if (!modalP1) {
              setModalP1(pid);
            } else if (!modalP2) {
              setModalP2(pid);
            } else {
              setModalP2(pid); // replace second player
            }
          }
        };

        const handleApply = () => {
          if (modalP1 && modalP2 && modalP1 === modalP2) {
            alert('동일한 선수를 중복으로 선택할 수 없습니다.');
            return;
          }
          handleUpdateTeamPlayers(
            assignModalData.courtId,
            assignModalData.courtNum,
            assignModalData.setIdx,
            assignModalData.teamSide,
            modalP1,
            modalP2
          );
          setAssignModalData(null);
        };

        const selectedCount = [modalP1, modalP2].filter(Boolean).length;

        const modalEl = (
          <div className="modal-overlay" onClick={() => setAssignModalData(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '540px', width: '100%', maxHeight: '88dvh', overflowY: 'auto' }}>
              {/* Modal Header */}
              <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ 
                      backgroundColor: teamTheme.badgeBg || '#3b82f6', 
                      color: '#fff', 
                      padding: '2px 8px', 
                      borderRadius: '12px', 
                      fontSize: '12px', 
                      fontWeight: 800 
                    }}>
                      {selectedTeam.name || '조'}
                    </span>
                    <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--navy)' }}>
                      {assignModalData.courtNum} {assignModalData.setIdx}세트 출전 선수 지정
                    </h2>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--txt2)', marginTop: '4px' }}>
                    조장: <strong>{byId[selectedTeam.captain]?.name || byId[selectedTeam.leaderId]?.name || '미정'}</strong> | 전체 조원: {teamPlayers.length}명
                  </div>
                </div>
                <button 
                  className="modal-close" 
                  onClick={() => setAssignModalData(null)} 
                  style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--text-muted)', lineHeight: '1' }}
                >
                  &times;
                </button>
              </div>

              {/* Modal Body */}
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* 1. 3단계 사전 배정 라인업 원클릭 선택 */}
                {normalizedLineups.length > 0 && (
                  <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                      <span>📋 3단계 사전 출전 명단 불러오기</span>
                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'normal' }}>터치 시 자동 선택</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                      {normalizedLineups.map((lu) => {
                        const p1Name = byId[lu.player1]?.name || '미정';
                        const p2Name = byId[lu.player2]?.name || '미정';
                        const p1Count = playerMatchCounts[lu.player1] || 0;
                        const p2Count = playerMatchCounts[lu.player2] || 0;
                        const isCurrentSet = lu.gameNum === assignModalData.setIdx;
                        const isSelected = (modalP1 === lu.player1 && modalP2 === lu.player2) || (modalP1 === lu.player2 && modalP2 === lu.player1);

                        return (
                          <button
                            key={lu.gameNum}
                            type="button"
                            onClick={() => handleSelectLineup(lu)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 10px',
                              borderRadius: '8px',
                              border: isSelected ? '2px solid #2563eb' : isCurrentSet ? '1.5px solid #86efac' : '1px solid #cbd5e1',
                              backgroundColor: isSelected ? '#eff6ff' : isCurrentSet ? '#f0fdf4' : '#fff',
                              cursor: 'pointer',
                              textAlign: 'left',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <div>
                              <div style={{ fontSize: '11px', color: isSelected ? '#2563eb' : isCurrentSet ? '#16a34a' : '#64748b', fontWeight: 700 }}>
                                {lu.gameNum}경기 명단 {isCurrentSet && '🌟 (추천)'}
                              </div>
                              <div style={{ fontSize: '12px', fontWeight: 800, color: '#1e293b', marginTop: '2px' }}>
                                👤 {p1Name} <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: 'bold' }}>({p1Count}경기)</span> / 👤 {p2Name} <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: 'bold' }}>({p2Count}경기)</span>
                              </div>
                            </div>
                            {isSelected && (
                              <span style={{ fontSize: '14px', color: '#2563eb', fontWeight: 'bold' }}>✓</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. 조원 직접 선택 (임의 지정) */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>
                      👤 조원 직접 선택 ({selectedCount}/2명 선택됨)
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      조원 2명을 터치하여 선택/해제
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px' }}>
                    {teamPlayers.map(pid => {
                      const player = byId[pid] || { name: '선수' };
                      const isSelected1 = modalP1 === pid;
                      const isSelected2 = modalP2 === pid;
                      const isSelected = isSelected1 || isSelected2;
                      const isLeader = selectedTeam.captain === pid || selectedTeam.leaderId === pid;
                      const gameCount = playerMatchCounts[pid] || 0;

                      // 동일 시간대(setIdx) 타 코트 출전 여부 체크
                      const conflictingMatch = localMatches.find(m => 
                        (m.courtId !== assignModalData.courtId && m.court !== assignModalData.courtNum) &&
                        m.setIndex === assignModalData.setIdx &&
                        [m.playerA1, m.playerA2, m.playerB1, m.playerB2].includes(pid)
                      );

                      return (
                        <div
                          key={pid}
                          onClick={() => handleTogglePlayer(pid)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: isSelected ? '2px solid #2563eb' : conflictingMatch ? '1.5px solid #fca5a5' : '1px solid #e2e8f0',
                            backgroundColor: isSelected ? '#eff6ff' : conflictingMatch ? '#fef2f2' : '#fff',
                            cursor: 'pointer',
                            userSelect: 'none',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '50%',
                            backgroundColor: isSelected ? '#2563eb' : '#f1f5f9',
                            color: isSelected ? '#fff' : '#64748b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            flexShrink: 0
                          }}>
                            {isSelected1 ? '1' : isSelected2 ? '2' : ''}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 800, fontSize: '13px', color: conflictingMatch ? '#b91c1c' : '#1e293b' }}>
                                  {player.name}
                                </span>
                                {isLeader && <span style={{ fontSize: '9.5px', backgroundColor: '#fef3c7', color: '#b45309', padding: '1px 3px', borderRadius: '3px', fontWeight: 'bold' }}>👑조장</span>}
                                {player.gender && <span style={{ fontSize: '10px', color: player.gender === 'F' ? '#e11d48' : '#2563eb' }}>({player.gender === 'F' ? '여' : '남'})</span>}
                              </div>
                              <span style={{ 
                                fontSize: '11px', 
                                fontWeight: 800, 
                                color: gameCount > 0 ? '#1d4ed8' : '#64748b',
                                backgroundColor: gameCount > 0 ? '#dbeafe' : '#f1f5f9',
                                padding: '1px 6px',
                                borderRadius: '10px',
                                flexShrink: 0
                              }}>
                                🎾 {gameCount}경기
                              </span>
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                              NTRP: {player.ntrp || '-'}
                            </div>
                            {conflictingMatch && (
                              <div style={{ fontSize: '10px', color: '#dc2626', fontWeight: 700, marginTop: '2px' }}>
                                ⚠️ {conflictingMatch.court || conflictingMatch.courtId} 출전중
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. 현재 선택 요약 박스 */}
                <div style={{ padding: '10px 14px', backgroundColor: '#f1f5f9', borderRadius: '8px', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                  <span style={{ fontSize: '12px', color: '#475569', fontWeight: 700 }}>선택된 출전 선수:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: 800, fontSize: '13.5px', color: modalP1 ? '#2563eb' : '#94a3b8' }}>
                      {modalP1 ? `👤 ${byId[modalP1]?.name}` : '(선수1 미지정)'}
                    </span>
                    <span style={{ color: '#94a3b8', fontWeight: 'bold' }}>+</span>
                    <span style={{ fontWeight: 800, fontSize: '13.5px', color: modalP2 ? '#2563eb' : '#94a3b8' }}>
                      {modalP2 ? `👤 ${byId[modalP2]?.name}` : '(선수2 미지정)'}
                    </span>
                  </div>
                </div>

              </div>

              {/* Modal Footer */}
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary btn-sm" 
                  style={{ color: '#dc2626', borderColor: '#fca5a5', backgroundColor: '#fff' }}
                  onClick={() => {
                    setModalP1(null);
                    setModalP2(null);
                  }}
                >
                  선수 비우기
                </button>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAssignModalData(null)}>
                    취소
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-primary btn-sm" 
                    onClick={handleApply}
                    style={{ fontWeight: 800, padding: '6px 16px' }}
                  >
                    선택 완료 및 적용
                  </button>
                </div>
              </div>

            </div>
          </div>
        );
        return mounted && typeof document !== 'undefined' ? createPortal(modalEl, document.body) : modalEl;
      })()}

      {/* 📊 각 선수별 게임수 및 출전 현황 모달 */}
      {showPlayerStatsModal && (() => {
        const modalEl = (
          <div className="modal-overlay" onClick={() => setShowPlayerStatsModal(false)}>
            <div 
              className="modal-content" 
              onClick={e => e.stopPropagation()} 
              style={{ 
                maxWidth: '740px', 
                width: '100%', 
                maxHeight: '88dvh', 
                overflowY: 'auto',
                borderRadius: '16px',
                padding: '20px'
              }}
            >
            {/* Modal Header */}
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '22px' }}>📊</span>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--navy)' }}>
                    각 선수별 게임수 및 출전 현황
                  </h2>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--txt2)', marginTop: '4px' }}>
                  선수별 총 출전 경기수, 완료/대기 현황, 상세 출전 세트 및 전적을 한눈에 확인합니다.
                </div>
              </div>
              <button 
                className="modal-close" 
                onClick={() => setShowPlayerStatsModal(false)} 
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* 1. KPI Metric Summary Cards (4 Cards) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                <div style={{ padding: '10px 12px', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#0369a1', fontWeight: 700 }}>👥 총 출전 선수</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#0c4a6e', marginTop: '2px' }}>
                    {playerGameStatsData.totalPlayers}명
                  </div>
                </div>

                <div style={{ padding: '10px 12px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#15803d', fontWeight: 700 }}>🎾 총 배정 슬롯</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#14532d', marginTop: '2px' }}>
                    {playerGameStatsData.totalMatchSlots}회
                  </div>
                </div>

                <div style={{ padding: '10px 12px', backgroundColor: '#fdf4ff', border: '1px solid #f5d0fe', borderRadius: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#a21caf', fontWeight: 700 }}>⚖️ 1인 평균 경기수</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#701a75', marginTop: '2px' }}>
                    {playerGameStatsData.avgGames}경기
                  </div>
                </div>

                <div style={{ padding: '10px 12px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 700 }}>🎯 출전 편차</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#78350f', marginTop: '2px' }}>
                    {playerGameStatsData.minGames}~{playerGameStatsData.maxGames}경기
                  </div>
                </div>
              </div>

              {/* ⚠️ 미배정 선수 경고 알림 */}
              {playerGameStatsData.unassignedPlayers.length > 0 && (
                <div style={{ padding: '10px 14px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#991b1b', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '16px' }}>⚠️</span>
                  <div>
                    <strong>아직 출전이 배정되지 않은 선수({playerGameStatsData.unassignedPlayers.length}명): </strong>
                    <span>{playerGameStatsData.unassignedPlayers.map(p => p.name).join(', ')}</span>
                  </div>
                </div>
              )}

              {/* 2. 필터 & 검색 툴바 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                {/* 조(팀) 탭 필터 (팀전 전용) */}
                {type === 'team' && teams && teams.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', minWidth: '42px' }}>조 구분:</span>
                    <button
                      type="button"
                      onClick={() => setPlayerStatsFilterTeam('ALL')}
                      style={{
                        padding: '4px 10px',
                        fontSize: '11.5px',
                        fontWeight: playerStatsFilterTeam === 'ALL' ? 800 : 500,
                        backgroundColor: playerStatsFilterTeam === 'ALL' ? '#2563eb' : '#fff',
                        color: playerStatsFilterTeam === 'ALL' ? '#fff' : '#64748b',
                        border: '1px solid',
                        borderColor: playerStatsFilterTeam === 'ALL' ? '#2563eb' : '#cbd5e1',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      전체 ({playerGameStatsData.totalPlayers})
                    </button>
                    {teams.map((t, idx) => {
                      const countInTeam = (t.players || []).length;
                      const isSelected = playerStatsFilterTeam === t.id;
                      const theme = TEAM_COLORS[idx % TEAM_COLORS.length] || { badgeBg: '#2563eb', border: '#cbd5e1', text: '#2563eb' };
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setPlayerStatsFilterTeam(t.id)}
                          style={{
                            padding: '4px 10px',
                            fontSize: '11.5px',
                            fontWeight: isSelected ? 800 : 500,
                            backgroundColor: isSelected ? theme.badgeBg : '#fff',
                            color: isSelected ? '#fff' : theme.text,
                            border: '1px solid',
                            borderColor: isSelected ? theme.badgeBg : theme.border,
                            borderRadius: '6px',
                            cursor: 'pointer'
                          }}
                        >
                          {t.name} ({countInTeam})
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 경기수 필터 칩 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', minWidth: '42px' }}>경기수:</span>
                  {[
                    { key: 'ALL', label: '전체' },
                    { key: '0', label: '0경기(미출전)' },
                    { key: '1', label: '1경기' },
                    { key: '2', label: '2경기' },
                    { key: '3+', label: '3경기 이상' }
                  ].map(f => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setPlayerStatsFilterGames(f.key)}
                      style={{
                        padding: '3px 8px',
                        fontSize: '11px',
                        fontWeight: playerStatsFilterGames === f.key ? 800 : 500,
                        backgroundColor: playerStatsFilterGames === f.key ? '#0f172a' : '#fff',
                        color: playerStatsFilterGames === f.key ? '#fff' : '#64748b',
                        border: '1px solid',
                        borderColor: playerStatsFilterGames === f.key ? '#0f172a' : '#cbd5e1',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* 검색 및 정렬 드롭다운 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 180px', position: 'relative' }}>
                    <input
                      type="text"
                      className="input input-sm"
                      placeholder="🔍 선수명 검색..."
                      value={playerStatsSearch}
                      onChange={e => setPlayerStatsSearch(e.target.value)}
                      style={{ width: '100%', height: '32px', fontSize: '12px', paddingLeft: '8px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>정렬:</span>
                    <select
                      className="input input-sm"
                      value={playerStatsSort}
                      onChange={e => setPlayerStatsSort(e.target.value)}
                      style={{ height: '32px', fontSize: '12px', padding: '2px 8px', fontWeight: 700 }}
                    >
                      <option value="games_desc">경기수 많은 순 ↓</option>
                      <option value="games_asc">경기수 적은 순 ↑</option>
                      <option value="name_asc">이름 가나다순</option>
                      <option value="ntrp_desc">NTRP 실력순 ↓</option>
                      <option value="winrate_desc">승률 높은 순 ↓</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 3. 선수별 목록 카드 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
                {filteredAndSortedPlayers.length === 0 ? (
                  <div style={{ padding: '30px', textAlign: 'center', color: 'var(--txt3)', fontSize: '13px' }}>
                    선택한 조건에 해당하는 선수가 없습니다.
                  </div>
                ) : (
                  filteredAndSortedPlayers.map((p) => {
                    const teamTheme = (p.teamIdx !== undefined && p.teamIdx >= 0) ? TEAM_COLORS[p.teamIdx % TEAM_COLORS.length] : null;

                    return (
                      <div
                        key={p.id}
                        style={{
                          border: '1px solid var(--border)',
                          borderRadius: '10px',
                          padding: '12px 14px',
                          backgroundColor: '#fff',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}
                      >
                        {/* Player Header Row */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--txt)' }}>
                              👤 {p.name}
                            </span>
                            {p.isLeader && (
                              <span style={{ fontSize: '10px', backgroundColor: '#fef3c7', color: '#b45309', padding: '1px 5px', borderRadius: '4px', fontWeight: 800 }}>
                                👑 조장
                              </span>
                            )}
                            {p.gender && (
                              <span style={{ fontSize: '11px', color: p.gender === 'F' ? '#e11d48' : '#2563eb' }}>
                                ({p.gender === 'F' ? '여' : '남'})
                              </span>
                            )}
                            <span style={{ fontSize: '11px', color: 'var(--txt3)' }}>
                              NTRP {p.ntrp}
                            </span>
                            {p.teamName && (
                              <span style={{ 
                                fontSize: '11px', 
                                fontWeight: 700, 
                                backgroundColor: teamTheme ? teamTheme.bg : '#f1f5f9', 
                                color: teamTheme ? teamTheme.text : 'var(--navy)',
                                border: teamTheme ? `1px solid ${teamTheme.border}` : '1px solid #cbd5e1',
                                padding: '1px 6px',
                                borderRadius: '4px'
                              }}>
                                {p.teamName}
                              </span>
                            )}
                            {p.pairName && (
                              <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '1px 6px', borderRadius: '4px' }}>
                                👫 {p.pairName}
                              </span>
                            )}
                          </div>

                          {/* Game Count & Record Badges */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{
                              fontSize: '12px',
                              fontWeight: 800,
                              padding: '3px 10px',
                              borderRadius: '12px',
                              backgroundColor: p.totalGames > 0 ? '#eff6ff' : '#fef2f2',
                              color: p.totalGames > 0 ? '#1d4ed8' : '#dc2626',
                              border: p.totalGames > 0 ? '1px solid #bfdbfe' : '1px solid #fca5a5'
                            }}>
                              🔥 총 {p.totalGames}경기 출전
                              <span style={{ fontSize: '10.5px', fontWeight: 600, marginLeft: '4px', color: p.totalGames > 0 ? '#3b82f6' : '#ef4444' }}>
                                (완료 {p.completedCount} / 대기 {p.pendingCount})
                              </span>
                            </span>

                            {p.completedCount > 0 && (
                              <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: '#f1f5f9', color: '#334155', padding: '3px 8px', borderRadius: '8px' }}>
                                {p.wins}승 {p.draws > 0 ? `${p.draws}무 ` : ''}{p.losses}패 ({p.gameDiff > 0 ? `+${p.gameDiff}` : p.gameDiff})
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Matches List */}
                        {p.matches.length > 0 ? (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '6px', borderTop: '1px dashed #e2e8f0', paddingTop: '6px' }}>
                            {p.matches.map((m, mIdx) => (
                              <div
                                key={mIdx}
                                style={{
                                  padding: '6px 8px',
                                  borderRadius: '6px',
                                  backgroundColor: m.isFinished ? (m.result === 'win' ? '#f0fdf4' : m.result === 'loss' ? '#fef2f2' : '#f8fafc') : '#f8fafc',
                                  border: m.isFinished ? (m.result === 'win' ? '1px solid #bbf7d0' : m.result === 'loss' ? '1px solid #fecaca' : '1px solid #e2e8f0') : '1px solid #e2e8f0',
                                  fontSize: '11.5px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '2px'
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontWeight: 800, color: 'var(--navy)' }}>
                                    🎾 {m.courtName} {m.setIndex}세트
                                  </span>
                                  {m.isFinished ? (
                                    <span style={{ 
                                      fontWeight: 800, 
                                      fontSize: '11px',
                                      color: m.result === 'win' ? '#16a34a' : m.result === 'loss' ? '#dc2626' : '#64748b' 
                                    }}>
                                      {m.myScore} : {m.oppScore} ({m.result === 'win' ? '승' : m.result === 'loss' ? '패' : '무'})
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: '10.5px', color: '#2563eb', fontWeight: 700, backgroundColor: '#dbeafe', padding: '1px 5px', borderRadius: '4px' }}>
                                      ⏳ 대기중
                                    </span>
                                  )}
                                </div>
                                <div style={{ color: 'var(--txt2)', fontSize: '11px' }}>
                                  파트너: <strong>{m.partnerName}</strong>
                                  <span style={{ margin: '0 4px', color: '#cbd5e1' }}>|</span>
                                  상대: <strong>{m.opp1Name}{m.opp2Name && ` / ${m.opp2Name}`}</strong>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: '11.5px', color: '#dc2626', backgroundColor: '#fef2f2', padding: '6px 10px', borderRadius: '6px', border: '1px solid #fee2e2' }}>
                            ⚠️ 현재 배정된 경기가 없습니다.
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
              <button 
                type="button" 
                className="btn btn-secondary btn-sm" 
                onClick={() => setShowPlayerStatsModal(false)}
                style={{ fontWeight: 700, padding: '6px 18px' }}
              >
                닫기
              </button>
            </div>

          </div>
        </div>
      );
      return mounted && typeof document !== 'undefined' ? createPortal(modalEl, document.body) : modalEl;
    })()}
    </div>
  );
}

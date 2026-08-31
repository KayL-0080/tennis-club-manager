import { useState } from 'react';

export const TEAM_COLORS = [
  { bg: 'rgba(0, 122, 255, 0.08)', border: 'rgba(0, 122, 255, 0.35)', text: '#0062d2', badgeBg: '#007aff', tagBg: 'rgba(0, 122, 255, 0.15)', tagText: '#0062d2', glow: 'rgba(0, 122, 255, 0.25)' }, // 1조 (iOS Electric Blue)
  { bg: 'rgba(255, 59, 48, 0.08)', border: 'rgba(255, 59, 48, 0.35)', text: '#c53030', badgeBg: '#ff3b30', tagBg: 'rgba(255, 59, 48, 0.15)', tagText: '#c53030', glow: 'rgba(255, 59, 48, 0.25)' }, // 2조 (iOS Red)
  { bg: 'rgba(52, 199, 89, 0.08)', border: 'rgba(52, 199, 89, 0.35)', text: '#166534', badgeBg: '#34c759', tagBg: 'rgba(52, 199, 89, 0.15)', tagText: '#166534', glow: 'rgba(52, 199, 89, 0.25)' }, // 3조 (iOS Green)
  { bg: 'rgba(255, 149, 0, 0.08)', border: 'rgba(255, 149, 0, 0.35)', text: '#c05621', badgeBg: '#ff9500', tagBg: 'rgba(255, 149, 0, 0.15)', tagText: '#c05621', glow: 'rgba(255, 149, 0, 0.25)' }, // 4조 (iOS Amber)
  { bg: 'rgba(175, 82, 222, 0.08)', border: 'rgba(175, 82, 222, 0.35)', text: '#6b21a8', badgeBg: '#af52de', tagBg: 'rgba(175, 82, 222, 0.15)', tagText: '#6b21a8', glow: 'rgba(175, 82, 222, 0.25)' }, // 5조 (iOS Purple)
  { bg: 'rgba(255, 45, 85, 0.08)', border: 'rgba(255, 45, 85, 0.35)', text: '#be185d', badgeBg: '#ff2d55', tagBg: 'rgba(255, 45, 85, 0.15)', tagText: '#be185d', glow: 'rgba(255, 45, 85, 0.25)' }, // 6조 (iOS Pink)
  { bg: 'rgba(0, 199, 190, 0.08)', border: 'rgba(0, 199, 190, 0.35)', text: '#0f766e', badgeBg: '#00c7be', tagBg: 'rgba(0, 199, 190, 0.15)', tagText: '#0f766e', glow: 'rgba(0, 199, 190, 0.25)' }, // 7조 (iOS Mint/Teal)
  { bg: 'rgba(99, 99, 102, 0.08)', border: 'rgba(99, 99, 102, 0.35)', text: '#3a3a3c', badgeBg: '#636366', tagBg: 'rgba(99, 99, 102, 0.15)', tagText: '#3a3a3c', glow: 'rgba(99, 99, 102, 0.25)' }, // 8조 (iOS Gray)
];

export default function PickingPhase({ tournament, members, onUpdate, isAdmin }) {
  const { type, attendees } = tournament;
  const byId = {};
  members.forEach(m => byId[m.id] = m);

  const [teams, setTeams] = useState(tournament.teams || []);
  const [lineupModalTeamIdx, setLineupModalTeamIdx] = useState(null);

  // NTRP 높은 순 -> 남자 우선 -> 해당 그룹 내 랜덤 선발 헬퍼
  const getNextRankedRandomPlayer = (unassignedIds) => {
    if (!unassignedIds || unassignedIds.length === 0) return null;

    const pool = unassignedIds.map(id => byId[id] || { id, name: '', ntrp: 2.0, gender: 'M' });

    // 1. 미배정 인원 중 최고 NTRP 확인
    const maxNtrp = Math.max(...pool.map(m => (typeof m.ntrp === 'number' ? m.ntrp : parseFloat(m.ntrp) || 2.0)));

    // 2. 최고 NTRP 그룹 필터링
    const topNtrpPlayers = pool.filter(m => (typeof m.ntrp === 'number' ? m.ntrp : parseFloat(m.ntrp) || 2.0) === maxNtrp);

    // 3. 최고 NTRP 그룹 내 남자(M) 우선, 없으면 여자(F)
    const topMales = topNtrpPlayers.filter(m => m.gender === 'M');
    const targetTier = topMales.length > 0 ? topMales : topNtrpPlayers.filter(m => m.gender === 'F');
    const finalCandidates = targetTier.length > 0 ? targetTier : topNtrpPlayers;

    // 4. 해당 최우선 그룹 내에서 무작위 1명 선발
    const chosen = finalCandidates[Math.floor(Math.random() * finalCandidates.length)];
    return chosen.id;
  };

  const pickRandomPlayer = (teamIndex) => {
    const unassigned = attendees.filter(aid => !teams.some(t => t.players.includes(aid)));
    if (unassigned.length === 0) {
      alert('더 이상 배정할 선수가 없습니다.');
      return;
    }
    const chosenId = getNextRankedRandomPlayer(unassigned);
    if (!chosenId) return;
    assignPlayerToTeam(chosenId, teamIndex);
  };

  const assignPlayerToTeam = (memberId, teamIndex) => {
    const newTeams = [...teams];
    newTeams.forEach(t => {
      // If we remove player from team, clear any lineups they were in
      if (t.players.includes(memberId) && teamIndex !== teams.indexOf(t)) {
        t.players = t.players.filter(id => id !== memberId);
        if (t.lineups) {
          Object.keys(t.lineups).forEach(g => {
            if (t.lineups[g].player1 === memberId) t.lineups[g].player1 = '';
            if (t.lineups[g].player2 === memberId) t.lineups[g].player2 = '';
          });
        }
      }
    });
    if (teamIndex !== -1) {
      const targetTeam = newTeams[teamIndex];
      if (!targetTeam.players.includes(memberId)) {
        targetTeam.players.push(memberId);
      }
    }
    setTeams(newTeams);
  };

  const handleBatchRandomAssign = () => {
    if (!isAdmin) return;
    let unassigned = attendees.filter(aid => !teams.some(t => t.players.includes(aid)));
    if (unassigned.length === 0) {
      alert('이미 모든 선수가 배정되었습니다.');
      return;
    }

    const newTeams = teams.map(t => ({ ...t, players: [...t.players] }));

    while (unassigned.length > 0) {
      const chosenId = getNextRankedRandomPlayer(unassigned);
      if (!chosenId) break;

      // 현재 팀원 수가 가장 적은 팀에 배정 (균등 분배)
      newTeams.sort((a, b) => a.players.length - b.players.length);
      newTeams[0].players.push(chosenId);

      // 배정된 선수 제거
      unassigned = unassigned.filter(id => id !== chosenId);
    }

    // 원래 팀 순서로 복원
    newTeams.sort((a, b) => {
      return teams.findIndex(t => t.id === a.id) - teams.findIndex(t => t.id === b.id);
    });

    setTeams(newTeams);
  };

  const handleBatchReset = () => {
    if (!isAdmin) return;
    if (!confirm('모든 조의 배정 선수를 초기화하고 조장만 남기시겠습니까?')) return;
    
    const newTeams = teams.map(t => {
      return {
        ...t,
        players: t.captain ? [t.captain] : [],
        lineups: {}
      };
    });
    setTeams(newTeams);
  };

  const triggerModalAutoComplete = () => {
    if (lineupModalTeamIdx === null) return;
    const roster = teams[lineupModalTeamIdx].players;
    if (roster.length < 2) {
      alert('팀원이 최소 2명 이상이어야 대진을 짤 수 있습니다.');
      return;
    }
    const newTeams = [...teams];
    const gamesCount = tournament.gamesPerTeam || 3;
    
    const lineups = {};
    const playCounts = {};
    roster.forEach(pid => playCounts[pid] = 0);
    
    for (let g = 1; g <= gamesCount; g++) {
      const sorted = [...roster].sort((a, b) => {
        if (playCounts[a] !== playCounts[b]) {
          return playCounts[a] - playCounts[b];
        }
        return Math.random() - 0.5;
      });
      const p1 = sorted[0];
      const p2 = sorted[1];
      lineups[g] = { player1: p1, player2: p2 };
      playCounts[p1]++;
      playCounts[p2]++;
    }
    newTeams[lineupModalTeamIdx].lineups = lineups;
    setTeams(newTeams);
  };

  const generateTournamentSchedule = (teams, courtDetails, gamesCount) => {
    const teamIds = teams.map(t => t.id);
    const N = teamIds.length;
    const maxSets = Math.max(...courtDetails.map(c => c.games || 2));
    const numCourts = courtDetails.length;

    if (N < 2 || numCourts === 0) {
      const emptyMatches = [];
      for (let s = 1; s <= maxSets; s++) {
        courtDetails.forEach((court, cIdx) => {
          if (s <= (court.games || 2)) {
            const courtId = court.id || `c-${cIdx + 1}`;
            emptyMatches.push({
              id: `court-${courtId}-set-${s}`,
              court: court.name,
              courtId,
              setIndex: s,
              teamAId: '',
              teamBId: '',
              playerA1: null,
              playerA2: null,
              playerB1: null,
              playerB2: null,
              scoreA: null,
              scoreB: null
            });
          }
        });
      }
      return emptyMatches;
    }

    // 1. Generate all pairs among teams
    const allPairs = [];
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        allPairs.push([teamIds[i], teamIds[j]]);
      }
    }

    const teamPlayCount = {};
    const teamAppearanceCount = {};
    teamIds.forEach(id => {
      teamPlayCount[id] = 0;
      teamAppearanceCount[id] = 0;
    });

    const pairCount = {};
    allPairs.forEach(([t1, t2]) => {
      pairCount[`${t1}_${t2}`] = 0;
    });

    const slotMatches = {};

    // 2. Assign matches set-by-set across all active courts
    for (let s = 1; s <= maxSets; s++) {
      const playersPlayingInThisSet = new Set();
      const teamsPlayingInThisSet = new Set();
      const activeCourtsInSet = courtDetails.filter(c => s <= (c.games || 2));

      for (let cIdx = 0; cIdx < activeCourtsInSet.length; cIdx++) {
        const court = activeCourtsInSet[cIdx];
        const courtId = court.id || `c-${cIdx + 1}`;

        // Check if all teams have finished their gamesCount
        const allFinished = teamIds.every(id => teamPlayCount[id] >= gamesCount);
        if (allFinished) break;

        const validPairs = [];

        for (const [tA, tB] of allPairs) {
          if (teamPlayCount[tA] >= gamesCount && teamPlayCount[tB] >= gamesCount) continue;

          const nextIdxA = (teamAppearanceCount[tA] % gamesCount) + 1;
          const nextIdxB = (teamAppearanceCount[tB] % gamesCount) + 1;

          const teamAObj = teams.find(t => t.id === tA);
          const teamBObj = teams.find(t => t.id === tB);

          const luA = teamAObj?.lineups?.[nextIdxA] || {};
          const luB = teamBObj?.lineups?.[nextIdxB] || {};

          const pA1 = luA.player1;
          const pA2 = luA.player2;
          const pB1 = luB.player1;
          const pB2 = luB.player2;

          // Check if any individual player is already scheduled in set s
          let playerConflict = false;
          if (pA1 && playersPlayingInThisSet.has(pA1)) playerConflict = true;
          if (pA2 && playersPlayingInThisSet.has(pA2)) playerConflict = true;
          if (pB1 && playersPlayingInThisSet.has(pB1)) playerConflict = true;
          if (pB2 && playersPlayingInThisSet.has(pB2)) playerConflict = true;

          // If no lineup players or not enough players, check team conflict
          const rosterA = teamAObj?.players || [];
          const rosterB = teamBObj?.players || [];
          if ((!pA1 && !pA2) && rosterA.length < 4 && teamsPlayingInThisSet.has(tA)) playerConflict = true;
          if ((!pB1 && !pB2) && rosterB.length < 4 && teamsPlayingInThisSet.has(tB)) playerConflict = true;

          if (playerConflict) continue;

          const pKey = `${tA}_${tB}`;
          const pCount = pairCount[pKey] || 0;
          const combinedPlays = (teamPlayCount[tA] || 0) + (teamPlayCount[tB] || 0);
          const minTeamPlays = Math.min(teamPlayCount[tA] || 0, teamPlayCount[tB] || 0);

          validPairs.push({
            tA,
            tB,
            pKey,
            pCount,
            minTeamPlays,
            combinedPlays,
            pA1,
            pA2,
            pB1,
            pB2,
            luA,
            luB
          });
        }

        if (validPairs.length === 0) {
          // If strict player overlap prevented matching, try any available pair not yet maxed out
          const fallbackPairs = [];
          for (const [tA, tB] of allPairs) {
            if (teamPlayCount[tA] >= gamesCount && teamPlayCount[tB] >= gamesCount) continue;
            const pKey = `${tA}_${tB}`;
            fallbackPairs.push({
              tA,
              tB,
              pKey,
              pCount: pairCount[pKey] || 0,
              minTeamPlays: Math.min(teamPlayCount[tA] || 0, teamPlayCount[tB] || 0),
              combinedPlays: (teamPlayCount[tA] || 0) + (teamPlayCount[tB] || 0)
            });
          }
          if (fallbackPairs.length > 0) {
            fallbackPairs.sort((a, b) => {
              if (a.pCount !== b.pCount) return a.pCount - b.pCount;
              if (a.minTeamPlays !== b.minTeamPlays) return a.minTeamPlays - b.minTeamPlays;
              return a.combinedPlays - b.combinedPlays;
            });
            const fallback = fallbackPairs[0];
            const { tA, tB, pKey } = fallback;

            teamPlayCount[tA]++;
            teamPlayCount[tB]++;
            pairCount[pKey] = (pairCount[pKey] || 0) + 1;

            const idxA = teamAppearanceCount[tA]++;
            const idxB = teamAppearanceCount[tB]++;

            const teamAObj = teams.find(t => t.id === tA);
            const teamBObj = teams.find(t => t.id === tB);

            const luA = teamAObj?.lineups?.[(idxA % gamesCount) + 1] || {};
            const luB = teamBObj?.lineups?.[(idxB % gamesCount) + 1] || {};

            slotMatches[`${courtId}_${s}`] = {
              id: `court-${courtId}-set-${s}`,
              court: court.name,
              courtId,
              setIndex: s,
              teamAId: tA,
              teamBId: tB,
              playerA1: luA.player1 || null,
              playerA2: luA.player2 || null,
              playerB1: luB.player1 || null,
              playerB2: luB.player2 || null,
              scoreA: null,
              scoreB: null
            };
            continue;
          }
          break;
        }

        // Sort to prioritize least played pairs and teams with fewest matches
        validPairs.sort((a, b) => {
          if (a.pCount !== b.pCount) return a.pCount - b.pCount;
          if (a.minTeamPlays !== b.minTeamPlays) return a.minTeamPlays - b.minTeamPlays;
          if (a.combinedPlays !== b.combinedPlays) return a.combinedPlays - b.combinedPlays;
          return 0;
        });

        const bestPair = validPairs[0];
        const { tA, tB, pKey, pA1, pA2, pB1, pB2 } = bestPair;

        if (pA1) playersPlayingInThisSet.add(pA1);
        if (pA2) playersPlayingInThisSet.add(pA2);
        if (pB1) playersPlayingInThisSet.add(pB1);
        if (pB2) playersPlayingInThisSet.add(pB2);
        teamsPlayingInThisSet.add(tA);
        teamsPlayingInThisSet.add(tB);

        teamPlayCount[tA]++;
        teamPlayCount[tB]++;
        pairCount[pKey] = (pairCount[pKey] || 0) + 1;

        const idxA = teamAppearanceCount[tA]++;
        const idxB = teamAppearanceCount[tB]++;

        const teamAObj = teams.find(t => t.id === tA);
        const teamBObj = teams.find(t => t.id === tB);

        const luA = teamAObj?.lineups?.[(idxA % gamesCount) + 1] || {};
        const luB = teamBObj?.lineups?.[(idxB % gamesCount) + 1] || {};

        slotMatches[`${courtId}_${s}`] = {
          id: `court-${courtId}-set-${s}`,
          court: court.name,
          courtId,
          setIndex: s,
          teamAId: tA,
          teamBId: tB,
          playerA1: luA.player1 || null,
          playerA2: luA.player2 || null,
          playerB1: luB.player1 || null,
          playerB2: luB.player2 || null,
          scoreA: null,
          scoreB: null
        };
      }
    }

    // 3. Build final match list for all court sets
    const finalMatches = [];
    for (let s = 1; s <= maxSets; s++) {
      courtDetails.forEach((court, cIdx) => {
        if (s <= (court.games || 2)) {
          const courtId = court.id || `c-${cIdx + 1}`;
          const existing = slotMatches[`${courtId}_${s}`];
          if (existing) {
            finalMatches.push(existing);
          } else {
            finalMatches.push({
              id: `court-${courtId}-set-${s}`,
              court: court.name,
              courtId,
              setIndex: s,
              teamAId: '',
              teamBId: '',
              playerA1: null,
              playerA2: null,
              playerB1: null,
              playerB2: null,
              scoreA: null,
              scoreB: null
            });
          }
        }
      });
    }

    return finalMatches;
  };

  const finalizeTeamDraft = async () => {
    if (!isAdmin) return;
    const assignedCount = teams.reduce((acc, t) => acc + t.players.length, 0);
    if (assignedCount < attendees.length) {
      if (!confirm('아직 배정되지 않은 선수가 있습니다. 이대로 진행하시겠습니까?')) return;
    }
    
    const gamesCount = tournament.gamesPerTeam || 3;
    
    // Exactly respect the court settings configured in Step 1
    const courtDetails = tournament.courtDetails || [
      { id: 'c1', name: '1코트', games: 2 },
      { id: 'c2', name: '2코트', games: 2 }
    ];
    
    const newCourtSets = {};
    courtDetails.forEach((court, cIdx) => {
      newCourtSets[court.id || `c-${cIdx+1}`] = court.games || 2;
    });

    const matches = generateTournamentSchedule(teams, courtDetails, gamesCount);

    await onUpdate({ 
      teams, 
      matches, 
      status: 'playing', 
      courtDetails, 
      courtSets: newCourtSets,
      gamesPerTeam: gamesCount 
    });
  };

  const [indRounds, setIndRounds] = useState(tournament.gamesPerTeam || 4);
  const generateIndividualMatches = async () => {
    if (!isAdmin) return;
    
    const attMembers = attendees.map(id => byId[id]).filter(Boolean);
    attMembers.sort((a, b) => (b.ntrp || 0) - (a.ntrp || 0));

    const matches = [];
    
    for (let r = 0; r < indRounds; r++) {
        const pool = [...attMembers].sort(() => Math.random() - 0.5);
        const top = pool.slice(0, Math.ceil(pool.length / 2));
        const bot = pool.slice(Math.ceil(pool.length / 2));
        
        const pairs = [];
        for (let i = 0; i < Math.min(top.length, bot.length); i++) {
           pairs.push([top[i].id, bot[i].id]);
        }
        if (top.length > bot.length) pairs.push([top[top.length-1].id, null]);

        for (let i = 0; i < pairs.length - 1; i += 2) {
            matches.push({
                id: `r${r}-m${i/2}`,
                round: r + 1,
                type: 'individual',
                playerA1: pairs[i][0],
                playerA2: pairs[i][1],
                playerB1: pairs[i+1][0],
                playerB2: pairs[i+1][1],
                scoreA: null,
                scoreB: null
            });
        }
    }
    await onUpdate({ matches, status: 'playing' });
  };

  const unassignedPlayers = attendees.filter(aid => !teams.some(t => t.players.includes(aid)));

  const isLineupComplete = (team) => {
    if (!team.lineups) return false;
    const gamesCount = tournament.gamesPerTeam || 3;
    for (let g = 1; g <= gamesCount; g++) {
      if (!team.lineups[g] || !team.lineups[g].player1 || !team.lineups[g].player2) {
        return false;
      }
    }
    return true;
  };

  const allLineupsComplete = teams.length > 0 && teams.every(isLineupComplete);

  return (
    <div className="card" style={{ padding: '20px' }}>
      <h2 style={{ marginTop: 0, color: 'var(--navy)', fontSize: '18px' }}>3단계. {type === 'team' ? '팀원 배정 및 선수 구성' : '매치(대진표) 생성'}</h2>
      
      {type === 'team' && (
        <>
          {teams.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center' }}>
               <p style={{ color: 'var(--red)', fontWeight: 'bold', marginBottom: '16px' }}>1단계(명단 확정)에서 조장이 지정되지 않았습니다.</p>
               <button className="btn btn-secondary btn-sm" onClick={() => onUpdate({ status: 'draft' })}>👈 1단계로 돌아가서 조장 지정</button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
                  1단계에서 지정된 조장 중심으로 팀원 배정 후, 각 조별로 <strong>{tournament.gamesPerTeam || 3}경기</strong>의 출전 선수 명단을 설정하세요.
                </p>
                {isAdmin && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button 
                      className="btn btn-secondary btn-sm" 
                      style={{ background: '#e0f2fe', color: '#0369a1', borderColor: '#7dd3fc' }}
                      onClick={handleBatchRandomAssign}
                    >
                      🎲 일괄 랜덤 배정
                    </button>
                    <button 
                      className="btn btn-secondary btn-sm" 
                      style={{ background: '#fee2e2', color: '#b91c1c', borderColor: '#fca5a5' }}
                      onClick={handleBatchReset}
                    >
                      🔄 일괄 초기화
                    </button>
                    <button 
                      className="btn btn-secondary btn-sm" 
                      onClick={() => {
                        const gamesCount = tournament.gamesPerTeam || 3;
                        const newTeams = teams.map(t => {
                          const roster = t.players;
                          if (roster.length < 2) return t;
                          
                          const lineups = {};
                          const playCounts = {};
                          roster.forEach(pid => playCounts[pid] = 0);
                          
                          for (let g = 1; g <= gamesCount; g++) {
                            const sorted = [...roster].sort((a, b) => {
                              if (playCounts[a] !== playCounts[b]) {
                                return playCounts[a] - playCounts[b];
                              }
                              return Math.random() - 0.5;
                            });
                            const p1 = sorted[0];
                            const p2 = sorted[1];
                            lineups[g] = { player1: p1, player2: p2 };
                            playCounts[p1]++;
                            playCounts[p2]++;
                          }
                          return { ...t, lineups };
                        });
                        setTeams(newTeams);
                      }}
                    >
                      🎲 모든 조 대진 자동 완성
                    </button>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
                {teams.map((t, tIdx) => {
                  const completed = isLineupComplete(t);
                  const colorTheme = TEAM_COLORS[tIdx % TEAM_COLORS.length];
                  return (
                    <div 
                      key={t.id} 
                      style={{ 
                        flex: '1 1 220px', 
                        border: `2px solid ${colorTheme.border}`, 
                        borderRadius: '12px', 
                        padding: '14px', 
                        backgroundColor: colorTheme.bg,
                        boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
                      }}
                    >
                      <input 
                        type="text" 
                        className="input input-sm" 
                        style={{ 
                          width: '100%', 
                          marginBottom: '8px', 
                          fontWeight: '800', 
                          borderColor: colorTheme.border,
                          color: colorTheme.text,
                          backgroundColor: '#fff'
                        }} 
                        value={t.name} 
                        onChange={e => {
                          const newTeams = [...teams];
                          newTeams[tIdx].name = e.target.value;
                          setTeams(newTeams);
                        }} 
                      />
                      
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--txt3)', fontWeight: 'bold', marginBottom: '2px' }}>조장 (Captain)</div>
                        <div style={{ padding: '6px 10px', background: '#fff', color: colorTheme.text, borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', border: `1px solid ${colorTheme.border}` }}>
                          👑 {t.captain ? byId[t.captain]?.name : '미지정'}
                        </div>
                      </div>

                      <div style={{ marginBottom: '12px' }}>
                        <button
                          className="btn btn-sm"
                          style={{
                            width: '100%',
                            padding: '7px 10px',
                            backgroundColor: completed ? '#16a34a' : '#dc2626',
                            color: '#ffffff',
                            border: 'none',
                            boxShadow: completed ? '0 2px 8px rgba(22,163,74,0.3)' : '0 2px 8px rgba(220,38,38,0.3)',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            borderRadius: '8px'
                          }}
                          onClick={() => setLineupModalTeamIdx(tIdx)}
                        >
                          {completed ? '✅ 출전 명단 완료' : '⚠️ 출전 명단 설정 필요'}
                        </button>
                      </div>
                      
                      <div style={{ marginBottom: '8px' }}>
                        <button 
                          className="btn btn-sm" 
                          style={{ 
                            width: '100%',
                            backgroundColor: colorTheme.badgeBg,
                            color: '#fff',
                            border: 'none',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                          }} 
                          onClick={() => pickRandomPlayer(tIdx)}
                        >
                          🎲 랜덤 뽑기
                        </button>
                      </div>

                      <div style={{ minHeight: '90px', border: `1px dashed ${colorTheme.border}`, padding: '8px', backgroundColor: '#fff', borderRadius: '8px' }}>
                        <p style={{ fontSize: '11px', color: 'var(--txt3)', margin: '0 0 6px 0' }}>팀원 명단 <span style={{ fontSize: '9px' }}>(클릭 시 제거)</span></p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {t.players.map(pid => (
                             <div key={pid} 
                                  onClick={() => {
                                     if(isAdmin) {
                                        if (t.captain === pid) {
                                           alert('조장은 팀에서 제외할 수 없습니다. 조장 해제는 1단계에서 가능합니다.');
                                           return;
                                        }
                                        if (confirm(`${byId[pid]?.name} 선수를 제외하시겠습니까?`)) {
                                           assignPlayerToTeam(pid, -1);
                                        }
                                     }
                                  }}
                                  style={{ 
                                    display: 'inline-flex', 
                                    alignItems: 'center',
                                    background: t.captain === pid ? colorTheme.tagBg : colorTheme.badgeBg, 
                                    color: t.captain === pid ? colorTheme.tagText : '#fff', 
                                    border: t.captain === pid ? `1px solid ${colorTheme.border}` : 'none',
                                    padding: '3px 8px', 
                                    borderRadius: '12px', 
                                    fontSize: '12px', 
                                    cursor: (isAdmin && t.captain !== pid) ? 'pointer' : 'default',
                                    fontWeight: 'bold'
                                  }}>
                               {byId[pid]?.name}
                               {t.captain === pid && ' 👑'}
                             </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: '24px', backgroundColor: '#f1f5f9', padding: '16px', borderRadius: '8px' }}>
                <h3 style={{ fontSize: '14px', marginTop: 0, marginBottom: '10px' }}>미배정 선수 ({unassignedPlayers.length}명)</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {unassignedPlayers.map(aid => (
                     <div key={aid} style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#fff' }}>
                        <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{byId[aid]?.name}</span>
                        <select className="input input-sm" style={{ width: '80px', padding: '2px 4px' }} onChange={e => assignPlayerToTeam(aid, parseInt(e.target.value))}>
                          <option value="-1">배정</option>
                          {teams.map((t, i) => <option key={t.id} value={i}>{t.name}</option>)}
                        </select>
                     </div>
                  ))}
                  {unassignedPlayers.length === 0 && (
                    <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>모든 참가자가 배정되었습니다.</span>
                  )}
                </div>
              </div>

              <div style={{ marginTop: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button className="btn btn-secondary" onClick={() => onUpdate({ status: 'draft' })}>👈 이전 (조장 재조정)</button>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <button 
                      className="btn btn-primary" 
                      onClick={finalizeTeamDraft}
                      disabled={!allLineupsComplete}
                      style={{
                        opacity: allLineupsComplete ? 1 : 0.5,
                        cursor: allLineupsComplete ? 'pointer' : 'not-allowed'
                      }}
                    >
                      팀 구성 완료 🚀
                    </button>
                    {!allLineupsComplete && (
                      <span style={{ color: 'var(--red)', fontSize: '12px', marginTop: '6px' }}>
                        ⚠️ 모든 조의 출전 명단(대진) 설정이 완료되어야 합니다.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {type === 'individual' && (
        <>
          <p style={{ color: 'var(--text-muted)' }}>
             개인전은 NTRP 실력을 고려하여 상위 그룹과 하위 그룹을 나눈 뒤, 각 라운드마다 무작위로 파트너를 지정합니다.
          </p>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap' }}>
            <label style={{ fontWeight: 'bold' }}>진행할 개인별 경기수 (라운드):</label>
            <input type="number" min="1" max="16" className="input input-sm" style={{ width: '70px', textAlign: 'center' }} value={indRounds} onChange={e => setIndRounds(parseInt(e.target.value) || 4)} />
            <span style={{ fontSize: '12px', color: 'var(--txt3)' }}>(1단계 추천: {tournament.gamesPerTeam || 4}경기)</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button className="btn btn-secondary" onClick={() => onUpdate({ status: 'draft' })}>👈 이전</button>
            <button className="btn btn-primary" onClick={generateIndividualMatches}>매치 생성 및 시작</button>
          </div>
        </>
      )}

      {/* Lineup modal */}
      {lineupModalTeamIdx !== null && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '12px',
            padding: '20px',
            width: '100%',
            maxWidth: '450px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px', color: 'var(--navy)' }}>
              👑 {teams[lineupModalTeamIdx].name} 출전 명단 설정
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              각 경기(게임)마다 출전할 복식 페어 2명을 지정해주세요.
            </p>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginBottom: '16px' }}>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={triggerModalAutoComplete}
              >
                🎲 자동 완성
              </button>
              <button 
                className="btn btn-primary btn-sm" 
                onClick={() => setLineupModalTeamIdx(null)}
              >
                확정 및 닫기
              </button>
            </div>

            {(() => {
              const currentTeam = teams[lineupModalTeamIdx];
              const roster = currentTeam.players || [];
              const gamesCount = tournament.gamesPerTeam || 3;
              
              const stats = {};
              roster.forEach(pid => stats[pid] = 0);
              
              for (let g = 1; g <= gamesCount; g++) {
                const lu = currentTeam.lineups?.[g] || {};
                if (lu.player1) stats[lu.player1] = (stats[lu.player1] || 0) + 1;
                if (lu.player2) stats[lu.player2] = (stats[lu.player2] || 0) + 1;
              }

              return (
                <div style={{ 
                  marginBottom: '16px', 
                  padding: '10px 12px', 
                  backgroundColor: '#f0fdf4', 
                  border: '1px solid #bbf7d0', 
                  borderRadius: '8px', 
                  fontSize: '12px' 
                }}>
                  <strong style={{ display: 'block', marginBottom: '6px', color: '#166534' }}>📊 선수별 출전 횟수 현황:</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {roster.map(pid => (
                      <span key={pid} style={{ backgroundColor: '#fff', padding: '2px 6px', borderRadius: '4px', border: '1px solid #dcfce7', fontWeight: 'bold', color: '#1b5e20' }}>
                        {byId[pid]?.name || '알수없음'}: {stats[pid]}경기
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {Array.from({ length: tournament.gamesPerTeam || 3 }).map((_, idx) => {
                const gameNum = idx + 1;
                const currentLineup = teams[lineupModalTeamIdx].lineups?.[gameNum] || { player1: '', player2: '' };
                
                return (
                  <div key={gameNum} style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: '8px', backgroundColor: '#f8fafc' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: 'var(--navy)' }}>{gameNum}경기 출전 페어</h4>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select
                        className="input input-sm"
                        style={{ flex: 1 }}
                        value={currentLineup.player1 || ''}
                        onChange={e => {
                          const newTeams = [...teams];
                          if (!newTeams[lineupModalTeamIdx].lineups) newTeams[lineupModalTeamIdx].lineups = {};
                          newTeams[lineupModalTeamIdx].lineups[gameNum] = {
                            ...newTeams[lineupModalTeamIdx].lineups[gameNum],
                            player1: e.target.value
                          };
                          setTeams(newTeams);
                        }}
                      >
                        <option value="">선수 1</option>
                        {teams[lineupModalTeamIdx].players.map(pid => (
                          <option key={pid} value={pid}>{byId[pid]?.name}</option>
                        ))}
                      </select>
                      
                      <select
                        className="input input-sm"
                        style={{ flex: 1 }}
                        value={currentLineup.player2 || ''}
                        onChange={e => {
                          const newTeams = [...teams];
                          if (!newTeams[lineupModalTeamIdx].lineups) newTeams[lineupModalTeamIdx].lineups = {};
                          newTeams[lineupModalTeamIdx].lineups[gameNum] = {
                            ...newTeams[lineupModalTeamIdx].lineups[gameNum],
                            player2: e.target.value
                          };
                          setTeams(newTeams);
                        }}
                      >
                        <option value="">선수 2</option>
                        {teams[lineupModalTeamIdx].players.map(pid => (
                          <option key={pid} value={pid}>{byId[pid]?.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

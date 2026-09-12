import { useState, useMemo } from 'react';
import { TEAM_COLORS } from './PickingPhase';

export default function CompletedPhase({ tournament, members, onUpdate, isAdmin }) {
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

  const [playerStatsSearch, setPlayerStatsSearch] = useState('');
  const [playerStatsSort, setPlayerStatsSort] = useState('games_desc');
  const [playerStatsFilterTeam, setPlayerStatsFilterTeam] = useState('ALL');

  const teamStats = useMemo(() => {
    if (type !== 'team') return [];
    const stats = {};
    teams.forEach(t => stats[t.id] = { ...t, matchWin: 0, matchDraw: 0, matchLoss: 0, setWin: 0, setLoss: 0, points: 0 });

    (matches || []).forEach(m => {
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
  }, [matches, teams, type]);

  const indStats = useMemo(() => {
    if (type !== 'individual') return [];
    const stats = {};
    const ensure = (id) => {
      if (!id) return null;
      if (!stats[id]) stats[id] = { id, name: byId[id]?.name || '알수없음', win: 0, draw: 0, loss: 0, points: 0, diff: 0 };
      return stats[id];
    };

    (matches || []).forEach(m => {
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
  }, [matches, type, byId]);

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

    (matches || []).forEach(m => {
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
  }, [matches, tournament.pairs, type, byId]);

  // 📊 각 선수별 출전 경기수 및 상세 전적 집계
  const allPlayerStats = useMemo(() => {
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

    (matches || []).forEach(m => {
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

    const list = Array.from(participantsMap.values()).map(p => {
      const pid = p.id;
      const assignedMatches = [];
      let completedCount = 0;
      let wins = 0;
      let draws = 0;
      let losses = 0;
      let pointsScored = 0;
      let pointsAllowed = 0;

      (matches || []).forEach(m => {
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
          const isFinished = m.scoreA !== null && m.scoreB !== null;
          const myScore = isFinished ? (isSideA ? m.scoreA : m.scoreB) : null;
          const oppScore = isFinished ? (isSideA ? m.scoreB : m.scoreA) : null;

          let result = null;
          if (isFinished) {
            completedCount++;
            pointsScored += myScore;
            pointsAllowed += oppScore;
            if (myScore > oppScore) { wins++; result = 'win'; }
            else if (myScore < oppScore) { losses++; result = 'loss'; }
            else { draws++; result = 'draw'; }
          }

          assignedMatches.push({
            courtName,
            setIndex,
            isFinished,
            myScore,
            oppScore,
            result,
            partnerName: byId[partnerId]?.name || (partnerId ? '파트너' : '미정'),
            opp1Name: byId[opp1Id]?.name || (opp1Id ? '상대1' : '미정'),
            opp2Name: byId[opp2Id]?.name || (opp2Id ? '상대2' : '미정')
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

    return list;
  }, [type, teams, tournament.pairs, tournament.attendees, matches, byId, tournament.courtDetails]);

  // Filtered & Sorted players for CompletedPhase
  const filteredPlayers = useMemo(() => {
    let list = [...allPlayerStats];

    if (playerStatsFilterTeam !== 'ALL') {
      list = list.filter(p => p.teamId === playerStatsFilterTeam);
    }

    if (playerStatsSearch.trim()) {
      const q = playerStatsSearch.trim().toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      if (playerStatsSort === 'games_desc') {
        if (b.totalGames !== a.totalGames) return b.totalGames - a.totalGames;
        return (a.name || '').localeCompare(b.name || '');
      } else if (playerStatsSort === 'winrate_desc') {
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        if (b.wins !== a.wins) return b.wins - a.wins;
        return (a.name || '').localeCompare(b.name || '');
      } else if (playerStatsSort === 'name_asc') {
        return (a.name || '').localeCompare(b.name || '');
      }
      return 0;
    });

    return list;
  }, [allPlayerStats, playerStatsFilterTeam, playerStatsSearch, playerStatsSort]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 🏆 최종 대회 순위 카드 */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, color: 'var(--navy)', fontSize: '18px' }}>🏆 최종 대회 결과</h2>
          {isAdmin && (
            <button className="btn btn-secondary btn-sm" onClick={() => {
              if (confirm('대회 종료를 취소하시겠습니까?')) onUpdate({ status: 'playing' });
            }}>👈 이전</button>
          )}
        </div>
        
        {type === 'team' && (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', textAlign: 'center', minWidth: '400px' }}>
              <thead>
                <tr>
                  <th>순위</th>
                  <th>팀</th>
                  <th>점수</th>
                  <th>전적</th>
                  <th>세트득실</th>
                </tr>
              </thead>
              <tbody>
                {teamStats.map((t, idx) => (
                  <tr key={t.id} style={{ fontWeight: idx === 0 ? 800 : 500, backgroundColor: idx === 0 ? 'rgba(212, 160, 23, 0.12)' : 'transparent' }}>
                    <td>{idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : idx + 1}</td>
                    <td style={{ fontWeight: 700 }}>{t.name}</td>
                    <td style={{ color: 'var(--blue)', fontWeight: 800 }}>{t.points}</td>
                    <td>{t.matchWin}승 {t.matchDraw}무 {t.matchLoss}패</td>
                    <td>{t.setWin > t.setLoss ? '+' : ''}{t.setWin - t.setLoss} ({t.setWin}승 {t.setLoss}패)</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {type === 'individual' && (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', textAlign: 'center', minWidth: '350px' }}>
              <thead>
                <tr>
                  <th>순위</th>
                  <th>이름</th>
                  <th>점수</th>
                  <th>전적</th>
                  <th>득실</th>
                </tr>
              </thead>
              <tbody>
                {indStats.map((p, idx) => (
                  <tr key={p.id} style={{ 
                    fontWeight: idx < 3 ? 800 : 500, 
                    backgroundColor: idx === 0 ? 'rgba(212, 160, 23, 0.12)' : idx === 1 ? 'rgba(148, 163, 184, 0.12)' : idx === 2 ? 'rgba(180, 83, 9, 0.1)' : 'transparent' 
                  }}>
                    <td>{idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : idx + 1}</td>
                    <td style={{ fontWeight: 700 }}>{p.name}</td>
                    <td style={{ color: 'var(--blue)', fontWeight: 800 }}>{p.points}</td>
                    <td>{p.win}승 {p.draw}무 {p.loss}패</td>
                    <td>{p.diff > 0 ? '+' : ''}{p.diff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {type === 'fixed_pair' && (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', textAlign: 'center', minWidth: '400px' }}>
              <thead>
                <tr>
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
                  <tr key={p.id} style={{ 
                    fontWeight: idx < 3 ? 800 : 500, 
                    backgroundColor: idx === 0 ? 'rgba(212, 160, 23, 0.12)' : idx === 1 ? 'rgba(148, 163, 184, 0.12)' : idx === 2 ? 'rgba(180, 83, 9, 0.1)' : 'transparent' 
                  }}>
                    <td>{idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : idx + 1}</td>
                    <td style={{ fontWeight: 700, color: '#166534' }}>{p.name}</td>
                    <td>{p.p1Name}, {p.p2Name}</td>
                    <td style={{ color: 'var(--blue)', fontWeight: 800 }}>{p.points}</td>
                    <td>{p.matchWin}승 {p.matchDraw}무 {p.matchLoss}패</td>
                    <td>{p.diff > 0 ? '+' : ''}{p.diff} ({p.setWin}득 {p.setLoss}실)</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 📊 각 선수별 게임수 및 상세 전적 현황 카드 */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h2 style={{ margin: 0, color: 'var(--navy)', fontSize: '17px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              📊 각 선수별 출전 경기수 및 상세 전적
            </h2>
            <div style={{ fontSize: '12px', color: 'var(--txt2)', marginTop: '2px' }}>
              참가자 총 {allPlayerStats.length}명의 출전 경기수, 승률, 세부 출전 기록
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <input
              type="text"
              className="input input-sm"
              placeholder="🔍 선수 검색..."
              value={playerStatsSearch}
              onChange={e => setPlayerStatsSearch(e.target.value)}
              style={{ width: '130px', height: '30px', fontSize: '12px' }}
            />
            <select
              className="input input-sm"
              value={playerStatsSort}
              onChange={e => setPlayerStatsSort(e.target.value)}
              style={{ height: '30px', fontSize: '12px', padding: '2px 6px' }}
            >
              <option value="games_desc">경기수 많은 순 ↓</option>
              <option value="winrate_desc">승률 높은 순 ↓</option>
              <option value="name_asc">이름순</option>
            </select>
          </div>
        </div>

        {type === 'team' && teams && teams.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setPlayerStatsFilterTeam('ALL')}
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                backgroundColor: playerStatsFilterTeam === 'ALL' ? '#2563eb' : '#fff',
                color: playerStatsFilterTeam === 'ALL' ? '#fff' : '#475569',
                borderColor: playerStatsFilterTeam === 'ALL' ? '#2563eb' : '#cbd5e1'
              }}
            >
              전체 ({allPlayerStats.length})
            </button>
            {teams.map((t, idx) => {
              const isSelected = playerStatsFilterTeam === t.id;
              const theme = TEAM_COLORS[idx % TEAM_COLORS.length] || { badgeBg: '#2563eb', border: '#cbd5e1', text: '#2563eb' };
              return (
                <button
                  key={t.id}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setPlayerStatsFilterTeam(t.id)}
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    backgroundColor: isSelected ? theme.badgeBg : '#fff',
                    color: isSelected ? '#fff' : theme.text,
                    borderColor: isSelected ? theme.badgeBg : theme.border
                  }}
                >
                  {t.name} ({(t.players || []).length})
                </button>
              );
            })}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
          {filteredPlayers.map((p) => {
            const teamTheme = (p.teamIdx !== undefined && p.teamIdx >= 0) ? TEAM_COLORS[p.teamIdx % TEAM_COLORS.length] : null;

            return (
              <div
                key={p.id}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  backgroundColor: '#f8fafc',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontWeight: 800, fontSize: '13.5px', color: 'var(--txt)' }}>
                      👤 {p.name}
                    </span>
                    {p.isLeader && <span style={{ fontSize: '9.5px', backgroundColor: '#fef3c7', color: '#b45309', padding: '1px 4px', borderRadius: '3px', fontWeight: 800 }}>👑조장</span>}
                    {p.teamName && (
                      <span style={{ fontSize: '10.5px', fontWeight: 700, backgroundColor: teamTheme ? teamTheme.bg : '#fff', color: teamTheme ? teamTheme.text : '#334155', border: teamTheme ? `1px solid ${teamTheme.border}` : '1px solid #cbd5e1', padding: '0 4px', borderRadius: '3px' }}>
                        {p.teamName}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#1d4ed8', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: '10px' }}>
                    🔥 {p.totalGames}경기 출전
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', color: '#475569', backgroundColor: '#fff', padding: '4px 8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <span>전적: <strong>{p.wins}승 {p.draws > 0 ? `${p.draws}무 ` : ''}{p.losses}패</strong> (승률 {p.winRate}%)</span>
                  <span>득실: <strong>{p.gameDiff > 0 ? `+${p.gameDiff}` : p.gameDiff}</strong></span>
                </div>

                {p.matches.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '2px' }}>
                    {p.matches.map((m, mIdx) => (
                      <div key={mIdx} style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#334155', backgroundColor: '#fff', padding: '3px 6px', borderRadius: '4px', border: '1px solid #eef2f6' }}>
                        <span>🎾 {m.courtName} {m.setIndex}세트 (w. {m.partnerName})</span>
                        {m.isFinished ? (
                          <span style={{ fontWeight: 700, color: m.result === 'win' ? '#16a34a' : m.result === 'loss' ? '#dc2626' : '#64748b' }}>
                            {m.myScore}:{m.oppScore} ({m.result === 'win' ? '승' : m.result === 'loss' ? '패' : '무'})
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>대기</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

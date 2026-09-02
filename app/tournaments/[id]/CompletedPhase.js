import { useMemo } from 'react';

export default function CompletedPhase({ tournament, members, onUpdate, isAdmin }) {
  const { type, matches, teams } = tournament;
  const byId = {};
  members.forEach(m => byId[m.id] = m);

  const teamStats = useMemo(() => {
    if (type !== 'team') return [];
    const stats = {};
    teams.forEach(t => stats[t.id] = { ...t, matchWin: 0, matchDraw: 0, matchLoss: 0, setWin: 0, setLoss: 0, points: 0 });

    matches.forEach(m => {
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

    matches.forEach(m => {
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

    matches.forEach(m => {
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

  return (
    <div className="card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, color: 'var(--navy)', fontSize: '18px' }}>🏆 최종 결과</h2>
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
  );
}

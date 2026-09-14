/**
 * 대회 최종 결과 공유 텍스트 생성 유틸리티
 */
export function generateTournamentResultShareText(tournament, members = []) {
  if (!tournament) return '';
  const { title, date, time, courtDetails, courts, type, matches, teams, pairs } = tournament;
  const byId = {};
  members.forEach(m => {
    if (m && m.id) byId[m.id] = m;
  });

  const typeName = type === 'team' ? '👥 팀전' : type === 'fixed_pair' ? '👫 개인전(고정페어)' : '👤 개인전(순환)';
  const courtStr = courtDetails ? courtDetails.map(c => c.name).join(', ') : `${courts || 2}코트`;
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://tcmngr.vercel.app';
  const shareUrl = `${origin}/tournaments/${tournament.id}`;

  let rankingText = '';

  if (type === 'team' && teams && teams.length > 0) {
    const stats = {};
    teams.forEach(t => stats[t.id] = { ...t, matchWin: 0, matchDraw: 0, matchLoss: 0, setWin: 0, setLoss: 0, points: 0 });

    (matches || []).forEach(m => {
      if (m.teamAId && m.teamBId && m.scoreA !== null && m.scoreB !== null && m.scoreA !== undefined && m.scoreB !== undefined) {
        const sA = Number(m.scoreA);
        const sB = Number(m.scoreB);
        if (isNaN(sA) || isNaN(sB)) return;

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

    rankingText = arr.map((t, idx) => {
      const medal = idx === 0 ? '🥇 1위' : idx === 1 ? '🥈 2위' : idx === 2 ? '🥉 3위' : `🔹 ${idx + 1}위`;
      const diff = t.setWin - t.setLoss;
      const diffStr = diff > 0 ? `+${diff}` : `${diff}`;
      const playerNames = (t.players || []).map(pid => byId[pid]?.name).filter(Boolean).join(', ');
      return `${medal} ${t.name}: ${t.points}점 (${t.matchWin}승 ${t.matchDraw > 0 ? `${t.matchDraw}무 ` : ''}${t.matchLoss}패, 득실 ${diffStr})\n   👥 팀원: ${playerNames || '미정'}`;
    }).join('\n\n');

  } else if (type === 'fixed_pair' && pairs && pairs.length > 0) {
    const stats = {};
    pairs.forEach(p => {
      const p1 = byId[p.player1];
      const p2 = byId[p.player2];
      stats[p.id] = {
        id: p.id,
        name: p.name || '페어',
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
      if (m.scoreA === null || m.scoreB === null || m.scoreA === undefined || m.scoreB === undefined) return;
      const sA = Number(m.scoreA);
      const sB = Number(m.scoreB);
      if (isNaN(sA) || isNaN(sB)) return;
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

    rankingText = arr.map((p, idx) => {
      const medal = idx === 0 ? '🥇 1위' : idx === 1 ? '🥈 2위' : idx === 2 ? '🥉 3위' : `🔹 ${idx + 1}위`;
      const diffStr = p.diff > 0 ? `+${p.diff}` : `${p.diff}`;
      return `${medal} ${p.name} (${p.p1Name}, ${p.p2Name}): ${p.points}점 (${p.matchWin}승 ${p.matchDraw > 0 ? `${p.matchDraw}무 ` : ''}${p.matchLoss}패, 득실 ${diffStr})`;
    }).join('\n');

  } else {
    // Individual
    const stats = {};
    const ensure = (id) => {
      if (!id) return null;
      if (!stats[id]) stats[id] = { id, name: byId[id]?.name || '알수없음', win: 0, draw: 0, loss: 0, points: 0, diff: 0, played: 0 };
      return stats[id];
    };

    (matches || []).forEach(m => {
      if (m.scoreA === null || m.scoreB === null || m.scoreA === undefined || m.scoreB === undefined) return;
      const sA = Number(m.scoreA);
      const sB = Number(m.scoreB);
      if (isNaN(sA) || isNaN(sB)) return;
      const diff = sA - sB;

      [m.playerA1, m.playerA2].forEach(pid => {
        const p = ensure(pid);
        if (!p) return;
        p.played++;
        p.diff += diff;
        if (sA > sB) { p.win++; p.points += 3; }
        else if (sA < sB) { p.loss++; p.points += 1; }
        else { p.draw++; p.points += 2; }
      });

      [m.playerB1, m.playerB2].forEach(pid => {
        const p = ensure(pid);
        if (!p) return;
        p.played++;
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

    rankingText = arr.map((p, idx) => {
      const medal = idx === 0 ? '🥇 1위' : idx === 1 ? '🥈 2위' : idx === 2 ? '🥉 3위' : `🔹 ${idx + 1}위`;
      const diffStr = p.diff > 0 ? `+${p.diff}` : `${p.diff}`;
      return `${medal} ${p.name}: ${p.points}점 (${p.win}승 ${p.draw > 0 ? `${p.draw}무 ` : ''}${p.loss}패, 득실 ${diffStr})`;
    }).join('\n');
  }

  return `[🏆 정기 대회 최종 결과]
📌 대회명: ${title}
📅 일시: ${date} ${time ? `⏰ ${time}` : ''}
🎾 방식/코트: ${typeName} | ${courtStr}

━━━━━━━━━━━━━━━━━━━
🏆 [최종 순위 및 결과]
━━━━━━━━━━━━━━━━━━━
${rankingText || '경기 결과 집계 중'}

━━━━━━━━━━━━━━━━━━━
🔗 상세 대진표 및 개인별 전적 바로가기:
${shareUrl}`;
}

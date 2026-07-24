// lib/scheduler.js — v3: 스케줄링 알고리즘 + 순위 계산 유틸

/* ── 알고리즘 헬퍼 ── */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function weightedPick(list, weightFn) {
  const weights = list.map(weightFn);
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return list[Math.floor(Math.random() * list.length)];
  let r = Math.random() * total;
  for (let i = 0; i < list.length; i++) {
    r -= weights[i];
    if (r <= 0) return list[i];
  }
  return list[list.length - 1];
}

export function pairKey(a, b) { return [a, b].sort().join('__'); }

function pickFreeQuad(avail, need) {
  if (avail.length < 4) return null;
  let remaining = avail.slice();
  const picked = [];
  for (let i = 0; i < 4; i++) {
    const p = weightedPick(remaining, p => Math.max(0, need[p.id]) + 0.5);
    picked.push(p);
    remaining = remaining.filter(x => x.id !== p.id);
  }
  return picked.map(p => p.id);
}

function pickJointQuad(avail, need) {
  const females = avail.filter(p => p.gender === 'F');
  const males = avail.filter(p => p.gender === 'M');
  const choices = [];
  if (females.length >= 1 && males.length >= 3) choices.push(1);
  if (females.length >= 3 && males.length >= 1) choices.push(3);
  if (females.length >= 4) choices.push(4);
  if (choices.length === 0) return null;
  const femaleCountToPick = choices[Math.floor(Math.random() * choices.length)];
  const picked = [];
  let remainingFemales = females.slice();
  for (let i = 0; i < femaleCountToPick; i++) {
    const f = weightedPick(remainingFemales, p => need[p.id] + 0.5);
    picked.push(f);
    remainingFemales = remainingFemales.filter(p => p.id !== f.id);
  }
  const maleCountToPick = 4 - femaleCountToPick;
  let remainingMales = males.slice();
  for (let i = 0; i < maleCountToPick; i++) {
    const m = weightedPick(remainingMales, p => need[p.id] + 0.5);
    picked.push(m);
    remainingMales = remainingMales.filter(p => p.id !== m.id);
  }
  return picked.map(p => p.id);
}

function tryGenerateOnce(players, rounds, courts, opts) {
  const byId = {}; players.forEach(p => byId[p.id] = p);
  const total = rounds * courts;
  const need = {}; players.forEach(p => need[p.id] = p.target);
  const quads = [];

  for (const g of opts.groups) {
    for (let k = 0; k < g.count; k++) {
      for (const id of g.memberIds) { if (need[id] <= 0) return { fail: 'group_need_exhausted' }; }
      quads.push({ ids: g.memberIds.slice(), type: 'group' });
      for (const id of g.memberIds) need[id]--;
    }
  }

  // 1. 남복 (Men's Doubles)
  for (let i = 0; i < (opts.mensDoublesCount || 0); i++) {
    let mavail = players.filter(p => p.gender === 'M' && need[p.id] > 0);
    if (mavail.length < 4) return { fail: 'mens_not_enough_males' };
    mavail = shuffle(mavail).sort((a, b) => need[b.id] - need[a.id]);
    const picked = [];
    let remaining = mavail.slice();
    for (let k = 0; k < 4; k++) {
      const m = weightedPick(remaining, p => need[p.id] + 0.5);
      picked.push(m);
      remaining = remaining.filter(p => p.id !== m.id);
    }
    quads.push({ ids: picked.map(p => p.id), type: 'mens' });
    picked.forEach(p => need[p.id]--);
  }

  // 2. 혼복 (Mixed Doubles)
  for (let i = 0; i < (opts.mixedCount || 0); i++) {
    let favail = players.filter(p => p.gender === 'F' && need[p.id] > 0);
    if (favail.length < 2) return { fail: 'mixed_not_enough_females' };
    favail = shuffle(favail).sort((a, b) => need[b.id] - need[a.id]);
    const f1 = favail[0];
    const f2 = weightedPick(favail.slice(1), p => need[p.id] + 0.5);
    let mavail = players.filter(p => p.gender === 'M' && need[p.id] > 0);
    if (mavail.length < 2) return { fail: 'mixed_not_enough_males' };
    const m1 = weightedPick(mavail, p => need[p.id] + 0.5);
    const m2 = weightedPick(mavail.filter(p => p.id !== m1.id), p => need[p.id] + 0.5);
    quads.push({ ids: [f1.id, f2.id, m1.id, m2.id], type: 'mixed' });
    [f1, f2, m1, m2].forEach(p => need[p.id]--);
  }

  // 3. 잡복 (Joint Doubles)
  for (let i = 0; i < (opts.jointCount || 0); i++) {
    const avail = players.filter(p => need[p.id] > 0);
    if (avail.length < 4) return { fail: 'joint_not_enough_players' };
    const ids = pickJointQuad(avail, need);
    if (!ids) return { fail: 'joint_pick_null' };
    quads.push({ ids, type: 'joint' });
    ids.forEach(id => need[id]--);
  }

  const freeCount = total - quads.length;
  if (freeCount < 0) return { fail: 'freeCount_negative' };
  for (let i = 0; i < freeCount; i++) {
    const avail = players.filter(p => need[p.id] > 0);
    if (avail.length < 4) return { fail: 'free_avail_lt_4' };
    const ids = pickFreeQuad(avail, need);
    if (!ids) return { fail: 'free_pick_null' };
    quads.push({ ids, type: 'free' });
    ids.forEach(id => need[id]--);
  }

  for (const p of players) if (need[p.id] !== 0) return { fail: 'leftover_need' };

  let pool = shuffle(quads.slice());
  const partition = [];
  for (let r = 0; r < rounds; r++) {
    let success = false, roundMatches = [];
    for (let attempt = 0; attempt < 60 && !success; attempt++) {
      roundMatches = []; const used = new Set();
      const candidates = shuffle(pool.slice());
      for (const q of candidates) {
        if (roundMatches.length >= courts) break;
        if (q.ids.some(id => used.has(id))) continue;
        roundMatches.push(q); q.ids.forEach(id => used.add(id));
      }
      if (roundMatches.length === courts) success = true;
    }
    if (!success) return { fail: 'partition_round_fail' };
    roundMatches.forEach(q => { const idx = pool.indexOf(q); pool.splice(idx, 1); });
    partition.push(roundMatches);
  }

  const usedPairs = {};
  let ntrpDiffSum = 0;
  const scheduleRounds = [];
  for (const roundMatches of partition) {
    const roundOut = [];
    for (const q of roundMatches) {
      const ids = q.ids;
      let splits;
      if (q.type === 'mixed') {
        const [f1, f2, m1, m2] = ids;
        splits = [[[f1, m1], [f2, m2]], [[f1, m2], [f2, m1]]];
      } else {
        const [a, b, c, d] = ids;
        splits = [[[a, b], [c, d]], [[a, c], [b, d]], [[a, d], [b, c]]];
        splits = splits.filter(s => {
          const t1f = s[0].filter(id => byId[id].gender === 'F').length;
          const t2f = s[1].filter(id => byId[id].gender === 'F').length;
          return t1f < 2 && t2f < 2;
        });
        if (splits.length === 0) splits = [[[a, b], [c, d]]];
      }
      let best = null, bestScore = Infinity;
      for (const s of splits) {
        const [t1, t2] = s;
        const k1 = pairKey(t1[0], t1[1]), k2 = pairKey(t2[0], t2[1]);
        const dupPenalty = (usedPairs[k1] || 0) * 1000 + (usedPairs[k2] || 0) * 1000;
        const sum1 = t1.reduce((s, id) => s + byId[id].ntrp, 0);
        const sum2 = t2.reduce((s, id) => s + byId[id].ntrp, 0);
        const diff = Math.abs(sum1 - sum2);
        const score = dupPenalty + diff;
        if (score < bestScore) { bestScore = score; best = { t1, t2, sum1, sum2, diff, k1, k2 }; }
      }
      usedPairs[best.k1] = (usedPairs[best.k1] || 0) + 1;
      usedPairs[best.k2] = (usedPairs[best.k2] || 0) + 1;
      ntrpDiffSum += best.diff;
      roundOut.push({ teamA: best.t1.slice(), teamB: best.t2.slice(), type: q.type });
    }
    scheduleRounds.push(roundOut);
  }

  let dupCount = 0;
  for (const k in usedPairs) if (usedPairs[k] > 1) dupCount += usedPairs[k] - 1;
  const score = dupCount * 1000 + ntrpDiffSum;
  return { scheduleRounds, score, dupCount, ntrpDiffSum };
}

export function generateSchedule(players, rounds, courts, opts, timeBudgetMs = 2500, maxAttempts = 3000) {
  const start = Date.now();
  let best = null, attempts = 0;
  const failReasons = {};
  while (Date.now() - start < timeBudgetMs && attempts < maxAttempts) {
    attempts++;
    const r = tryGenerateOnce(players, rounds, courts, opts);
    if (r && r.fail) { failReasons[r.fail] = (failReasons[r.fail] || 0) + 1; continue; }
    if (r && (!best || r.score < best.score)) { best = r; if (best.score === 0) break; }
  }
  return { result: best, attempts, failReasons };
}

/* ── 유틸 ── */
export function makeEmptyMatch() { return { teamA: ['', ''], teamB: ['', ''], type: 'manual' }; }

export function teamNtrpSum(ids, byId) {
  return ids.reduce((s, id) => { const p = byId[id]; return s + (p ? p.ntrp : 0); }, 0);
}

/** 오늘 개인 순위 계산 */
export function computeTodayStandings(schedule, scores, byId) {
  if (!schedule) return [];
  const stats = {};
  function ensure(id) {
    if (!stats[id]) {
      const p = byId[id];
      if (!p) return null;
      stats[id] = { id, name: p.name, played: 0, win: 0, loss: 0, draw: 0, diff: 0 };
    }
    return stats[id];
  }
  schedule.forEach((round, ri) => {
    round.forEach((m, ci) => {
      const key = `${ri}-${ci}`;
      const sc = scores[key];
      if (!sc || sc.a === null || sc.a === undefined || sc.a === '' ||
          sc.b === null || sc.b === undefined || sc.b === '') return;
      const a = Number(sc.a), b = Number(sc.b);
      const diff = a - b;
      m.teamA.forEach(id => {
        if (!id) return;
        const s = ensure(id);
        if (!s) return;
        s.played++; s.diff += diff;
        if (a > b) s.win++; else if (a < b) s.loss++; else s.draw++;
      });
      m.teamB.forEach(id => {
        if (!id) return;
        const s = ensure(id);
        if (!s) return;
        s.played++; s.diff += -diff;
        if (b > a) s.win++; else if (b < a) s.loss++; else s.draw++;
      });
    });
  });
  const rows = Object.values(stats).map(s => ({ 
    ...s, 
    winRate: s.played > 0 ? s.win / s.played : -1,
    points: s.win * 3 + s.draw * 1 - s.loss * 3
  }));
  rows.sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points;
    if (y.diff !== x.diff) return y.diff - x.diff;
    return y.win - x.win;
  });
  return rows;
}

/** 전체 누적 순위 계산 */
export function computeLifetimeStandings(history, currentMembersById) {
  const stats = {};
  function ensure(name) { if (!stats[name]) stats[name] = { name, played: 0, win: 0, loss: 0, draw: 0, diff: 0 }; return stats[name]; }
  history.forEach(entry => {
    const snap = {};
    entry.playerSnapshot.forEach(p => snap[p.id] = p);
    entry.schedule.forEach((round, ri) => {
      round.forEach((m, ci) => {
        const key = `${ri}-${ci}`;
        const sc = entry.scores && entry.scores[key];
        if (!sc || sc.a === null || sc.a === undefined || sc.a === '' ||
            sc.b === null || sc.b === undefined || sc.b === '') return;
        const a = Number(sc.a), b = Number(sc.b);
        const diff = a - b;
        m.teamA.forEach(id => {
          const p = snap[id]; if (!p) return;
          if (currentMembersById && !currentMembersById[id]) return;
          const s = ensure(p.name); s.played++; s.diff += diff;
          if (a > b) s.win++; else if (a < b) s.loss++; else s.draw++;
        });
        m.teamB.forEach(id => {
          const p = snap[id]; if (!p) return;
          if (currentMembersById && !currentMembersById[id]) return;
          const s = ensure(p.name); s.played++; s.diff += -diff;
          if (b > a) s.win++; else if (b < a) s.loss++; else s.draw++;
        });
      });
    });
  });
  const rows = Object.values(stats).map(s => ({ 
    ...s, 
    winRate: s.played > 0 ? s.win / s.played : -1,
    points: s.win * 3 + s.draw * 1 - s.loss * 3
  }));
  rows.sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points;
    if (y.diff !== x.diff) return y.diff - x.diff;
    return y.win - x.win;
  });
  return rows;
}

/** 전체 클럽 다중 대진표 누적 순위 및 참가 횟수 계산 */
export function computeGlobalStandings(schedules, members, startDate, endDate) {
  const stats = {};
  const byId = {};
  members.forEach(m => byId[m.id] = m);

  function ensure(id) {
    if (!stats[id]) {
      const p = byId[id];
      if (!p) return null;
      stats[id] = { 
        id, 
        name: p.name, 
        gender: p.gender,
        played: 0, 
        win: 0, 
        loss: 0, 
        draw: 0,
        diff: 0,
        attendedDays: 0 // 참가 횟수 (일수)
      };
    }
    return stats[id];
  }

  schedules.forEach(schedDoc => {
    if (!schedDoc.matchDate) return;
    if (startDate && schedDoc.matchDate < startDate) return;
    if (endDate && schedDoc.matchDate > endDate) return;

    if (!schedDoc.schedule || !schedDoc.scores) return;

    const attendedThisDay = new Set();

    schedDoc.schedule.forEach((round, ri) => {
      round.forEach((m, ci) => {
        const key = `${ri}-${ci}`;
        const sc = schedDoc.scores[key];
        if (!sc || sc.a === null || sc.a === undefined || sc.a === '' ||
            sc.b === null || sc.b === undefined || sc.b === '') return;
        
        const a = Number(sc.a), b = Number(sc.b);
        const diff = a - b;
        
        m.teamA.forEach(id => {
          if (!id) return;
          const s = ensure(id);
          if (!s) return;
          attendedThisDay.add(id);
          s.played++; s.diff += diff;
          if (a > b) s.win++; else if (a < b) s.loss++; else s.draw++;
        });
        
        m.teamB.forEach(id => {
          if (!id) return;
          const s = ensure(id);
          if (!s) return;
          attendedThisDay.add(id);
          s.played++; s.diff += -diff;
          if (b > a) s.win++; else if (b < a) s.loss++; else s.draw++;
        });
      });
    });

    attendedThisDay.forEach(id => {
      const s = ensure(id);
      if (!s) return;
      s.attendedDays++;
    });
  });

  const rows = Object.values(stats).map(s => ({ 
    ...s, 
    winRate: s.played > 0 ? s.win / s.played : -1,
    points: s.win * 3 + s.draw * 1 - s.loss * 3
  }));
  rows.sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points;
    if (y.diff !== x.diff) return y.diff - x.diff;
    return y.win - x.win;
  });
  return rows;
}

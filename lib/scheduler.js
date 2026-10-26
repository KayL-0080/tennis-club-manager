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

function pickFreePair(avail, need) {
  if (avail.length < 2) return null;
  let remaining = avail.slice();
  const picked = [];
  for (let i = 0; i < 2; i++) {
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

  // 1.5 여복 (Women's Doubles)
  for (let i = 0; i < (opts.womensDoublesCount || 0); i++) {
    let favail = players.filter(p => p.gender === 'F' && need[p.id] > 0);
    if (favail.length < 4) return { fail: 'womens_not_enough_females' };
    favail = shuffle(favail).sort((a, b) => need[b.id] - need[a.id]);
    const picked = [];
    let remaining = favail.slice();
    for (let k = 0; k < 4; k++) {
      const f = weightedPick(remaining, p => need[p.id] + 0.5);
      picked.push(f);
      remaining = remaining.filter(p => p.id !== f.id);
    }
    quads.push({ ids: picked.map(p => p.id), type: 'womens' });
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

  // 4. 단식 (Singles)
  const singlesCount = (opts.singlesPerRound || 0) * rounds;
  for (let i = 0; i < singlesCount; i++) {
    const avail = players.filter(p => need[p.id] > 0);
    if (avail.length < 2) return { fail: 'singles_avail_lt_2' };
    const ids = pickFreePair(avail, need);
    if (!ids) return { fail: 'singles_pick_null' };
    quads.push({ ids, type: 'singles' });
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
      if (q.type === 'singles') {
        const [a, b] = ids;
        const diff = Math.abs(byId[a].ntrp - byId[b].ntrp);
        ntrpDiffSum += diff;
        roundOut.push({ teamA: [a, ''], teamB: [b, ''], type: 'singles' });
        continue;
      } else if (q.type === 'mixed') {
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

export function splitPlayersByNtrp(players = []) {
  const sorted = players.slice().sort((a, b) => {
    const diff = Number(b.ntrp || 0) - Number(a.ntrp || 0);
    if (diff !== 0) return diff;
    const gDiff = (a.gender === 'M' ? 0 : 1) - (b.gender === 'M' ? 0 : 1);
    if (gDiff !== 0) return gDiff;
    return (a.name || '').localeCompare(b.name || '', 'ko');
  });
  const half = Math.ceil(sorted.length / 2);
  const upperGroup = sorted.slice(0, half);
  const lowerGroup = sorted.slice(half);
  const upperIds = new Set(upperGroup.map(p => p.id));
  const lowerIds = new Set(lowerGroup.map(p => p.id));
  return { sorted, upperGroup, lowerGroup, upperIds, lowerIds };
}

/**
 * 시작~종료 시간 및 총 라운드 수를 기준으로
 * '앞 2시간(120분)'에 해당하는 기본 분리 대진 라운드 수를 계산합니다.
 */
export function calcDefaultSplitRounds(startTime = '09:00', endTime = '12:00', rounds = 6) {
  const totalRounds = Math.max(1, Number(rounds) || 6);
  if (totalRounds <= 1) return 1;
  let diff = 180;
  if (startTime && endTime) {
    const [sH, sM] = startTime.split(':').map(Number);
    const [eH, eM] = endTime.split(':').map(Number);
    diff = (eH * 60 + eM) - (sH * 60 + sM);
    if (diff <= 0) diff += 24 * 60;
  }
  if (diff > 120) {
    const r = Math.round((120 / diff) * totalRounds);
    return Math.max(1, Math.min(totalRounds - 1, r));
  }
  // 총 경기시간이 2시간 이하인 경우 앞 절반(약 60%)을 그룹별 대진으로 설정
  return Math.max(1, Math.min(totalRounds - 1, Math.ceil(totalRounds * 0.6)));
}

function pickPlayersFromPool(pool, count, need, remRounds, preferGenderType = null) {
  if (pool.length < count) return null;
  const must = pool.filter(p => need[p.id] === remRounds);
  if (must.length > count) return null;

  // 성별 조건 선호 처리 (남복/여복/혼복)
  if (preferGenderType && count === 4) {
    if (preferGenderType === 'mens') {
      const males = pool.filter(p => p.gender === 'M');
      const mustFemales = must.filter(p => p.gender === 'F');
      if (mustFemales.length === 0 && males.length >= 4) {
        return pickPlayersFromPool(males, 4, need, remRounds, null);
      }
    } else if (preferGenderType === 'womens') {
      const females = pool.filter(p => p.gender === 'F');
      const mustMales = must.filter(p => p.gender === 'M');
      if (mustMales.length === 0 && females.length >= 4) {
        return pickPlayersFromPool(females, 4, need, remRounds, null);
      }
    } else if (preferGenderType === 'mixed') {
      const females = pool.filter(p => p.gender === 'F');
      const males = pool.filter(p => p.gender === 'M');
      const mustF = must.filter(p => p.gender === 'F');
      const mustM = must.filter(p => p.gender === 'M');
      if (mustF.length <= 2 && mustM.length <= 2 && females.length >= 2 && males.length >= 2) {
        const pF = pickPlayersFromPool(females, 2, need, remRounds, null);
        const pM = pickPlayersFromPool(males, 2, need, remRounds, null);
        if (pF && pM) return [...pF, ...pM];
      }
    }
  }

  const picked = shuffle(must.slice());
  let remaining = pool.filter(p => !picked.some(x => x.id === p.id));
  while (picked.length < count && remaining.length > 0) {
    const p = weightedPick(remaining, x => Math.pow(Math.max(1, need[x.id]), 2.5) + 0.15);
    picked.push(p);
    remaining = remaining.filter(x => x.id !== p.id);
  }
  return picked.length === count ? picked : null;
}

function tryGenerateSplitScheduleOnce(players, rounds, courts, opts, relaxGenderCounts = false) {
  const byId = {};
  players.forEach(p => { byId[p.id] = p; });
  const need = {};
  players.forEach(p => { need[p.id] = p.target; });

  const { upperGroup, lowerGroup, upperIds, lowerIds } = splitPlayersByNtrp(players);
  const splitRounds = Math.max(1, Math.min(rounds, Number(opts.splitRounds) || calcDefaultSplitRounds(opts.startTime, opts.endTime, rounds)));
  const singlesPerRound = opts.singlesPerRound || 0;
  const doublesPerRound = courts - singlesPerRound;

  // 성별 목표 카운트 추적 (완화 모드가 아닐 때 우선 반영)
  let remMens = relaxGenderCounts ? 0 : (opts.mensDoublesCount || 0);
  let remWomens = relaxGenderCounts ? 0 : (opts.womensDoublesCount || 0);
  let remMixed = relaxGenderCounts ? 0 : (opts.mixedCount || 0);

  const partition = [];

  for (let r = 0; r < rounds; r++) {
    const remRounds = rounds - r;
    for (const p of players) {
      if (need[p.id] > remRounds) return { fail: 'partition_round_fail' };
    }

    const isSplitPhase = r < splitRounds;
    const roundQuads = [];

    if (isSplitPhase) {
      // [앞 2시간 구간] 상위그룹끼리 / 하위그룹끼리 분리 대진
      let remUpper = upperGroup.filter(p => need[p.id] > 0);
      let remLower = lowerGroup.filter(p => need[p.id] > 0);

      for (let c = 0; c < courts; c++) {
        const isSinglesCourt = c >= doublesPerRound;
        const slotSize = isSinglesCourt ? 2 : 4;

        const uMust = remUpper.filter(p => need[p.id] === remRounds);
        const lMust = remLower.filter(p => need[p.id] === remRounds);
        const uCan = remUpper.length >= slotSize && uMust.length <= slotSize;
        const lCan = remLower.length >= slotSize && lMust.length <= slotSize;

        let chosenGroupTag = null;
        if (uCan && !lCan) {
          chosenGroupTag = 'upper';
        } else if (!uCan && lCan) {
          chosenGroupTag = 'lower';
        } else if (uCan && lCan) {
          const remCourtsAfter = courts - 1 - c;
          if (uMust.length > 0 && remCourtsAfter === 0 && lMust.length === 0) {
            chosenGroupTag = 'upper';
          } else if (lMust.length > 0 && remCourtsAfter === 0 && uMust.length === 0) {
            chosenGroupTag = 'lower';
          } else {
            const uNeedSum = remUpper.reduce((s, p) => s + need[p.id], 0) + uMust.length * 4;
            const lNeedSum = remLower.reduce((s, p) => s + need[p.id], 0) + lMust.length * 4;
            // 코트가 2개 이상일 때 상위/하위 코트가 골고루 배정되도록 유도
            const upperAlready = roundQuads.filter(q => q.groupTag === 'upper').length;
            const lowerAlready = roundQuads.filter(q => q.groupTag === 'lower').length;
            if (upperAlready < lowerAlready && uNeedSum >= slotSize) {
              chosenGroupTag = 'upper';
            } else if (lowerAlready < upperAlready && lNeedSum >= slotSize) {
              chosenGroupTag = 'lower';
            } else {
              const probUpper = uNeedSum / Math.max(1, uNeedSum + lNeedSum);
              chosenGroupTag = Math.random() < probUpper ? 'upper' : 'lower';
            }
          }
        }

        let preferType = null;
        if (!isSinglesCourt) {
          const choices = [];
          if (remMixed > 0) choices.push('mixed');
          if (remMens > 0) choices.push('mens');
          if (remWomens > 0) choices.push('womens');
          if (choices.length > 0) preferType = choices[Math.floor(Math.random() * choices.length)];
        }

        let pickedPlayers = null;
        let finalGroupTag = chosenGroupTag;

        if (chosenGroupTag === 'upper') {
          pickedPlayers = pickPlayersFromPool(remUpper, slotSize, need, remRounds, preferType);
        } else if (chosenGroupTag === 'lower') {
          pickedPlayers = pickPlayersFromPool(remLower, slotSize, need, remRounds, preferType);
        }

        // 만약 단일 그룹 내 인원이 4명 미만인 예외 상황이면 잔여 풀에서 NTRP 인접순으로 보충
        if (!pickedPlayers) {
          const combined = [...remUpper, ...remLower];
          pickedPlayers = pickPlayersFromPool(combined, slotSize, need, remRounds, preferType);
          if (!pickedPlayers) return { fail: 'free_avail_lt_4' };
          const uCnt = pickedPlayers.filter(p => upperIds.has(p.id)).length;
          finalGroupTag = uCnt === slotSize ? 'upper' : (uCnt === 0 ? 'lower' : 'mixed_group');
        }

        const pickedIds = pickedPlayers.map(p => p.id);
        remUpper = remUpper.filter(p => !pickedIds.includes(p.id));
        remLower = remLower.filter(p => !pickedIds.includes(p.id));
        pickedIds.forEach(id => { need[id]--; });

        let qType = isSinglesCourt ? 'singles' : 'free';
        if (!isSinglesCourt) {
          const fCnt = pickedPlayers.filter(p => p.gender === 'F').length;
          const mCnt = pickedPlayers.filter(p => p.gender === 'M').length;
          if (fCnt === 2 && mCnt === 2) { qType = 'mixed'; if (remMixed > 0) remMixed--; }
          else if (mCnt === 4) { qType = 'mens'; if (remMens > 0) remMens--; }
          else if (fCnt === 4) { qType = 'womens'; if (remWomens > 0) remWomens--; }
        }

        roundQuads.push({ ids: pickedIds, type: qType, groupTag: finalGroupTag });
      }

      // 이 라운드에서 반드시 뛰어야 했던 선수가 누락되었는지 확인
      for (const p of players) {
        if (need[p.id] > remRounds - 1) return { fail: 'partition_round_fail' };
      }
    } else {
      // [이후 종료시간까지 구간] 상위/하위 그룹 섞어서 혼합 대진
      const totalSlotsInRound = doublesPerRound * 4 + singlesPerRound * 2;
      const avail = players.filter(p => need[p.id] > 0);
      if (avail.length < totalSlotsInRound) return { fail: 'free_avail_lt_4' };

      const must = avail.filter(p => need[p.id] === remRounds);
      if (must.length > totalSlotsInRound) return { fail: 'partition_round_fail' };

      const roundPicked = shuffle(must.slice());
      let remUpper = upperGroup.filter(p => need[p.id] > 0 && !roundPicked.some(x => x.id === p.id));
      let remLower = lowerGroup.filter(p => need[p.id] > 0 && !roundPicked.some(x => x.id === p.id));

      // 라운드 전체 참가자 중 상위그룹과 하위그룹 비율이 50:50에 가깝도록 교차 선발
      while (roundPicked.length < totalSlotsInRound) {
        const curUpperCnt = roundPicked.filter(p => upperIds.has(p.id)).length;
        const curLowerCnt = roundPicked.length - curUpperCnt;
        let targetPool = null;
        if (remUpper.length > 0 && (curUpperCnt < curLowerCnt || remLower.length === 0)) {
          targetPool = remUpper;
        } else if (remLower.length > 0 && (curLowerCnt < curUpperCnt || remUpper.length === 0)) {
          targetPool = remLower;
        } else {
          const combined = [...remUpper, ...remLower];
          targetPool = combined;
        }
        if (!targetPool || targetPool.length === 0) break;
        const p = weightedPick(targetPool, x => Math.pow(Math.max(1, need[x.id]), 2.5) + 0.15);
        roundPicked.push(p);
        remUpper = remUpper.filter(x => x.id !== p.id);
        remLower = remLower.filter(x => x.id !== p.id);
      }

      if (roundPicked.length < totalSlotsInRound) return { fail: 'free_avail_lt_4' };
      roundPicked.forEach(p => { need[p.id]--; });

      let poolUpper = shuffle(roundPicked.filter(p => upperIds.has(p.id)));
      let poolLower = shuffle(roundPicked.filter(p => lowerIds.has(p.id)));

      for (let c = 0; c < courts; c++) {
        const isSinglesCourt = c >= doublesPerRound;
        const slotSize = isSinglesCourt ? 2 : 4;
        const matchPlayers = [];

        if (!isSinglesCourt) {
          // 복식: 각 코트에 상위그룹 2명 + 하위그룹 2명 우선 배정
          while (matchPlayers.length < 2 && poolUpper.length > 0) {
            matchPlayers.push(poolUpper.pop());
          }
          while (matchPlayers.length < 4 && poolLower.length > 0) {
            matchPlayers.push(poolLower.pop());
          }
          while (matchPlayers.length < 4 && poolUpper.length > 0) {
            matchPlayers.push(poolUpper.pop());
          }
        } else {
          // 단식: 상위 1 + 하위 1 우선 배정
          if (poolUpper.length > 0) matchPlayers.push(poolUpper.pop());
          if (poolLower.length > 0 && matchPlayers.length < 2) matchPlayers.push(poolLower.pop());
          while (matchPlayers.length < 2 && poolUpper.length > 0) matchPlayers.push(poolUpper.pop());
          while (matchPlayers.length < 2 && poolLower.length > 0) matchPlayers.push(poolLower.pop());
        }

        const ids = matchPlayers.map(p => p.id);
        const fCnt = matchPlayers.filter(p => p.gender === 'F').length;
        const mCnt = matchPlayers.filter(p => p.gender === 'M').length;
        let qType = isSinglesCourt ? 'singles' : 'free';
        if (!isSinglesCourt) {
          if (fCnt === 2 && mCnt === 2) qType = 'mixed';
          else if (mCnt === 4) qType = 'mens';
          else if (fCnt === 4) qType = 'womens';
        }
        roundQuads.push({ ids, type: qType, groupTag: 'mixed_group' });
      }
    }

    partition.push(roundQuads);
  }

  for (const p of players) {
    if (need[p.id] !== 0) return { fail: 'leftover_need' };
  }

  // 팀 분할 및 파트너 중복 최소화 + NTRP 밸런스 최적화
  const usedPairs = {};
  let ntrpDiffSum = 0;
  const scheduleRounds = [];

  for (const roundMatches of partition) {
    const roundOut = [];
    for (const q of roundMatches) {
      const ids = q.ids;
      if (q.type === 'singles') {
        const [a, b] = ids;
        const diff = Math.abs(byId[a].ntrp - byId[b].ntrp);
        ntrpDiffSum += diff;
        roundOut.push({ teamA: [a, ''], teamB: [b, ''], type: 'singles', groupTag: q.groupTag });
        continue;
      }

      const [a, b, c, d] = ids;
      let splits = [[[a, b], [c, d]], [[a, c], [b, d]], [[a, d], [b, c]]];

      // 여+여 페어 방지 (여복 제외)
      const noFFSplits = splits.filter(s => {
        const t1f = s[0].filter(id => byId[id].gender === 'F').length;
        const t2f = s[1].filter(id => byId[id].gender === 'F').length;
        return t1f < 2 && t2f < 2;
      });
      if (noFFSplits.length > 0) splits = noFFSplits;

      // 상·하위 혼합 대진('mixed_group')인 경우 [상위1+하위1] vs [상위1+하위1] 팀 구성을 우선 선택
      if (q.groupTag === 'mixed_group') {
        const crossGroupSplits = splits.filter(s => {
          const t1u = s[0].filter(id => upperIds.has(id)).length;
          const t2u = s[1].filter(id => upperIds.has(id)).length;
          return t1u === 1 && t2u === 1;
        });
        if (crossGroupSplits.length > 0) splits = crossGroupSplits;
      }

      let best = null, bestScore = Infinity;
      for (const s of splits) {
        const [t1, t2] = s;
        const k1 = pairKey(t1[0], t1[1]), k2 = pairKey(t2[0], t2[1]);
        const dupPenalty = (usedPairs[k1] || 0) * 1000 + (usedPairs[k2] || 0) * 1000;
        const sum1 = t1.reduce((acc, id) => acc + byId[id].ntrp, 0);
        const sum2 = t2.reduce((acc, id) => acc + byId[id].ntrp, 0);
        const diff = Math.abs(sum1 - sum2);
        const score = dupPenalty + diff;
        if (score < bestScore) {
          bestScore = score;
          best = { t1, t2, sum1, sum2, diff, k1, k2 };
        }
      }
      usedPairs[best.k1] = (usedPairs[best.k1] || 0) + 1;
      usedPairs[best.k2] = (usedPairs[best.k2] || 0) + 1;
      ntrpDiffSum += best.diff;
      roundOut.push({ teamA: best.t1.slice(), teamB: best.t2.slice(), type: q.type, groupTag: q.groupTag });
    }
    scheduleRounds.push(roundOut);
  }

  let dupCount = 0;
  for (const k in usedPairs) if (usedPairs[k] > 1) dupCount += usedPairs[k] - 1;
  const score = dupCount * 1000 + ntrpDiffSum;
  return { scheduleRounds, score, dupCount, ntrpDiffSum, ntrpSplitMode: true, splitRounds };
}

export function generateSchedule(players, rounds, courts, opts = {}, timeBudgetMs = 2500, maxAttempts = 3000) {
  const start = Date.now();
  let best = null, attempts = 0;
  const failReasons = {};
  const useSplitMode = !!opts?.ntrpSplitMode;

  while (Date.now() - start < timeBudgetMs && attempts < maxAttempts) {
    attempts++;
    const relaxGender = useSplitMode && attempts > Math.floor(maxAttempts * 0.4) && !best;
    const r = useSplitMode
      ? tryGenerateSplitScheduleOnce(players, rounds, courts, opts, relaxGender)
      : tryGenerateOnce(players, rounds, courts, opts);
    if (r && r.fail) { failReasons[r.fail] = (failReasons[r.fail] || 0) + 1; continue; }
    if (r && (!best || r.score < best.score)) { best = r; if (best.score === 0) break; }
  }
  return { result: best, attempts, failReasons };
}

/**
 * 경기 시간(시작~종료)과 참가자 성별 분포를 분석하여
 * 추천 라운드 수 및 남복/여복/혼복/잡복 경기 수를 산출합니다.
 */
export function calculateRecommendedSettings({
  startTime = '09:00',
  endTime = '12:00',
  courts = 2,
  participants = [],
  members = [],
  preferredMaxGames = null,
  ensureMin4Games = true
}) {
  let diff = 180;
  if (startTime && endTime) {
    const [sH, sM] = startTime.split(':').map(Number);
    const [eH, eM] = endTime.split(':').map(Number);
    diff = (eH * 60 + eM) - (sH * 60 + sM);
    if (diff <= 0) diff += 24 * 60;
  }

  const memberMap = new Map(members.map(m => [m.id, m]));
  let maleCount = 0;
  let femaleCount = 0;

  participants.forEach(p => {
    const m = memberMap.get(p.playerId);
    const gender = m?.gender || 'M';
    if (gender === 'F') femaleCount++;
    else maleCount++;
  });

  const totalCount = maleCount + femaleCount;
  const numCourts = Math.max(1, courts || 2);

  // 6게임제 기본 라운드 수 (약 30분당 1라운드) vs 5게임제 기본 라운드 수 (약 25분당 1라운드)
  const rounds6 = Math.max(1, Math.min(20, Math.round(diff / 30)));
  const rounds5 = Math.max(rounds6 + 1, Math.min(20, Math.round(diff / 25)));
  // 전 참가자 최소 4게임 보장에 필요한 최소 라운드 수: ceil((N * 4) / (courts * 4)) = ceil(N / courts)
  const minRoundsFor4Games = totalCount >= 4 ? Math.min(20, Math.ceil(totalCount / numCourts)) : rounds6;

  let recMaxGames = 6;
  let recRounds = rounds6;
  let autoSwitchedTo5 = false;

  if (preferredMaxGames === 5) {
    recMaxGames = 5;
    recRounds = (ensureMin4Games && totalCount >= 4)
      ? Math.max(rounds5, minRoundsFor4Games)
      : rounds5;
  } else if (preferredMaxGames === 6) {
    recMaxGames = 6;
    recRounds = rounds6;
  } else {
    // 자동 판단 모드: 인원이 많아 6게임제 라운드(rounds6)로 전원 4게임이 불가능할 경우 5게임제로 자동 전환
    if (ensureMin4Games && totalCount >= 4 && rounds6 < minRoundsFor4Games) {
      recMaxGames = 5;
      recRounds = Math.max(rounds5, minRoundsFor4Games);
      autoSwitchedTo5 = true;
    } else {
      recMaxGames = 6;
      recRounds = rounds6;
    }
  }

  const totalMatches = recRounds * numCourts;
  const totalSlots = totalMatches * 4;
  const minsPerRound = Math.max(10, Math.round(diff / recRounds));

  let recMens = 0;
  let recWomens = 0;
  let recMixed = 0;
  let recJoint = 0;
  let explanation = '';

  const durationHours = Math.floor(diff / 60);
  const durationMins = diff % 60;
  const durationText = `${durationHours > 0 ? `${durationHours}시간 ` : ''}${durationMins > 0 ? `${durationMins}분` : ''}`.trim() || '0분';

  if (totalCount === 0) {
    return {
      rounds: recRounds,
      maxGames: recMaxGames,
      rounds6,
      rounds5,
      minRoundsFor4Games,
      minsPerRound,
      autoSwitchedTo5: false,
      mensDoublesCount: 0,
      womensDoublesCount: 0,
      mixedCount: 0,
      jointCount: 0,
      diff,
      durationText,
      maleCount: 0,
      femaleCount: 0,
      totalCount: 0,
      explanation: '참가자가 선택되지 않았습니다. 경기 시간 기준 기본 라운드수만 계산되었습니다.'
    };
  }

  const avgGames = totalSlots / totalCount;
  const availF = Math.floor(femaleCount * avgGames);
  const availM = Math.floor(maleCount * avgGames);

  if (femaleCount === 0) {
    recMens = totalMatches;
    explanation = `남성 ${maleCount}명 전원으로 총 ${totalMatches}경기 모두 남복으로 편성합니다.`;
  } else if (maleCount === 0) {
    recWomens = totalMatches;
    explanation = `여성 ${femaleCount}명 전원으로 총 ${totalMatches}경기 모두 여복으로 편성합니다.`;
  } else if (femaleCount === 1) {
    recJoint = Math.min(recRounds, Math.max(1, Math.floor(availF)));
    recMens = Math.max(0, totalMatches - recJoint);
    explanation = `여성 1명 참여로 잡복(여1+남3) ${recJoint}경기, 남복 ${recMens}경기로 편성합니다.`;
  } else if (maleCount === 1) {
    recJoint = Math.min(recRounds, Math.max(1, Math.floor(availM)));
    recWomens = Math.max(0, totalMatches - recJoint);
    explanation = `남성 1명 참여로 잡복(남1+여3) ${recJoint}경기, 여복 ${recWomens}경기로 편성합니다.`;
  } else if (femaleCount < 4) {
    // 여성 2~3명 (여복 최소 4인 미달)
    const budgetF = Math.floor(availF * 0.7);
    recMixed = Math.min(Math.floor(budgetF / 2), Math.floor(availM * 0.7 / 2), recRounds);
    const budgetM = Math.floor(availM * 0.7) - (recMixed * 2);
    recMens = Math.min(totalMatches - recMixed, Math.max(0, Math.floor(budgetM / 4)));
    const free = totalMatches - (recMixed + recMens);
    explanation = `여성 ${femaleCount}명(여복 4인 미달), 남성 ${maleCount}명에 맞춰 혼복 ${recMixed}경기, 남복 ${recMens}경기${free > 0 ? ` (잔여 ${free}경기는 성별무관 배정)` : ''}로 편성합니다.`;
  } else if (maleCount < 4) {
    // 남성 2~3명 (남복 최소 4인 미달)
    const budgetM = Math.floor(availM * 0.7);
    recMixed = Math.min(Math.floor(budgetM / 2), Math.floor(availF * 0.7 / 2), recRounds);
    const budgetF = Math.floor(availF * 0.7) - (recMixed * 2);
    recWomens = Math.min(totalMatches - recMixed, Math.max(0, Math.floor(budgetF / 4)));
    const free = totalMatches - (recMixed + recWomens);
    explanation = `남성 ${maleCount}명(남복 4인 미달), 여성 ${femaleCount}명에 맞춰 혼복 ${recMixed}경기, 여복 ${recWomens}경기${free > 0 ? ` (잔여 ${free}경기는 성별무관 배정)` : ''}로 편성합니다.`;
  } else {
    // 남녀 모두 4명 이상
    if (maleCount === femaleCount) {
      let maxMixed = Math.min(Math.floor(totalMatches * 0.5), Math.floor(availF * 0.5 / 2));
      if (maxMixed % 2 === 1 && maxMixed > 1) maxMixed--;
      recMixed = maxMixed;
      const remF = Math.floor(availF * 0.7) - (recMixed * 2);
      const remM = Math.floor(availM * 0.7) - (recMixed * 2);
      recWomens = Math.max(0, Math.floor(remF / 4));
      recMens = Math.max(0, Math.floor(remM / 4));
    } else if (maleCount > femaleCount) {
      let maxMixed = Math.min(Math.floor(availF * 0.6 / 2), Math.floor(availM * 0.5 / 2), totalMatches - 1);
      if (maxMixed % 2 === 1 && maxMixed > 1) maxMixed--;
      recMixed = maxMixed;
      const remF = Math.floor(availF * 0.8) - (recMixed * 2);
      const remM = Math.floor(availM * 0.8) - (recMixed * 2);
      recWomens = Math.max(0, Math.min(1, Math.floor(remF / 4)));
      recMens = Math.min(totalMatches - recMixed - recWomens, Math.max(0, Math.floor(remM / 4)));
    } else {
      let maxMixed = Math.min(Math.floor(availM * 0.6 / 2), Math.floor(availF * 0.5 / 2), totalMatches - 1);
      if (maxMixed % 2 === 1 && maxMixed > 1) maxMixed--;
      recMixed = maxMixed;
      const remM = Math.floor(availM * 0.8) - (recMixed * 2);
      const remF = Math.floor(availF * 0.8) - (recMixed * 2);
      recMens = Math.max(0, Math.min(1, Math.floor(remM / 4)));
      recWomens = Math.min(totalMatches - recMixed - recMens, Math.max(0, Math.floor(remF / 4)));
    }
    const free = totalMatches - (recMens + recWomens + recMixed);
    explanation = `남성 ${maleCount}명, 여성 ${femaleCount}명에 맞춰 남복 ${recMens}경기, 여복 ${recWomens}경기, 혼복 ${recMixed}경기${free > 0 ? ` (잔여 ${free}경기는 성별무관 배정)` : ''}로 편성합니다.`;
  }

  // 총 경기 수 초과 방어
  const currentTotal = recMens + recWomens + recMixed + recJoint;
  if (currentTotal > totalMatches) {
    const excess = currentTotal - totalMatches;
    if (recJoint >= excess) recJoint -= excess;
    else if (recMixed >= excess) recMixed -= excess;
    else if (recMens >= excess) recMens -= excess;
    else if (recWomens >= excess) recWomens -= excess;
  }

  if (autoSwitchedTo5) {
    explanation = `[⚡ 다인원(${totalCount}명) 전원 최소 4게임 보장을 위해 5게임제 · ${recRounds}라운드(경기당 약 ${minsPerRound}분)로 자동 전환됨] ` + explanation;
  } else if (recMaxGames === 5) {
    explanation = `[⚡ 5게임 선승제 · ${recRounds}라운드(경기당 약 ${minsPerRound}분) 적용] ` + explanation;
  }

  return {
    rounds: recRounds,
    maxGames: recMaxGames,
    rounds6,
    rounds5,
    minRoundsFor4Games,
    minsPerRound,
    autoSwitchedTo5,
    mensDoublesCount: recMens,
    womensDoublesCount: recWomens,
    mixedCount: recMixed,
    jointCount: recJoint,
    diff,
    durationText,
    maleCount,
    femaleCount,
    totalCount,
    explanation
  };
}

/* ── 유틸 ── */

export function makeEmptyMatch() { return { teamA: ['', ''], teamB: ['', ''], type: 'manual' }; }

export function teamNtrpSum(ids, byId) {
  return ids.reduce((s, id) => { const p = byId[id]; return s + (p ? p.ntrp : 0); }, 0);
}

/** 오늘 개인 순위 계산 */
export function computeTodayStandings(schedule, scores, byId) {
  const points = {};
  const stats = {};
  function ensure(id) {
    if (!stats[id]) {
      const p = byId[id];
      stats[id] = { id, name: p ? p.name : '(미정)', played: 0, win: 0, loss: 0, draw: 0, diff: 0 };
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
        s.played++; s.diff += diff;
        if (a > b) s.win++; else if (a < b) s.loss++; else s.draw++;
      });
      m.teamB.forEach(id => {
        if (!id) return;
        const s = ensure(id);
        s.played++; s.diff += -diff;
        if (b > a) s.win++; else if (b < a) s.loss++; else s.draw++;
      });
    });
  });
  const rows = Object.values(stats).map(s => ({ ...s, winRate: s.played > 0 ? s.win / s.played : -1 }));
  rows.sort((x, y) => {
    if (y.winRate !== x.winRate) return y.winRate - x.winRate;
    if (y.diff !== x.diff) return y.diff - x.diff;
    return y.win - x.win;
  });
  return rows;
}

/** 전체 누적 순위 계산 */
export function computeLifetimeStandings(history) {
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
          const s = ensure(p.name); s.played++; s.diff += diff;
          if (a > b) s.win++; else if (a < b) s.loss++; else s.draw++;
        });
        m.teamB.forEach(id => {
          const p = snap[id]; if (!p) return;
          const s = ensure(p.name); s.played++; s.diff += -diff;
          if (b > a) s.win++; else if (b < a) s.loss++; else s.draw++;
        });
      });
    });
  });
  const rows = Object.values(stats).map(s => ({ ...s, winRate: s.played > 0 ? s.win / s.played : -1 }));
  rows.sort((x, y) => {
    if (y.winRate !== x.winRate) return y.winRate - x.winRate;
    if (y.diff !== x.diff) return y.diff - x.diff;
    return y.win - x.win;
  });
  return rows;
}

/** 전체 클럽 다중 대진표 및 분기대회 누적 순위 및 참가 횟수 계산 */
export function computeGlobalStandings(schedules = [], members = [], startDate = '', endDate = '', tournaments = [], filterSource = 'ALL', rulesConfig = null) {
  const rules = {
    winPoints: rulesConfig?.winPoints !== undefined ? Number(rulesConfig.winPoints) : 3.0,
    drawPoints: rulesConfig?.drawPoints !== undefined ? Number(rulesConfig.drawPoints) : 2.0,
    lossPoints: rulesConfig?.lossPoints !== undefined ? Number(rulesConfig.lossPoints) : 1.0,
    bonusPerDay: rulesConfig?.bonusPerDay !== undefined ? Number(rulesConfig.bonusPerDay) : 1.0,
    bonusPerMatch: rulesConfig?.bonusPerMatch !== undefined ? Number(rulesConfig.bonusPerMatch) : 0.0,
    calcType: rulesConfig?.calcType || 'avg'
  };

  const stats = {};
  const attendedDates = {};
  const byId = {};
  members.forEach(m => {
    byId[m.id] = m;
    attendedDates[m.id] = new Set();
    stats[m.id] = {
      id: m.id,
      name: m.name,
      gender: m.gender,
      played: 0,
      win: 0,
      loss: 0,
      draw: 0,
      diff: 0,
      regularPlayed: 0,
      regularWin: 0,
      regularDraw: 0,
      regularLoss: 0,
      tournamentPlayed: 0,
      tournamentWin: 0,
      tournamentDraw: 0,
      tournamentLoss: 0,
      attendedDays: 0
    };
  });

  function ensure(id) {
    if (!stats[id]) {
      const p = byId[id];
      attendedDates[id] = new Set();
      stats[id] = { 
        id, 
        name: p ? p.name : '(삭제된 회원)', 
        gender: p ? p.gender : 'M',
        played: 0, 
        win: 0, 
        loss: 0, 
        draw: 0,
        diff: 0,
        regularPlayed: 0,
        regularWin: 0,
        regularDraw: 0,
        regularLoss: 0,
        tournamentPlayed: 0,
        tournamentWin: 0,
        tournamentDraw: 0,
        tournamentLoss: 0,
        attendedDays: 0
      };
    }
    return stats[id];
  }

  // 1. 정기 모임(schedules) 집계 (filterSource: 'ALL' 또는 'REGULAR')
  if (filterSource === 'ALL' || filterSource === 'REGULAR') {
    (schedules || []).forEach(schedDoc => {
      if (!schedDoc.matchDate) return;
      if (startDate && schedDoc.matchDate < startDate) return;
      if (endDate && schedDoc.matchDate > endDate) return;
      if (!schedDoc.schedule || !schedDoc.scores) return;

      const dateKey = `sched_${schedDoc.matchDate}`;

      schedDoc.schedule.forEach((round, ri) => {
        round.forEach((m, ci) => {
          const key = `${ri}-${ci}`;
          const sc = schedDoc.scores[key];
          if (!sc || sc.a === null || sc.a === undefined || sc.a === '' ||
              sc.b === null || sc.b === undefined || sc.b === '') return;
          
          const a = Number(sc.a);
          const b = Number(sc.b);
          if (isNaN(a) || isNaN(b)) return;
          const diff = a - b;
          
          (m.teamA || []).forEach(id => {
            if (!id) return;
            const s = ensure(id);
            attendedDates[id]?.add(dateKey);
            s.played++;
            s.regularPlayed++;
            s.diff += diff;
            if (a > b) { s.win++; s.regularWin++; }
            else if (a < b) { s.loss++; s.regularLoss++; }
            else { s.draw++; s.regularDraw++; }
          });
          
          (m.teamB || []).forEach(id => {
            if (!id) return;
            const s = ensure(id);
            attendedDates[id]?.add(dateKey);
            s.played++;
            s.regularPlayed++;
            s.diff += -diff;
            if (b > a) { s.win++; s.regularWin++; }
            else if (b < a) { s.loss++; s.regularLoss++; }
            else { s.draw++; s.regularDraw++; }
          });
        });
      });
    });
  }

  // 2. 분기대회 / 정기대회(tournaments) 집계 (filterSource: 'ALL' 또는 'TOURNAMENT')
  if (filterSource === 'ALL' || filterSource === 'TOURNAMENT') {
    (tournaments || []).forEach(tourDoc => {
      let tourDate = tourDoc.date || '';
      if (!tourDate && tourDoc.createdAt) {
        if (tourDoc.createdAt.toDate) {
          tourDate = tourDoc.createdAt.toDate().toISOString().slice(0, 10);
        } else if (typeof tourDoc.createdAt === 'string') {
          tourDate = tourDoc.createdAt.slice(0, 10);
        }
      }

      if (startDate && tourDate && tourDate < startDate) return;
      if (endDate && tourDate && tourDate > endDate) return;

      let matches = [];
      if (Array.isArray(tourDoc.matches)) {
        matches = tourDoc.matches;
      } else if (typeof tourDoc.matches === 'string') {
        try { matches = JSON.parse(tourDoc.matches); } catch (_) { matches = []; }
      }

      if (!matches || matches.length === 0) return;

      const dateKey = tourDate ? `tour_${tourDate}` : `tour_id_${tourDoc.id}`;

      matches.forEach(m => {
        let scoreA = m.scoreA;
        let scoreB = m.scoreB;

        // Fallback to tourDoc.scores if match properties are null
        if ((scoreA === null || scoreA === undefined || scoreA === '') && tourDoc.scores && tourDoc.scores[m.id]) {
          scoreA = tourDoc.scores[m.id].a;
          scoreB = tourDoc.scores[m.id].b;
        }

        if (scoreA === null || scoreA === undefined || scoreA === '' ||
            scoreB === null || scoreB === undefined || scoreB === '') return;
        
        const a = Number(scoreA);
        const b = Number(scoreB);
        if (isNaN(a) || isNaN(b)) return;
        const diff = a - b;

        const sideAPlayers = [m.playerA1, m.playerA2].filter(Boolean);
        const sideBPlayers = [m.playerB1, m.playerB2].filter(Boolean);

        if (sideAPlayers.length === 0 || sideBPlayers.length === 0) return;

        sideAPlayers.forEach(id => {
          const s = ensure(id);
          attendedDates[id]?.add(dateKey);
          s.played++;
          s.tournamentPlayed++;
          s.diff += diff;
          if (a > b) { s.win++; s.tournamentWin++; }
          else if (a < b) { s.loss++; s.tournamentLoss++; }
          else { s.draw++; s.tournamentDraw++; }
        });

        sideBPlayers.forEach(id => {
          const s = ensure(id);
          attendedDates[id]?.add(dateKey);
          s.played++;
          s.tournamentPlayed++;
          s.diff += -diff;
          if (b > a) { s.win++; s.tournamentWin++; }
          else if (b < a) { s.loss++; s.tournamentLoss++; }
          else { s.draw++; s.tournamentDraw++; }
        });
      });
    });
  }

  // Set attendedDays from unique date keys
  Object.keys(stats).forEach(id => {
    stats[id].attendedDays = attendedDates[id] ? attendedDates[id].size : 0;
  });

  const rows = Object.values(stats).map(s => {
    const totalMatchPoints = (s.win * rules.winPoints) + (s.draw * rules.drawPoints) + (s.loss * rules.lossPoints);
    const basePoints = rules.calcType === 'sum'
      ? totalMatchPoints
      : (s.played > 0 ? totalMatchPoints / s.played : 0);
    const attendanceBonus = (s.attendedDays * rules.bonusPerDay) + (s.played * rules.bonusPerMatch);
    const finalScore = basePoints + attendanceBonus;
    return { 
      ...s, 
      winRate: s.played > 0 ? s.win / s.played : -1,
      totalMatchPoints: parseFloat(totalMatchPoints.toFixed(2)),
      avgMatchPoints: s.played > 0 ? parseFloat((totalMatchPoints / s.played).toFixed(2)) : 0,
      attendanceBonus: parseFloat(attendanceBonus.toFixed(2)),
      points: parseFloat(finalScore.toFixed(2))
    };
  });

  rows.sort((x, y) => {
    const xZero = x.attendedDays === 0;
    const yZero = y.attendedDays === 0;
    if (xZero && !yZero) return 1;
    if (!xZero && yZero) return -1;

    if (y.points !== x.points) return y.points - x.points;
    if (y.diff !== x.diff) return y.diff - x.diff;
    if (y.winRate !== x.winRate) return y.winRate - x.winRate;
    return y.win - x.win;
  });

  return rows;
}

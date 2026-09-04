import { useState, useMemo, useEffect } from 'react';
import { getEvents, getClubSettings } from '@/lib/firestore';

export function generateIndividualTournamentMatches(attendeeIds, byId, roundsCount, courtDetails) {
  const attMembers = attendeeIds.map(id => byId[id] || { id, name: '선수', gender: 'M', ntrp: 2.0 }).filter(Boolean);
  if (attMembers.length < 4) return [];

  const matches = [];
  const playerMatchCount = {};
  const partnerHistory = {};

  attMembers.forEach(m => {
    playerMatchCount[m.id] = 0;
    partnerHistory[m.id] = {};
  });

  const matchesPerRound = Math.floor(attMembers.length / 4);

  for (let r = 0; r < roundsCount; r++) {
    // 1. Select players for this round: sort by least played, with random tie-breaker
    const sortedCandidates = [...attMembers].sort((a, b) => {
      const countDiff = playerMatchCount[a.id] - playerMatchCount[b.id];
      if (countDiff !== 0) return countDiff;
      return Math.random() - 0.5;
    });

    const roundPlayers = sortedCandidates.slice(0, matchesPerRound * 4);
    roundPlayers.forEach(p => playerMatchCount[p.id]++);

    // Split into males and females for this round
    let roundMales = roundPlayers.filter(p => p.gender === 'M').sort((a, b) => (parseFloat(b.ntrp) || 2.0) - (parseFloat(a.ntrp) || 2.0));
    let roundFemales = roundPlayers.filter(p => p.gender === 'F').sort((a, b) => (parseFloat(b.ntrp) || 2.0) - (parseFloat(a.ntrp) || 2.0));

    const roundMatches = [];

    // Even round (0, 2, 4): Prioritize 남복 & 여복
    // Odd round (1, 3, 5): Prioritize 혼복 (2M + 2F)
    const preferMixed = (r % 2 === 1);

    let targetMixedCount = 0;
    if (preferMixed) {
      targetMixedCount = Math.min(Math.floor(roundMales.length / 2), Math.floor(roundFemales.length / 2));
    } else {
      const remM = roundMales.length % 4;
      const remF = roundFemales.length % 4;
      if (remM >= 2 && remF >= 2) {
        targetMixedCount = 1;
      }
    }

    // 1. Create Mixed Doubles (혼복) matches
    for (let mIdx = 0; mIdx < targetMixedCount; mIdx++) {
      if (roundMales.length >= 2 && roundFemales.length >= 2) {
        const m1 = roundMales.shift();
        const m2 = roundMales.shift();
        const f1 = roundFemales.shift();
        const f2 = roundFemales.shift();

        // NTRP Balancing: Higher Male (m1) + Lower Female (f2) vs Lower Male (m2) + Higher Female (f1)
        const pA1 = m1.id;
        const pA2 = f2.id;
        const pB1 = m2.id;
        const pB2 = f1.id;

        partnerHistory[pA1][pA2] = (partnerHistory[pA1][pA2] || 0) + 1;
        partnerHistory[pB1][pB2] = (partnerHistory[pB1][pB2] || 0) + 1;

        roundMatches.push({
          category: '혼복',
          playerA1: pA1,
          playerA2: pA2,
          playerB1: pB1,
          playerB2: pB2
        });
      }
    }

    // 2. Create Men's Doubles (남복) matches for groups of 4 males
    while (roundMales.length >= 4) {
      const group = [roundMales.shift(), roundMales.shift(), roundMales.shift(), roundMales.shift()];
      group.sort((a, b) => (parseFloat(b.ntrp) || 2.0) - (parseFloat(a.ntrp) || 2.0));

      // NTRP Balancing: 1st + 4th vs 2nd + 3rd
      const pA1 = group[0].id;
      const pA2 = group[3].id;
      const pB1 = group[1].id;
      const pB2 = group[2].id;

      partnerHistory[pA1][pA2] = (partnerHistory[pA1][pA2] || 0) + 1;
      partnerHistory[pB1][pB2] = (partnerHistory[pB1][pB2] || 0) + 1;

        roundMatches.push({
          category: '남복',
          playerA1: pA1,
          playerA2: pA2,
          playerB1: pB1,
          playerB2: pB2
        });
    }

    // 3. Create Women's Doubles (여복) matches for groups of 4 females
    while (roundFemales.length >= 4) {
      const group = [roundFemales.shift(), roundFemales.shift(), roundFemales.shift(), roundFemales.shift()];
      group.sort((a, b) => (parseFloat(b.ntrp) || 2.0) - (parseFloat(a.ntrp) || 2.0));

      // NTRP Balancing: 1st + 4th vs 2nd + 3rd
      const pA1 = group[0].id;
      const pA2 = group[3].id;
      const pB1 = group[1].id;
      const pB2 = group[2].id;

      partnerHistory[pA1][pA2] = (partnerHistory[pA1][pA2] || 0) + 1;
      partnerHistory[pB1][pB2] = (partnerHistory[pB1][pB2] || 0) + 1;

      roundMatches.push({
        category: '여복',
        playerA1: pA1,
        playerA2: pA2,
        playerB1: pB1,
        playerB2: pB2
      });
    }

    // 4. Handle remaining players (잡복 / 혼복)
    const leftovers = [...roundMales, ...roundFemales];
    while (leftovers.length >= 4) {
      const group = [leftovers.shift(), leftovers.shift(), leftovers.shift(), leftovers.shift()];
      const malesInGroup = group.filter(p => p.gender === 'M');
      const femalesInGroup = group.filter(p => p.gender === 'F');

      let category = '잡복';
      let pA1, pA2, pB1, pB2;

      if (malesInGroup.length === 2 && femalesInGroup.length === 2) {
        category = '혼복';
        malesInGroup.sort((a, b) => (parseFloat(b.ntrp) || 2.0) - (parseFloat(a.ntrp) || 2.0));
        femalesInGroup.sort((a, b) => (parseFloat(b.ntrp) || 2.0) - (parseFloat(a.ntrp) || 2.0));
        pA1 = malesInGroup[0].id;
        pA2 = femalesInGroup[1].id;
        pB1 = malesInGroup[1].id;
        pB2 = femalesInGroup[0].id;
      } else {
        group.sort((a, b) => (parseFloat(b.ntrp) || 2.0) - (parseFloat(a.ntrp) || 2.0));
        pA1 = group[0].id;
        pA2 = group[3].id;
        pB1 = group[1].id;
        pB2 = group[2].id;
      }

      partnerHistory[pA1][pA2] = (partnerHistory[pA1][pA2] || 0) + 1;
      partnerHistory[pB1][pB2] = (partnerHistory[pB1][pB2] || 0) + 1;

      roundMatches.push({
        category,
        playerA1: pA1,
        playerA2: pA2,
        playerB1: pB1,
        playerB2: pB2
      });
    }

    // Add to matches array
    roundMatches.forEach((rm, idx) => {
      matches.push({
        id: `r${r}-m${idx}`,
        round: r + 1,
        type: 'individual',
        category: rm.category,
        playerA1: rm.playerA1,
        playerA2: rm.playerA2,
        playerB1: rm.playerB1,
        playerB2: rm.playerB2,
        scoreA: null,
        scoreB: null
      });
    });
  }

  // Auto assign courts without player conflicts
  const courtOccupied = {};
  const playerOccupied = {};

  matches.forEach((m) => {
    const matchPlayers = [m.playerA1, m.playerA2, m.playerB1, m.playerB2].filter(Boolean);
    let targetSlot = m.round || 1;
    let assignedCourt = null;

    while (!assignedCourt && targetSlot < 100) {
      const hasPlayerConflict = matchPlayers.some(pId => playerOccupied[targetSlot] && playerOccupied[targetSlot].has(pId));
      if (!hasPlayerConflict) {
        for (const court of courtDetails) {
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

  return matches;
}

export function generateFixedPairTournamentMatches(pairs, byId, roundsCount, courtDetails) {
  if (!pairs || pairs.length < 2) return [];

  // Filter valid pairs (having both player1 and player2)
  const validPairs = pairs.filter(p => p.player1 && p.player2);
  if (validPairs.length < 2) return [];

  const n = validPairs.length;
  // If odd, add a dummy bye
  const isOdd = n % 2 !== 0;
  const list = isOdd ? [...validPairs, null] : [...validPairs];
  const totalSlots = list.length;
  const singleCycleRounds = totalSlots - 1;

  const matches = [];

  for (let r = 0; r < roundsCount; r++) {
    const cycleRound = r % singleCycleRounds;
    // Standard Circle Method round-robin
    const roundPairs = [];
    for (let i = 0; i < totalSlots / 2; i++) {
      const idxA = (cycleRound + i) % (totalSlots - 1);
      let idxB = (totalSlots - 1 - i + cycleRound) % (totalSlots - 1);
      if (i === 0) {
        idxB = totalSlots - 1;
      }

      const pairA = list[idxA];
      const pairB = list[idxB];

      if (pairA && pairB) {
        roundPairs.push([pairA, pairB]);
      }
    }

    roundPairs.forEach(([pA, pB], mIdx) => {
      // Determine category
      const players = [pA.player1, pA.player2, pB.player1, pB.player2].map(id => byId[id]).filter(Boolean);
      let category = '복식';
      if (players.length === 4) {
        const males = players.filter(p => p.gender === 'M').length;
        const females = players.filter(p => p.gender === 'F').length;
        if (males === 4) category = '남복';
        else if (females === 4) category = '여복';
        else if (males === 2 && females === 2) category = '혼복';
        else category = '잡복';
      }

      matches.push({
        id: `r${r}-m${mIdx}`,
        round: r + 1,
        type: 'fixed_pair',
        pairAId: pA.id,
        pairBId: pB.id,
        pairAName: pA.name || `${byId[pA.player1]?.name}/${byId[pA.player2]?.name}`,
        pairBName: pB.name || `${byId[pB.player1]?.name}/${byId[pB.player2]?.name}`,
        category,
        playerA1: pA.player1,
        playerA2: pA.player2,
        playerB1: pB.player1,
        playerB2: pB.player2,
        scoreA: null,
        scoreB: null
      });
    });
  }

  // Auto assign courts and time slots (setIndex)
  const courtOccupied = {};
  const playerOccupied = {};

  matches.forEach((m) => {
    const matchPlayers = [m.playerA1, m.playerA2, m.playerB1, m.playerB2].filter(Boolean);
    let targetSlot = m.round || 1;
    let assignedCourt = null;

    while (!assignedCourt && targetSlot < 100) {
      const hasPlayerConflict = matchPlayers.some(pId => playerOccupied[targetSlot] && playerOccupied[targetSlot].has(pId));
      if (!hasPlayerConflict) {
        for (const court of courtDetails) {
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

  return matches;
}

const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
const getDayName = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-').map(Number);
  if (parts.length < 3) return '';
  const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
  return dayNames[dateObj.getDay()] || '';
};

export const DEFAULT_MATCH_RULES = {
  doublesHandicap: '• 남남 vs 여여 경기 시 여여 쪽에 30point(30:0) 선점으로 시작 (듀스코트에서 서브/리시브 시작)\n• 남남 vs 남여 경기 시 남여 쪽에 15point(15:0) 선점으로 시작 (애드코트에서 서브/리시브 시작)\n• 남여 vs 여여 경기 시 여여 쪽에 15point(15:0) 선점으로 시작 (애드코트에서 서브/리시브 시작)',
  tiebreak: '• 5:5 동점(또는 마지막 게임 동점) 상황 시 타이브레이크 경기 진행\n• 7점 먼저 선취 시 해당 세트 승리',
  noAd: '• 40:40 듀스 시 No-Ad(1포인트 결정)\n• 혼복(남여) 경기 시 리시버 동성 선택 (서버 성별에 맞추어 남남/여여 리시브)',
  custom: '• 풋폴트 주의, 라인 콜은 해당 코트 선수 판정 존중, 경기 전 웜업 3분 준수'
};

export default function DraftPhase({ tournament, members, onUpdate, isAdmin }) {
  const isTeam = tournament.type === 'team';
  const isFixedPair = tournament.type === 'fixed_pair';
  const isIndividualRotation = tournament.type === 'individual';
  const isIndividual = !isTeam;

  const byId = useMemo(() => {
    const map = {};
    members.forEach(m => map[m.id] = m);
    return map;
  }, [members]);

  const [draftStep, setDraftStep] = useState(1);
  const [attendees, setAttendees] = useState(tournament.attendees || []);
  const [captains, setCaptains] = useState(tournament.captains || []);
  const [pairs, setPairs] = useState(tournament.pairs || []);
  const [fixedPairMethod, setFixedPairMethod] = useState('auto_balance'); // 'auto_balance' | 'seed_draw'
  const [mainPlayers, setMainPlayers] = useState([]);
  const [date, setDate] = useState(tournament.date || new Date().toLocaleDateString('en-CA'));
  const [startTime, setStartTime] = useState(tournament.startTime || tournament.time || '19:00');
  const [endTime, setEndTime] = useState(tournament.endTime || '22:00');
  const [gamesPerTeam, setGamesPerTeam] = useState(tournament.gamesPerTeam || 4);
  const [entryFee, setEntryFee] = useState(tournament.entryFee !== undefined ? tournament.entryFee : 10000);
  const [bankAccount, setBankAccount] = useState(tournament.bankAccount || '');
  const [matchRules, setMatchRules] = useState(() => ({
    ...DEFAULT_MATCH_RULES,
    ...(tournament.matchRules || {})
  }));
  const [showFeeNoticeModal, setShowFeeNoticeModal] = useState(false);
  const [feeNoticeText, setFeeNoticeText] = useState('');
  const [fetchingVotes, setFetchingVotes] = useState(false);
  const [lastVotedInfo, setLastVotedInfo] = useState('');

  const [courtDetails, setCourtDetails] = useState(() => {
    return tournament.courtDetails || [
      { id: 'c1', name: '1코트', games: 4 },
      { id: 'c2', name: '2코트', games: 4 }
    ];
  });

  // Calculate gender counts and ratio from current attendees
  const selectedMales = useMemo(() => attendees.filter(id => byId[id]?.gender === 'M'), [attendees, byId]);
  const selectedFemales = useMemo(() => attendees.filter(id => byId[id]?.gender === 'F'), [attendees, byId]);
  const totalCount = attendees.length;
  const malePct = totalCount > 0 ? Math.round((selectedMales.length / totalCount) * 100) : 0;
  const femalePct = totalCount > 0 ? Math.round((selectedFemales.length / totalCount) * 100) : 0;

  const targetPairCount = Math.floor(attendees.length / 2);
  const partnerPool = useMemo(() => {
    return attendees.filter(id => !mainPlayers.includes(id));
  }, [attendees, mainPlayers]);

  // Auto-fetch voted attendees for a given date
  const fetchVotedAttendees = async (targetDate, silent = false) => {
    if (!targetDate) return;
    setFetchingVotes(true);
    try {
      const evts = await getEvents('shared');
      const matchedEvt = evts.find(e => e.date === targetDate);
      if (matchedEvt && matchedEvt.attendees) {
        const votedYesIds = Object.keys(matchedEvt.attendees).filter(id => matchedEvt.attendees[id] === 'Y');
        const validVotedIds = votedYesIds.filter(id => byId[id]);
        if (validVotedIds.length > 0) {
          setAttendees(validVotedIds);
          setCaptains(prev => prev.filter(cid => validVotedIds.includes(cid)));
          setLastVotedInfo(`📅 ${targetDate} 투표 참석자 ${validVotedIds.length}명 자동 반영 완료`);
          if (!silent) {
            alert(`${targetDate} 모임의 투표 참석자 ${validVotedIds.length}명을 성공적으로 불러왔습니다.`);
          }
        } else {
          setLastVotedInfo(`⚠️ ${targetDate} 날짜에 참석('Y') 투표자가 없습니다.`);
          if (!silent) alert(`${targetDate} 날짜에 참석('Y')으로 투표한 인원이 없습니다.`);
        }
      } else {
        setLastVotedInfo(`⚠️ ${targetDate} 날짜에 등록된 투표 일정이 없습니다.`);
        if (!silent) alert(`${targetDate} 날짜에 등록된 투표 일정이 없습니다.`);
      }
    } catch (err) {
      console.error('Failed to fetch votes for date:', err);
      if (!silent) alert('투표 데이터를 불러오는데 실패했습니다.');
    } finally {
      setFetchingVotes(false);
    }
  };

  // Initial load: fetch default bank account from Club Settings if not set, and auto-fetch attendees
  useEffect(() => {
    (async () => {
      // 1. Fetch default bank account from member management settings if not set in tournament
      if (!tournament.bankAccount) {
        try {
          const clubSettings = await getClubSettings();
          if (clubSettings && (clubSettings.bankAccount || clubSettings.accountHolder)) {
            const defaultBank = [
              clubSettings.bankAccount,
              clubSettings.accountHolder ? `(${clubSettings.accountHolder})` : ''
            ].filter(Boolean).join(' ');
            if (defaultBank) {
              setBankAccount(defaultBank);
            }
          }
        } catch (err) {
          console.error('Failed to load club settings bank account:', err);
        }
      }

      // 2. If tournament attendees is empty, auto-fetch from votes
      if ((!tournament.attendees || tournament.attendees.length === 0) && date) {
        fetchVotedAttendees(date, true);
      }
    })();
  }, []);

  const calcAutoValues = (start, end, courtsList, customAttendeesCount) => {
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
      const pCount = customAttendeesCount !== undefined ? customAttendeesCount : (attendees.length || 12);
      const validPCount = Math.max(4, pCount);
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
      const updated = isSelected ? prev.filter(id => id !== memberId) : [...prev, memberId];
      if (isSelected) {
        setCaptains(c => c.filter(id => id !== memberId));
        setMainPlayers(m => m.filter(id => id !== memberId));
      }
      const { autoGames } = calcAutoValues(startTime, endTime, courtDetails, updated.length);
      setGamesPerTeam(autoGames);
      return updated;
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

  const toggleMainPlayer = (memberId) => {
    if (!isAdmin || !isFixedPair) return;
    setMainPlayers(prev => {
      if (prev.includes(memberId)) {
        return prev.filter(id => id !== memberId);
      } else {
        if (prev.length >= targetPairCount) {
          alert(`참가 인원(${attendees.length}명) 기준 주선수는 최대 ${targetPairCount}명까지 지정할 수 있습니다.`);
          return prev;
        }
        return [...prev, memberId];
      }
    });
  };

  const autoSelectTopNtrAsMain = () => {
    if (!isAdmin || attendees.length < 2) return;
    const sorted = [...attendees].sort((a, b) => {
      const ntrpA = parseFloat(byId[a]?.ntrp) || 2.0;
      const ntrpB = parseFloat(byId[b]?.ntrp) || 2.0;
      return ntrpB - ntrpA;
    });
    setMainPlayers(sorted.slice(0, targetPairCount));
  };

  const drawRandomPartners = () => {
    if (!isAdmin) return;
    if (mainPlayers.length < 2) {
      alert(`주선수(시드)를 최소 2명 이상 선택해주세요. (현재 ${mainPlayers.length}명 / 권장 ${targetPairCount}명)`);
      return;
    }
    if (mainPlayers.length !== targetPairCount) {
      if (!confirm(`현재 주선수가 ${mainPlayers.length}명 선택되었습니다. (권장: ${targetPairCount}명)\n이대로 나머지 인원을 파트너로 랜덤 추첨하시겠습니까?`)) {
        return;
      }
    }

    // Pool of remaining players
    const currentPartnerPool = attendees.filter(id => !mainPlayers.includes(id));
    
    // Fisher-Yates shuffle
    const shuffled = [...currentPartnerPool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const generatedPairs = mainPlayers.map((p1Id, idx) => ({
      id: `pair-${idx + 1}`,
      name: `${idx + 1}페어`,
      player1: p1Id,
      player2: shuffled[idx] || ''
    }));

    // If there are leftovers in shuffled
    let extraIdx = mainPlayers.length + 1;
    for (let i = mainPlayers.length; i < shuffled.length; i += 2) {
      generatedPairs.push({
        id: `pair-${extraIdx}`,
        name: `${extraIdx}페어`,
        player1: shuffled[i] || '',
        player2: shuffled[i + 1] || ''
      });
      extraIdx++;
    }

    setPairs(generatedPairs);
  };

  const autoMatchFixedPairs = (currentAttendees = attendees) => {
    if (!isAdmin) return;
    if (currentAttendees.length < 2) {
      alert('최소 2명 이상의 참가자를 선택해야 페어를 구성할 수 있습니다.');
      return;
    }

    const attendeeObjs = currentAttendees
      .map(id => byId[id] || { id, name: '선수', gender: 'M', ntrp: 2.0 })
      .sort((a, b) => (parseFloat(b.ntrp) || 2.0) - (parseFloat(a.ntrp) || 2.0));

    const males = attendeeObjs.filter(p => p.gender === 'M');
    const females = attendeeObjs.filter(p => p.gender === 'F');

    const generatedPairs = [];
    let pairIdx = 1;

    // Case 1: Equal number of males and females (e.g. 4M, 4F) -> Pair high M with low F (Balanced Mixed Doubles)
    if (males.length === females.length && males.length > 0) {
      for (let i = 0; i < males.length; i++) {
        const m = males[i];
        const f = females[females.length - 1 - i];
        generatedPairs.push({
          id: `pair-${pairIdx}`,
          name: `${pairIdx}페어`,
          player1: m.id,
          player2: f.id
        });
        pairIdx++;
      }
    } else {
      // General NTRP balancing (1st highest + 1st lowest, 2nd highest + 2nd lowest...)
      const pool = [...attendeeObjs];
      while (pool.length >= 2) {
        const p1 = pool.shift(); // highest
        const p2 = pool.pop();   // lowest
        generatedPairs.push({
          id: `pair-${pairIdx}`,
          name: `${pairIdx}페어`,
          player1: p1.id,
          player2: p2.id
        });
        pairIdx++;
      }
      // If odd leftover
      if (pool.length === 1) {
        const leftover = pool.shift();
        generatedPairs.push({
          id: `pair-${pairIdx}`,
          name: `${pairIdx}페어`,
          player1: leftover.id,
          player2: ''
        });
      }
    }

    setPairs(generatedPairs);
  };

  const handleAddPair = () => {
    if (!isAdmin) return;
    const nextIdx = pairs.length + 1;
    setPairs(prev => [
      ...prev,
      { id: `pair-${Date.now()}`, name: `${nextIdx}페어`, player1: '', player2: '' }
    ]);
  };

  const handleRemovePair = (pairId) => {
    if (!isAdmin) return;
    setPairs(prev => prev.filter(p => p.id !== pairId));
  };

  const handleUpdatePairPlayer = (pairId, slotKey, playerId) => {
    if (!isAdmin) return;
    setPairs(prev => prev.map(p => {
      if (p.id === pairId) {
        return { ...p, [slotKey]: playerId || '' };
      }
      return p;
    }));
  };

  const handleUpdatePairName = (pairId, newName) => {
    if (!isAdmin) return;
    setPairs(prev => prev.map(p => {
      if (p.id === pairId) {
        return { ...p, name: newName };
      }
      return p;
    }));
  };

  const handleOpenFeeNoticeModal = () => {
    const dayName = getDayName(date);
    const attendeeNames = attendees
      .map(id => byId[id]?.name)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'ko'));
    const dayDisplay = dayName ? ` (${dayName})` : '';
    const feeDisplay = entryFee > 0 ? `${Number(entryFee).toLocaleString()}원` : '무료';
    const totalExpected = attendees.length * entryFee;

    const text = `[🏆 ${tournament.title || '정기 대회'} 참가비 입금 및 대회 안내]

안녕하세요, 회원 여러분!
이번 ${date}${dayDisplay} 정기 대회의 참가비 입금 및 경기 진행 규칙을 안내드립니다.

📅 대회 일시: ${date}${dayDisplay} ⏰ ${startTime} ~ ${endTime}
🎾 대회 방식: ${isTeam ? '팀전' : isFixedPair ? '개인전(고정 페어)' : '개인전(파트너 순환)'}
💰 1인 참가비: ${feeDisplay}
🏦 입금 계좌: ${bankAccount || '(계좌 정보 미입력 - 현장 납부 또는 운영진 문의)'}
⏰ 입금 기한: 대회 시작 전까지

📜 [경기 진행 규칙 안내]
1️⃣ 복식 핸디캡 룰:
${matchRules.doublesHandicap}

2️⃣ 타이브레이크 룰:
${matchRules.tiebreak}

3️⃣ No-Ad 룰:
${matchRules.noAd}${matchRules.custom ? `\n\n4️⃣ 추가 및 매너 수칙:\n${matchRules.custom}` : ''}
${isFixedPair && pairs.length > 0 ? `\n👫 [확정된 페어 명단 (${pairs.length}페어)]\n` + pairs.map((p, i) => `${p.name || `${i + 1}페어`}: ${byId[p.player1]?.name || '미정'} & ${byId[p.player2]?.name || '미정'}`).join('\n') : ''}

👥 참가 선수 명단 (총 ${attendees.length}명 / 총 예상 ${totalExpected.toLocaleString()}원):
${attendeeNames.length > 0 ? attendeeNames.map((name, i) => `${i + 1}. ${name}`).join('\n') : '참가자 미정'}

※ 원활한 대회 준비를 위해 기한 내 입금 부탁드립니다. 감사합니다! 🎾
🔗 실시간 대진 및 순위 확인: https://tcmngr.vercel.app`;

    setFeeNoticeText(text);
    setShowFeeNoticeModal(true);
  };

  const handleGoToStep2 = () => {
    if (attendees.length < 4) {
      alert('최소 4명 이상의 참가자를 선택해주세요.');
      return;
    }
    if (isTeam && captains.length < 2) {
      alert('팀전은 최소 2명 이상의 조장을 지정해주세요.');
      return;
    }
    if (isFixedPair) {
      if (pairs.length < 2) {
        alert('고정 페어는 최소 2개 이상의 페어(4명)가 구성되어야 합니다.\n하단의 [🎲 NTRP 균형 자동 페어 매칭]을 눌러 페어를 구성해주세요.');
        return;
      }
      const unassignedPairs = pairs.filter(p => !p.player1 || !p.player2);
      if (unassignedPairs.length > 0) {
        alert('선수가 배정되지 않은 페어가 있습니다. 모든 페어에 선수를 2명씩 배정해주세요.');
        return;
      }
      const allAssignedPlayers = pairs.flatMap(p => [p.player1, p.player2]);
      const uniqueAssigned = new Set(allAssignedPlayers);
      if (uniqueAssigned.size !== allAssignedPlayers.length) {
        alert('동일한 선수가 중복으로 배정된 페어가 있습니다. 각 페어의 선수를 확인해주세요.');
        return;
      }
    }
    const { autoGames } = calcAutoValues(startTime, endTime, courtDetails, attendees.length);
    setGamesPerTeam(autoGames);
    setDraftStep(2);
  };

  const handleConfirmStep2 = async () => {
    if (!isAdmin) return;
    if (courtDetails.some(c => !c.name.trim())) {
      alert('코트명을 빈 칸 없이 작성해주세요.');
      return;
    }

    if (isFixedPair) {
      // 고정 페어 개인전: 3단계 패스 -> 4단계로 직행
      const matches = generateFixedPairTournamentMatches(pairs, byId, gamesPerTeam, courtDetails);
      await onUpdate({
        attendees,
        pairs,
        maleCount: selectedMales.length,
        femaleCount: selectedFemales.length,
        participantCount: attendees.length,
        date,
        startTime,
        endTime,
        entryFee,
        bankAccount,
        matchRules,
        courts: courtDetails.length,
        courtDetails,
        gamesPerTeam,
        matches,
        status: 'playing'
      });
    } else if (isIndividualRotation) {
      // 순환 개인전: 3단계 패스 -> 4단계로 직행
      const matches = generateIndividualTournamentMatches(attendees, byId, gamesPerTeam, courtDetails);
      await onUpdate({
        attendees,
        maleCount: selectedMales.length,
        femaleCount: selectedFemales.length,
        participantCount: attendees.length,
        date,
        startTime,
        endTime,
        entryFee,
        bankAccount,
        matchRules,
        courts: courtDetails.length,
        courtDetails,
        gamesPerTeam,
        matches,
        status: 'playing'
      });
    } else {
      // 팀전: 3단계 팀원 배정 및 선수 구성(picking)으로 이동
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
        entryFee,
        bankAccount,
        matchRules,
        courts: courtDetails.length,
        courtDetails,
        gamesPerTeam,
        status: 'picking'
      });
    }
  };

  const memberList = useMemo(() => {
    return members
      .filter(m => m.role !== '준회원' && m.role !== '게스트')
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
  }, [members]);

  return (
    <>
      {draftStep === 1 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Card 1: 💰 정기 대회 참가비 설정 (화면 최상단 독립 카드) */}
          <div className="card" style={{ padding: '18px 20px', border: '1px solid #fed7aa', backgroundColor: '#fffbf5', boxShadow: '0 2px 4px rgba(249, 115, 22, 0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>💰</span>
                <h3 style={{ margin: 0, color: '#9a3412', fontSize: '16px', fontWeight: 800 }}>
                  정기 대회 참가비 설정 및 입금 안내
                </h3>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{
                  fontSize: '12px',
                  padding: '5px 12px',
                  background: '#fef3c7',
                  color: '#b45309',
                  borderColor: '#fde68a',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
                onClick={handleOpenFeeNoticeModal}
              >
                📢 참가비 입금 안내문 생성 및 공유
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* 참가비 입력 및 빠른 선택 프리셋 버튼 */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '4px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 'bold', margin: 0, color: 'var(--txt)' }}>
                    1인 참가비 (직접 입력 또는 빠른 선택)
                  </label>
                  <span style={{ fontSize: '12px', color: '#c2410c', fontWeight: 700 }}>
                    설정 금액: {entryFee > 0 ? `${Number(entryFee).toLocaleString()}원` : '무료'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: '1 1 180px', minWidth: '150px' }}>
                    <input
                      type="number"
                      step="1000"
                      min="0"
                      className="input"
                      value={entryFee}
                      onChange={e => setEntryFee(Math.max(0, parseInt(e.target.value) || 0))}
                      disabled={!isAdmin}
                      placeholder="참가비 입력 (원)"
                      style={{ width: '100%', fontWeight: 'bold', fontSize: '14px', backgroundColor: '#fff' }}
                    />
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--txt2)', whiteSpace: 'nowrap' }}>원</span>
                  </div>

                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {[
                      { amount: 0, label: '무료' },
                      { amount: 5000, label: '5천원' },
                      { amount: 10000, label: '1만원' },
                      { amount: 15000, label: '1.5만원' },
                      { amount: 20000, label: '2만원' },
                      { amount: 30000, label: '3만원' }
                    ].map(preset => (
                      <button
                        key={preset.amount}
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{
                          padding: '4px 9px',
                          fontSize: '11px',
                          backgroundColor: entryFee === preset.amount ? '#ea580c' : '#fff',
                          color: entryFee === preset.amount ? '#fff' : 'var(--txt)',
                          borderColor: entryFee === preset.amount ? '#ea580c' : '#fdba74',
                          fontWeight: entryFee === preset.amount ? 'bold' : 'normal'
                        }}
                        onClick={() => setEntryFee(preset.amount)}
                        disabled={!isAdmin}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 입금 계좌 정보 입력 (회원관리 회비 계좌 기본 연동) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--txt)' }}>
                    🏦 입금 계좌 정보 (회원관리 회비 계좌 기본 연동)
                  </label>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    안내문 공유 시 자동 포함됩니다.
                  </span>
                </div>
                <input
                  type="text"
                  className="input input-sm"
                  value={bankAccount}
                  onChange={e => setBankAccount(e.target.value)}
                  disabled={!isAdmin}
                  placeholder="예: 카카오뱅크 3333-01-1234567 (홍길동)"
                  style={{ width: '100%', fontSize: '13px', backgroundColor: '#fff' }}
                />
              </div>

              {/* 실시간 총 예상 참가비 요약 배너 */}
              <div style={{ 
                padding: '10px 14px', 
                backgroundColor: '#fff', 
                borderRadius: '8px', 
                border: '1px solid #fed7aa', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                fontSize: '12px',
                color: 'var(--txt)'
              }}>
                <span>👥 <strong>총 예상 참가비</strong> (현재 선택 <strong>{totalCount}명</strong> × {entryFee.toLocaleString()}원)</span>
                <strong style={{ color: '#ea580c', fontSize: '15px' }}>
                  {(totalCount * entryFee).toLocaleString()}원
                </strong>
              </div>
            </div>
          </div>

          {/* Card 2: 📜 정기 대회 경기 진행 규칙 설정 (복식 핸디캡 / 타이브레이크 / No-Ad) */}
          <div className="card" style={{ padding: '18px 20px', border: '1px solid #c7d2fe', backgroundColor: '#f5f7ff', boxShadow: '0 2px 4px rgba(99, 102, 241, 0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>📜</span>
                <h3 style={{ margin: 0, color: '#3730a3', fontSize: '16px', fontWeight: 800 }}>
                  경기 진행 규칙 설정 (복식 핸디캡 / 타이브레이크 / No-Ad)
                </h3>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '11px', padding: '4px 10px', backgroundColor: '#fff', color: '#4338ca', borderColor: '#c7d2fe' }}
                onClick={() => setMatchRules(DEFAULT_MATCH_RULES)}
                disabled={!isAdmin}
                title="기본 권장 규칙으로 초기화"
              >
                🔄 기본 룰로 리셋
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* 1. 복식 경기룰 설정 (핸디캡 등) */}
              <div style={{ backgroundColor: '#fff', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e0e7ff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '4px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 800, color: 'var(--navy)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>🎾 1. 복식 경기룰 (성비 핸디캡)</span>
                  </label>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '11px', padding: '2px 8px' }}
                      disabled={!isAdmin}
                      onClick={() => setMatchRules(prev => ({
                        ...prev,
                        doublesHandicap: '• 남남 vs 여여: 여여 30point(30:0) 선점 시작 (듀스코트에서 서브/리시브 시작)\n• 남남 vs 남여: 남여 15point(15:0) 선점 시작 (애드코트에서 서브/리시브 시작)\n• 남여 vs 여여: 여여 15point(15:0) 선점 시작 (애드코트에서 서브/리시브 시작)'
                      }))}
                    >
                      기본 핸디캡 적용
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '11px', padding: '2px 8px' }}
                      disabled={!isAdmin}
                      onClick={() => setMatchRules(prev => ({
                        ...prev,
                        doublesHandicap: '• 모든 경기 핸디캡 없이 동일하게 0:0으로 시작'
                      }))}
                    >
                      핸디캡 없음
                    </button>
                  </div>
                </div>
                <textarea
                  className="input"
                  style={{ width: '100%', minHeight: '68px', fontSize: '12px', lineHeight: '1.5', padding: '8px', boxSizing: 'border-box', backgroundColor: '#fbfcfe' }}
                  value={matchRules.doublesHandicap}
                  onChange={e => setMatchRules(prev => ({ ...prev, doublesHandicap: e.target.value }))}
                  disabled={!isAdmin}
                  placeholder="복식 핸디캡 규칙을 입력하세요."
                />
              </div>

              {/* 2. 타이브레이크 경기룰 설정 */}
              <div style={{ backgroundColor: '#fff', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e0e7ff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '4px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 800, color: 'var(--navy)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>⚡ 2. 타이브레이크 경기룰</span>
                  </label>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '11px', padding: '2px 8px' }}
                      disabled={!isAdmin}
                      onClick={() => setMatchRules(prev => ({
                        ...prev,
                        tiebreak: '• 5:5 동점(또는 마지막 게임 동점) 상황 시 타이브레이크 경기 진행\n• 7점 먼저 선취 시 해당 세트 승리'
                      }))}
                    >
                      5:5 7점 선취
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '11px', padding: '2px 8px' }}
                      disabled={!isAdmin}
                      onClick={() => setMatchRules(prev => ({
                        ...prev,
                        tiebreak: '• 4:4 동점 상황 시 타이브레이크 경기 진행\n• 7점 먼저 선취 시 해당 세트 승리'
                      }))}
                    >
                      4:4 7점 선취
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '11px', padding: '2px 8px' }}
                      disabled={!isAdmin}
                      onClick={() => setMatchRules(prev => ({
                        ...prev,
                        tiebreak: '• 타이브레이크 없이 해당 게임 점수로 승패 결정 (동점 시 무승부)'
                      }))}
                    >
                      타이브레이크 없음
                    </button>
                  </div>
                </div>
                <textarea
                  className="input"
                  style={{ width: '100%', minHeight: '52px', fontSize: '12px', lineHeight: '1.5', padding: '8px', boxSizing: 'border-box', backgroundColor: '#fbfcfe' }}
                  value={matchRules.tiebreak}
                  onChange={e => setMatchRules(prev => ({ ...prev, tiebreak: e.target.value }))}
                  disabled={!isAdmin}
                  placeholder="타이브레이크 규칙을 입력하세요."
                />
              </div>

              {/* 3. No-Ad 시 경기룰 설정 */}
              <div style={{ backgroundColor: '#fff', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e0e7ff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '4px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 800, color: 'var(--navy)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>🎯 3. No-Ad 시 경기룰</span>
                  </label>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '11px', padding: '2px 8px' }}
                      disabled={!isAdmin}
                      onClick={() => setMatchRules(prev => ({
                        ...prev,
                        noAd: '• 40:40 듀스 시 No-Ad(1포인트 결정)\n• 혼복(남여) 경기 시 리시버 동성 선택 (서버 성별에 맞추어 남남/여여 리시브)'
                      }))}
                    >
                      No-Ad (혼복 동성리시브)
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '11px', padding: '2px 8px' }}
                      disabled={!isAdmin}
                      onClick={() => setMatchRules(prev => ({
                        ...prev,
                        noAd: '• 40:40 듀스 시 리시버가 원하는 코트(서브/리시버) 자유 선택'
                      }))}
                    >
                      리시버 자유선택
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '11px', padding: '2px 8px' }}
                      disabled={!isAdmin}
                      onClick={() => setMatchRules(prev => ({
                        ...prev,
                        noAd: '• 듀스 적용 (2점 차이 승리, Ad 코트 진행)'
                      }))}
                    >
                      듀스(Advantage) 적용
                    </button>
                  </div>
                </div>
                <textarea
                  className="input"
                  style={{ width: '100%', minHeight: '52px', fontSize: '12px', lineHeight: '1.5', padding: '8px', boxSizing: 'border-box', backgroundColor: '#fbfcfe' }}
                  value={matchRules.noAd}
                  onChange={e => setMatchRules(prev => ({ ...prev, noAd: e.target.value }))}
                  disabled={!isAdmin}
                  placeholder="No-Ad 룰을 입력하세요."
                />
              </div>

              {/* 4. 추가 경기 룰 및 매너 수칙 (선택) */}
              <div style={{ backgroundColor: '#fff', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e0e7ff' }}>
                <label style={{ fontSize: '13px', fontWeight: 800, color: 'var(--navy)', marginBottom: '6px', display: 'block' }}>
                  📝 4. 추가 안내 및 매너 수칙 (선택)
                </label>
                <input
                  type="text"
                  className="input input-sm"
                  style={{ width: '100%', fontSize: '12px', backgroundColor: '#fbfcfe' }}
                  value={matchRules.custom || ''}
                  onChange={e => setMatchRules(prev => ({ ...prev, custom: e.target.value }))}
                  disabled={!isAdmin}
                  placeholder="예: 풋폴트 주의, 라인 콜은 해당 코트 선수 판정 존중, 경기 전 웜업 3분 준수"
                />
              </div>

            </div>
          </div>

          {/* Card 3: 📝 1단계. 대회 일정, 시간 및 참가자/조장 확정 (하단 메인 카드) */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <h2 style={{ margin: 0, color: 'var(--navy)', fontSize: '18px' }}>
                1단계. 대회 일정, 시간 및 참가자{isTeam ? ' / 조장' : isFixedPair ? ' / 고정 페어' : ''} 확정
              </h2>
              <span className={isTeam ? 'badge badge-blue' : isFixedPair ? 'badge badge-green' : 'badge badge-purple'} style={{ fontSize: '12px' }}>
                {isTeam ? '👥 팀전 모드' : isFixedPair ? '👫 개인전(고정 페어) 모드' : '👤 개인전(순환) 모드'}
              </span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid var(--border)' }}>
              
              {/* 1. 대회 일정 및 투표 참석자 자동 불러오기 */}
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 'bold', margin: 0, color: 'var(--txt)' }}>대회 일정</label>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '12px', padding: '3px 10px', background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe', fontWeight: 'bold' }}
                    onClick={() => fetchVotedAttendees(date, false)}
                    disabled={fetchingVotes || !isAdmin}
                  >
                    {fetchingVotes ? '⏳ 불러오는 중...' : '📥 해당 일정 투표 참석자 불러오기'}
                  </button>
                </div>
                <input
                  type="date"
                  className="input"
                  value={date}
                  onChange={e => {
                    setDate(e.target.value);
                    fetchVotedAttendees(e.target.value, true);
                  }}
                  disabled={!isAdmin}
                  style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}
                />
                {lastVotedInfo && (
                  <div style={{ marginTop: '4px', fontSize: '11px', color: lastVotedInfo.includes('⚠️') ? '#b91c1c' : '#166534', fontWeight: 600 }}>
                    {lastVotedInfo}
                  </div>
                )}
              </div>
              
              {/* 2. 대회 시간 */}
              <div style={{ width: '100%', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '4px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 'bold', margin: 0, color: 'var(--txt)' }}>대회 시간</label>
                  <span style={{ fontSize: '11px', color: 'var(--blue)', background: '#e0f2fe', padding: '2px 8px', borderRadius: '12px' }}>
                    ⏰ 총 {durationInfo.text} (1경기 30분 기준, 코트당 {maxAllowedSets}경기 소화 가능)
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                   <input type="time" className="input" value={startTime} onChange={e => updateTimeAndAutoCalculate(e.target.value, endTime)} disabled={!isAdmin} style={{ flex: 1, minWidth: '0' }} />
                   <span>~</span>
                   <input type="time" className="input" value={endTime} onChange={e => updateTimeAndAutoCalculate(startTime, e.target.value)} disabled={!isAdmin} style={{ flex: 1, minWidth: '0' }} />
                </div>
              </div>

              {/* 3. 참가자 성비 현황 실시간 배너 */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                <div style={{ 
                  padding: '12px 14px', 
                  backgroundColor: '#fff', 
                  border: '1px solid #cbd5e1', 
                  borderRadius: '8px', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  flexWrap: 'wrap', 
                  gap: '8px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--navy)' }}>
                      🎾 선택된 참가자: <strong>{totalCount}명</strong>
                    </span>
                    <span style={{ fontSize: '12px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '2px 10px', borderRadius: '12px', fontWeight: 'bold' }}>
                      👨 남 {selectedMales.length}명 ({malePct}%)
                    </span>
                    <span style={{ fontSize: '12px', background: '#fdf2f8', color: '#be185d', border: '1px solid #fbcfe8', padding: '2px 10px', borderRadius: '12px', fontWeight: 'bold' }}>
                      👩 여 {selectedFemales.length}명 ({femalePct}%)
                    </span>
                  </div>
                  {isTeam && (
                    <span style={{ fontSize: '12px', color: captains.length >= 2 ? '#166534' : '#b45309', fontWeight: 'bold', background: captains.length >= 2 ? '#dcfce7' : '#fef3c7', padding: '2px 10px', borderRadius: '12px', border: `1px solid ${captains.length >= 2 ? '#bbf7d0' : '#fde68a'}` }}>
                      👑 조장 {captains.length}명 지정됨 {captains.length < 2 && '(최소 2명 필요)'}
                    </span>
                  )}
                  {isFixedPair && (
                    <span style={{ fontSize: '12px', color: pairs.length >= 2 ? '#166534' : '#b45309', fontWeight: 'bold', background: pairs.length >= 2 ? '#dcfce7' : '#fef3c7', padding: '2px 10px', borderRadius: '12px', border: `1px solid ${pairs.length >= 2 ? '#bbf7d0' : '#fde68a'}` }}>
                      👫 {pairs.length}페어 구성됨
                    </span>
                  )}
                </div>
              </div>

              {/* 4. 참가자 명단 선택 및 조장 지정 그리드 */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '4px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 'bold', margin: 0, color: 'var(--txt)' }}>
                    참가자 명단 {isTeam ? '및 조장(👑) 지정' : (isFixedPair && fixedPairMethod === 'seed_draw') ? '및 주선수(⭐) 지정' : '체크'}
                  </label>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {isTeam ? '회원을 클릭하여 참석을 선택하고, 왕관(👑) 아이콘을 눌러 조장을 지정하세요.' : (isFixedPair && fixedPairMethod === 'seed_draw') ? '회원을 클릭하여 참석을 선택하고, 별(⭐) 아이콘을 눌러 주선수(시드)를 지정하세요.' : isFixedPair ? '출전할 회원을 선택한 후 하단에서 2인 1조 페어를 구성하세요.' : '회원을 클릭하여 참가 여부를 선택하세요.'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px' }}>
                  {memberList.map(m => {
                    const isSelected = attendees.includes(m.id);
                    const isCaptain = captains.includes(m.id);
                    const isMainPlayer = mainPlayers.includes(m.id);
                    const isFemale = m.gender === 'F';

                    return (
                      <div 
                        key={m.id} 
                        onClick={() => toggleAttendee(m.id)}
                        style={{ 
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '6px',
                          padding: '8px 10px', 
                          border: '1.5px solid',
                          borderColor: isSelected ? (isFemale ? '#f472b6' : '#60a5fa') : 'var(--border)',
                          backgroundColor: isSelected ? (isFemale ? '#fdf2f8' : '#eff6ff') : '#fff',
                          borderRadius: '8px',
                          cursor: isAdmin ? 'pointer' : 'default',
                          userSelect: 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: isSelected ? 800 : 500, fontSize: '13px', color: isSelected ? 'var(--navy)' : 'var(--txt)' }}>
                            {m.name}
                          </span>
                          <span style={{ fontSize: '10px', color: isFemale ? '#be185d' : '#1d4ed8', fontWeight: 700 }}>
                            {isFemale ? '여' : '남'} ({m.ntrp || 2.0})
                          </span>
                        </div>
                        
                        {isTeam && isSelected && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCaptain(m.id);
                            }}
                            disabled={!isAdmin}
                            style={{
                              border: 'none',
                              background: isCaptain ? '#f59e0b' : '#e2e8f0',
                              color: isCaptain ? '#fff' : '#64748b',
                              borderRadius: '4px',
                              padding: '3px 6px',
                              fontSize: '11px',
                              cursor: isAdmin ? 'pointer' : 'default',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '2px',
                              fontWeight: 'bold',
                              marginTop: '2px'
                            }}
                          >
                            👑 {isCaptain ? '조장 지정됨' : '조장 지정'}
                          </button>
                        )}

                        {isFixedPair && fixedPairMethod === 'seed_draw' && isSelected && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleMainPlayer(m.id);
                            }}
                            disabled={!isAdmin}
                            style={{
                              border: 'none',
                              background: isMainPlayer ? '#16a34a' : '#e2e8f0',
                              color: isMainPlayer ? '#fff' : '#64748b',
                              borderRadius: '4px',
                              padding: '3px 6px',
                              fontSize: '11px',
                              cursor: isAdmin ? 'pointer' : 'default',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '2px',
                              fontWeight: 'bold',
                              marginTop: '2px'
                            }}
                          >
                            ⭐ {isMainPlayer ? '주선수(시드) 지정됨' : '주선수로 지정'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 5. 고정 페어(파트너) 구성 관리 카드 (isFixedPair 모드 전용) */}
              {isFixedPair && (
                <div style={{ marginTop: '14px', padding: '16px', backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#166534', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>👫 2인 1조 고정 복식 페어 구성</span>
                        <span className="badge badge-green" style={{ fontSize: '11px' }}>
                          총 {pairs.length}페어 ({pairs.filter(p => p.player1 && p.player2).length * 2}/{attendees.length}명 배정)
                        </span>
                      </h4>
                      <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#15803d' }}>
                        대회 내내 파트너가 고정되어 팀을 이룹니다. 원하는 페어 구성 방식을 선택하여 페어를 생성하세요.
                      </p>
                    </div>

                    {/* 페어 구성 방식 선택 탭 */}
                    <div style={{ display: 'flex', backgroundColor: '#dcfce7', borderRadius: '8px', padding: '3px', gap: '3px', border: '1px solid #86efac' }}>
                      <button
                        type="button"
                        onClick={() => setFixedPairMethod('auto_balance')}
                        style={{
                          border: 'none',
                          padding: '5px 12px',
                          fontSize: '12px',
                          fontWeight: fixedPairMethod === 'auto_balance' ? 'bold' : 'normal',
                          backgroundColor: fixedPairMethod === 'auto_balance' ? '#16a34a' : 'transparent',
                          color: fixedPairMethod === 'auto_balance' ? '#fff' : '#166534',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          boxShadow: fixedPairMethod === 'auto_balance' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                        }}
                      >
                        ⚡ 1. NTRP 균형 자동 매칭
                      </button>
                      <button
                        type="button"
                        onClick={() => setFixedPairMethod('seed_draw')}
                        style={{
                          border: 'none',
                          padding: '5px 12px',
                          fontSize: '12px',
                          fontWeight: fixedPairMethod === 'seed_draw' ? 'bold' : 'normal',
                          backgroundColor: fixedPairMethod === 'seed_draw' ? '#16a34a' : 'transparent',
                          color: fixedPairMethod === 'seed_draw' ? '#fff' : '#166534',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          boxShadow: fixedPairMethod === 'seed_draw' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                        }}
                      >
                        🎲 2. 주선수 지정 후 파트너 랜덤 추첨
                      </button>
                    </div>
                  </div>

                  {/* 방식별 상세 설명 및 액션 버튼 바 */}
                  {fixedPairMethod === 'auto_balance' ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', padding: '10px 14px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #bbf7d0', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ fontSize: '12px', color: '#166534' }}>
                        💡 <strong>NTRP 균형 방식:</strong> 참가자들의 성비 및 NTRP 수준을 고려하여 상위+하위 선수를 밸런스 있게 2인 1조로 자동 매칭합니다.
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          style={{ fontSize: '12px', padding: '4px 10px', backgroundColor: '#16a34a', borderColor: '#16a34a' }}
                          onClick={() => autoMatchFixedPairs()}
                          disabled={!isAdmin || attendees.length < 2}
                        >
                          🎲 NTRP 균형 자동 매칭
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '12px', padding: '4px 10px', backgroundColor: '#fff' }}
                          onClick={handleAddPair}
                          disabled={!isAdmin}
                        >
                          ➕ 페어 추가
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '12px', padding: '4px 10px', backgroundColor: '#fff', color: '#dc2626' }}
                          onClick={() => { if (confirm('모든 페어 구성을 초기화하시겠습니까?')) setPairs([]); }}
                          disabled={!isAdmin || pairs.length === 0}
                        >
                          🧹 초기화
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px', padding: '12px 14px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ fontSize: '12px', color: '#166534' }}>
                          💡 <strong>주선수 지정 & 파트너 랜덤 추첨 방식:</strong> 주선수(시드)를 지정한 뒤, 나머지 참가자들을 <strong>무작위 랜덤(제비뽑기)</strong>으로 추첨하여 페어를 구성합니다.
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '12px', padding: '4px 10px', backgroundColor: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe', fontWeight: 'bold' }}
                            onClick={autoSelectTopNtrAsMain}
                            disabled={!isAdmin || attendees.length < 2}
                          >
                            ⚡ 상위 NTRP {targetPairCount}명 주선수 자동 지정
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            style={{ fontSize: '12px', padding: '4px 12px', backgroundColor: '#16a34a', borderColor: '#16a34a', fontWeight: 'bold' }}
                            onClick={drawRandomPartners}
                            disabled={!isAdmin || mainPlayers.length < 2}
                          >
                            🎲 {pairs.length > 0 ? '🔄 파트너 다시 추첨하기' : '🎲 파트너 랜덤 추첨 (제비뽑기)'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '12px', padding: '4px 10px', backgroundColor: '#fff', color: '#dc2626' }}
                            onClick={() => {
                              if (confirm('주선수 및 페어 구성을 초기화하시겠습니까?')) {
                                setMainPlayers([]);
                                setPairs([]);
                              }
                            }}
                            disabled={!isAdmin || (mainPlayers.length === 0 && pairs.length === 0)}
                          >
                            🧹 초기화
                          </button>
                        </div>
                      </div>

                      {/* 주선수 및 파트너 풀 상태 안내 */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', backgroundColor: '#f8fafc', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 'bold', color: '#166534' }}>⭐ 지정된 주선수 ({mainPlayers.length}/{targetPairCount}명):</span>
                          {mainPlayers.length > 0 ? (
                            mainPlayers.map(id => (
                              <span key={id} style={{ background: '#dcfce7', color: '#166534', border: '1px solid #86efac', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold', fontSize: '11px' }}>
                                {byId[id]?.name} ({byId[id]?.gender === 'M' ? '남' : '여'} / {byId[id]?.ntrp})
                              </span>
                            ))
                          ) : (
                            <span style={{ color: '#94a3b8' }}>상단 참가자 목록에서 ⭐ 버튼을 눌러 지정하거나 자동 지정을 누르세요.</span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 'bold', color: '#475569' }}>🎟️ 파트너 추첨 대상 풀 ({partnerPool.length}명):</span>
                          {partnerPool.length > 0 ? (
                            partnerPool.map(id => (
                              <span key={id} style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '1px 6px', borderRadius: '4px', fontSize: '11px' }}>
                                {byId[id]?.name} ({byId[id]?.gender === 'M' ? '남' : '여'} / {byId[id]?.ntrp})
                              </span>
                            ))
                          ) : (
                            <span style={{ color: '#94a3b8' }}>없음</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {pairs.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', backgroundColor: '#fff', borderRadius: '8px', border: '1px dashed #86efac', color: '#15803d' }}>
                      <p style={{ margin: 0, fontSize: '13px', fontWeight: 'bold' }}>아직 구성된 페어가 없습니다.</p>
                      <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#166534' }}>
                        상단의 <strong>[🎲 NTRP 균형 자동 페어 매칭]</strong> 버튼을 누르면 선택된 참가자들을 자동으로 2인 1조로 구성합니다.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
                      {pairs.map((pair, pIdx) => {
                        const p1 = byId[pair.player1];
                        const p2 = byId[pair.player2];
                        const sumNtrp = ((parseFloat(p1?.ntrp) || 2.0) + (parseFloat(p2?.ntrp) || 2.0)).toFixed(1);
                        let pairType = '복식';
                        if (p1 && p2) {
                          if (p1.gender === 'M' && p2.gender === 'M') pairType = '남복';
                          else if (p1.gender === 'F' && p2.gender === 'F') pairType = '여복';
                          else pairType = '혼복';
                        }

                        return (
                          <div key={pair.id || pIdx} style={{ backgroundColor: '#fff', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <input
                                type="text"
                                className="input input-sm"
                                style={{ fontWeight: 800, fontSize: '13px', width: '120px', padding: '2px 6px', color: '#166534' }}
                                value={pair.name || `${pIdx + 1}페어`}
                                onChange={e => handleUpdatePairName(pair.id, e.target.value)}
                                disabled={!isAdmin}
                              />
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {p1 && p2 && (
                                  <span className="badge badge-purple" style={{ fontSize: '10px', padding: '2px 6px' }}>
                                    {pairType} (NTRP {sumNtrp})
                                  </span>
                                )}
                                {isAdmin && (
                                  <button
                                    type="button"
                                    style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '14px', padding: '0 2px' }}
                                    onClick={() => handleRemovePair(pair.id)}
                                    title="페어 삭제"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              {/* Player 1 Select */}
                              <select
                                className="input input-sm"
                                style={{ flex: 1, fontSize: '12px', padding: '4px 6px' }}
                                value={pair.player1 || ''}
                                onChange={e => handleUpdatePairPlayer(pair.id, 'player1', e.target.value)}
                                disabled={!isAdmin}
                              >
                                <option value="">선수 1 선택</option>
                                {attendees.map(id => {
                                  const m = byId[id];
                                  if (!m) return null;
                                  return (
                                    <option key={id} value={id}>
                                      {m.name} ({m.gender === 'M' ? '남' : '여'} / {m.ntrp || '2.0'})
                                    </option>
                                  );
                                })}
                              </select>

                              <span style={{ fontWeight: 'bold', color: '#16a34a', fontSize: '13px' }}>+</span>

                              {/* Player 2 Select */}
                              <select
                                className="input input-sm"
                                style={{ flex: 1, fontSize: '12px', padding: '4px 6px' }}
                                value={pair.player2 || ''}
                                onChange={e => handleUpdatePairPlayer(pair.id, 'player2', e.target.value)}
                                disabled={!isAdmin}
                              >
                                <option value="">선수 2 선택</option>
                                {attendees.map(id => {
                                  const m = byId[id];
                                  if (!m) return null;
                                  return (
                                    <option key={id} value={id}>
                                      {m.name} ({m.gender === 'M' ? '남' : '여'} / {m.ntrp || '2.0'})
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={handleGoToStep2}>
                다음 (2단계 코트 및 경기수 설정 👉)
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <h2 style={{ margin: 0, color: 'var(--navy)', fontSize: '18px' }}>
              2단계. 코트 및 {isTeam ? '조별' : isFixedPair ? '페어별' : '개인별'} 경기수 설정
            </h2>
            <span className={isTeam ? 'badge badge-blue' : isFixedPair ? 'badge badge-green' : 'badge badge-purple'} style={{ fontSize: '12px' }}>
              {isTeam ? '👥 팀전 모드' : isFixedPair ? '👫 개인전(고정 페어) 모드' : '👤 개인전(순환) 모드'}
            </span>
          </div>
          
          {/* 1단계 완료 요약 정보 */}
          <div style={{ marginBottom: '20px', padding: '12px 16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', fontSize: '13px', color: '#166534', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div>
              <strong>⚙️ 1단계 설정 요약:</strong> 📅 {date} | ⏰ {startTime}~{endTime} ({durationInfo.text}) | 💰 1인 {entryFee > 0 ? `${entryFee.toLocaleString()}원` : '무료'} (총 {(totalCount * entryFee).toLocaleString()}원)
            </div>
            <div>
              🎾 <strong>참석 명단:</strong> 총 {totalCount}명 (남 {selectedMales.length}명 / 여 {selectedFemales.length}명)
              {isTeam && (
                <> | 👑 <strong>지정된 조장 ({captains.length}명):</strong> {captains.map(cid => byId[cid]?.name).join(', ')}</>
              )}
            </div>
            {isFixedPair && (
              <div>
                👫 <strong>확정된 고정 페어 ({pairs.length}페어):</strong> {pairs.map(p => `${p.name || '페어'}(${byId[p.player1]?.name || '선수1'}/${byId[p.player2]?.name || '선수2'})`).join(', ')}
              </div>
            )}
            <div style={{ fontSize: '12px', color: '#15803d' }}>
              📜 <strong>경기 규칙:</strong> 복식 핸디캡, 타이브레이크, No-Ad 규칙 설정됨
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid var(--border)' }}>
            
            {/* 1. 코트 설정 */}
            <div style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 'bold', margin: 0, color: 'var(--txt)' }}>코트 설정 (코트명 및 코트당 경기수)</label>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  자동 세팅: {maxAllowedSets}경기/코트
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {courtDetails.map((court) => (
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

            {/* 2. 경기수 설정 */}
            <div style={{ width: '100%', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 'bold', margin: 0, color: 'var(--txt)' }}>
                  {isTeam ? '조별 경기수 (팀당 경기수)' : isFixedPair ? '페어별 경기수 (1페어당 경기수)' : '개인별 경기수 (1인당 경기수)'}
                </label>
                <span style={{ fontSize: '11px', color: '#16a34a', background: '#dcfce7', padding: '2px 8px', borderRadius: '12px' }}>
                  💡 {isTeam ? `시간/코트/조(${captains.length}팀) 기반 자동 추천: ${gamesPerTeam}경기` : isFixedPair ? `시간/코트/페어(${pairs.length}페어) 기반 추천: ${gamesPerTeam}경기` : `시간/코트/인원수(${totalCount}명) 기반 자동 추천: ${gamesPerTeam}경기`}
                </span>
              </div>
              <select 
                className="input" 
                value={gamesPerTeam} 
                onChange={e => setGamesPerTeam(parseInt(e.target.value) || 3)} 
                disabled={!isAdmin} 
                style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}
              >
                {[1,2,3,4,5,6,7,8,9,10,11,12,14,16].map(g => (
                  <option key={g} value={g}>{g}경기</option>
                ))}
              </select>
            </div>

          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <button className="btn btn-secondary" onClick={() => setDraftStep(1)}>
              👈 이전 (일정/참석자 수정)
            </button>
            {isAdmin && (
              <button 
                className="btn btn-primary" 
                style={{ 
                  fontWeight: 'bold',
                  background: isIndividual ? 'linear-gradient(135deg, #7c3aed, #4f46e5)' : 'var(--blue)',
                  border: 'none',
                  padding: '8px 18px'
                }} 
                onClick={handleConfirmStep2}
              >
                {isIndividual ? '🎾 대진표 자동 생성 및 4단계 경기 시작 👉' : '3단계. 팀원 배정 및 선수 구성 시작 👉'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 참가비 입금 안내문 생성 및 공유 모달 */}
      {showFeeNoticeModal && (
        <div className="modal-overlay" onClick={() => setShowFeeNoticeModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '540px', width: '100%' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 'bold', color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                📢 정기 대회 참가비 입금 안내문
              </h2>
              <button 
                className="modal-close" 
                onClick={() => setShowFeeNoticeModal(false)} 
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                &times;
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                아래 생성된 안내문을 확인 및 필요시 수정한 후, <strong>복사하기</strong> 또는 <strong>공유하기</strong> 버튼을 눌러 회원들에게 전달하세요.
              </p>

              <textarea
                className="input"
                style={{
                  width: '100%',
                  height: '240px',
                  resize: 'vertical',
                  padding: '12px',
                  lineHeight: '1.6',
                  fontFamily: 'inherit',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                  backgroundColor: '#f8fafc',
                  border: '1.5px solid var(--border)'
                }}
                value={feeNoticeText}
                onChange={(e) => setFeeNoticeText(e.target.value)}
              />
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={() => setShowFeeNoticeModal(false)}>
                닫기
              </button>
              <button 
                className="btn btn-primary" 
                onClick={() => {
                  navigator.clipboard.writeText(feeNoticeText)
                    .then(() => alert('📋 참가비 안내문이 클립보드에 복사되었습니다.\n카카오톡이나 밴드 등에 붙여넣기(Ctrl+V) 하세요!'))
                    .catch(() => alert('복사에 실패했습니다.'));
                }}
              >
                📋 복사하기
              </button>
              {typeof navigator !== 'undefined' && navigator.share && (
                <button 
                  className="btn btn-primary" 
                  style={{ background: '#fee500', color: '#3c1e1e', borderColor: '#fee500', fontWeight: 'bold' }} 
                  onClick={() => {
                    navigator.share({ title: `${tournament.title || '정기 대회'} 참가비 입금 안내`, text: feeNoticeText }).catch(console.error);
                  }}
                >
                  💬 공유하기
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

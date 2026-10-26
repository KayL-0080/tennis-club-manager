// components/tabs/SettingsTab.js — 오늘 참가자 선택 + 라운드/코트 + 특별조건 + 대진표 생성
'use client';
import { useState, useEffect, useRef } from 'react';
import { generateSchedule, makeEmptyMatch, calculateRecommendedSettings, splitPlayersByNtrp, calcDefaultSplitRounds } from '@/lib/scheduler';
import { addMember } from '@/lib/firestore';
import styles from './tabs.module.css';

let _gCounter = 2000;
const newGid = () => 'grp' + _gCounter++;

const numOptions = (min, max) => {
  const opts = [];
  for (let i = min; i <= max; i++) opts.push(<option key={i} value={i}>{i}</option>);
  return opts;
};

export default function SettingsTab({
  events = [],
  matchDate, setMatchDate,
  members, participants, setParticipants,
  rounds, setRounds, courts, setCourts,
  mensDoublesCount, setMensDoublesCount,
  womensDoublesCount, setWomensDoublesCount,
  mixedCount, setMixedCount,
  jointCount, setJointCount,
  allowSingles, setAllowSingles,
  startTime, setStartTime, endTime, setEndTime,
  usePenalty = false, setUsePenalty,
  maxGames: propMaxGames, setMaxGames: propSetMaxGames,
  ntrpSplitMode: propNtrpSplitMode, setNtrpSplitMode: propSetNtrpSplitMode,
  ntrpSplitRounds: propNtrpSplitRounds, setNtrpSplitRounds: propSetNtrpSplitRounds,
  groups, setGroups,
  onScheduleGenerated, onScheduleManual, onSave, onSaveAndExit, onGoto, onReloadMembers
}) {
  const [status, setStatus] = useState('');
  const [warnMsg, setWarnMsg] = useState('');
  const [generating, setGenerating] = useState(false);
  const [enableConditions, setEnableConditions] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState([]);
  const [recExplanation, setRecExplanation] = useState('');
  const [recNotice, setRecNotice] = useState('');
  const lastAutoSyncedDateRef = useRef(null);

  const [localMaxGames, setLocalMaxGames] = useState(6);
  const [ensureMin4Games, setEnsureMin4Games] = useState(true);
  const effectiveMaxGames = propMaxGames !== undefined ? propMaxGames : localMaxGames;
  const setEffectiveMaxGames = propSetMaxGames || setLocalMaxGames;

  const [localNtrpSplitMode, setLocalNtrpSplitMode] = useState(false);
  const [localNtrpSplitRounds, setLocalNtrpSplitRounds] = useState(() => calcDefaultSplitRounds(startTime, endTime, rounds));
  const [sortByNtrp, setSortByNtrp] = useState(false);

  const effectiveSplitMode = propNtrpSplitMode !== undefined ? propNtrpSplitMode : localNtrpSplitMode;
  const setEffectiveSplitMode = propSetNtrpSplitMode || setLocalNtrpSplitMode;
  const effectiveSplitRounds = propNtrpSplitRounds !== undefined
    ? Math.max(1, Math.min(Math.max(1, (rounds || 2) - 1), Number(propNtrpSplitRounds) || 1))
    : Math.max(1, Math.min(Math.max(1, (rounds || 2) - 1), Number(localNtrpSplitRounds) || 1));
  const setEffectiveSplitRounds = propSetNtrpSplitRounds || setLocalNtrpSplitRounds;

  // 시작/종료 시간이나 총 라운드 수가 변경될 때 앞 2시간 기준 분리 라운드 자동 업데이트
  useEffect(() => {
    const autoR = calcDefaultSplitRounds(startTime, endTime, rounds);
    setEffectiveSplitRounds(autoR);
  }, [startTime, endTime, rounds]);

  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestMode, setGuestMode] = useState('POOL'); // 'POOL' (게스트 풀에서 선택) | 'NEW' (신규 게스트 입력)
  const [selectedGuestsToAdd, setSelectedGuestsToAdd] = useState([]);
  const [guestForm, setGuestForm] = useState({ name: '', gender: 'M', ntrp: 2.0 });

  const isGuestMember = (m) => Boolean(
    m && (
      m.role === '게스트' ||
      (typeof m.role === 'string' && m.role.includes('게스트')) ||
      m.isGuest === true
    )
  );

  // 🗓️ 경기날짜가 정기모임 투표날짜와 일치할 경우 시작/종료시간 자동 동기화
  useEffect(() => {
    if (!matchDate || !events || events.length === 0) return;
    const evt = events.find(e => e.date === matchDate);
    if (evt && lastAutoSyncedDateRef.current !== matchDate) {
      lastAutoSyncedDateRef.current = matchDate;
      const sTime = evt.startTime || startTime;
      const eTime = evt.endTime || endTime;
      let needUpdate = false;
      if (evt.startTime && evt.startTime !== startTime) {
        setStartTime(evt.startTime);
        needUpdate = true;
      }
      if (evt.endTime && evt.endTime !== endTime) {
        setEndTime(evt.endTime);
        needUpdate = true;
      }
      if (needUpdate) {
        if (participants.length > 0) {
          applyRecommendation(participants, sTime, eTime, courts);
        } else {
          const rec = calculateRecommendedSettings({ startTime: sTime, endTime: eTime, courts, participants, members });
          setRounds(rec.rounds);
        }
        setRecNotice(`🗓️ ${matchDate} 정기모임 투표 시간(${sTime} ~ ${eTime})이 시작/종료시간에 자동 반영되었습니다.`);
        setTimeout(() => setRecNotice(''), 4000);
      }
    } else if (!evt) {
      lastAutoSyncedDateRef.current = matchDate;
    }
  }, [matchDate, events]);

  const handleMatchDateChange = (newDate) => {
    setMatchDate(newDate);
    const evt = events.find(e => e.date === newDate);
    if (evt) {
      lastAutoSyncedDateRef.current = newDate;
      const sTime = evt.startTime || startTime;
      const eTime = evt.endTime || endTime;
      if (evt.startTime) setStartTime(evt.startTime);
      if (evt.endTime) setEndTime(evt.endTime);
      if (participants.length > 0) {
        applyRecommendation(participants, sTime, eTime, courts);
      } else {
        const rec = calculateRecommendedSettings({ startTime: sTime, endTime: eTime, courts, participants, members });
        setRounds(rec.rounds);
      }
      setRecNotice(`🗓️ ${newDate} 정기모임 투표 시간(${sTime} ~ ${eTime})이 시작/종료시간에 자동 반영되었습니다.`);
      setTimeout(() => setRecNotice(''), 4000);
    }
  };

  // 경기 시간(분 및 포맷) 계산
  const calcDuration = (start, end) => {
    if (!start || !end) return { text: '3시간 (180분)', diff: 180, hours: 3, mins: 0 };
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    let diff = (eH * 60 + eM) - (sH * 60 + sM);
    if (diff <= 0) diff += 24 * 60;
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    const text = `${hours > 0 ? `${hours}시간 ` : ''}${mins > 0 ? `${mins}분` : ''}`.trim() || '0분';
    return { text: `${text} (${diff}분)`, diff, hours, mins };
  };
  const durationInfo = calcDuration(startTime, endTime);

  // 균등 배분 계산 헬퍼
  const computeBalancedParticipants = (pts, rCount = rounds, cCount = courts, allowS = allowSingles) => {
    const n = pts.length;
    if (n === 0) return pts;
    const isSActive = allowS && n < cCount * 4 && n > 0;
    const sPerRound = isSActive ? Math.min(cCount, Math.ceil((cCount * 4 - n) / 2)) : 0;
    const dPerRound = cCount - sPerRound;
    const sSlots = sPerRound * 2 + dPerRound * 4;
    const tSlots = rCount * sSlots;
    if (tSlots <= 0) return pts;
    const base = Math.floor(tSlots / n);
    let rem = tSlots - base * n;
    return pts.map((pt, i) => ({ ...pt, target: base + (i < rem ? 1 : 0) }));
  };

  // 추천 설정 적용 함수
  const applyRecommendation = (
    pts = participants,
    sTime = startTime,
    eTime = endTime,
    numCourts = courts,
    preferredMaxGames = null,
    min4 = ensureMin4Games
  ) => {
    const rec = calculateRecommendedSettings({
      startTime: sTime,
      endTime: eTime,
      courts: numCourts,
      participants: pts,
      members,
      preferredMaxGames,
      ensureMin4Games: min4
    });

    setRounds(rec.rounds);
    if (rec.maxGames) setEffectiveMaxGames(rec.maxGames);
    setMensDoublesCount(rec.mensDoublesCount);
    setWomensDoublesCount(rec.womensDoublesCount);
    setMixedCount(rec.mixedCount);
    setJointCount(rec.jointCount);
    setRecExplanation(rec.explanation);

    if (pts.length > 0) {
      const balanced = computeBalancedParticipants(pts, rec.rounds, numCourts, allowSingles);
      setParticipants(balanced);
    }
    if (rec.autoSwitchedTo5) {
      setRecNotice(`⚡ 참가자(${pts.length}명) 전원 최소 4게임 보장을 위해 [5게임 선승제 · ${rec.rounds}라운드]로 자동 맞춤 세팅되었습니다.`);
    } else if (preferredMaxGames === 5 || preferredMaxGames === 6) {
      setRecNotice(`🎾 [${preferredMaxGames}게임 선승제 · ${rec.rounds}라운드] 기준으로 경기 수와 목표 게임수가 자동 세팅되었습니다.`);
    } else {
      setRecNotice('💡 3단계 설정이 추천값으로 자동 반영되었습니다.');
    }
    setTimeout(() => setRecNotice(''), 4500);
  };

  // 경기 방식(5게임 / 6게임) 수동 선택 핸들러
  const handleSelectMaxGames = (gameType) => {
    setEffectiveMaxGames(gameType);
    applyRecommendation(participants, startTime, endTime, courts, gameType, ensureMin4Games);
  };

  // 인당 최소 4게임 보장 토글 핸들러
  const handleToggleEnsureMin4 = (checked) => {
    setEnsureMin4Games(checked);
    if (checked && participants.length >= 4) {
      applyRecommendation(participants, startTime, endTime, courts, null, true);
    } else {
      applyRecommendation(participants, startTime, endTime, courts, effectiveMaxGames, checked);
    }
  };

  // 원클릭으로 즉시 5게임제 + 전원 최소 4게임 이상 보장 맞추기
  const enforceMin4GamesNow = () => {
    setEnsureMin4Games(true);
    applyRecommendation(participants, startTime, endTime, courts, 5, true);
  };

  // 시간 변경 핸들러
  const handleStartTimeChange = (newStart) => {
    setStartTime(newStart);
    if (participants.length > 0) {
      applyRecommendation(participants, newStart, endTime, courts);
    } else {
      const rec = calculateRecommendedSettings({ startTime: newStart, endTime, courts, participants, members });
      setRounds(rec.rounds);
    }
  };

  const handleEndTimeChange = (newEnd) => {
    setEndTime(newEnd);
    if (participants.length > 0) {
      applyRecommendation(participants, startTime, newEnd, courts);
    } else {
      const rec = calculateRecommendedSettings({ startTime, endTime: newEnd, courts, participants, members });
      setRounds(rec.rounds);
    }
  };

  // 시간 프리셋 적용 (시작 시간 기준)
  const applyDurationPreset = (hoursToAdd, minsToAdd = 0) => {
    const [sH, sM] = (startTime || '09:00').split(':').map(Number);
    let totalMinutes = sH * 60 + sM + hoursToAdd * 60 + minsToAdd;
    if (totalMinutes >= 24 * 60) totalMinutes %= 24 * 60;
    const newEH = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
    const newEM = String(totalMinutes % 60).padStart(2, '0');
    const newEnd = `${newEH}:${newEM}`;
    handleEndTimeChange(newEnd);
  };

  // 참가자로 포함 여부
  const isParticipant = id => participants.some(pt => pt.playerId === id);

  const addParticipant = id => {
    if (!id || isParticipant(id)) return;
    const newPts = [...participants, { playerId: id, target: 0 }];
    applyRecommendation(newPts, startTime, endTime, courts);
  };
  const removeParticipant = id => {
    const newPts = participants.filter(pt => pt.playerId !== id);
    if (newPts.length > 0) {
      applyRecommendation(newPts, startTime, endTime, courts);
    } else {
      setParticipants([]);
      setMensDoublesCount(0);
      setWomensDoublesCount(0);
      setMixedCount(0);
      setJointCount(0);
      setRecExplanation('');
    }
  };
  const addAll = () => {
    const regularIds = members.filter(m => !isGuestMember(m)).map(m => m.id);
    const existingGuestPts = participants.filter(pt => {
      const m = members.find(x => x.id === pt.playerId);
      return isGuestMember(m);
    });
    const newPts = [
      ...regularIds.map(id => ({ playerId: id, target: 0 })),
      ...existingGuestPts.map(pt => ({ playerId: pt.playerId, target: 0 }))
    ];
    applyRecommendation(newPts, startTime, endTime, courts);
  };
  const clearAll = () => {
    if (!confirm('참가자 전체를 제외할까요?')) return;
    setParticipants([]);
    setMensDoublesCount(0);
    setWomensDoublesCount(0);
    setMixedCount(0);
    setJointCount(0);
    setRecExplanation('');
  };

  const matchedEvent = events.find(e => e.date === matchDate);
  const loadFromVote = () => {
    if (!matchedEvent) return;
    const attendingIds = Object.entries(matchedEvent.attendees || {})
      .filter(([id, status]) => status === 'Y')
      .map(([id]) => id);
    
    if (attendingIds.length === 0) {
      alert('참석 투표에 "참석"으로 표시된 인원이 없습니다.');
      return;
    }
    
    if (confirm(`투표에서 참석으로 표시된 ${attendingIds.length}명을 불러오시겠습니까?\n(기존 참가자 목록이 교체되며 3단계 설정이 추천값으로 세팅됩니다.)`)) {
      // NTRP 높은 순서대로 정렬하여 참가자 목록 구성
      const sortedIds = attendingIds.slice().sort((idA, idB) => {
        const mA = members.find(m => m.id === idA);
        const mB = members.find(m => m.id === idB);
        const diff = Number(mB?.ntrp || 0) - Number(mA?.ntrp || 0);
        if (diff !== 0) return diff;
        return (mA?.name || '').localeCompare(mB?.name || '', 'ko');
      });
      const newPts = sortedIds.map(id => ({ playerId: id, target: 0 }));
      const sTime = matchedEvent.startTime || startTime;
      const eTime = matchedEvent.endTime || endTime;
      if (matchedEvent.startTime) setStartTime(matchedEvent.startTime);
      if (matchedEvent.endTime) setEndTime(matchedEvent.endTime);
      setSortByNtrp(true);
      applyRecommendation(newPts, sTime, eTime, courts);
    }
  };

  const toggleSelectToAdd = (id, isChecked) => {
    setSelectedToAdd(prev => isChecked ? [...prev, id] : prev.filter(x => x !== id));
  };
  const addSelectedParticipants = () => {
    if (selectedToAdd.length === 0) return;
    const newPts = [...participants, ...selectedToAdd.map(id => ({ playerId: id, target: 0 }))];
    setSelectedToAdd([]);
    applyRecommendation(newPts, startTime, endTime, courts);
  };

  const toggleSelectGuestToAdd = (id, isChecked) => {
    setSelectedGuestsToAdd(prev => isChecked ? [...prev, id] : prev.filter(x => x !== id));
  };

  const addSelectedGuestsFromPool = () => {
    if (selectedGuestsToAdd.length === 0) return;
    const newPts = [
      ...participants,
      ...selectedGuestsToAdd.filter(id => !isParticipant(id)).map(id => ({ playerId: id, target: 0 }))
    ];
    setSelectedGuestsToAdd([]);
    setShowGuestForm(false);
    applyRecommendation(newPts, startTime, endTime, courts);
  };

  const handleAddGuest = async (e) => {
    e.preventDefault();
    if (!guestForm.name.trim()) return;
    try {
      const newId = await addMember('shared', {
        ...guestForm,
        name: guestForm.name.trim(),
        role: '게스트',
        isGuest: true
      });
      if (onReloadMembers) await onReloadMembers();
      const newPts = [...participants, { playerId: newId, target: 0 }];
      setShowGuestForm(false);
      setGuestForm({ name: '', gender: 'M', ntrp: 2.0 });
      applyRecommendation(newPts, startTime, endTime, courts);
    } catch (err) {
      alert('게스트 추가 실패: ' + err.message);
    }
  };

  const updateTarget = (playerId, val) => {
    setParticipants(prev => prev.map(pt => pt.playerId === playerId ? { ...pt, target: parseInt(val) || 0 } : pt));
  };

  const isSinglesActive = allowSingles && participants.length < courts * 4 && participants.length > 0;
  const singlesPerRound = isSinglesActive ? Math.min(courts, Math.ceil((courts * 4 - participants.length) / 2)) : 0;
  const doublesPerRound = courts - singlesPerRound;
  const slotsPerRound = singlesPerRound * 2 + doublesPerRound * 4;
  const totalSlots = rounds * slotsPerRound;
  
  const autoBalance = () => {
    const balanced = computeBalancedParticipants(participants, rounds, courts, allowSingles);
    setParticipants(balanced);
  };

  const targetSum = participants.reduce((s, pt) => s + (pt.target || 0), 0);
  const isBalanced = totalSlots === targetSum && totalSlots > 0 && participants.length >= 2;

  // 참가자 상세 (이름/성별/NTRP 포함)
  const getEntry = id => members.find(m => m.id === id);
  const entries = participants.map(pt => {
    const m = getEntry(pt.playerId);
    return m ? { ...m, target: pt.target } : null;
  }).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));

  const ntrpSplitInfo = splitPlayersByNtrp(entries);
  const displayEntries = (effectiveSplitMode || sortByNtrp) ? ntrpSplitInfo.sorted : entries;

  const maleCount = entries.filter(e => e.gender === 'M').length;
  const femaleCount = entries.filter(e => e.gender === 'F').length;

  // 인당 최소 4게임 보장 관련 통계 계산
  const numCourtsSafe = Math.max(1, courts || 2);
  const minRoundsFor4Games = entries.length >= 4 ? Math.min(20, Math.ceil(entries.length / numCourtsSafe)) : rounds;
  const std6GameRounds = Math.max(1, Math.min(20, Math.round(durationInfo.diff / 30)));
  const std5GameRounds = Math.max(std6GameRounds + 1, Math.min(20, Math.round(durationInfo.diff / 25)));
  const recommended5GameRounds = Math.max(std5GameRounds, minRoundsFor4Games);
  const minsPerRoundCurrent = Math.max(10, Math.round(durationInfo.diff / Math.max(1, rounds)));
  const under4Players = entries.filter(p => (p.target || 0) < 4);
  const minAssignedTarget = entries.length > 0 ? Math.min(...entries.map(p => p.target || 0)) : 0;
  const maxAssignedTarget = entries.length > 0 ? Math.max(...entries.map(p => p.target || 0)) : 0;
  const isAllAtLeast4Games = entries.length >= 4 && under4Players.length === 0;

  // 특별 조건 그룹 추가
  const addGroup = e => {
    e.preventDefault();
    const form = e.currentTarget;
    const ids = ['g1', 'g2', 'g3', 'g4'].map(n => form[n].value);
    const count = parseInt(form.gCount.value) || 1;
    if (ids.some(id => !id) || new Set(ids).size < 4) { alert('오늘 참가자 중 4명을 서로 다르게 선택해주세요.'); return; }
    setGroups(prev => [...prev, { id: newGid(), memberIds: ids, count }]);
    form.reset();
  };

  const removeGroup = id => setGroups(prev => prev.filter(g => g.id !== id));

  // 자동 생성
  const runGeneration = () => {
    setGenerating(true);
    setStatus('생성 중... (최대 3초)');
    setWarnMsg('');
    setTimeout(() => {
      const validGroups = groups.filter(g => g.memberIds.every(id => entries.some(p => p.id === id)));
      const activeGroups = enableConditions ? validGroups.map(g => ({ memberIds: g.memberIds, count: g.count })) : [];
      const opts = { 
        groups: activeGroups, 
        mensDoublesCount, womensDoublesCount, mixedCount, jointCount, 
        singlesPerRound,
        noFF: true,
        ntrpSplitMode: effectiveSplitMode,
        splitRounds: effectiveSplitRounds,
        startTime,
        endTime
      };
      const { result, attempts, failReasons } = generateSchedule(entries, rounds, courts, opts, 2500, 3000);
      setGenerating(false);
      setStatus(`시도 ${attempts}회 완료`);
      if (!result) {
        const KoreanReasons = {
          group_need_exhausted: "• 특별 조건 멤버의 목표 게임수 부족 (특별 조건 멤버들의 '목표 게임수'가 조건에 설정된 게임수보다 작음)",
          mens_not_enough_males: "• 남성 참가자 부족 (남식 복식을 위한 남성 회원 또는 남성 회원의 잔여 목표 게임수가 부족함)",
          mixed_not_enough_females: "• 여성 참가자 부족 (혼식 복식에 배정할 여성 회원 또는 여성 회원의 잔여 목표 게임수가 부족함)",
          mixed_not_enough_males: "• 남성 참가자 부족 (혼식 복식에 배정할 남성 회원 또는 남성 회원의 잔여 목표 게임수가 부족함)",
          singles_avail_lt_2: "• 단식 배정 인원 부족 (단식 경기를 위한 잔여 목표 게임수가 있는 참가자가 2명 미만임)",
          singles_pick_null: "• 단식 조합 불가능 (설정된 단식 경기 수에 맞는 조합을 찾을 수 없습니다)",
          joint_not_enough_players: "• 잡복 대기 참가자 부족 (잡식 복식을 채우기 위한 잔여 목표 게임수가 있는 참가자가 부족함)",
          joint_pick_null: "• 잡복 구성 불가능 (잡식 복식 조건을 맞추어 4인을 구성할 수 없습니다. 성비 또는 목표 게임수를 조절해주세요)",
          freeCount_negative: "• 특별/남복/혼복/잡복 조건 초과 (설정된 게임 수의 합이 총 경기 수(라운드×코트)보다 많음)",
          free_avail_lt_4: "• 대기 인원 부족 (남은 경기를 채울 대기 참가자가 4명 미만임. 참가자를 추가하거나 목표 게임수를 넓혀주세요)",
          free_pick_null: "• 성비 불균형 (남녀 참가자 비율 또는 특정 성별의 목표 게임수가 한쪽으로 너무 치우침)",
          leftover_need: "• 목표 게임수 불일치 (참가자들의 목표 게임수 합계가 '라운드 × 코트 × 4'와 완벽히 맞물리지 않음)",
          partition_round_fail: "• 라운드 중복 배정 한계 (특정 인원의 목표 게임수가 라운드 수보다 많거나 한 라운드에 동시 출전이 강제되어 분할 실패)"
        };

        const reasonsText = Object.entries(failReasons)
          .map(([k, v]) => {
            const desc = KoreanReasons[k] || k;
            return `${desc}`;
          })
          .join('\n');

        setWarnMsg(`조건을 만족하는 대진표를 찾지 못했습니다. 아래 추천 해결 조건을 참고하여 설정을 조정해보세요.\n\n[주요 실패 원인 분석]\n${reasonsText}\n\n💡 [추천 해결 가이드]\n1. '목표 게임수 자동 균등배분' 버튼을 눌러 참가자들의 목표 게임수 합계와 필요 게임수를 일치시켜 보세요.\n2. 특정 인원의 '목표 게임수'가 전체 '라운드 수'보다 크지 않도록 조절하세요. (한 사람이 같은 라운드에 두 번 뛸 수는 없습니다.)\n3. 여성 회원 수가 적다면 '혼복 게임 수'를 줄이거나 없애서 대진 조건을 완화해 보세요.`);
        return;
      }
      onScheduleGenerated(result.scheduleRounds, {
        dupCount: result.dupCount,
        ntrpDiffSum: result.ntrpDiffSum,
        ntrpSplitMode: !!effectiveSplitMode,
        splitRounds: effectiveSplitMode ? effectiveSplitRounds : null,
        maxGames: effectiveMaxGames
      });
      onGoto('bracket');
    }, 50);
  };

  // 빈 대진표 직접 만들기
  const createManual = () => {
    if (!confirm('빈 대진표를 만들겠습니까? 기존 대진표와 점수는 초기화됩니다.')) return;
    const sched = [];
    for (let r = 0; r < rounds; r++) {
      const round = [];
      for (let c = 0; c < courts; c++) round.push(makeEmptyMatch());
      sched.push(round);
    }
    onScheduleManual(sched);
    onGoto('bracket');
  };

  // 2단계 기본 참가자 선택 목록: 정회원(임원·정회원·준회원)만 표시 (게스트 제외)
  const availableToAdd = members
    .filter(m => !isGuestMember(m) && !isParticipant(m.id))
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));

  // 게스트 풀에서 아직 오늘 참가자로 선택되지 않은 게스트 목록 (NTRP 높은 순)
  const availableGuestPool = members
    .filter(m => isGuestMember(m) && !isParticipant(m.id))
    .sort((a, b) => (Number(b.ntrp) || 0) - (Number(a.ntrp) || 0) || (a.name || '').localeCompare(b.name || '', 'ko'));

  // 오늘 참가자로 이미 추가된 게스트 목록
  const participatingGuests = entries.filter(e => isGuestMember(e));
  const participatingRegularCount = entries.length - participatingGuests.length;

  const sumMatches = (mensDoublesCount || 0) + (womensDoublesCount || 0) + (mixedCount || 0) + (jointCount || 0);
  const requiredMatches = rounds * doublesPerRound;
  const isMatchSumOk = sumMatches <= requiredMatches;

  return (
    <div>
      {/* 1단계: 경기 일시 및 시간 설정 */}
      <div className={`card ${styles.section}`} style={{ overflow: 'hidden', maxWidth: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <h2 className={styles.sectionTitle} style={{ margin: 0, paddingBottom: 0, borderBottom: 'none' }}>1단계: 경기 일시 및 시간 설정</h2>
          {matchedEvent && (
            <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '6px', background: 'rgba(22, 163, 74, 0.12)', color: '#15803d', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              🗓️ 정기모임 투표 시간 연동됨 ({matchedEvent.startTime || startTime} ~ {matchedEvent.endTime || endTime})
            </span>
          )}
        </div>

        {recNotice && (
          <div style={{
            margin: '0 0 14px 0',
            padding: '10px 14px',
            borderRadius: '8px',
            background: '#f0fdf4',
            border: '1px solid #86efac',
            color: '#166534',
            fontSize: '13px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>✨</span>
            <span>{recNotice}</span>
          </div>
        )}
        
        <div className={styles.step1DateTimeContainer} style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
          {/* 1. 경기 날짜 (카드 전체 폭 100%) */}
          <div className={styles.step1FormGroup} style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
            <label className={styles.step1Label}>
              <span>📅</span> 경기 날짜
            </label>
            <input
              className={styles.step1Input}
              type="date"
              value={matchDate}
              onChange={e => handleMatchDateChange(e.target.value)}
              style={{ display: 'block', width: '100%', minWidth: '100%', maxWidth: '100%', boxSizing: 'border-box' }}
            />
          </div>

          {/* 2. 시작 시간 & 종료 시간 (1:1 균등 대칭 2열) */}
          <div className={styles.step1TimeGrid} style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
            <div className={styles.step1FormGroup} style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
              <label className={styles.step1Label}>
                <span>⏰</span> 시작 시간
              </label>
              <input
                className={styles.step1Input}
                type="time"
                value={startTime || '09:00'}
                onChange={e => handleStartTimeChange(e.target.value)}
                style={{ display: 'block', width: '100%', minWidth: '100%', maxWidth: '100%', boxSizing: 'border-box', textAlign: 'center' }}
              />
            </div>
            <div className={styles.step1FormGroup} style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
              <label className={styles.step1Label}>
                <span>🏁</span> 종료 시간
              </label>
              <input
                className={styles.step1Input}
                type="time"
                value={endTime || '12:00'}
                onChange={e => handleEndTimeChange(e.target.value)}
                style={{ display: 'block', width: '100%', minWidth: '100%', maxWidth: '100%', boxSizing: 'border-box', textAlign: 'center' }}
              />
            </div>
          </div>
          
          <div className={styles.step1DurationRow}>
            <div className={styles.step1DurationBadge}>
              <span>⏱️</span>
              <span>총 <strong>{durationInfo.text}</strong></span>
            </div>
            
            {/* 시간 빠른 프리셋 버튼 */}
            <div className={styles.step1PresetGroup}>
              {[
                { label: '2시간', h: 2, m: 0 },
                { label: '2.5시간', h: 2, m: 30 },
                { label: '3시간', h: 3, m: 0 },
                { label: '4시간', h: 4, m: 0 }
              ].map(preset => {
                const isActive = preset.h === durationInfo.hours && preset.m === durationInfo.mins;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    className={isActive ? styles.step1PresetBtnActive : styles.step1PresetBtn}
                    onClick={() => applyDurationPreset(preset.h, preset.m)}
                    title={`시작 시간(${startTime || '09:00'}) 기준 ${preset.label} 경기`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 2단계: 참가자 선택 */}
      <div className={`card ${styles.section}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h2 className={styles.sectionTitle} style={{ margin: 0, paddingBottom: 0, borderBottom: 'none' }}>2단계: 참가자 선택</h2>
            {participants.length > 0 && (
              <span style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '12px', backgroundColor: 'var(--bg)', border: '1px solid var(--border)', fontWeight: '700' }}>
                👥 총 {participants.length}명 (정회원 {participatingRegularCount} · 게스트 {participatingGuests.length}) | <span style={{ color: '#2563eb' }}>남 {maleCount}명</span> · <span style={{ color: '#9333ea' }}>여 {femaleCount}명</span>
              </span>
            )}
          </div>
          <button 
            className="btn btn-primary btn-sm" 
            onClick={loadFromVote}
            disabled={!matchedEvent}
            type="button"
          >
            🗓️ 참석 투표 불러오기 {matchedEvent ? `(참석 ${Object.values(matchedEvent.attendees || {}).filter(v => v === 'Y').length}명)` : '(투표 없음)'}
          </button>
        </div>

        {recNotice && (
          <div style={{ marginBottom: '12px', padding: '8px 12px', borderRadius: '6px', backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#16a34a', fontSize: '13px', fontWeight: '700' }}>
            {recNotice}
          </div>
        )}

        {/* 정회원 선택 영역 (게스트 제외) */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#1e293b' }}>
              🎾 정회원 명단에서 선택 <span style={{ color: '#64748b', fontWeight: 600 }}>(미선택 정회원 {availableToAdd.length}명)</span>
            </span>
            {selectedToAdd.length > 0 && (
              <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#2563eb' }}>
                ✓ {selectedToAdd.length}명 선택됨
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '10px', border: '1px solid var(--border)', borderRadius: '8px', maxHeight: '160px', overflowY: 'auto', background: 'var(--bg)' }}>
            {availableToAdd.length === 0 ? (
              <span className="text-muted" style={{ fontSize: 13 }}>추가할 정회원이 없습니다.</span>
            ) : (
              availableToAdd.map(m => (
                <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', background: 'var(--bg-card)', padding: '4px 8px', borderRadius: '6px', border: selectedToAdd.includes(m.id) ? '1.5px solid #2563eb' : '1px solid var(--border)', fontSize: 13.5, fontWeight: selectedToAdd.includes(m.id) ? 700 : 500 }}>
                  <input type="checkbox" checked={selectedToAdd.includes(m.id)} onChange={e => toggleSelectToAdd(m.id, e.target.checked)} />
                  <span>{m.name}</span>
                  <span style={{ fontSize: '10.5px', color: m.gender === 'F' ? '#9333ea' : '#2563eb', fontWeight: 'bold' }}>
                    ({m.gender === 'F' ? '여' : '남'})
                  </span>
                </label>
              ))
            )}
          </div>
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            onClick={addSelectedParticipants}
            disabled={selectedToAdd.length === 0}
            style={{ marginTop: '8px', fontWeight: 700 }}
          >
            + 선택한 정회원 참가자로 추가 {selectedToAdd.length > 0 ? `(${selectedToAdd.length}명)` : ''}
          </button>
        </div>

        {/* 현재 참가 등록된 게스트 칩 표시 */}
        {participatingGuests.length > 0 && (
          <div style={{
            marginBottom: '12px',
            padding: '8px 12px',
            borderRadius: '8px',
            backgroundColor: '#f5f3ff',
            border: '1px solid #ddd6fe',
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '6px'
          }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: '#6d28d9', marginRight: '4px' }}>
              🙋 참가 게스트 ({participatingGuests.length}명):
            </span>
            {participatingGuests.map(g => (
              <span
                key={g.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #c4b5fd',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#5b21b6'
                }}
              >
                <span>{g.name}({g.gender === 'F' ? '여' : '남'} · NTRP {Number(g.ntrp || 2.0).toFixed(1)})</span>
                <button
                  type="button"
                  onClick={() => removeParticipant(g.id)}
                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px', fontWeight: 900, padding: '0 2px', lineHeight: 1 }}
                  title="참가 명단에서 제외"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
        
        {/* 게스트 추가 (게스트 풀 선택 or 신규 게스트 입력) */}
        <div style={{ marginBottom: 12 }}>
          {!showGuestForm ? (
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              onClick={() => {
                setGuestMode(availableGuestPool.length > 0 ? 'POOL' : 'NEW');
                setShowGuestForm(true);
              }}
              style={{
                backgroundColor: '#f5f3ff',
                color: '#6d28d9',
                borderColor: '#ddd6fe',
                fontWeight: 800
              }}
            >
              🙋 게스트 추가 (게스트 풀 {availableGuestPool.length}명 / 신규 입력)
            </button>
          ) : (
            <div style={{
              background: '#faf5ff',
              padding: '14px',
              borderRadius: '12px',
              border: '1.5px solid #d8b4fe'
            }}>
              {/* 상단 헤더 & 모드 전환 탭 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setGuestMode('POOL')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '12.5px',
                      fontWeight: guestMode === 'POOL' ? 800 : 600,
                      border: guestMode === 'POOL' ? '1.5px solid #7c3aed' : '1px solid #cbd5e1',
                      backgroundColor: guestMode === 'POOL' ? '#7c3aed' : '#ffffff',
                      color: guestMode === 'POOL' ? '#ffffff' : '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    📋 게스트 풀에서 선택 ({availableGuestPool.length}명)
                  </button>
                  <button
                    type="button"
                    onClick={() => setGuestMode('NEW')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '12.5px',
                      fontWeight: guestMode === 'NEW' ? 800 : 600,
                      border: guestMode === 'NEW' ? '1.5px solid #7c3aed' : '1px solid #cbd5e1',
                      backgroundColor: guestMode === 'NEW' ? '#7c3aed' : '#ffffff',
                      color: guestMode === 'NEW' ? '#ffffff' : '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    ➕ 신규 게스트 직접 입력
                  </button>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setShowGuestForm(false);
                    setSelectedGuestsToAdd([]);
                  }}
                >
                  닫기
                </button>
              </div>

              {/* 탭 1: 게스트 풀에서 선택 */}
              {guestMode === 'POOL' ? (
                <div>
                  {availableGuestPool.length === 0 ? (
                    <div style={{ padding: '16px', textAlign: 'center', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e9d5ff', color: '#64748b', fontSize: '13px' }}>
                      <div style={{ marginBottom: '8px', fontWeight: 700 }}>등록된 대기 게스트가 없습니다.</div>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        style={{ backgroundColor: '#7c3aed', borderColor: '#7c3aed' }}
                        onClick={() => setGuestMode('NEW')}
                      >
                        ➕ 신규 게스트 입력하기
                      </button>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '10px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e9d5ff', maxHeight: '150px', overflowY: 'auto' }}>
                        {availableGuestPool.map(g => {
                          const isChecked = selectedGuestsToAdd.includes(g.id);
                          return (
                            <label
                              key={g.id}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                cursor: 'pointer',
                                padding: '5px 10px',
                                borderRadius: '6px',
                                border: isChecked ? '1.5px solid #7c3aed' : '1px solid #e2e8f0',
                                backgroundColor: isChecked ? '#f5f3ff' : '#f8fafc',
                                fontSize: '13px',
                                fontWeight: isChecked ? 800 : 600
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={e => toggleSelectGuestToAdd(g.id, e.target.checked)}
                              />
                              <span>{g.name}</span>
                              <span style={{ fontSize: '11px', color: g.gender === 'F' ? '#db2777' : '#2563eb', fontWeight: 700 }}>
                                ({g.gender === 'F' ? '여' : '남'})
                              </span>
                              <span style={{ fontSize: '10.5px', padding: '1px 5px', borderRadius: '4px', backgroundColor: '#ede9fe', color: '#6d28d9', fontWeight: 800 }}>
                                NTRP {Number(g.ntrp || 2.0).toFixed(1)}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap', gap: '8px' }}>
                        <span style={{ fontSize: '11.5px', color: '#6d28d9', fontWeight: 600 }}>
                          💡 명단에 없는 게스트는 상단 [➕ 신규 게스트 직접 입력] 탭에서 추가하세요.
                        </span>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={selectedGuestsToAdd.length === 0}
                          onClick={addSelectedGuestsFromPool}
                          style={{ backgroundColor: '#7c3aed', borderColor: '#7c3aed', fontWeight: 800 }}
                        >
                          + 선택한 게스트 참가 추가 {selectedGuestsToAdd.length > 0 ? `(${selectedGuestsToAdd.length}명)` : ''}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                /* 탭 2: 신규 게스트 직접 입력 */
                <form onSubmit={handleAddGuest} style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #e9d5ff' }}>
                  <input
                    className="input input-sm"
                    placeholder="신규 게스트 이름"
                    value={guestForm.name}
                    onChange={e => setGuestForm(prev => ({ ...prev, name: e.target.value }))}
                    style={{ width: '130px', fontWeight: 700 }}
                    required
                    autoFocus
                  />
                  <select
                    className="input input-sm"
                    value={guestForm.gender}
                    onChange={e => setGuestForm(prev => ({ ...prev, gender: e.target.value }))}
                    style={{ width: '75px', fontWeight: 700 }}
                  >
                    <option value="M">남성</option>
                    <option value="F">여성</option>
                  </select>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>NTRP:</span>
                    <select
                      className="input input-sm"
                      value={guestForm.ntrp}
                      onChange={e => setGuestForm(prev => ({ ...prev, ntrp: parseFloat(e.target.value) }))}
                      style={{ width: '72px', fontWeight: 800 }}
                    >
                      {[1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0].map(v => <option key={v} value={v}>{v.toFixed(1)}</option>)}
                    </select>
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    type="submit"
                    style={{ backgroundColor: '#7c3aed', borderColor: '#7c3aed', fontWeight: 800 }}
                  >
                    ➕ 신규 등록 및 참가 추가
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        <div className={styles.toolbar} style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '12px' }}>
          <button className="btn btn-secondary btn-sm" onClick={addAll}>정회원 전체 추가</button>
          <button className="btn btn-secondary btn-sm" onClick={clearAll}>참가자 전체 제외</button>
        </div>
      </div>

      {/* 3단계: 경기 세부 설정 */}
      <div className={`card ${styles.section}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <h2 className={styles.sectionTitle} style={{ margin: 0, paddingBottom: 0, borderBottom: 'none' }}>3단계: 경기 세부 설정</h2>
          {participants.length > 0 && (
            <button 
              type="button" 
              className="btn btn-secondary btn-sm"
              onClick={() => applyRecommendation()}
              title="경기 시간과 참가자 성별 분포에 맞춰 추천 설정을 다시 적용합니다"
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              🔄 추천 설정 다시 적용
            </button>
          )}
        </div>

        {/* 추천 안내 카드 */}
        {participants.length > 0 && (
          <div style={{ 
            padding: '12px 14px', 
            borderRadius: '8px', 
            backgroundColor: 'rgba(59, 130, 246, 0.08)', 
            border: '1px solid rgba(59, 130, 246, 0.25)', 
            marginBottom: '16px',
            fontSize: '13px'
          }}>
            <div style={{ fontWeight: '800', color: '#1d4ed8', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span>💡 경기시간({durationInfo.text}) & 참가자(남 {maleCount}명, 여 {femaleCount}명) 맞춤 추천 세팅</span>
              <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '4px', backgroundColor: '#2563eb', color: '#fff', fontWeight: 800 }}>자동 세팅됨</span>
            </div>
            <div style={{ color: 'var(--txt)', lineHeight: '1.45' }}>
              {recExplanation || `경기시간(${durationInfo.diff}분)에 맞춘 추천 라운드수(${rounds}R)와 성별 참가 인원에 적합한 게임 수가 세팅되었습니다.`}
            </div>
          </div>
        )}

        {/* 🎾 경기 방식 (5게임제 / 6게임제) & 🛡️ 인당 최소 4게임 보장 선택 패널 */}
        <div style={{
          marginBottom: '16px',
          padding: '14px 16px',
          borderRadius: '10px',
          backgroundColor: effectiveMaxGames === 5 ? 'rgba(245, 158, 11, 0.07)' : 'var(--bg)',
          border: `1.5px solid ${effectiveMaxGames === 5 ? 'rgba(245, 158, 11, 0.45)' : 'var(--border)'}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--txt)' }}>
                🎾 경기 방식 선택:
              </span>
              <div style={{ display: 'inline-flex', borderRadius: '8px', padding: '3px', backgroundColor: '#e2e8f0', gap: '4px' }}>
                <button
                  type="button"
                  onClick={() => handleSelectMaxGames(6)}
                  style={{
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '12.5px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    backgroundColor: effectiveMaxGames === 6 ? '#2563eb' : 'transparent',
                    color: effectiveMaxGames === 6 ? '#ffffff' : '#475569',
                    boxShadow: effectiveMaxGames === 6 ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  🎾 6게임제 (기본 · {std6GameRounds}R 기준)
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectMaxGames(5)}
                  style={{
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '12.5px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    backgroundColor: effectiveMaxGames === 5 ? '#d97706' : 'transparent',
                    color: effectiveMaxGames === 5 ? '#ffffff' : '#475569',
                    boxShadow: effectiveMaxGames === 5 ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  ⚡ 5게임제 (다인원 · {recommended5GameRounds}R 기준)
                </button>
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 800, color: ensureMin4Games ? '#15803d' : 'var(--txt2)', margin: 0 }}>
              <input
                type="checkbox"
                checked={!!ensureMin4Games}
                onChange={e => handleToggleEnsureMin4(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              🛡️ 참여 인원 많을 시 인당 최소 4게임 자동 보장
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', fontSize: '12px', color: 'var(--txt2)', paddingTop: '8px', borderTop: '1px dashed var(--border)' }}>
            <div>
              <span>⏱️ 현재 설정: <strong>{effectiveMaxGames}게임 선승</strong> · <strong>{rounds}라운드</strong> (경기당 약 <strong>{minsPerRoundCurrent}분</strong> 소요)</span>
              {entries.length >= 4 && (
                <span style={{ marginLeft: '8px', fontWeight: 700, color: isAllAtLeast4Games ? '#15803d' : '#dc2626' }}>
                  | 👥 인당 배정: {minAssignedTarget === maxAssignedTarget ? `${minAssignedTarget}게임` : `${minAssignedTarget}~${maxAssignedTarget}게임`}
                  {isAllAtLeast4Games ? ' (✓ 전원 4게임 이상 보장)' : ` (⚠️ 4게임 미만 ${under4Players.length}명)`}
                </span>
              )}
            </div>

            {entries.length >= 4 && !isAllAtLeast4Games && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={enforceMin4GamesNow}
                style={{ backgroundColor: '#d97706', borderColor: '#d97706', fontSize: '11.5px', padding: '4px 10px', fontWeight: 800 }}
              >
                ⚡ 5게임제({minRoundsFor4Games}R)로 전환해 전원 4게임 맞추기
              </button>
            )}
          </div>
        </div>

        <div className={styles.settingsRow}>
          <div className="form-group">
            <label className="form-label">라운드 수</label>
            <select className="input input-sm" value={rounds} onChange={e => {
              const newR = parseInt(e.target.value) || 1;
              setRounds(newR);
              if (participants.length > 0) {
                setParticipants(computeBalancedParticipants(participants, newR, courts, allowSingles));
              }
            }} style={{ width: 90 }}>
              {numOptions(1, 20)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">코트 수</label>
            <select className="input input-sm" value={courts} onChange={e => {
              const newC = parseInt(e.target.value) || 1;
              setCourts(newC);
              if (participants.length > 0) {
                applyRecommendation(participants, startTime, endTime, newC);
              }
            }} style={{ width: 90 }}>
              {numOptions(1, 10)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">남복 게임 수</label>
            <select className="input input-sm" value={mensDoublesCount} onChange={e => setMensDoublesCount(parseInt(e.target.value) || 0)} style={{ width: 90 }}>
              {numOptions(0, 20)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">여복 게임 수</label>
            <select className="input input-sm" value={womensDoublesCount} onChange={e => setWomensDoublesCount(parseInt(e.target.value) || 0)} style={{ width: 90 }}>
              {numOptions(0, 20)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">혼복 게임 수</label>
            <select className="input input-sm" value={mixedCount} onChange={e => setMixedCount(parseInt(e.target.value) || 0)} style={{ width: 90 }}>
              {numOptions(0, 20)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">잡복 게임 수</label>
            <select className="input input-sm" value={jointCount} onChange={e => setJointCount(parseInt(e.target.value) || 0)} style={{ width: 90 }}>
              {numOptions(0, 20)}
            </select>
          </div>
          {participants.length > 0 && participants.length < courts * 4 && (
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', height: '32px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: 13, fontWeight: 'bold' }}>
                <input type="checkbox" checked={allowSingles} onChange={e => setAllowSingles(e.target.checked)} />
                단식 혼합 허용
              </label>
            </div>
          )}
        </div>

        <div style={{ marginTop: 12, fontSize: 13, color: isMatchSumOk ? 'var(--primary)' : 'var(--danger)', fontWeight: 'bold' }}>
          {isMatchSumOk 
            ? (sumMatches < requiredMatches ? `✓ 세부 게임(${sumMatches}) 외 남은 복식 경기(${requiredMatches - sumMatches})는 성별 무관(잡복)으로 자동 배정됩니다.` : '✓ 세부 게임 수 합계가 총 복식 경기 수와 일치합니다.')
            : `✗ 남복(${mensDoublesCount || 0}) + 여복(${womensDoublesCount || 0}) + 혼복(${mixedCount || 0}) + 잡복(${jointCount || 0}) 합계(${sumMatches})가 총 복식 경기 수(${requiredMatches} = 라운드×복식코트)보다 클 수 없습니다.`}
        </div>
        {isSinglesActive && (
          <div style={{ marginTop: 6, fontSize: 13, color: 'var(--primary)', fontWeight: 'bold' }}>
            🎾 참가자 부족으로 라운드 당 단식 {singlesPerRound}경기, 복식 {doublesPerRound}경기가 진행됩니다.
          </div>
        )}

        {/* 벌칙금 여부 설정 */}
        <div style={{
          marginTop: '16px',
          padding: '12px 16px',
          borderRadius: '8px',
          backgroundColor: usePenalty ? 'rgba(225, 29, 72, 0.05)' : 'var(--bg)',
          border: `1px solid ${usePenalty ? 'rgba(225, 29, 72, 0.3)' : 'var(--border)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0, fontWeight: 700, fontSize: '13.5px', color: 'var(--txt)' }}>
            <input 
              type="checkbox" 
              checked={!!usePenalty} 
              onChange={e => setUsePenalty && setUsePenalty(e.target.checked)} 
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            💸 경기 패배 벌칙금(진팀 벌금) 정산 적용
          </label>
          <span style={{ fontSize: '12px', color: usePenalty ? '#e11d48' : 'var(--txt3)', fontWeight: 600 }}>
            {usePenalty 
              ? '✓ 체크됨: 대진표 화면에 패배 벌칙금 정산소가 활성화됩니다.' 
              : '✓ 체크 해제됨: 벌칙금 정산소 대신 선수별 경기 진행/완료 현황이 표시됩니다.'}
          </span>
        </div>

        {/* 🏆 NTRP 상위/하위 그룹 분리 후 혼합 대진 옵션 설정 */}
        <div style={{
          marginTop: '12px',
          padding: '14px 16px',
          borderRadius: '10px',
          backgroundColor: effectiveSplitMode ? 'rgba(37, 99, 235, 0.06)' : 'var(--bg)',
          border: `1.5px solid ${effectiveSplitMode ? 'rgba(37, 99, 235, 0.38)' : 'var(--border)'}`,
          transition: 'all 0.2s ease'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0, fontWeight: 800, fontSize: '13.8px', color: 'var(--txt)' }}>
              <input
                type="checkbox"
                checked={!!effectiveSplitMode}
                onChange={e => {
                  const checked = e.target.checked;
                  setEffectiveSplitMode(checked);
                  if (checked) {
                    setSortByNtrp(true);
                    setEffectiveSplitRounds(calcDefaultSplitRounds(startTime, endTime, rounds));
                  }
                }}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              🏆 NTRP 상위/하위 그룹 분리 후 혼합 대진 적용 <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#2563eb' }}>(앞 2시간 수준별 대진 + 이후 시간 혼합 대진)</span>
            </label>
            <span style={{ fontSize: '12px', color: effectiveSplitMode ? '#1d4ed8' : 'var(--txt3)', fontWeight: 700 }}>
              {effectiveSplitMode
                ? `✓ 적용됨: 1R~${effectiveSplitRounds}R 상·하위 그룹별 대진 → ${effectiveSplitRounds + 1}R~${rounds}R 그룹 혼합 대진`
                : '✓ 미적용 (일반 전체 혼합 대진)'}
            </span>
          </div>

          {effectiveSplitMode && (
            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed rgba(37, 99, 235, 0.25)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', fontSize: '12.5px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, color: '#1e40af' }}>⏱️ 구간별 라운드 배정:</span>
                  <span style={{ padding: '3px 8px', borderRadius: '6px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', fontWeight: 700 }}>
                    앞 2시간 (그룹별 대진): 1R ~
                    <select
                      className="input input-sm"
                      value={effectiveSplitRounds}
                      onChange={e => setEffectiveSplitRounds(parseInt(e.target.value) || 1)}
                      style={{ width: '54px', margin: '0 4px', padding: '1px 4px', height: '24px', fontWeight: 800, display: 'inline-block' }}
                    >
                      {numOptions(1, Math.max(1, rounds - 1))}
                    </select>
                    R
                  </span>
                  <span style={{ color: '#64748b', fontWeight: 800 }}>➔</span>
                  <span style={{ padding: '3px 8px', borderRadius: '6px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', fontWeight: 700 }}>
                    이후 ~ 종료시간 ({endTime || '12:00'}): {Math.min(rounds, effectiveSplitRounds + 1)}R ~ {rounds}R (상·하위 혼합 대진)
                  </span>
                </div>
                <span style={{ fontSize: '11.5px', color: '#475569' }}>
                  * 참가자를 NTRP 순으로 나열해 절반씩 상위/하위 그룹으로 자동 분류합니다.
                </span>
              </div>

              {entries.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
                  {/* 상위그룹 미리보기 */}
                  <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: '#fff7ed', border: '1px solid #fed7aa' }}>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#c2410c', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>🔥 상위그룹 ({ntrpSplitInfo.upperGroup.length}명)</span>
                      <span style={{ fontSize: '11px', color: '#ea580c' }}>
                        NTRP {ntrpSplitInfo.upperGroup[ntrpSplitInfo.upperGroup.length - 1]?.ntrp?.toFixed(1) || '-'} ~ {ntrpSplitInfo.upperGroup[0]?.ntrp?.toFixed(1) || '-'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {ntrpSplitInfo.upperGroup.map((p, idx) => (
                        <span key={p.id} style={{ fontSize: '11.5px', padding: '2px 7px', borderRadius: '12px', backgroundColor: '#ffffff', border: '1px solid #fdba74', color: '#9a3412', fontWeight: 700 }}>
                          {idx + 1}. {p.name} <span style={{ opacity: 0.75 }}>({p.ntrp.toFixed(1)})</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 하위그룹 미리보기 */}
                  <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#15803d', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>🌱 하위그룹 ({ntrpSplitInfo.lowerGroup.length}명)</span>
                      <span style={{ fontSize: '11px', color: '#16a34a' }}>
                        NTRP {ntrpSplitInfo.lowerGroup[ntrpSplitInfo.lowerGroup.length - 1]?.ntrp?.toFixed(1) || '-'} ~ {ntrpSplitInfo.lowerGroup[0]?.ntrp?.toFixed(1) || '-'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {ntrpSplitInfo.lowerGroup.map((p, idx) => (
                        <span key={p.id} style={{ fontSize: '11.5px', padding: '2px 7px', borderRadius: '12px', backgroundColor: '#ffffff', border: '1px solid #86efac', color: '#166534', fontWeight: 700 }}>
                          {ntrpSplitInfo.upperGroup.length + idx + 1}. {p.name} <span style={{ opacity: 0.75 }}>({p.ntrp.toFixed(1)})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 4단계: 참가자 목표 게임수 설정 및 균등 배분 */}
      <div className={`card ${styles.section}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <h2 className={styles.sectionTitle} style={{ margin: 0, borderBottom: 'none', paddingBottom: 0 }}>
            4단계: 참가자 목표 게임수 설정 및 균등 배분
          </h2>
          {entries.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                className={`btn btn-sm ${!(effectiveSplitMode || sortByNtrp) ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSortByNtrp(false)}
                disabled={!!effectiveSplitMode}
                title={effectiveSplitMode ? 'NTRP 그룹 분리 옵션 활성화 중에는 NTRP 순서로 고정됩니다' : '가나다 이름순 정렬'}
                style={{ fontSize: '11.5px', padding: '3px 9px' }}
              >
                가나다순
              </button>
              <button
                type="button"
                className={`btn btn-sm ${(effectiveSplitMode || sortByNtrp) ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSortByNtrp(true)}
                style={{ fontSize: '11.5px', padding: '3px 9px' }}
              >
                🏆 NTRP 순 (상·하위 그룹)
              </button>
            </div>
          )}
        </div>
        <div className="table-wrap" style={{ marginTop: 10 }}>
          <table style={{ width: '100%' }}>
            <thead>
              <tr>
                {(effectiveSplitMode || sortByNtrp) && <th style={{ width: '78px', whiteSpace: 'nowrap', padding: '8px 6px' }}>그룹</th>}
                <th style={{ minWidth: '110px', whiteSpace: 'nowrap', padding: '8px 10px' }}>이름</th>
                <th style={{ width: '48px', whiteSpace: 'nowrap', textAlign: 'center', padding: '8px 4px' }}>성별</th>
                <th style={{ width: '54px', whiteSpace: 'nowrap', textAlign: 'center', padding: '8px 4px' }}>NTRP</th>
                <th style={{ width: '82px', whiteSpace: 'nowrap', textAlign: 'center', padding: '8px 6px' }}>목표 게임수</th>
                <th style={{ width: '56px', whiteSpace: 'nowrap', textAlign: 'center', padding: '8px 4px' }}></th>
              </tr>
            </thead>
            <tbody>
              {displayEntries.map((p, idx) => {
                const isUpper = ntrpSplitInfo.upperIds.has(p.id);
                return (
                  <tr
                    key={p.id}
                    style={(effectiveSplitMode || sortByNtrp) ? {
                      backgroundColor: isUpper ? 'rgba(255, 247, 237, 0.45)' : 'rgba(240, 253, 244, 0.45)'
                    } : undefined}
                  >
                    {(effectiveSplitMode || sortByNtrp) && (
                      <td style={{ whiteSpace: 'nowrap', padding: '8px 6px' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: '10px',
                          backgroundColor: isUpper ? '#ffedd5' : '#dcfce7',
                          color: isUpper ? '#c2410c' : '#15803d',
                          border: `1px solid ${isUpper ? '#fdba74' : '#86efac'}`,
                          whiteSpace: 'nowrap'
                        }}>
                          {isUpper ? '🔥 상위' : '🌱 하위'}
                        </span>
                      </td>
                    )}
                    <td style={{ fontWeight: 700, minWidth: '110px', whiteSpace: 'nowrap', wordBreak: 'keep-all', padding: '8px 10px' }}>
                      {(effectiveSplitMode || sortByNtrp) ? `${idx + 1}. ${p.name}` : p.name}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'center', padding: '8px 4px' }}>
                      <span className={`badge ${p.gender === 'F' ? 'badge-purple' : 'badge-blue'}`}>{p.gender === 'F' ? '여' : '남'}</span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'center', padding: '8px 4px' }}>{p.ntrp.toFixed(1)}</td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'center', padding: '8px 6px' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <select className="input input-sm" value={p.target} style={{ width: 56 }}
                          onChange={e => updateTarget(p.id, e.target.value)}>
                          {numOptions(0, 20)}
                        </select>
                        {ensureMin4Games && (p.target || 0) < 4 && (
                          <span style={{ fontSize: '10.5px', color: '#dc2626', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            ⚠️ 4G미만
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'center', padding: '8px 4px' }}>
                      <button className="btn btn-danger btn-sm" style={{ whiteSpace: 'nowrap', padding: '4px 8px' }} onClick={() => removeParticipant(p.id)}>제외</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className={styles.toolbar} style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn-primary btn-sm" onClick={autoBalance}>
            ⚖️ 목표 게임수 자동 균등배분
          </button>
          {entries.length >= 4 && !isAllAtLeast4Games && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={enforceMin4GamesNow}
              style={{ backgroundColor: '#d97706', color: '#fff', border: '1px solid #b45309', fontWeight: 800 }}
            >
              ⚡ 5게임제({minRoundsFor4Games}R) 전환하여 전원 최소 4게임 맞추기
            </button>
          )}
          {entries.length >= 4 && isAllAtLeast4Games && (
            <span style={{ fontSize: '12px', color: '#15803d', fontWeight: 700, padding: '4px 10px', borderRadius: '6px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              🛡️ 전 참가자 최소 4게임 이상 보장 완료 ({minAssignedTarget === maxAssignedTarget ? `전원 ${minAssignedTarget}게임` : `${minAssignedTarget}~${maxAssignedTarget}게임`})
            </span>
          )}
        </div>
        <div className={`${styles.balanceRow} ${isBalanced ? styles.ok : styles.bad}`} style={{ marginTop: 12 }}>
          참가자 <strong>{participants.length}명</strong> · 목표 합계: <strong>{targetSum}</strong> / 필요 슬롯: <strong>{totalSlots}</strong>
          {isBalanced ? ' ✓ 일치' : ' ✗ 불일치 (균등배분을 실행하거나 숫자를 직접 맞추어 주세요)'}
        </div>
      </div>

      {/* 특별 조건 */}
      <div className={`card ${styles.section}`}>
        <h2 className={styles.sectionTitle}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={enableConditions} onChange={e => setEnableConditions(e.target.checked)} />
            특별 조건 적용
          </label>
          <span className={styles.sectionNote}>(체크 시 자동 생성에 반영)</span>
        </h2>
        <p className="text-muted" style={{ fontSize: 13, marginBottom: 12 }}>특정 4명이 함께 뛰는 게임 (같은 4명, 페어만 다르게 구성)</p>
        {entries.length >= 4 && (
          <form className={styles.addRow} onSubmit={addGroup}>
            {['g1', 'g2', 'g3', 'g4'].map(n => (
              <select key={n} name={n} className="select input-sm" style={{ flex: 1, minWidth: 90 }}>
                {entries.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            ))}
            <span style={{ fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>게임수:</span>
            <select name="gCount" className="input input-sm" defaultValue={2} style={{ width: 55 }}>
              {numOptions(1, 10)}
            </select>
            <button className="btn btn-secondary btn-sm" type="submit">추가</button>
          </form>
        )}
        {groups.length > 0 && (
          <div className={styles.groupList}>
            {groups.map(g => {
              const names = g.memberIds.map(id => members.find(m => m.id === id)?.name ?? '(삭제됨)').join(', ');
              return (
                <div key={g.id} className={styles.groupItem}>
                  <span>{names} — <strong>{g.count}게임</strong></span>
                  <button className="btn btn-danger btn-sm" onClick={() => removeGroup(g.id)}>삭제</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 생성 버튼 */}
      <div className={`card ${styles.section}`}>
        <h2 className={styles.sectionTitle}>대진표 만들기</h2>
        <div className={styles.genRow}>
          <button className="btn btn-primary btn-lg" onClick={runGeneration}
            disabled={!isBalanced || !isMatchSumOk || generating}>
            {generating ? <><span className="spinner" /> 생성 중...</> : '🎾 자동으로 대진표 생성'}
          </button>
          <button className="btn btn-secondary" onClick={createManual}>빈 대진표 직접 만들기</button>
          <button className="btn btn-secondary" onClick={onSaveAndExit}>💾 저장 후 목록으로</button>
          {status && <span className="text-muted" style={{ fontSize: 13 }}>{status}</span>}
        </div>
        {warnMsg && (
          <div className="alert alert-warn" style={{ marginTop: 12, whiteSpace: 'pre-line' }}>⚠️ {warnMsg}</div>
        )}
      </div>
    </div>
  );
}

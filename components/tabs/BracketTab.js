// components/tabs/BracketTab.js — 대진표(선수 드롭다운+점수입력) + 검증요약 + 개인순위 + 벌칙금 정산
'use client';
import { useState, useMemo, useEffect, useRef } from 'react';
import { makeEmptyMatch, teamNtrpSum, computeTodayStandings } from '@/lib/scheduler';
import styles from './tabs.module.css';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const generateId = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);

function SortableRow({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? {
      zIndex: 1,
      position: 'relative',
      backgroundColor: 'var(--bg)',
      boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
    } : {})
  };

  return (
    <tr ref={setNodeRef} style={style} {...attributes}>
      {children(listeners)}
    </tr>
  );
}


const COURT_LABELS = 'ABCDEFGHIJ'.split('');

const scoreOptions = (max = 6) => {
  const opts = [];
  opts.push(<option key="empty" value="">-</option>);
  const limit = Math.max(1, Number(max) || 6);
  for (let i = 0; i <= limit; i++) opts.push(<option key={i} value={i}>{i}</option>);
  return opts;
};

export default function BracketTab({
  schedule, setSchedule, scores, setScores,
  members, participants, lastGenStats,
  scheduleRounds, scheduleCourts, setScheduleRounds, setScheduleCourts,
  penaltyAmount = 1000, setPenaltyAmount,
  penaltyPaidMap = {}, setPenaltyPaidMap,
  maxGames = 6, setMaxGames,
  clubSettings,
  matchDate,
  title,
  onSave, onPrint, isAdmin, isReadOnly, isPastMatch,
}) {
  const byId = useMemo(() => {
    const m = {}; members.forEach(p => m[p.id] = p); return m;
  }, [members]);

  const entries = useMemo(() =>
    participants.map(pt => members.find(m => m.id === pt.playerId)).filter(Boolean),
    [participants, members]
  );

  const todayRows = useMemo(() => computeTodayStandings(schedule, scores, byId), [schedule, scores, byId]);

  const [showPenaltyShareModal, setShowPenaltyShareModal] = useState(false);
  const [penaltyShareText, setPenaltyShareText] = useState('');
  const [customPenaltyInput, setCustomPenaltyInput] = useState(String(penaltyAmount ?? 1000));

  useEffect(() => {
    setCustomPenaltyInput(String(penaltyAmount ?? 1000));
  }, [penaltyAmount]);

  /* ── 👁️ 대진표 보기 모드 & 진행중 필터 상태 ── */
  const [viewMode, setViewMode] = useState('court'); // 'court' (코트별 선수 배치) | 'table' (라운드별 테이블)
  const [activeOnlyMode, setActiveOnlyMode] = useState(false); // true: 현재 진행중인 경기만, false: 전체 펼쳐보기
  const [collapsedCourts, setCollapsedCourts] = useState({}); // { [courtIdx]: boolean }

  const isCourtCollapsed = (courtIdx) => {
    if (collapsedCourts[courtIdx] !== undefined) {
      return collapsedCourts[courtIdx];
    }
    return activeOnlyMode;
  };

  const toggleCourtCollapse = (courtIdx) => {
    setCollapsedCourts(prev => ({
      ...prev,
      [courtIdx]: !isCourtCollapsed(courtIdx)
    }));
  };

  const setGlobalMode = (activeOnly) => {
    setActiveOnlyMode(activeOnly);
    setCollapsedCourts({});
  };

  const roundIdsRef = useRef([]);
  if (schedule && roundIdsRef.current.length !== schedule.length) {
    if (roundIdsRef.current.length < schedule.length) {
      const diff = schedule.length - roundIdsRef.current.length;
      for (let i = 0; i < diff; i++) roundIdsRef.current.push(generateId());
    } else {
      roundIdsRef.current = roundIdsRef.current.slice(0, schedule.length);
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event) => {
    if (isReadOnly || !isAdmin) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = roundIdsRef.current.indexOf(active.id);
    const newIndex = roundIdsRef.current.indexOf(over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newSchedule = arrayMove(schedule, oldIndex, newIndex);
    
    const newScores = { ...scores };
    const currentIndices = Array.from({length: schedule.length}, (_, i) => i);
    const movedIndices = arrayMove(currentIndices, oldIndex, newIndex);
    
    const oldToNew = {};
    for (let i = 0; i < movedIndices.length; i++) {
       oldToNew[movedIndices[i]] = i;
    }

    const remappedScores = {};
    Object.keys(newScores).forEach(key => {
      const [riStr, ciStr] = key.split('-');
      const ri = parseInt(riStr, 10);
      if (!isNaN(ri) && oldToNew[ri] !== undefined) {
        remappedScores[`${oldToNew[ri]}-${ciStr}`] = newScores[key];
      } else {
        remappedScores[key] = newScores[key];
      }
    });

    roundIdsRef.current = arrayMove(roundIdsRef.current, oldIndex, newIndex);
    setScores(remappedScores);
    setSchedule(newSchedule);
    if (onSave) onSave({ schedule: newSchedule, scores: remappedScores });
  };


  if (!schedule || schedule.length === 0) {
    return (
      <div className={`card ${styles.section}`} style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>📋</div>
        <p className="text-muted">대진표가 없습니다. "대진표 만들기" 탭에서 생성해주세요.</p>
      </div>
    );
  }

  const courts = scheduleCourts || (schedule[0]?.length ?? 0);

  /* ── 라운드별 중복 출전 계산 ── */
  const roundConflicts = useMemo(() => {
    if (!schedule) return {};
    const map = {};
    schedule.forEach((round, ri) => {
      const pCount = {};
      round.forEach(m => {
        [...(m.teamA || []), ...(m.teamB || [])].forEach(pId => {
          if (!pId) return;
          pCount[pId] = (pCount[pId] || 0) + 1;
        });
      });
      Object.keys(pCount).forEach(pId => {
        if (pCount[pId] > 1) {
          if (!map[ri]) map[ri] = {};
          map[ri][pId] = pCount[pId];
        }
      });
    });
    return map;
  }, [schedule]);

  /* ── 이벤트 핸들러 (입력 즉시 자동 저장 및 실시간 동기화) ── */
  const onPlayerSelect = (ri, ci, team, slot, value) => {
    if (isReadOnly) return;
    if (value) {
      const currentMatch = schedule[ri]?.[ci];
      const playerName = byId[value]?.name || '선수';
      const courtLabel = `${COURT_LABELS[ci] || ci + 1}코트`;
      const roundLabel = `${ri + 1}R`;

      // 1. 동일 경기(매치) 내 중복 체크
      if (currentMatch) {
        const teamA = [...(currentMatch.teamA || [])];
        const teamB = [...(currentMatch.teamB || [])];

        if (team === 'a') {
          const otherSlot = slot === 0 ? 1 : 0;
          if (teamA[otherSlot] === value) {
            alert(`[${playerName}] 선수는 현재 경기(${roundLabel} ${courtLabel})에 이미 배정되어 있습니다.`);
            return;
          }
          if (teamB.includes(value)) {
            alert(`[${playerName}] 선수는 현재 경기(${roundLabel} ${courtLabel})의 상대팀에 이미 배정되어 있습니다.`);
            return;
          }
        } else {
          const otherSlot = slot === 0 ? 1 : 0;
          if (teamB[otherSlot] === value) {
            alert(`[${playerName}] 선수는 현재 경기(${roundLabel} ${courtLabel})에 이미 배정되어 있습니다.`);
            return;
          }
          if (teamA.includes(value)) {
            alert(`[${playerName}] 선수는 현재 경기(${roundLabel} ${courtLabel})의 상대팀에 이미 배정되어 있습니다.`);
            return;
          }
        }
      }

      // 2. 동일 라운드 내 타 코트 중복 출전 체크
      const currentRound = schedule[ri];
      if (currentRound) {
        for (let otherCi = 0; otherCi < currentRound.length; otherCi++) {
          if (otherCi === ci) continue;
          const otherMatch = currentRound[otherCi];
          if (!otherMatch) continue;
          const otherPlayers = [...(otherMatch.teamA || []), ...(otherMatch.teamB || [])].filter(Boolean);
          if (otherPlayers.includes(value)) {
            const otherCourtLabel = `${COURT_LABELS[otherCi] || otherCi + 1}코트`;
            alert(`[${playerName}] 선수는 동일 시간대(${roundLabel}, ${otherCourtLabel})에 이미 출전 중입니다.\n동일 라운드 중복 출전은 불가합니다.`);
            return;
          }
        }
      }
    }

    const next = schedule.map((r, rIdx) => r.map((m, cIdx) => {
      if (rIdx !== ri || cIdx !== ci) return m;
      const updated = { ...m, teamA: [...m.teamA], teamB: [...m.teamB] };
      if (team === 'a') updated.teamA[slot] = value;
      else updated.teamB[slot] = value;
      return updated;
    }));
    setSchedule(next);
    if (onSave) onSave({ schedule: next });
  };

  const handleMaxGamesChange = (newMax) => {
    if (isReadOnly || !isAdmin) return;
    if (setMaxGames) setMaxGames(newMax);

    let scoreChanged = false;
    const nextScores = { ...scores };
    Object.keys(nextScores).forEach(key => {
      const sc = nextScores[key];
      if (sc) {
        let nextA = sc.a;
        let nextB = sc.b;
        if (nextA !== null && nextA !== undefined && nextA !== '' && Number(nextA) > newMax) {
          nextA = newMax;
          scoreChanged = true;
        }
        if (nextB !== null && nextB !== undefined && nextB !== '' && Number(nextB) > newMax) {
          nextB = newMax;
          scoreChanged = true;
        }
        if (scoreChanged) {
          nextScores[key] = { ...sc, a: nextA, b: nextB };
        }
      }
    });

    if (scoreChanged) {
      setScores(nextScores);
    }
    if (onSave) {
      onSave({
        maxGames: newMax,
        ...(scoreChanged ? { scores: nextScores } : {})
      });
    }
  };

  const onScore = (ri, ci, team, value) => {
    if (isReadOnly) return;
    const key = `${ri}-${ci}`;
    let nextVal = value === '' ? null : Number(value);
    if (nextVal !== null) {
      nextVal = Math.max(0, Math.min(maxGames || 6, nextVal));
    }
    const newScores = {
      ...scores,
      [key]: { ...(scores[key] || { a: null, b: null }), [team]: nextVal },
    };
    setScores(newScores);
    if (onSave) onSave({ scores: newScores });
  };

  /* ── 라운드/코트 편집 ── */
  const addRound = () => {
    if (isReadOnly || !isAdmin) return;
    const newRound = Array.from({ length: courts }, makeEmptyMatch);
    const next = [...schedule, newRound];
    setSchedule(next);
    setScheduleRounds(prev => prev + 1);
    if (onSave) onSave({ schedule: next, scheduleRounds_: (scheduleRounds || schedule.length) + 1 });
  };
  const removeRound = () => {
    if (isReadOnly || !isAdmin) return;
    if (!confirm('마지막 라운드를 삭제할까요?')) return;
    const ri = schedule.length - 1;
    const nextScores = { ...scores };
    Object.keys(nextScores).forEach(k => { if (k.startsWith(ri + '-')) delete nextScores[k]; });
    const nextSchedule = schedule.slice(0, -1);
    setScores(nextScores);
    setSchedule(nextSchedule);
    setScheduleRounds(prev => prev - 1);
    if (onSave) onSave({ schedule: nextSchedule, scores: nextScores, scheduleRounds_: Math.max(0, (scheduleRounds || schedule.length) - 1) });
  };
  const addCourt = () => {
    if (isReadOnly || !isAdmin) return;
    const next = schedule.map(r => [...r, makeEmptyMatch()]);
    setSchedule(next);
    setScheduleCourts(prev => prev + 1);
    if (onSave) onSave({ schedule: next, scheduleCourts_: (scheduleCourts || courts) + 1 });
  };
  const removeCourt = () => {
    if (isReadOnly || !isAdmin) return;
    if (courts <= 1) { alert('코트가 1개뿐입니다.'); return; }
    if (!confirm('마지막 코트를 삭제할까요?')) return;
    const ci = courts - 1;
    const nextScores = { ...scores };
    Object.keys(nextScores).forEach(k => { if (k.endsWith('-' + ci)) delete nextScores[k]; });
    const nextSchedule = schedule.map(r => r.slice(0, -1));
    setScores(nextScores);
    setSchedule(nextSchedule);
    setScheduleCourts(prev => prev - 1);
    if (onSave) onSave({ schedule: nextSchedule, scores: nextScores, scheduleCourts_: Math.max(1, (scheduleCourts || courts) - 1) });
  };
  const clearScores = () => {
    if (isReadOnly || !isAdmin) return;
    if (!confirm('점수를 모두 지울까요?')) return;
    setScores({});
    if (onSave) onSave({ scores: {} });
  };
  const clearSchedule = () => {
    if (isReadOnly || !isAdmin) return;
    if (confirm('정말로 전체 대진표를 삭제하시겠습니까?\n(이 작업은 되돌릴 수 없습니다)')) {
      setSchedule([]);
      setScores({});
      if (onSave) onSave({ schedule: [], scores: {} });
    }
  };

  /* ── 선수 선택 옵션 ── */
  const playerOptions = (selectedId) => {
    const list = [...entries];
    if (selectedId && !list.some(p => p.id === selectedId)) {
      const p = members.find(m => m.id === selectedId);
      if (p) list.unshift(p);
    }
    return [
      <option key="" value="">-</option>,
      ...list.map(p => <option key={p.id} value={p.id}>{p.name}</option>),
    ];
  };

  /* ── 참가자별 실제 배정 수 ── */
  const counts = {};
  entries.forEach(p => counts[p.id] = 0);
  schedule.forEach(round => round.forEach(m => {
    [...m.teamA, ...m.teamB].forEach(id => { if (id && counts[id] !== undefined) counts[id]++; });
  }));

  /* ── 경기 완료 통계 ── */
  const matchStats = useMemo(() => {
    if (!schedule || schedule.length === 0) return { totalMatches: 0, completedMatches: 0, isAllCompleted: false };
    let total = 0;
    let completed = 0;
    schedule.forEach((round, ri) => {
      round.forEach((m, ci) => {
        total++;
        const key = `${ri}-${ci}`;
        const sc = scores[key];
        if (sc && sc.a !== null && sc.a !== undefined && sc.a !== '' &&
            sc.b !== null && sc.b !== undefined && sc.b !== '') {
          completed++;
        }
      });
    });
    return {
      totalMatches: total,
      completedMatches: completed,
      isAllCompleted: total > 0 && completed === total
    };
  }, [schedule, scores]);

  /* ── 코트별 경기 목록 구조화 ── */
  const courtMatchesList = useMemo(() => {
    if (!schedule || schedule.length === 0) return [];
    const list = [];
    const cCount = courts;
    for (let ci = 0; ci < cCount; ci++) {
      const matchesInCourt = schedule.map((round, ri) => {
        const m = round[ci] || { teamA: [null, null], teamB: [null, null] };
        const key = `${ri}-${ci}`;
        const sc = scores[key] || { a: null, b: null };
        const hasScore = sc.a !== null && sc.a !== undefined && sc.a !== '' &&
                         sc.b !== null && sc.b !== undefined && sc.b !== '';
        return {
          ri,
          ci,
          match: m,
          score: sc,
          hasScore,
          isWinA: hasScore && Number(sc.a) > Number(sc.b),
          isWinB: hasScore && Number(sc.b) > Number(sc.a),
          isDraw: hasScore && Number(sc.a) === Number(sc.b),
        };
      });
      list.push(matchesInCourt);
    }
    return list;
  }, [schedule, scores, courts]);

  /* ── 벌칙금 정산 통계 ── */
  const penaltySummary = useMemo(() => {
    const rate = penaltyAmount || 0;
    const losersList = [];
    const unbeatenList = [];
    let totalLosses = 0;
    let totalPenalty = 0;
    let paidTotal = 0;

    todayRows.forEach(r => {
      const losses = r.loss || 0;
      const amount = losses * rate;
      const isPaid = !!penaltyPaidMap[r.id];

      if (losses > 0) {
        losersList.push({
          ...r,
          losses,
          penalty: amount,
          isPaid
        });
        totalLosses += losses;
        totalPenalty += amount;
        if (isPaid) paidTotal += amount;
      } else if (r.played > 0) {
        unbeatenList.push(r);
      }
    });

    // 패배가 많은 순으로 정렬 (동률이면 경기수 많은 순)
    losersList.sort((a, b) => b.losses - a.losses || (b.played - a.played));

    const topLoser = losersList[0] || null;

    return {
      rate,
      losersList,
      unbeatenList,
      totalLosses,
      totalPenalty,
      paidTotal,
      unpaidTotal: totalPenalty - paidTotal,
      paidCount: losersList.filter(l => l.isPaid).length,
      unpaidCount: losersList.filter(l => !l.isPaid).length,
      topLoser
    };
  }, [todayRows, penaltyAmount, penaltyPaidMap]);

  const handleSelectPenaltyPreset = (amount) => {
    if (!isAdmin && isReadOnly) return;
    setPenaltyAmount(amount);
    setCustomPenaltyInput(String(amount));
    if (onSave) onSave({ penaltyAmount: amount });
  };

  const handleCustomPenaltyBlur = () => {
    if (!isAdmin && isReadOnly) return;
    const val = Math.max(0, parseInt(customPenaltyInput, 10) || 0);
    setPenaltyAmount(val);
    setCustomPenaltyInput(String(val));
    if (onSave) onSave({ penaltyAmount: val });
  };

  const handleTogglePayment = (playerId) => {
    if (!isAdmin && isReadOnly) return;
    const nextMap = { ...(penaltyPaidMap || {}), [playerId]: !penaltyPaidMap?.[playerId] };
    if (setPenaltyPaidMap) setPenaltyPaidMap(nextMap);
    if (onSave) onSave({ penaltyPaidMap: nextMap });
  };

  const handleBulkPayment = (status) => {
    if (!isAdmin && isReadOnly) return;
    const nextMap = { ...(penaltyPaidMap || {}) };
    todayRows.forEach(r => {
      if (r.loss > 0) {
        nextMap[r.id] = status;
      }
    });
    if (setPenaltyPaidMap) setPenaltyPaidMap(nextMap);
    if (onSave) onSave({ penaltyPaidMap: nextMap });
  };

  const handleOpenPenaltyShare = () => {
    const dateStr = matchDate || new Date().toLocaleDateString('ko-KR');
    const titleStr = title || '오늘의 테니스 대진표';
    const rateFormatted = (penaltySummary.rate || 0).toLocaleString();
    const totalFormatted = (penaltySummary.totalPenalty || 0).toLocaleString();
    
    let text = `🎾 [${titleStr}] 경기 벌칙금(진팀 벌금) 정산 안내 🎾\n`;
    text += `📅 경기 일자: ${dateStr}\n`;
    text += `⚡ 진행 상태: 총 ${matchStats.completedMatches}/${matchStats.totalMatches}경기 완료 (${matchStats.isAllCompleted ? '전체 경기 종료 ✅' : '경기 진행 중 🎾'})\n`;
    text += `🎾 경기 방식: ${maxGames || 6}게임 선승\n`;
    text += `💰 진팀 벌칙: 1패당 1인 ${rateFormatted}원\n\n`;
    text += `💵 총 모인 벌칙금: ${totalFormatted}원 (총 ${penaltySummary.totalLosses}패)\n`;
    text += `📊 수납 현황: 완납 ${penaltySummary.paidCount}명 / 미납 ${penaltySummary.unpaidCount}명\n\n`;

    text += `📋 개인별 벌칙금 납부 현황:\n`;
    if (penaltySummary.losersList.length === 0) {
      text += `(아직 패배가 기록된 선수가 없습니다)\n`;
    } else {
      penaltySummary.losersList.forEach((l, idx) => {
        const rankPrefix = idx === 0 ? '💸 [최다 기부왕] ' : `${idx + 1}. `;
        const statusStr = l.isPaid ? '✅ 완납' : '💰 미납';
        text += `${rankPrefix}${l.name}: ${l.losses}패 → ${l.penalty.toLocaleString()}원 (${statusStr})\n`;
      });
    }

    if (penaltySummary.unbeatenList.length > 0) {
      const names = penaltySummary.unbeatenList.map(u => `${u.name}(${u.win}승${u.draw > 0 ? ` ${u.draw}무` : ''})`).join(', ');
      text += `\n👑 무패 (벌칙 면제): ${names}\n`;
    }

    if (clubSettings?.bankAccount) {
      text += `\n🏦 입금 계좌: ${clubSettings.bankAccount}`;
      if (clubSettings.accountHolder) text += ` (예금주: ${clubSettings.accountHolder})`;
      text += `\n`;
    }

    text += `\n모인 벌칙금은 동호회 공/음료 구매 및 운영비로 사용됩니다. 감사합니다!`;

    setPenaltyShareText(text);
    setShowPenaltyShareModal(true);
  };

  const shareNative = () => {
    if (typeof window === 'undefined') return;
    if (navigator.share) {
      navigator.share({
        title: '테니스 대진표',
        text: '생성된 테니스 대진표를 확인하세요.',
        url: window.location.href,
      }).catch(err => console.log('공유 취소 또는 실패', err));
    } else {
      navigator.clipboard.writeText(window.location.href)
        .then(() => alert('대진표 링크가 클립보드에 복사되었습니다.'))
        .catch(() => alert('링크 복사에 실패했습니다.'));
    }
  };

  return (
    <div>
      {/* 도구 모음 */}
      <div className={`card ${styles.section} no-print`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div className={styles.toolbarGroup} style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className={styles.toolbarLabel}>데이터 관리</span>
                {isReadOnly ? (
                  <span style={{ fontSize: '11px', color: '#64748b', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', padding: '1px 7px', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
                    🔒 읽기 전용 (수정 불가)
                  </span>
                ) : (
                  <span style={{ fontSize: '11px', color: '#16a34a', backgroundColor: '#dcfce7', padding: '1px 7px', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#16a34a', display: 'inline-block' }}></span>
                    실시간 자동 저장 중
                  </span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isAdmin ? 'repeat(3, 1fr)' : '1fr', gap: '8px' }}>
                <button 
                  className="btn btn-primary btn-sm" 
                  disabled={isReadOnly}
                  style={isReadOnly ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                  onClick={async () => { 
                    if (isReadOnly) return;
                    await onSave(); 
                    alert('저장되었습니다.'); 
                  }}
                >
                  💾 수동 저장
                </button>
                {isAdmin && (
                  <>
                    <button className="btn btn-secondary btn-sm" onClick={clearScores}>점수 초기화</button>
                    <button className="btn btn-danger btn-sm" onClick={clearSchedule}>🗑️ 전체 삭제</button>
                  </>
                )}
              </div>
            </div>
            <div className={styles.toolbarGroup} style={{ flex: 1, minWidth: 160 }}>
              <span className={styles.toolbarLabel}>공유</span>
              <button className="btn btn-secondary btn-sm" onClick={shareNative} style={{ width: '100%' }}>
                📤 대진표 공유하기
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 대진표 */}
      <div className={`card ${styles.section}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
          <h2 className={styles.sectionTitle} style={{ margin: 0, border: 'none', padding: 0 }}>
            대진표 <span className={styles.sectionNote}>{isReadOnly ? '(종료된 경기 기록)' : '(선수·점수 입력 즉시 전원에게 실시간 반영)'}</span>
          </h2>
          {isReadOnly ? (
            <span style={{ fontSize: '11.5px', color: '#64748b', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', padding: '3px 10px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 600 }}>
              🔒 읽기 전용 모드
            </span>
          ) : (
            <span style={{ fontSize: '11.5px', color: '#0369a1', backgroundColor: '#e0f2fe', padding: '3px 10px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 600 }}>
              ⚡ 모바일 실시간 동기화 ON
            </span>
          )}
        </div>

        {isReadOnly && (
          <div style={{ marginBottom: '14px', padding: '10px 14px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#475569', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }} className="no-print">
            <span style={{ fontSize: '16px' }}>🔒</span>
            <span>
              <strong>종료된 경기 기록 (읽기 전용):</strong> 지난 경기 기록은 일반 사용자의 점수 수정, 저장, 초기화, 삭제가 비활성화됩니다.
            </span>
          </div>
        )}

        {Object.keys(roundConflicts).length > 0 && (
          <div style={{ marginBottom: '14px', padding: '10px 14px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#991b1b', fontSize: '13px' }} className="no-print">
            <strong>⚠️ 라운드 내 동시간대 중복 출전 선수 감지:</strong>
            <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
              {Object.entries(roundConflicts).map(([ri, pMap]) => (
                <li key={ri}>
                  <strong>{parseInt(ri) + 1}R:</strong> {Object.keys(pMap).map(pId => `${byId[pId]?.name || '선수'} (${pMap[pId]}회 중복)`).join(', ')}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 👁️ 대진표 보기 모드 컨트롤러 (코트별 선수 배치 & 전체 펼쳐보기 / 진행중만 모아보기) */}
        <div className={`${styles.controllerBar} no-print`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* 1. 보기 방식: 코트별 선수 배치 vs 라운드별 전체 테이블 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--txt)' }}>
                👁️ 대진표 보기:
              </span>
              <div style={{ display: 'flex', backgroundColor: '#e2e8f0', borderRadius: '8px', padding: '2px', gap: '2px' }}>
                <button
                  type="button"
                  style={{
                    border: 'none',
                    padding: '5px 12px',
                    fontSize: '12px',
                    fontWeight: viewMode === 'court' ? 800 : 500,
                    backgroundColor: viewMode === 'court' ? '#2563eb' : 'transparent',
                    color: viewMode === 'court' ? '#fff' : 'var(--txt2)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    boxShadow: viewMode === 'court' ? '0 1px 4px rgba(37,99,235,0.3)' : 'none'
                  }}
                  onClick={() => setViewMode('court')}
                >
                  🎾 코트별 선수 배치
                </button>
                <button
                  type="button"
                  style={{
                    border: 'none',
                    padding: '5px 12px',
                    fontSize: '12px',
                    fontWeight: viewMode === 'table' ? 800 : 500,
                    backgroundColor: viewMode === 'table' ? '#2563eb' : 'transparent',
                    color: viewMode === 'table' ? '#fff' : 'var(--txt2)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    boxShadow: viewMode === 'table' ? '0 1px 4px rgba(37,99,235,0.3)' : 'none'
                  }}
                  onClick={() => setViewMode('table')}
                >
                  📋 라운드별 전체 테이블
                </button>
              </div>
            </div>

            {/* 2. 전체 펼쳐보기 vs 진행중 경기만 모아보기 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ display: 'flex', backgroundColor: '#e2e8f0', borderRadius: '8px', padding: '2px', gap: '2px' }}>
                <button
                  type="button"
                  style={{
                    border: 'none',
                    padding: '5px 12px',
                    fontSize: '12px',
                    fontWeight: !activeOnlyMode ? 800 : 500,
                    backgroundColor: !activeOnlyMode ? '#fff' : 'transparent',
                    color: !activeOnlyMode ? 'var(--navy)' : 'var(--txt3)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    boxShadow: !activeOnlyMode ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                  onClick={() => setGlobalMode(false)}
                >
                  📋 전체 펼쳐보기
                </button>
                <button
                  type="button"
                  style={{
                    border: 'none',
                    padding: '5px 12px',
                    fontSize: '12px',
                    fontWeight: activeOnlyMode ? 800 : 500,
                    backgroundColor: activeOnlyMode ? '#0284c7' : 'transparent',
                    color: activeOnlyMode ? '#fff' : 'var(--txt3)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    boxShadow: activeOnlyMode ? '0 1px 3px rgba(2,132,199,0.3)' : 'none'
                  }}
                  onClick={() => setGlobalMode(true)}
                >
                  ⚡ 현재 진행중인 경기만 모아보기
                </button>
              </div>
            </div>
          </div>

          {/* 3. 경기 방식(게임수) 설정 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '13px', fontWeight: 700, margin: 0, color: 'var(--txt)' }}>
              🎾 경기 방식:
            </label>
            {isAdmin && !isReadOnly ? (
              <select
                className="input input-sm"
                style={{ width: '120px', fontWeight: 700, padding: '4px 8px', borderRadius: '8px' }}
                value={maxGames}
                onChange={e => handleMaxGamesChange(parseInt(e.target.value) || 6)}
              >
                {[4, 5, 6, 7, 8].map(g => (
                  <option key={g} value={g}>{g}게임 선승</option>
                ))}
              </select>
            ) : (
              <span className="hero-chip" style={{ fontSize: '12px', padding: '3px 10px', color: '#0284c7', background: 'rgba(2, 132, 199, 0.1)', fontWeight: 700 }}>
                {maxGames}게임 선승
              </span>
            )}
            <span className="badge badge-blue" style={{ fontSize: '11px', padding: '2px 8px', fontWeight: 700 }}>
              최대 {maxGames}점
            </span>
          </div>
        </div>

        {/* ── 1. 코트별 선수 배치 뷰 ── */}
        {viewMode === 'court' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {courtMatchesList.map((matchesInCourt, ci) => {
              const courtLabel = `${COURT_LABELS[ci] || ci + 1}코트`;
              const isCollapsed = isCourtCollapsed(ci);
              const completedMatches = matchesInCourt.filter(m => m.hasScore);
              const activeMatch = matchesInCourt.find(m => !m.hasScore) || null;
              const activeMatchIdx = activeMatch ? matchesInCourt.indexOf(activeMatch) + 1 : null;
              const matchesToRender = isCollapsed
                ? (activeMatch ? [activeMatch] : [])
                : matchesInCourt;

              return (
                <div 
                  key={ci} 
                  className={styles.courtSection}
                >
                  {/* 코트 헤더 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--txt)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800 }}>
                        🎾 {courtLabel} 선수 배치 ({matchesInCourt.length}경기)
                      </h3>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{
                          padding: '3px 10px',
                          fontSize: '11.5px',
                          height: '26px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          borderRadius: '12px',
                          backgroundColor: isCollapsed ? '#e0f2fe' : '#fff',
                          color: isCollapsed ? '#0369a1' : 'var(--txt)',
                          borderColor: isCollapsed ? '#7dd3fc' : 'var(--border)',
                          fontWeight: isCollapsed ? 700 : 500
                        }}
                        onClick={() => toggleCourtCollapse(ci)}
                      >
                        {isCollapsed ? '⚡ 진행중만 모아보기' : '📋 전체 펼쳐보기'}
                        <span>{isCollapsed ? '▲' : '▼'}</span>
                      </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className={`badge ${completedMatches.length === matchesInCourt.length && matchesInCourt.length > 0 ? 'badge-green' : 'badge-blue'}`} style={{ fontSize: '11.5px', padding: '3px 8px', fontWeight: 700 }}>
                        {completedMatches.length === matchesInCourt.length && matchesInCourt.length > 0
                          ? '🎉 전 경기 완료'
                          : `${completedMatches.length} / ${matchesInCourt.length} 완료`}
                      </span>
                    </div>
                  </div>

                  {/* 진행중/완료 안내 바 */}
                  {isCollapsed && (
                    <div style={{
                      marginBottom: '14px',
                      padding: '8px 12px',
                      backgroundColor: activeMatch !== null ? '#f0fdf4' : '#f8fafc',
                      border: `1px solid ${activeMatch !== null ? '#bbf7d0' : 'var(--border)'}`,
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: activeMatch !== null ? '#166534' : 'var(--txt2)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '6px'
                    }}>
                      <span>
                        {activeMatch !== null ? (
                          <>🔥 <strong>{activeMatch.ri + 1}R</strong> 경기 진행 중 ({completedMatches.length}경기 완료 / {matchesInCourt.length - (activeMatchIdx || 0)}경기 대기)</>
                        ) : (
                          <>✅ <strong>{courtLabel}의 모든 경기({matchesInCourt.length}경기)가 완료되었습니다!</strong></>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleCourtCollapse(ci)}
                        style={{ background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', fontWeight: 700, fontSize: '11.5px', textDecoration: 'underline' }}
                      >
                        전체 경기 펼쳐보기 ({matchesInCourt.length}경기)
                      </button>
                    </div>
                  )}

                  {/* 경기 카드 목록 */}
                  {matchesToRender.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {matchesToRender.map((mObj) => {
                        const { ri, ci: currentCi, match: m, score: sc, hasScore, isWinA, isWinB } = mObj;
                        const sumA = teamNtrpSum(m.teamA, byId);
                        const sumB = teamNtrpSum(m.teamB, byId);
                        const isCurrentActive = activeMatch && activeMatch.ri === ri;

                        return (
                          <div
                            key={ri}
                            className={styles.courtMatchCard}
                            style={{
                              border: isCurrentActive ? '2px solid #38bdf8' : '1px solid #e2e8f0',
                              backgroundColor: isCurrentActive ? '#ffffff' : '#fafafa',
                              boxShadow: isCurrentActive ? '0 4px 12px rgba(56, 189, 248, 0.15)' : '0 1px 3px rgba(0,0,0,0.02)',
                            }}
                          >
                            {/* 카드 상단: 라운드 번호 & 상태 배지 */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ 
                                  fontWeight: 800, 
                                  fontSize: '13px', 
                                  color: isCurrentActive ? '#0284c7' : 'var(--txt)',
                                  backgroundColor: isCurrentActive ? 'rgba(2, 132, 199, 0.1)' : '#e2e8f0',
                                  padding: '2px 8px',
                                  borderRadius: '6px'
                                }}>
                                  {ri + 1}라운드 ({ri + 1}R)
                                </span>
                                {isCurrentActive && (
                                  <span className="badge badge-green" style={{ fontSize: '11px', padding: '2px 7px', fontWeight: 700 }}>
                                    🔥 현재 진행 중
                                  </span>
                                )}
                              </div>

                              <div>
                                {hasScore ? (
                                  <span className="badge badge-green" style={{ fontSize: '11px', padding: '2px 8px', fontWeight: 700 }}>
                                    ✅ 경기 완료 ({sc.a} : {sc.b})
                                  </span>
                                ) : isCurrentActive ? (
                                  <span style={{ fontSize: '11.5px', color: '#0284c7', fontWeight: 700 }}>
                                    점수를 입력해주세요
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '11.5px', color: 'var(--txt3)' }}>
                                    ⏳ 대기 중
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* 대진 (Team A vs Team B) - 모바일 최적화 그리드 */}
                            <div className={styles.courtMatchGrid}>
                              {/* Team A */}
                              <div 
                                className={styles.courtTeamBlock}
                                style={{
                                  border: isWinA ? '2px solid #3b82f6' : '1px solid #bfdbfe',
                                  backgroundColor: isWinA ? 'rgba(59, 130, 246, 0.08)' : 'rgba(239, 246, 255, 0.7)',
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '2px', overflow: 'hidden' }}>
                                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#1d4ed8', whiteSpace: 'nowrap' }}>
                                    A팀 {isWinA && '🏆'}
                                  </span>
                                  <span style={{ fontSize: '10.5px', color: '#3b82f6', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                    {sumA.toFixed(1)}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '100%' }}>
                                  {[0, 1].map(slot => {
                                    const pId = m.teamA[slot];
                                    const isDup = pId && roundConflicts[ri]?.[pId];
                                    return (
                                      <select
                                        key={slot}
                                        disabled={isReadOnly}
                                        className={`${styles.playerSel} ${styles.bgTeamA}`}
                                        style={{
                                          width: '100%',
                                          minWidth: 0,
                                          maxWidth: '100%',
                                          height: '28px',
                                          fontSize: '12px',
                                          padding: '2px 4px',
                                          borderRadius: '6px',
                                          boxSizing: 'border-box',
                                          ...(isDup ? { borderColor: '#ef4444', backgroundColor: '#fee2e2', color: '#b91c1c', fontWeight: 700 } : {})
                                        }}
                                        value={pId || ''}
                                        onChange={e => onPlayerSelect(ri, currentCi, 'a', slot, e.target.value)}
                                      >
                                        {playerOptions(pId)}
                                      </select>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* 스코어 입력 영역 */}
                              <div className={styles.courtScoreArea}>
                                <select
                                  disabled={isReadOnly}
                                  className={styles.courtScoreBox}
                                  value={sc.a === null || sc.a === undefined ? '' : sc.a}
                                  onChange={e => onScore(ri, currentCi, 'a', e.target.value)}
                                >
                                  {scoreOptions(maxGames)}
                                </select>
                                <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--txt3)', userSelect: 'none' }}>:</span>
                                <select
                                  disabled={isReadOnly}
                                  className={styles.courtScoreBox}
                                  value={sc.b === null || sc.b === undefined ? '' : sc.b}
                                  onChange={e => onScore(ri, currentCi, 'b', e.target.value)}
                                >
                                  {scoreOptions(maxGames)}
                                </select>
                              </div>

                              {/* Team B */}
                              <div 
                                className={styles.courtTeamBlock}
                                style={{
                                  border: isWinB ? '2px solid #ef4444' : '1px solid #fecdd3',
                                  backgroundColor: isWinB ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255, 241, 242, 0.7)',
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '2px', overflow: 'hidden' }}>
                                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#b91c1c', whiteSpace: 'nowrap' }}>
                                    B팀 {isWinB && '🏆'}
                                  </span>
                                  <span style={{ fontSize: '10.5px', color: '#ef4444', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                    {sumB.toFixed(1)}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '100%' }}>
                                  {[0, 1].map(slot => {
                                    const pId = m.teamB[slot];
                                    const isDup = pId && roundConflicts[ri]?.[pId];
                                    return (
                                      <select
                                        key={slot}
                                        disabled={isReadOnly}
                                        className={`${styles.playerSel} ${styles.bgTeamB}`}
                                        style={{
                                          width: '100%',
                                          minWidth: 0,
                                          maxWidth: '100%',
                                          height: '28px',
                                          fontSize: '12px',
                                          padding: '2px 4px',
                                          borderRadius: '6px',
                                          boxSizing: 'border-box',
                                          ...(isDup ? { borderColor: '#ef4444', backgroundColor: '#fee2e2', color: '#b91c1c', fontWeight: 700 } : {})
                                        }}
                                        value={pId || ''}
                                        onChange={e => onPlayerSelect(ri, currentCi, 'b', slot, e.target.value)}
                                      >
                                        {playerOptions(pId)}
                                      </select>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>

                            {/* 중복 출전 경고 배너 if any */}
                            {roundConflicts[ri] && Object.keys(roundConflicts[ri]).some(pId => [...m.teamA, ...m.teamB].includes(pId)) && (
                              <div style={{ marginTop: '8px', fontSize: '11px', color: '#dc2626', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                ⚠️ 해당 라운드({ri + 1}R)의 타 코트와 중복 배정된 선수가 포함되어 있습니다.
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ padding: '24px', textAlign: 'center', backgroundColor: '#fff', borderRadius: '10px', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '26px', marginBottom: '6px' }}>🏆</div>
                      <div style={{ fontWeight: 800, fontSize: '13.5px', color: '#166534' }}>
                        {courtLabel}의 모든 경기({matchesInCourt.length}경기)가 완료되었습니다!
                      </div>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ marginTop: '10px', fontSize: '11.5px', fontWeight: 700 }}
                        onClick={() => toggleCourtCollapse(ci)}
                      >
                        📋 전체 경기 결과 펼쳐보기 ({matchesInCourt.length}경기)
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── 2. 라운드별 전체 테이블 뷰 ── */}
        {viewMode === 'table' && (
          <div className="table-wrap">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <table>
                <thead>
                  <tr>
                    <th>라운드</th>
                    {Array.from({ length: courts }, (_, i) => <th key={i}>{COURT_LABELS[i]}코트</th>)}
                  </tr>
                </thead>
                <SortableContext items={roundIdsRef.current} strategy={verticalListSortingStrategy}>
                  <tbody>
                    {schedule.map((round, ri) => (
                      <SortableRow key={roundIdsRef.current[ri]} id={roundIdsRef.current[ri]}>
                        {(listeners) => (
                          <>
                            <td className={styles.roundLabel}>
                              {isAdmin && (
                                <span
                                  {...listeners}
                                  style={{ cursor: 'grab', marginRight: '8px', opacity: 0.5, fontSize: '18px', verticalAlign: 'middle' }}
                                  title="순서 변경"
                                >
                                  ☰
                                </span>
                              )}
                              {ri + 1}R
                            </td>
                    {round.map((m, ci) => {
                      const key = `${ri}-${ci}`;
                      const sc = scores[key] || { a: null, b: null };
                      const sumA = teamNtrpSum(m.teamA, byId);
                      const sumB = teamNtrpSum(m.teamB, byId);
                      const hasScore = sc.a !== null && sc.a !== undefined && sc.a !== '' &&
                                       sc.b !== null && sc.b !== undefined && sc.b !== '';
                      const winA = hasScore && Number(sc.a) > Number(sc.b);
                      const winB = hasScore && Number(sc.b) > Number(sc.a);
                      return (
                        <td key={ci} className={styles.matchCell}>
                          <div className={`${styles.matchCellContent} ${courts === 1 ? styles.singleCourt : ''}`}>
                            {/* 팀 A */}
                            <div className={`${styles.teamLine} ${winA ? styles.winner : ''}`}>
                              {[0, 1].map(slot => {
                                const pId = m.teamA[slot];
                                const isDup = pId && roundConflicts[ri]?.[pId];
                                return (
                                  <select 
                                    key={slot} 
                                    disabled={isReadOnly}
                                    className={`${styles.playerSel} ${styles.bgTeamA}`}
                                    style={isDup ? { borderColor: '#ef4444', backgroundColor: '#fee2e2', color: '#b91c1c', fontWeight: 'bold' } : {}}
                                    value={pId || ''}
                                    onChange={e => onPlayerSelect(ri, ci, 'a', slot, e.target.value)}>
                                    {playerOptions(pId)}
                                  </select>
                                );
                              })}
                            </div>
                            {/* 스코어 */}
                            <div className={styles.scoreRow}>
                              <select 
                                disabled={isReadOnly}
                                className={styles.scoreInput}
                                value={sc.a === null || sc.a === undefined ? '' : sc.a}
                                onChange={e => onScore(ri, ci, 'a', e.target.value)}>
                                {scoreOptions(maxGames)}
                              </select>
                              <span className={styles.scoreSep}>:</span>
                              <select 
                                disabled={isReadOnly}
                                className={styles.scoreInput}
                                value={sc.b === null || sc.b === undefined ? '' : sc.b}
                                onChange={e => onScore(ri, ci, 'b', e.target.value)}>
                                {scoreOptions(maxGames)}
                              </select>
                            </div>
                            {/* 팀 B */}
                            <div className={`${styles.teamLine} ${winB ? styles.winner : ''}`}>
                              {[0, 1].map(slot => {
                                const pId = m.teamB[slot];
                                const isDup = pId && roundConflicts[ri]?.[pId];
                                return (
                                  <select 
                                    key={slot} 
                                    disabled={isReadOnly}
                                    className={`${styles.playerSel} ${styles.bgTeamB}`}
                                    style={isDup ? { borderColor: '#ef4444', backgroundColor: '#fee2e2', color: '#b91c1c', fontWeight: 'bold' } : {}}
                                    value={pId || ''}
                                    onChange={e => onPlayerSelect(ri, ci, 'b', slot, e.target.value)}>
                                    {playerOptions(pId)}
                                  </select>
                                );
                              })}
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </>
                )}
              </SortableRow>
            ))}
                  </tbody>
                </SortableContext>
              </table>
            </DndContext>
          </div>
        )}

        {/* 하단 관리자 라운드/코트 조정 버튼 */}
        {isAdmin && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '16px' }} className="no-print">
            <button className="btn btn-secondary btn-sm" onClick={addRound}>+ 라운드 추가</button>
            <button className="btn btn-secondary btn-sm" onClick={removeRound}>- 라운드 삭제</button>
            <button className="btn btn-secondary btn-sm" onClick={addCourt}>+ 코트 추가</button>
            <button className="btn btn-secondary btn-sm" onClick={removeCourt}>- 코트 삭제</button>
          </div>
        )}
      </div>


      {/* 💸 1. 최종 경기 벌칙금(진팀 벌금) 정산소 */}
      <div className={`card ${styles.section}`} style={{ marginTop: '24px', border: '1px solid rgba(225, 29, 72, 0.25)', background: 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(255, 241, 242, 0.4) 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--txt)' }}>
                💸 최종 경기 벌칙금(진팀 벌금) 정산소
              </h2>
              {matchStats.isAllCompleted ? (
                <span className="badge badge-green" style={{ fontSize: '11.5px', padding: '3px 8px', fontWeight: 700 }}>
                  🎉 전체 경기 완료 (최종 정산 완료)
                </span>
              ) : (
                <span className="badge badge-blue" style={{ fontSize: '11.5px', padding: '3px 8px', fontWeight: 700 }}>
                  🎾 경기 진행 중 ({matchStats.completedMatches}/{matchStats.totalMatches}경기 완료)
                </span>
              )}
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: 'var(--txt2)' }}>
              진팀 패배 시 1인당 부과되는 벌칙금을 설정하고, 최종 완료 시 개인별 납부 벌칙금을 정산합니다.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
              onClick={handleOpenPenaltyShare}
            >
              📤 벌칙금 정산 내역 공유
            </button>
            {isAdmin && (
              <>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleBulkPayment(true)}
                  title="벌칙 대상자 전원을 납부완료 상태로 변경"
                >
                  ✅ 전원 완납
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleBulkPayment(false)}
                  title="벌칙 대상자 전원을 미납 상태로 변경"
                >
                  🔄 전원 미납
                </button>
              </>
            )}
          </div>
        </div>

        {/* 벌칙금액 설정 툴바 */}
        <div style={{ 
          padding: '12px 16px', 
          backgroundColor: 'rgba(255, 255, 255, 0.85)', 
          borderRadius: '12px', 
          border: '1px solid var(--border)',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          flexWrap: 'wrap', 
          gap: '12px',
          marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--txt)' }}>
              💰 진팀 1인당 벌칙 설정 (1패당):
            </span>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              {[
                { label: '0원(벌칙없음)', value: 0 },
                { label: '1,000원', value: 1000 },
                { label: '2,000원', value: 2000 },
                { label: '3,000원', value: 3000 },
                { label: '5,000원', value: 5000 }
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelectPenaltyPreset(opt.value)}
                  disabled={!isAdmin && isReadOnly}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '8px',
                    border: penaltyAmount === opt.value ? '1.5px solid #e11d48' : '1px solid var(--border)',
                    backgroundColor: penaltyAmount === opt.value ? '#ffe4e6' : '#fff',
                    color: penaltyAmount === opt.value ? '#e11d48' : 'var(--txt)',
                    fontWeight: penaltyAmount === opt.value ? 800 : 500,
                    fontSize: '12px',
                    cursor: (!isAdmin && isReadOnly) ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--txt3)' }}>직접 입력:</span>
            <input 
              type="number" 
              className="input input-sm" 
              style={{ width: '80px', textAlign: 'right', fontWeight: 700 }}
              value={customPenaltyInput}
              disabled={!isAdmin && isReadOnly}
              onChange={e => setCustomPenaltyInput(e.target.value)}
              onBlur={handleCustomPenaltyBlur}
              step="500"
              min="0"
            />
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--txt)' }}>원</span>
          </div>
        </div>

        {/* 4분할 핵심 KPI 카드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          <div className="card" style={{ padding: '14px 16px', background: '#fff', border: '1px solid rgba(225, 29, 72, 0.2)' }}>
            <div style={{ fontSize: '11.5px', color: 'var(--txt3)', fontWeight: 700 }}>💵 총 모인 벌칙금</div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#e11d48', marginTop: '2px' }}>
              {penaltySummary.totalPenalty.toLocaleString()}원
            </div>
            <div style={{ fontSize: '11px', color: 'var(--txt2)', marginTop: '2px' }}>
              총 {penaltySummary.totalLosses}패 발생 (1패당 {(penaltyAmount || 0).toLocaleString()}원)
            </div>
          </div>

          <div className="card" style={{ padding: '14px 16px', background: '#fff', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '11.5px', color: 'var(--txt3)', fontWeight: 700 }}>🎾 경기 진행 완료율</div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: matchStats.isAllCompleted ? '#16a34a' : 'var(--ios-blue)', marginTop: '2px' }}>
              {matchStats.completedMatches} / {matchStats.totalMatches}경기
            </div>
            <div style={{ fontSize: '11px', color: 'var(--txt2)', marginTop: '2px' }}>
              진행률 {Math.round((matchStats.completedMatches / (matchStats.totalMatches || 1)) * 100)}% {matchStats.isAllCompleted ? '· 전체 완료 ✅' : ''}
            </div>
          </div>

          <div className="card" style={{ padding: '14px 16px', background: '#fff', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '11.5px', color: 'var(--txt3)', fontWeight: 700 }}>👥 벌칙금 수납 현황</div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--txt)', marginTop: '2px' }}>
              완납 {penaltySummary.paidCount}명 <span style={{ fontSize: '13px', color: 'var(--txt3)', fontWeight: 500 }}>/ 미납 {penaltySummary.unpaidCount}명</span>
            </div>
            <div style={{ fontSize: '11px', color: penaltySummary.unpaidCount === 0 && penaltySummary.totalPenalty > 0 ? '#16a34a' : '#b45309', marginTop: '2px', fontWeight: 700 }}>
              {penaltySummary.totalPenalty === 0 ? '벌칙금 대상 없음' : penaltySummary.unpaidCount === 0 ? '전원 수납 완료 🎉' : `미납 총액: ${penaltySummary.unpaidTotal.toLocaleString()}원`}
            </div>
          </div>

          <div className="card" style={{ padding: '14px 16px', background: '#fff', border: '1px solid rgba(255, 149, 0, 0.3)' }}>
            <div style={{ fontSize: '11.5px', color: '#b45309', fontWeight: 700 }}>💸 오늘의 최다 기부왕</div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#b45309', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {penaltySummary.topLoser ? `${penaltySummary.topLoser.name} (${penaltySummary.topLoser.losses}패)` : '기부왕 없음'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--txt2)', marginTop: '2px' }}>
              {penaltySummary.topLoser ? `납부액: ${penaltySummary.topLoser.penalty.toLocaleString()}원 (${penaltySummary.topLoser.isPaid ? '완납 ✅' : '미납 💰'})` : '경기를 진행해주세요'}
            </div>
          </div>
        </div>

        {/* 개인별 벌칙금 납부 리스트 */}
        {penaltySummary.losersList.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--txt)', marginBottom: '8px' }}>
              📋 개인별 벌칙금 산출 및 납부 확인 ({penaltySummary.losersList.length}명)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
              {penaltySummary.losersList.map((p, idx) => (
                <div 
                  key={p.id}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '10px',
                    backgroundColor: '#fff',
                    border: idx === 0 ? '1.5px solid rgba(225, 29, 72, 0.4)' : '1px solid var(--border)',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: 800, fontSize: '13.5px', color: 'var(--txt)' }}>
                        {p.name}
                      </span>
                      {idx === 0 && (
                        <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', backgroundColor: '#ffe4e6', color: '#e11d48', fontWeight: 800 }}>
                          기부왕 💸
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--txt3)', marginTop: '2px' }}>
                      {p.played}경기 ({p.win}승 {p.losses}패)
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 900, color: '#e11d48' }}>
                      {p.penalty.toLocaleString()}원
                    </span>
                    <button
                      type="button"
                      onClick={() => handleTogglePayment(p.id)}
                      disabled={!isAdmin && isReadOnly}
                      style={{
                        padding: '2px 8px',
                        fontSize: '11px',
                        fontWeight: 700,
                        borderRadius: '6px',
                        border: 'none',
                        cursor: (!isAdmin && isReadOnly) ? 'not-allowed' : 'pointer',
                        backgroundColor: p.isPaid ? '#dcfce7' : '#fef3c7',
                        color: p.isPaid ? '#15803d' : '#b45309'
                      }}
                      title="클릭하여 납부/미납 상태 변경"
                    >
                      {p.isPaid ? '✅ 완납' : '💰 미납'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 무패 선수 (벌칙 면제) 안내 */}
        {penaltySummary.unbeatenList.length > 0 && (
          <div style={{ padding: '8px 12px', backgroundColor: 'rgba(22, 163, 74, 0.08)', borderRadius: '8px', border: '1px solid rgba(22, 163, 74, 0.2)', fontSize: '12px', color: '#166534', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span>👑</span>
            <strong>무패 선수 (벌칙 면제):</strong>
            <span>
              {penaltySummary.unbeatenList.map(u => `${u.name} (${u.win}승${u.draw > 0 ? ` ${u.draw}무` : ''})`).join(', ')}
            </span>
          </div>
        )}

        {/* 클럽 입금 계좌 안내 */}
        {clubSettings?.bankAccount && (
          <div style={{ padding: '8px 12px', backgroundColor: 'rgba(0, 122, 255, 0.06)', borderRadius: '8px', border: '1px solid rgba(0, 122, 255, 0.15)', fontSize: '12px', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span>🏦</span>
            <strong>클럽 벌칙금/회비 입금 계좌:</strong>
            <span style={{ fontWeight: 700 }}>{clubSettings.bankAccount}</span>
            {clubSettings.accountHolder && <span>(예금주: {clubSettings.accountHolder})</span>}
          </div>
        )}
      </div>

      {/* 2. 오늘 개인 순위표 & 벌칙금 현황 */}
      <div className={`card ${styles.section}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--txt)' }}>
              🏆 오늘 개인 순위표 & 벌칙금 현황
            </h2>
            <span className={styles.sectionNote}>
              (승률 → 득실차 → 다승 순 정렬 / 1패당 {(penaltyAmount || 0).toLocaleString()}원 벌칙금 반영)
            </span>
          </div>
          {penaltyAmount > 0 && (
            <span className="hero-chip" style={{ fontSize: '12px', padding: '3px 10px', color: '#e11d48', background: 'rgba(225, 29, 72, 0.08)' }}>
              1패당 {penaltyAmount.toLocaleString()}원
            </span>
          )}
        </div>

        {todayRows.length === 0 ? (
          <p className="text-muted" style={{ fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
            아직 입력된 점수가 없습니다. 대진표에서 스코어를 입력하면 순위와 벌칙금이 자동으로 산출됩니다.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="table" style={{ width: '100%', textAlign: 'center' }}>
              <thead>
                <tr>
                  <th style={{ width: 50 }}>순위</th>
                  <th>이름</th>
                  <th>경기</th>
                  <th>승</th>
                  <th>무</th>
                  <th>패</th>
                  <th>승률</th>
                  <th>득실차</th>
                  <th style={{ color: '#e11d48' }}>💸 벌칙금액</th>
                  <th>납부상태</th>
                </tr>
              </thead>
              <tbody>
                {todayRows.map((r, i) => {
                  const penalty = (r.loss || 0) * (penaltyAmount || 0);
                  const isPaid = !!penaltyPaidMap[r.id];
                  return (
                    <tr key={r.id ?? r.name}>
                      <td>
                        <strong>
                          {i === 0 && r.played > 0 ? '🥇 1' : i === 1 && r.played > 0 ? '🥈 2' : i === 2 && r.played > 0 ? '🥉 3' : r.played > 0 ? i + 1 : '-'}
                        </strong>
                      </td>
                      <td style={{ fontWeight: 700 }}>{r.name}</td>
                      <td>{r.played}</td>
                      <td><span style={{ color: '#16a34a', fontWeight: 700 }}>{r.win}</span></td>
                      <td><span style={{ color: '#64748b' }}>{r.draw}</span></td>
                      <td><span style={{ color: r.loss > 0 ? '#dc2626' : 'inherit', fontWeight: r.loss > 0 ? 700 : 400 }}>{r.loss}</span></td>
                      <td>{r.played > 0 ? (r.winRate * 100).toFixed(0) + '%' : '-'}</td>
                      <td>
                        <strong style={{ color: r.diff > 0 ? '#16a34a' : r.diff < 0 ? '#dc2626' : 'inherit' }}>
                          {r.diff > 0 ? '+' + r.diff : r.diff}
                        </strong>
                      </td>
                      <td>
                        {penaltyAmount > 0 ? (
                          r.loss > 0 ? (
                            <strong style={{ color: '#e11d48', fontSize: '13.5px' }}>
                              {penalty.toLocaleString()}원
                            </strong>
                          ) : r.played > 0 ? (
                            <span className="badge badge-green" style={{ fontSize: '11px', padding: '2px 6px' }}>
                              👑 0원 (무패)
                            </span>
                          ) : (
                            <span style={{ color: 'var(--txt3)' }}>-</span>
                          )
                        ) : (
                          <span style={{ color: 'var(--txt3)' }}>-</span>
                        )}
                      </td>
                      <td>
                        {penaltyAmount > 0 && r.loss > 0 ? (
                          <button
                            type="button"
                            onClick={() => handleTogglePayment(r.id)}
                            disabled={!isAdmin && isReadOnly}
                            style={{
                              padding: '2px 8px',
                              fontSize: '11px',
                              fontWeight: 700,
                              borderRadius: '6px',
                              border: 'none',
                              cursor: (!isAdmin && isReadOnly) ? 'not-allowed' : 'pointer',
                              backgroundColor: isPaid ? '#dcfce7' : '#fef3c7',
                              color: isPaid ? '#15803d' : '#b45309'
                            }}
                            title="클릭하여 납부 상태 변경"
                          >
                            {isPaid ? '✅ 완납' : '💰 미납'}
                          </button>
                        ) : (
                          <span style={{ color: 'var(--txt3)', fontSize: '12px' }}>면제</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. 벌칙금 정산 안내 공유 모달 */}
      {showPenaltyShareModal && (
        <div className="modal-overlay" style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="modal-content" style={{ maxWidth: '520px', width: '90%', borderRadius: '20px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--txt)' }}>
                📤 벌칙금(패배 벌금) 정산 공지문
              </h3>
              <button 
                type="button" 
                onClick={() => setShowPenaltyShareModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', color: 'var(--txt3)', cursor: 'pointer', padding: '4px' }}
              >
                ✕
              </button>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--txt2)', marginBottom: '12px', lineHeight: 1.5 }}>
              카카오톡 및 밴드에 공유하기 좋도록 개인별 벌칙 금액과 입금 계좌가 정돈된 공지 텍스트입니다.
            </p>
            <textarea
              className="input"
              style={{ width: '100%', height: '240px', resize: 'vertical', padding: '14px', lineHeight: '1.6', fontSize: '13px', borderRadius: '12px' }}
              value={penaltyShareText}
              onChange={(e) => setPenaltyShareText(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
              <button className="btn btn-secondary" onClick={() => setShowPenaltyShareModal(false)}>닫기</button>
              <button className="btn btn-primary" onClick={() => {
                navigator.clipboard.writeText(penaltyShareText);
                alert('벌칙금 정산 안내문이 클립보드에 복사되었습니다.');
              }}>📋 정산문 복사하기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

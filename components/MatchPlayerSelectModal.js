// components/MatchPlayerSelectModal.js — 대진표 경기 선수 배정 및 추가 전용 모달
'use client';
import { useState, useMemo, useEffect } from 'react';

const COURT_LABELS = 'ABCDEFGHIJ'.split('');

const checkIsGuest = (p) => Boolean(
  p && (
    p.role === '게스트' ||
    (typeof p.role === 'string' && p.role.includes('게스트')) ||
    p.isGuest === true
  )
);

const getDisplayNameWithGuest = (p) => {
  if (!p) return '';
  const name = p.name || '';
  return checkIsGuest(p) && !name.includes('(게)') ? `${name}(게)` : name;
};

const getRoleBadgeStyle = (role) => {
  switch (role) {
    case '회장': return { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' };
    case '부회장': return { bg: '#f5f3ff', color: '#6d28d9', border: '#ddd6fe' };
    case '총무': return { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' };
    case '경기이사':
    case '운영이사': return { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' };
    case '게스트': return { bg: '#fdf2f8', color: '#be185d', border: '#fbcfe8' };
    default: return { bg: '#f8fafc', color: '#475569', border: '#e2e8f0' };
  }
};

export const getGameCountBadgeStyle = (count) => {
  const num = Number(count) || 0;
  if (num === 0) {
    return {
      dot: '🟢',
      bg: '#ecfdf5',
      border: '#a7f3d0',
      text: '#047857',
      accent: '#10b981',
      title: '0경기 (미배정 · 우선 추천)',
      short: '0G',
    };
  }
  if (num === 1) {
    return {
      dot: '🔵',
      bg: '#eff6ff',
      border: '#bae6fd',
      text: '#0284c7',
      accent: '#3b82f6',
      title: '1경기 배정',
      short: '1G',
    };
  }
  if (num === 2) {
    return {
      dot: '🟣',
      bg: '#faf5ff',
      border: '#d8b4fe',
      text: '#7e22ce',
      accent: '#a855f7',
      title: '2경기 배정',
      short: '2G',
    };
  }
  if (num === 3) {
    return {
      dot: '🟠',
      bg: '#fff7ed',
      border: '#fed7aa',
      text: '#c2410c',
      accent: '#f97316',
      title: '3경기 배정 (목표 도달)',
      short: '3G',
    };
  }
  return {
    dot: '🔴',
    bg: '#fff1f2',
    border: '#fecdd3',
    text: '#be123c',
    accent: '#f43f5e',
    title: `${num}경기 배정 (휴식 권장)`,
    short: `${num}G`,
  };
};

export default function MatchPlayerSelectModal({
  isOpen,
  onClose,
  target, // { ri: number, ci: number, team: 'a' | 'b', slot: 0 | 1 }
  schedule = [],
  members = [],
  participants = [],
  scores = {},
  onAssignPlayer, // (ri, ci, team, slot, playerId, isNewParticipant) => void
  onClearSlot,    // (ri, ci, team, slot) => void
  isAdmin = true,
  isReadOnly = false,
}) {
  const [activeSlotInfo, setActiveSlotInfo] = useState(target);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState('AVAILABLE'); // 'AVAILABLE' | 'PARTICIPANTS' | 'UNJOINED' | 'ALL' | 'M' | 'F'
  const [notification, setNotification] = useState(null);

  // target prop 변경 시 activeSlotInfo 동기화
  useEffect(() => {
    if (target) {
      setActiveSlotInfo(target);
      setSearchTerm('');
    }
  }, [target]);

  const showToast = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const byId = useMemo(() => {
    const map = {};
    (members || []).forEach(m => { map[m.id] = m; });
    return map;
  }, [members]);

  const currentRi = activeSlotInfo?.ri ?? 0;
  const currentCi = activeSlotInfo?.ci ?? 0;
  const currentTeam = activeSlotInfo?.team ?? 'a';
  const currentSlot = activeSlotInfo?.slot ?? 0;

  const currentRound = schedule[currentRi] || [];
  const currentMatch = currentRound[currentCi] || { teamA: [null, null], teamB: [null, null] };
  const courtLabel = `${COURT_LABELS[currentCi] || currentCi + 1}코트`;
  const roundLabel = `${currentRi + 1}R`;

  // 대진표 참가자 ID 세트
  const participatingIdSet = useMemo(() => {
    return new Set((participants || []).map(p => p.playerId));
  }, [participants]);

  // 각 선수의 총 배정 경기수
  const assignedCounts = useMemo(() => {
    const map = {};
    schedule.forEach(round => {
      if (!Array.isArray(round)) return;
      round.forEach(match => {
        if (!match) return;
        [...(match.teamA || []), ...(match.teamB || [])].forEach(pId => {
          if (pId) map[pId] = (map[pId] || 0) + 1;
        });
      });
    });
    return map;
  }, [schedule]);

  // 각 선수의 완료(스코어 입력됨) 경기수
  const playedCounts = useMemo(() => {
    const map = {};
    schedule.forEach((round, ri) => {
      if (!Array.isArray(round)) return;
      round.forEach((match, ci) => {
        if (!match) return;
        const key = `${ri}-${ci}`;
        const sc = scores[key];
        const isDone = sc && sc.a !== null && sc.a !== undefined && sc.a !== '' &&
                            sc.b !== null && sc.b !== undefined && sc.b !== '';
        if (isDone) {
          [...(match.teamA || []), ...(match.teamB || [])].forEach(pId => {
            if (pId) map[pId] = (map[pId] || 0) + 1;
          });
        }
      });
    });
    return map;
  }, [schedule, scores]);

  // 현재 라운드(ri)의 타 코트에서 경기 중인 선수 맵: { [playerId]: otherCourtLabel }
  const roundCourtMap = useMemo(() => {
    const map = {};
    currentRound.forEach((m, oCi) => {
      if (oCi === currentCi || !m) return;
      const otherLabel = `${COURT_LABELS[oCi] || oCi + 1}코트`;
      [...(m.teamA || []), ...(m.teamB || [])].forEach(pId => {
        if (pId) map[pId] = otherLabel;
      });
    });
    return map;
  }, [currentRound, currentCi]);

  // 현재 경기 내 다른 슬롯에 배정된 선수들
  const currentMatchOtherPlayers = useMemo(() => {
    const map = {}; // { [playerId]: 'A팀 1번' | 'A팀 2번' | 'B팀 1번' | 'B팀 2번' }
    if (!currentMatch) return map;
    (currentMatch.teamA || []).forEach((pId, idx) => {
      if (pId && !(currentTeam === 'a' && currentSlot === idx)) {
        map[pId] = `A팀 ${idx + 1}번`;
      }
    });
    (currentMatch.teamB || []).forEach((pId, idx) => {
      if (pId && !(currentTeam === 'b' && currentSlot === idx)) {
        map[pId] = `B팀 ${idx + 1}번`;
      }
    });
    return map;
  }, [currentMatch, currentTeam, currentSlot]);

  // 현재 선택된 슬롯에 배정된 선수 ID
  const activeSlotPlayerId = useMemo(() => {
    if (!currentMatch) return null;
    return currentTeam === 'a' ? currentMatch.teamA?.[currentSlot] : currentMatch.teamB?.[currentSlot];
  }, [currentMatch, currentTeam, currentSlot]);

  // 후보 선수 목록 생성 및 상태 태깅
  const candidateList = useMemo(() => {
    return members.map(m => {
      const isParticipant = participatingIdSet.has(m.id);
      const isCurrentSlot = m.id === activeSlotPlayerId;
      const otherSlotInMatch = currentMatchOtherPlayers[m.id];
      const conflictCourt = roundCourtMap[m.id];
      const isRoundConflict = Boolean(conflictCourt);

      // 이번 라운드에 타 코트 경기가 없는 출전 가능(대기) 여부
      const isAvailableInRound = isParticipant && !isRoundConflict && !otherSlotInMatch;

      const played = playedCounts[m.id] || 0;
      const assigned = assignedCounts[m.id] || 0;

      return {
        ...m,
        isParticipant,
        isCurrentSlot,
        otherSlotInMatch,
        conflictCourt,
        isRoundConflict,
        isAvailableInRound,
        played,
        assigned,
      };
    });
  }, [members, participatingIdSet, activeSlotPlayerId, currentMatchOtherPlayers, roundCourtMap, playedCounts, assignedCounts]);

  // 필터링 및 정렬
  const filteredCandidates = useMemo(() => {
    return candidateList.filter(c => {
      // 1. 검색어 필터
      if (searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        const nameMatch = c.name?.toLowerCase().includes(term);
        const roleMatch = c.role?.toLowerCase().includes(term);
        if (!nameMatch && !roleMatch) return false;
      }

      // 2. 탭 필터
      if (filterMode === 'AVAILABLE') {
        // 출전 가능 대기 선수 (이번 라운드에 타코트 경기 안 뛰는 참가자)
        return c.isParticipant && !c.isRoundConflict;
      }
      if (filterMode === 'PARTICIPANTS') {
        return c.isParticipant;
      }
      if (filterMode === 'UNJOINED') {
        return !c.isParticipant;
      }
      if (filterMode === 'M') return c.gender === 'M';
      if (filterMode === 'F') return c.gender === 'F';
      return true; // 'ALL'
    }).sort((a, b) => {
      // 1. 현재 슬롯에 배정된 선수는 최상단
      if (a.isCurrentSlot && !b.isCurrentSlot) return -1;
      if (!a.isCurrentSlot && b.isCurrentSlot) return 1;

      // 2. 출전 가능(대기) 선수 우선
      if (a.isAvailableInRound && !b.isAvailableInRound) return -1;
      if (!a.isAvailableInRound && b.isAvailableInRound) return 1;

      // 3. 중복 출전 선수는 아래로
      if (!a.isRoundConflict && b.isRoundConflict) return -1;
      if (a.isRoundConflict && !b.isRoundConflict) return 1;

      // 4. ⭐ 핵심 사용자 요구사항: 경기 수가 적은 선수 우선 추천!
      if (a.played !== b.played) return a.played - b.played;
      if (a.assigned !== b.assigned) return a.assigned - b.assigned;

      // 5. 정회원/운영진 우선
      const rolePriority = { '회장': 1, '부회장': 2, '총무': 3, '경기이사': 4, '운영이사': 5, '정회원': 10, '준회원': 998, '게스트': 999 };
      const pA = rolePriority[a.role] || 99;
      const pB = rolePriority[b.role] || 99;
      if (pA !== pB) return pA - pB;

      return a.name.localeCompare(b.name, 'ko');
    });
  }, [candidateList, searchTerm, filterMode]);

  if (!isOpen || !target) return null;

  // 선수 슬롯 배정 실행
  const handleSelectPlayer = (candidate) => {
    if (isReadOnly || !isAdmin) return;

    if (candidate.isRoundConflict) {
      alert(`[${candidate.name}] 선수는 동일 시간대(${roundLabel} ${candidate.conflictCourt})에 이미 출전 중입니다.\n동일 라운드 중복 출전은 불가합니다.`);
      return;
    }
    if (candidate.otherSlotInMatch) {
      alert(`[${candidate.name}] 선수는 현재 경기(${roundLabel} ${courtLabel} ${candidate.otherSlotInMatch})에 이미 배정되어 있습니다.`);
      return;
    }

    const isNew = !candidate.isParticipant;
    if (onAssignPlayer) {
      onAssignPlayer(currentRi, currentCi, currentTeam, currentSlot, candidate.id, isNew);
      showToast(`🎉 [${candidate.name}] 선수가 ${roundLabel} ${courtLabel} ${currentTeam.toUpperCase()}팀 ${currentSlot + 1}번에 배정되었습니다!`);
    }

    // 자동으로 이 경기의 다음 빈 슬롯을 찾아 포커스 전환
    const slots = [
      { team: 'a', slot: 0 },
      { team: 'a', slot: 1 },
      { team: 'b', slot: 0 },
      { team: 'b', slot: 1 },
    ];
    const nextEmpty = slots.find(s => {
      if (s.team === currentTeam && s.slot === currentSlot) return false;
      const p = s.team === 'a' ? currentMatch.teamA?.[s.slot] : currentMatch.teamB?.[s.slot];
      return !p;
    });

    if (nextEmpty) {
      setActiveSlotInfo({ ri: currentRi, ci: currentCi, team: nextEmpty.team, slot: nextEmpty.slot });
    } else {
      // 4명이 모두 채워졌으면 가볍게 안내 후 모달 닫기
      setTimeout(() => {
        onClose();
      }, 400);
    }
  };

  // 현재 슬롯 비우기
  const handleClearCurrentSlot = () => {
    if (isReadOnly || !isAdmin) return;
    if (onClearSlot) {
      onClearSlot(currentRi, currentCi, currentTeam, currentSlot);
      showToast(`슬롯이 비워졌습니다.`);
    }
  };

  // 슬롯 전환
  const handleSwitchSlot = (team, slot) => {
    setActiveSlotInfo({ ri: currentRi, ci: currentCi, team, slot });
  };

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px',
        boxSizing: 'border-box'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        style={{
          backgroundColor: '#ffffff',
          width: '100%',
          maxWidth: '540px',
          maxHeight: '92vh',
          borderRadius: '22px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'modalSlideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          boxSizing: 'border-box'
        }}
      >
        {/* 모달 상단 헤더 */}
        <div style={{ padding: '16px 18px 12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '24px' }}>🎾</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--txt)' }}>
                경기 선수 배정 및 추가
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--txt3)' }}>
                <strong style={{ color: 'var(--ios-blue)' }}>{roundLabel} {courtLabel}</strong> · 선수를 배정할 슬롯을 누르고 아래 명단에서 선택하세요.
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '22px',
              color: 'var(--txt3)',
              cursor: 'pointer',
              padding: '4px 8px',
              lineHeight: 1
            }}
          >
            ✕
          </button>
        </div>

        {/* 안내 알림 토스트 (모달 내부) */}
        {notification && (
          <div style={{
            backgroundColor: '#10b981',
            color: '#fff',
            padding: '8px 16px',
            fontSize: '12.5px',
            fontWeight: 700,
            textAlign: 'center',
            boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)'
          }}>
            {notification}
          </div>
        )}

        {/* 1. 미니 코트 슬롯 프리뷰 (A팀 vs B팀 인터랙티브 슬롯 전환기) */}
        <div style={{ padding: '12px 16px', backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--txt2)' }}>
              🎯 현재 경기 슬롯 상태 (탭하여 배정 슬롯 변경)
            </span>
            {activeSlotPlayerId && (
              <button
                type="button"
                onClick={handleClearCurrentSlot}
                style={{
                  background: 'none',
                  border: '1px solid #fca5a5',
                  color: '#dc2626',
                  borderRadius: '6px',
                  padding: '2px 8px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: '#fef2f2'
                }}
              >
                ❌ 현재 슬롯 비우기
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '8px', alignItems: 'center' }}>
            {/* Team A Slots */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>🔵 A팀</span>
              </div>
              {[0, 1].map(sIdx => {
                const pId = currentMatch.teamA?.[sIdx];
                const p = byId[pId];
                const isActive = currentTeam === 'a' && currentSlot === sIdx;
                const pCount = p ? (assignedCounts[p.id] || 0) : 0;
                const pCountStyle = getGameCountBadgeStyle(pCount);
                return (
                  <button
                    key={sIdx}
                    type="button"
                    onClick={() => handleSwitchSlot('a', sIdx)}
                    style={{
                      padding: '6px 8px',
                      borderRadius: '8px',
                      border: isActive ? '2px solid #2563eb' : '1px solid #bfdbfe',
                      backgroundColor: isActive ? '#dbeafe' : 'rgba(239, 246, 255, 0.7)',
                      boxShadow: isActive ? '0 0 0 2px rgba(37, 99, 235, 0.2)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#1d4ed8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {p ? (
                        <>
                          <span>{getDisplayNameWithGuest(p)} ({p.gender === 'F' ? '여' : '남'})</span>
                          <span style={{
                            fontSize: '9.5px',
                            padding: '1px 4px',
                            borderRadius: '4px',
                            backgroundColor: pCountStyle.bg,
                            color: pCountStyle.text,
                            border: `1px solid ${pCountStyle.border}`,
                            fontWeight: 800,
                            lineHeight: '14px'
                          }}>
                            {pCountStyle.short}
                          </span>
                        </>
                      ) : `+ A${sIdx + 1} 빈 슬롯`}
                    </span>
                    {isActive && <span style={{ fontSize: '10px', color: '#2563eb', fontWeight: 900 }}>👉</span>}
                  </button>
                );
              })}
            </div>

            {/* VS Divider */}
            <div style={{ fontWeight: 900, color: 'var(--txt3)', fontSize: '12px', padding: '0 2px' }}>
              VS
            </div>

            {/* Team B Slots */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>🔴 B팀</span>
              </div>
              {[0, 1].map(sIdx => {
                const pId = currentMatch.teamB?.[sIdx];
                const p = byId[pId];
                const isActive = currentTeam === 'b' && currentSlot === sIdx;
                const pCount = p ? (assignedCounts[p.id] || 0) : 0;
                const pCountStyle = getGameCountBadgeStyle(pCount);
                return (
                  <button
                    key={sIdx}
                    type="button"
                    onClick={() => handleSwitchSlot('b', sIdx)}
                    style={{
                      padding: '6px 8px',
                      borderRadius: '8px',
                      border: isActive ? '2px solid #e11d48' : '1px solid #fecdd3',
                      backgroundColor: isActive ? '#ffe4e6' : 'rgba(255, 241, 242, 0.7)',
                      boxShadow: isActive ? '0 0 0 2px rgba(225, 29, 72, 0.2)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#be123c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {p ? (
                        <>
                          <span>{getDisplayNameWithGuest(p)} ({p.gender === 'F' ? '여' : '남'})</span>
                          <span style={{
                            fontSize: '9.5px',
                            padding: '1px 4px',
                            borderRadius: '4px',
                            backgroundColor: pCountStyle.bg,
                            color: pCountStyle.text,
                            border: `1px solid ${pCountStyle.border}`,
                            fontWeight: 800,
                            lineHeight: '14px'
                          }}>
                            {pCountStyle.short}
                          </span>
                        </>
                      ) : `+ B${sIdx + 1} 빈 슬롯`}
                    </span>
                    {isActive && <span style={{ fontSize: '10px', color: '#e11d48', fontWeight: 900 }}>👉</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 2. 검색창, 스마트 필터 칩 및 경기수 색상 안내 바 */}
        <div style={{ padding: '10px 16px 8px 16px', display: 'flex', flexDirection: 'column', gap: '8px', borderBottom: '1px solid var(--border)' }}>
          {/* 실시간 검색창 */}
          <div style={{ position: 'relative', width: '100%' }}>
            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: 'var(--txt3)' }}>
              🔍
            </span>
            <input
              type="text"
              placeholder="선수 이름 또는 직책으로 검색..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                height: '36px',
                padding: '6px 32px 6px 32px',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg)',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--txt)',
                boxSizing: 'border-box',
                outline: 'none'
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--txt3)', cursor: 'pointer', fontSize: '14px' }}
              >
                ✕
              </button>
            )}
          </div>

          {/* 필터 칩 바 */}
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
            {[
              { key: 'AVAILABLE', label: '⭐ 대기(출전 가능) 선수' },
              { key: 'PARTICIPANTS', label: '🎾 대진표 참가자' },
              { key: 'UNJOINED', label: '➕ 미참가 회원' },
              { key: 'ALL', label: '전체' },
              { key: 'M', label: '남성' },
              { key: 'F', label: '여성' },
            ].map(f => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilterMode(f.key)}
                style={{
                  padding: '3px 9px',
                  fontSize: '11.5px',
                  borderRadius: '14px',
                  border: filterMode === f.key ? '1px solid var(--ios-blue)' : '1px solid var(--border)',
                  backgroundColor: filterMode === f.key ? 'rgba(0, 122, 255, 0.1)' : '#fff',
                  color: filterMode === f.key ? 'var(--ios-blue)' : 'var(--txt2)',
                  fontWeight: filterMode === f.key ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* ⭐ 경기수 구분 색상 범례 가이드 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '6px',
            padding: '5px 10px',
            backgroundColor: '#f8fafc',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            flexWrap: 'wrap'
          }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--txt2)', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span>🎨</span> 경기수별 색상:
            </span>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#047857', backgroundColor: '#ecfdf5', padding: '1px 6px', borderRadius: '4px', border: '1px solid #a7f3d0' }}>🟢 0경기 (우선)</span>
              <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#0284c7', backgroundColor: '#eff6ff', padding: '1px 6px', borderRadius: '4px', border: '1px solid #bae6fd' }}>🔵 1경기</span>
              <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#7e22ce', backgroundColor: '#faf5ff', padding: '1px 6px', borderRadius: '4px', border: '1px solid #d8b4fe' }}>🟣 2경기</span>
              <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#c2410c', backgroundColor: '#fff7ed', padding: '1px 6px', borderRadius: '4px', border: '1px solid #fed7aa' }}>🟠 3경기</span>
              <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#be123c', backgroundColor: '#fff1f2', padding: '1px 6px', borderRadius: '4px', border: '1px solid #fecdd3' }}>🔴 4+경기</span>
            </div>
          </div>
        </div>

        {/* 3. 선수 리스트 (현재 완료 경기 수 표기 + 즉시 배정) */}
        <div 
          style={{
            flex: 1,
            overflowY: 'auto',
            maxHeight: '48vh',
            padding: '8px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            backgroundColor: '#f8fafc'
          }}
        >
          {filteredCandidates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 12px', color: 'var(--txt3)' }}>
              <span style={{ fontSize: '28px', display: 'block', marginBottom: '8px' }}>🎾</span>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>
                {searchTerm ? '검색된 선수가 없습니다.' : '선택 가능한 선수가 없습니다.'}
              </p>
              <p style={{ margin: '4px 0 0 0', fontSize: '11.5px', color: 'var(--txt3)' }}>
                필터나 검색어를 변경해 보세요.
              </p>
            </div>
          ) : (
            filteredCandidates.map(c => {
              const badgeStyle = getRoleBadgeStyle(c.role);
              const isFemale = c.gender === 'F';
              const isMale = c.gender === 'M';

              // ⭐ 경기수에 따른 색상 스타일 계산
              const countStyle = getGameCountBadgeStyle(c.assigned);

              // 버튼 및 카드 상태 결정
              const isCurrent = c.isCurrentSlot;
              const isConflict = c.isRoundConflict;
              const isOtherInMatch = c.otherSlotInMatch;
              const isDisabled = isConflict || isOtherInMatch;

              return (
                <div
                  key={c.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '12px',
                    backgroundColor: isCurrent ? '#eff6ff' : isDisabled ? '#f1f5f9' : '#ffffff',
                    border: isCurrent 
                      ? '1.5px solid var(--ios-blue)' 
                      : isDisabled 
                      ? '1px solid #e2e8f0' 
                      : '1px solid #cbd5e1',
                    borderLeft: `5px solid ${countStyle.accent}`,
                    boxShadow: isCurrent ? '0 2px 8px rgba(0, 122, 255, 0.12)' : '0 1px 3px rgba(0,0,0,0.02)',
                    opacity: isDisabled ? 0.75 : 1,
                    transition: 'all 0.15s ease',
                    gap: '10px'
                  }}
                >
                  {/* 선수 기본 정보 & ⭐ 경기수별 전용 색상 배지 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, fontSize: '13.5px', color: isConflict ? 'var(--txt3)' : 'var(--txt)' }}>
                        {getDisplayNameWithGuest(c)}
                      </span>

                      {/* 성별 뱃지 */}
                      <span style={{
                        fontSize: '10.5px',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        backgroundColor: isFemale ? 'rgba(236, 72, 153, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                        color: isFemale ? '#db2777' : '#2563eb',
                        fontWeight: 700
                      }}>
                        {isFemale ? '여' : '남'}
                      </span>

                      {/* 직책 뱃지 */}
                      <span style={{
                        fontSize: '10.5px',
                        padding: '1px 6px',
                        borderRadius: '6px',
                        backgroundColor: badgeStyle.bg,
                        color: badgeStyle.color,
                        border: `1px solid ${badgeStyle.border}`,
                        fontWeight: 700
                      }}>
                        {c.role || '정회원'}
                      </span>

                      {/* 출전 라운드 상태 태그 */}
                      {isConflict && (
                        <span style={{ fontSize: '10.5px', padding: '1px 6px', borderRadius: '4px', backgroundColor: '#fee2e2', color: '#b91c1c', fontWeight: 700 }}>
                          ⚠️ {roundLabel} {c.conflictCourt} 경기중
                        </span>
                      )}
                      {isOtherInMatch && (
                        <span style={{ fontSize: '10.5px', padding: '1px 6px', borderRadius: '4px', backgroundColor: '#fef3c7', color: '#b45309', fontWeight: 700 }}>
                          현재 경기 {c.otherSlotInMatch} 배정
                        </span>
                      )}
                      {!c.isParticipant && (
                        <span style={{ fontSize: '10.5px', padding: '1px 6px', borderRadius: '4px', backgroundColor: '#f3e8ff', color: '#7e22ce', fontWeight: 700 }}>
                          ➕ 대진표 미등록
                        </span>
                      )}
                    </div>

                    {/* ⭐ 사용자 요청 핵심: 경기수별 색상 배지 (총 배정 + 완료 경기수) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontWeight: 800,
                        backgroundColor: countStyle.bg,
                        color: countStyle.text,
                        border: `1px solid ${countStyle.border}`,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <span>{countStyle.dot}</span>
                        <span>총 {c.assigned}경기 배정</span>
                        <span style={{ opacity: 0.8, fontWeight: 600 }}>({c.played}경기 완료)</span>
                      </span>
                      {c.isAvailableInRound && (
                        <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700 }}>
                          🟢 현재 라운드 대기중(출전 가능)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 우측 배정 버튼 */}
                  <div>
                    {isCurrent ? (
                      <span style={{
                        fontSize: '11.5px',
                        padding: '4px 10px',
                        borderRadius: '8px',
                        backgroundColor: '#dbeafe',
                        color: '#1d4ed8',
                        fontWeight: 800,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}>
                        ✅ 현재 배정됨
                      </span>
                    ) : isConflict ? (
                      <button
                        type="button"
                        disabled
                        style={{
                          fontSize: '11.5px',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          backgroundColor: '#e2e8f0',
                          color: '#94a3b8',
                          border: 'none',
                          fontWeight: 700,
                          cursor: 'not-allowed'
                        }}
                      >
                        중복 불가
                      </button>
                    ) : isOtherInMatch ? (
                      <button
                        type="button"
                        disabled
                        style={{
                          fontSize: '11.5px',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          backgroundColor: '#e2e8f0',
                          color: '#94a3b8',
                          border: 'none',
                          fontWeight: 700,
                          cursor: 'not-allowed'
                        }}
                      >
                        경기 배정됨
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSelectPlayer(c)}
                        style={{
                          fontSize: '12px',
                          padding: '5px 12px',
                          borderRadius: '8px',
                          border: 'none',
                          backgroundColor: !c.isParticipant ? '#7c3aed' : 'var(--ios-blue)',
                          color: '#ffffff',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {!c.isParticipant ? '참가 & 배정 ➕' : '배정 🎾'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 하단 닫기 바 */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#ffffff' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            style={{ fontWeight: 700, padding: '8px 20px', borderRadius: '10px', fontSize: '13px' }}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

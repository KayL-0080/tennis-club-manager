// components/tabs/BracketTab.js — 대진표(선수 드롭다운+점수입력) + 검증요약 + 개인순위
'use client';
import { useMemo, useEffect, useRef } from 'react';
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

const scoreOptions = () => {
  const opts = [];
  opts.push(<option key="empty" value="">-</option>);
  for (let i = 0; i <= 10; i++) opts.push(<option key={i} value={i}>{i}</option>);
  return opts;
};

export default function BracketTab({
  schedule, setSchedule, scores, setScores,
  members, participants, lastGenStats,
  scheduleRounds, scheduleCourts, setScheduleRounds, setScheduleCourts,
  onSave, onPrint, isAdmin,
}) {
  const byId = useMemo(() => {
    const m = {}; members.forEach(p => m[p.id] = p); return m;
  }, [members]);

  const entries = useMemo(() =>
    participants.map(pt => members.find(m => m.id === pt.playerId)).filter(Boolean),
    [participants, members]
  );

  const todayRows = useMemo(() => computeTodayStandings(schedule, scores, byId), [schedule, scores, byId]);

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

  /* ── 이벤트 핸들러 ── */
  const onPlayerSelect = (ri, ci, team, slot, value) => {
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
  };

  const onScore = (ri, ci, team, value) => {
    const key = `${ri}-${ci}`;
    setScores(prev => ({
      ...prev,
      [key]: { ...(prev[key] || { a: null, b: null }), [team]: value === '' ? null : Number(value) },
    }));
  };

  /* ── 라운드/코트 편집 ── */
  const addRound = () => {
    const newRound = Array.from({ length: courts }, makeEmptyMatch);
    setSchedule(prev => [...prev, newRound]);
    setScheduleRounds(prev => prev + 1);
  };
  const removeRound = () => {
    if (!confirm('마지막 라운드를 삭제할까요?')) return;
    const ri = schedule.length - 1;
    setScores(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => { if (k.startsWith(ri + '-')) delete next[k]; });
      return next;
    });
    setSchedule(prev => prev.slice(0, -1));
    setScheduleRounds(prev => prev - 1);
  };
  const addCourt = () => {
    setSchedule(prev => prev.map(r => [...r, makeEmptyMatch()]));
    setScheduleCourts(prev => prev + 1);
  };
  const removeCourt = () => {
    if (courts <= 1) { alert('코트가 1개뿐입니다.'); return; }
    if (!confirm('마지막 코트를 삭제할까요?')) return;
    const ci = courts - 1;
    setScores(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => { if (k.endsWith('-' + ci)) delete next[k]; });
      return next;
    });
    setSchedule(prev => prev.map(r => r.slice(0, -1)));
    setScheduleCourts(prev => prev - 1);
  };
  const clearScores = () => {
    if (!confirm('점수를 모두 지울까요?')) return;
    setScores({});
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

  const copyUrl = () => {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(window.location.href)
      .then(() => alert('URL이 클립보드에 복사되었습니다.'))
      .catch(() => alert('URL 복사에 실패했습니다.'));
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
      alert('이 브라우저에서는 기본 공유 기능을 지원하지 않습니다. URL 복사를 이용해주세요.');
    }
  };
  const clearSchedule = () => {
    if (confirm('정말로 전체 대진표를 삭제하시겠습니까?\n(이 작업은 되돌릴 수 없습니다)')) {
      setSchedule([]);
      setScores({});
    }
  };

  return (
    <div>
      {/* 도구 모음 */}
      <div className={`card ${styles.section} no-print`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div className={styles.toolbarGroup} style={{ flex: 1, minWidth: 200 }}>
              <span className={styles.toolbarLabel}>데이터 관리</span>
              <div style={{ display: 'grid', gridTemplateColumns: isAdmin ? 'repeat(3, 1fr)' : '1fr', gap: '8px' }}>
                <button className="btn btn-primary btn-sm" onClick={async () => { await onSave(); alert('저장되었습니다.'); }}>💾 저장</button>
                {isAdmin && (
                  <>
                    <button className="btn btn-secondary btn-sm" onClick={clearScores}>점수 초기화</button>
                    <button className="btn btn-danger btn-sm" onClick={clearSchedule}>🗑️ 전체 삭제</button>
                  </>
                )}
              </div>
            </div>
            <div className={styles.toolbarGroup} style={{ flex: 1, minWidth: 260 }}>
              <span className={styles.toolbarLabel}>내보내기 / 공유</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                <button className="btn btn-secondary btn-sm" onClick={copyUrl}>🔗 URL 복사</button>
                <button className="btn btn-secondary btn-sm" onClick={shareNative}>📤 공유하기</button>
                <button className="btn btn-secondary btn-sm" onClick={onPrint}>🖨️ 인쇄</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 대진표 */}
      <div className={`card ${styles.section}`}>
        <h2 className={styles.sectionTitle}>대진표 <span className={styles.sectionNote}>(선수·점수 직접 수정 가능)</span></h2>

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
                                <select key={slot} className={`${styles.playerSel} ${styles.bgTeamA}`}
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
                            <select className={styles.scoreInput}
                              value={sc.a === null || sc.a === undefined ? '' : sc.a}
                              onChange={e => onScore(ri, ci, 'a', e.target.value)}>
                              {scoreOptions()}
                            </select>
                            <span className={styles.scoreSep}>:</span>
                            <select className={styles.scoreInput}
                              value={sc.b === null || sc.b === undefined ? '' : sc.b}
                              onChange={e => onScore(ri, ci, 'b', e.target.value)}>
                              {scoreOptions()}
                            </select>
                          </div>
                          {/* 팀 B */}
                          <div className={`${styles.teamLine} ${winB ? styles.winner : ''}`}>
                            {[0, 1].map(slot => {
                              const pId = m.teamB[slot];
                              const isDup = pId && roundConflicts[ri]?.[pId];
                              return (
                                <select key={slot} className={`${styles.playerSel} ${styles.bgTeamB}`}
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
        {isAdmin && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '16px' }} className="no-print">
            <button className="btn btn-secondary btn-sm" onClick={addRound}>+ 라운드 추가</button>
            <button className="btn btn-secondary btn-sm" onClick={removeRound}>- 라운드 삭제</button>
            <button className="btn btn-secondary btn-sm" onClick={addCourt}>+ 코트 추가</button>
            <button className="btn btn-secondary btn-sm" onClick={removeCourt}>- 코트 삭제</button>
          </div>
        )}
      </div>

      {/* 검증 요약 */}
      {isAdmin && (
        <div className={`card ${styles.section}`}>
          <h2 className={styles.sectionTitle}>검증 요약</h2>
          {lastGenStats && (
            <div className={styles.statsRow}>
              <div className={`${styles.statBox} ${lastGenStats.dupCount === 0 ? styles.statGreen : styles.statRed}`}>
                <span className={styles.statLabel}>중복 페어 수</span>
                <span className={styles.statNum2}>{lastGenStats.dupCount}</span>
              </div>
              <div className={styles.statBox}>
                <span className={styles.statLabel}>NTRP 편차 총합</span>
                <span className={styles.statNum2}>{lastGenStats.ntrpDiffSum?.toFixed(1)}</span>
              </div>
            </div>
          )}
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table>
              <thead><tr><th>이름</th><th>목표</th><th>실제</th><th>일치</th></tr></thead>
              <tbody>
                {entries.map(p => {
                  const actual = counts[p.id] || 0;
                  const ok = actual === p.target;
                  return (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>{p.target}</td>
                      <td>{actual}</td>
                      <td className={ok ? 'text-green' : 'text-red'}>{ok ? '✓' : '✗'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 개인 순위 */}
      <div className={`card ${styles.section}`}>
        <h2 className={styles.sectionTitle}>오늘 개인 순위표</h2>
        {todayRows.length === 0 ? (
          <p className="text-muted" style={{ fontSize: 13 }}>아직 입력된 점수가 없습니다.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>순위</th><th>이름</th><th>경기</th><th>승</th><th>무</th><th>패</th><th>승률</th><th>득실차</th></tr>
              </thead>
              <tbody>
                {todayRows.map((r, i) => (
                  <tr key={r.id ?? r.name}>
                    <td style={i === 0 && r.played > 0 ? { color: 'var(--gold)', fontWeight: 700 } : {}}>
                      {r.played > 0 ? i + 1 : '-'}
                    </td>
                    <td>{r.name}</td>
                    <td>{r.played}</td>
                    <td>{r.win}</td>
                    <td>{r.draw}</td>
                    <td>{r.loss}</td>
                    <td>{r.played > 0 ? (r.winRate * 100).toFixed(0) + '%' : '-'}</td>
                    <td>{r.diff > 0 ? '+' + r.diff : r.diff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

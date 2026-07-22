// components/tabs/BracketTab.js — 대진표(선수 드롭다운+점수입력) + 검증요약 + 개인순위
'use client';
import { useMemo } from 'react';
import { makeEmptyMatch, teamNtrpSum, computeTodayStandings } from '@/lib/scheduler';
import styles from './tabs.module.css';

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
    participants.map(pt => {
      const m = members.find(m => m.id === pt.playerId);
      return m ? { ...m, target: pt.target } : null;
    }).filter(Boolean),
    [participants, members]
  );

  const todayRows = useMemo(() => computeTodayStandings(schedule, scores, byId), [schedule, scores, byId]);

  if (!schedule || schedule.length === 0) {
    return (
      <div className={`card ${styles.section}`} style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>📋</div>
        <p className="text-muted">대진표가 없습니다. "대진표 만들기" 탭에서 생성해주세요.</p>
      </div>
    );
  }

  const courts = scheduleCourts || (schedule[0]?.length ?? 0);

  /* ── 이벤트 핸들러 ── */
  const onPlayerSelect = (ri, ci, team, slot, value) => {
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
      const p = byId[selectedId];
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

  return (
    <div>
      {/* 도구 모음 */}
      <div className={`card ${styles.section} no-print`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {isAdmin && (
            <div className={styles.toolbarGroup}>
              <span className={styles.toolbarLabel}>구조 편집</span>
              <div className={styles.genRow}>
                <button className="btn btn-secondary btn-sm" onClick={addRound}>+ 라운드 추가</button>
                <button className="btn btn-secondary btn-sm" onClick={removeRound}>- 라운드 삭제</button>
                <button className="btn btn-secondary btn-sm" onClick={addCourt}>+ 코트 추가</button>
                <button className="btn btn-secondary btn-sm" onClick={removeCourt}>- 코트 삭제</button>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div className={styles.toolbarGroup} style={{ flex: 1, minWidth: 200 }}>
              <span className={styles.toolbarLabel}>데이터 관리</span>
              <div className={styles.genRow}>
                <button className="btn btn-primary btn-sm" onClick={async () => { await onSave(); alert('저장되었습니다.'); }}>💾 저장</button>
                {isAdmin && (
                  <button className="btn btn-secondary btn-sm" onClick={clearScores}>점수 초기화</button>
                )}
              </div>
            </div>
            <div className={styles.toolbarGroup} style={{ flex: 1, minWidth: 260 }}>
              <span className={styles.toolbarLabel}>내보내기 / 공유</span>
              <div className={styles.genRow}>
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
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>라운드</th>
                {Array.from({ length: courts }, (_, i) => <th key={i}>{COURT_LABELS[i]}코트</th>)}
              </tr>
            </thead>
            <tbody>
              {schedule.map((round, ri) => (
                <tr key={ri}>
                  <td className={styles.roundLabel}>{ri + 1}R</td>
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
                            {[0, 1].map(slot => (
                              <select key={slot} className={`${styles.playerSel} ${styles.bgTeamA}`}
                                value={m.teamA[slot] || ''}
                                onChange={e => onPlayerSelect(ri, ci, 'a', slot, e.target.value)}>
                                {playerOptions(m.teamA[slot])}
                              </select>
                            ))}
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
                            {[0, 1].map(slot => (
                              <select key={slot} className={`${styles.playerSel} ${styles.bgTeamB}`}
                                value={m.teamB[slot] || ''}
                                onChange={e => onPlayerSelect(ri, ci, 'b', slot, e.target.value)}>
                                {playerOptions(m.teamB[slot])}
                              </select>
                            ))}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 검증 요약 */}
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

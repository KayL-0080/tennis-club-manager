// components/tabs/HistoryTab.js — 날짜별 기록 저장/조회 + 전체 누적 순위표
'use client';
import { useState, useMemo } from 'react';
import { computeLifetimeStandings } from '@/lib/scheduler';
import styles from './tabs.module.css';

const COURT_LABELS = 'ABCDEFGHIJ'.split('');

export default function HistoryTab({ schedule, scores, members, history, setHistory, onSave, isAdmin }) {
  const [viewEntry, setViewEntry] = useState(null);
  const lifetimeRows = useMemo(() => computeLifetimeStandings(history), [history]);

  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const saveRecord = () => {
    if (!schedule || schedule.length === 0) { alert('저장할 대진표가 없습니다.'); return; }
    const dateVal = document.getElementById('recordDateInput')?.value || todayStr();
    const entry = {
      id: 'h' + Date.now(),
      date: dateVal,
      schedule: JSON.parse(JSON.stringify(schedule)),
      scores: JSON.parse(JSON.stringify(scores)),
      playerSnapshot: members.map(m => ({ id: m.id, name: m.name, gender: m.gender, ntrp: m.ntrp })),
    };
    const next = [...history, entry].sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
    setHistory(next);
    onSave({ history: next });
    alert('기록이 저장되었습니다.');
  };

  const deleteEntry = (id) => {
    if (!confirm('이 기록을 삭제할까요?')) return;
    const next = history.filter(h => h.id !== id);
    setHistory(next);
    onSave({ history: next });
    if (viewEntry?.id === id) setViewEntry(null);
  };

  return (
    <div>
      {/* 기록 저장 */}
      {isAdmin && (
        <div className={`card ${styles.section}`}>
          <h2 className={styles.sectionTitle}>기록 저장 &amp; 지난 기록</h2>
          <div className={styles.settingsRow}>
            <div className="form-group">
              <label className="form-label">기록 날짜</label>
              <input id="recordDateInput" className="input input-sm" type="date" defaultValue={todayStr()} style={{ width: 160 }} />
            </div>
            <div className="form-group">
              <label className="form-label">&nbsp;</label>
              <button className="btn btn-primary btn-sm" onClick={saveRecord}>오늘 기록으로 저장</button>
            </div>
          </div>
        </div>
      )}

      {/* 기록 목록 */}
      <div className={`card ${styles.section}`}>
        <h2 className={styles.sectionTitle}>{isAdmin ? '기록 목록' : '지난 기록'}</h2>
        {history.length === 0 ? (
          <p className="text-muted" style={{ fontSize: 13, marginTop: 12 }}>아직 저장된 기록이 없습니다.</p>
        ) : (
          <div className={styles.histList}>
            {history.map(h => {
              const cnt = new Set(h.schedule.flatMap(r => r.flatMap(m => [...m.teamA, ...m.teamB])).filter(Boolean)).size;
              return (
                <div key={h.id} className={styles.histItem}>
                  <span>{h.date} · 참가 {cnt}명</span>
                  <span>
                    <button className="btn btn-secondary btn-sm" onClick={() => setViewEntry(viewEntry?.id === h.id ? null : h)}>
                      {viewEntry?.id === h.id ? '닫기' : '보기'}
                    </button>
                    {isAdmin && <button className="btn btn-danger btn-sm" onClick={() => deleteEntry(h.id)} style={{ marginLeft: 6 }}>삭제</button>}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 기록 상세 보기 */}
      {viewEntry && (
        <div className={`card ${styles.section}`}>
          <h2 className={styles.sectionTitle}>{viewEntry.date} 기록</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>라운드</th>
                  {Array.from({ length: viewEntry.schedule[0]?.length ?? 0 }, (_, i) => (
                    <th key={i}>{COURT_LABELS[i]}코트</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {viewEntry.schedule.map((round, ri) => {
                  const snap = {};
                  viewEntry.playerSnapshot.forEach(p => snap[p.id] = p);
                  return (
                    <tr key={ri}>
                      <td className={styles.roundLabel}>{ri + 1}R</td>
                      {round.map((m, ci) => {
                        const key = `${ri}-${ci}`;
                        const sc = (viewEntry.scores && viewEntry.scores[key]) || { a: null, b: null };
                        const nameOf = id => { const p = snap[id]; return p ? p.name : '(미정)'; };
                        const sumOf = ids => ids.reduce((s, id) => { const p = snap[id]; return s + (p ? p.ntrp : 0); }, 0);
                        const hasScore = sc.a !== null && sc.a !== undefined && sc.a !== '' &&
                                         sc.b !== null && sc.b !== undefined && sc.b !== '';
                        const winA = hasScore && Number(sc.a) > Number(sc.b);
                        const winB = hasScore && Number(sc.b) > Number(sc.a);
                        return (
                          <td key={ci} className={styles.matchCell}>
                            <div className={styles.matchCellContent}>
                              <div className={`${styles.teamLine} ${winA ? styles.winner : ''}`}>
                                <span className={`${styles.teamBadge} ${styles.bgTeamA}`}>
                                  {m.teamA.map(nameOf).join(' + ')}
                                </span>
                              </div>
                              <div className={styles.scoreRow} style={{ justifyContent: 'center' }}>
                                {hasScore ? `${sc.a} : ${sc.b}` : '- : -'}
                              </div>
                              <div className={`${styles.teamLine} ${winB ? styles.winner : ''}`}>
                                <span className={`${styles.teamBadge} ${styles.bgTeamB}`}>
                                  {m.teamB.map(nameOf).join(' + ')}
                                </span>
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 전체 누적 순위표 */}
      <div className={`card ${styles.section}`}>
        <h2 className={styles.sectionTitle}>전체 누적 순위표 (저장된 기록 전체 합산)</h2>
        {lifetimeRows.length === 0 ? (
          <p className="text-muted" style={{ fontSize: 13 }}>아직 저장된 기록이 없습니다. 경기를 마친 뒤 "오늘 기록으로 저장"을 눌러보세요.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>순위</th><th>이름</th><th>경기</th><th>승</th><th>무</th><th>패</th><th>승률</th><th>득실차</th></tr>
              </thead>
              <tbody>
                {lifetimeRows.map((r, i) => (
                  <tr key={r.name}>
                    <td style={i === 0 ? { color: 'var(--gold)', fontWeight: 700 } : {}}>{i + 1}</td>
                    <td>{r.name}</td>
                    <td>{r.played}</td>
                    <td>{r.win}</td>
                    <td>{r.draw}</td>
                    <td>{r.loss}</td>
                    <td>{r.played > 0 ? (r.winRate * 100).toFixed(0) + '%' : '-'}</td>
                    <td>{r.diff > 0 ? `+${r.diff}` : r.diff}</td>
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

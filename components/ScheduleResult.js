// components/ScheduleResult.js
'use client';
import styles from './ScheduleResult.module.css';

const COURT_LABELS = 'ABCDEFGHIJ'.split('');

export default function ScheduleResult({ result, players, rounds, courts }) {
  if (!result?.scheduleRounds) return null;

  const counts = {};
  players.forEach((p) => (counts[p.id] = 0));
  result.scheduleRounds.forEach((round) =>
    round.forEach((m) => {
      [...m.teamA, ...m.teamB].forEach((p) => (counts[p.id] = (counts[p.id] || 0) + 1));
    })
  );

  return (
    <>
      {/* 대진표 */}
      <section className={`card ${styles.section}`}>
        <h2 className={styles.title}>대진표</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>라운드</th>
                {Array.from({ length: courts }, (_, i) => (
                  <th key={i}>{COURT_LABELS[i]}코트</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.scheduleRounds.map((round, ri) => (
                <tr key={ri}>
                  <td className={styles.roundLabel}>{ri + 1}R</td>
                  {round.map((m, mi) => (
                    <td key={mi} className={styles.matchCell}>
                      <span className={styles.team}>{m.teamA.map((p) => p.name).join(' + ')}</span>
                      <span className={styles.ntrpSum}>({m.sumA.toFixed(1)})</span>
                      <span className={styles.vs}>vs</span>
                      <span className={styles.team}>{m.teamB.map((p) => p.name).join(' + ')}</span>
                      <span className={styles.ntrpSum}>({m.sumB.toFixed(1)})</span>
                      {m.type === 'mixed' && <span className="badge badge-purple" style={{ marginTop: 4, fontSize: 10 }}>혼복</span>}
                      {m.type === 'group' && <span className="badge badge-gold"   style={{ marginTop: 4, fontSize: 10 }}>지정</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 검증 요약 */}
      <section className={`card ${styles.section}`}>
        <h2 className={styles.title}>검증 요약</h2>
        <div className={styles.stats}>
          <div className={`${styles.statBox} ${result.dupCount === 0 ? styles.statGreen : styles.statRed}`}>
            <span className={styles.statLabel}>중복 페어 수</span>
            <span className={styles.statVal}>{result.dupCount}</span>
          </div>
          <div className={styles.statBox}>
            <span className={styles.statLabel}>NTRP 합계 편차 총합</span>
            <span className={styles.statVal}>{result.ntrpDiffSum?.toFixed(1)}</span>
          </div>
        </div>
        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table>
            <thead>
              <tr><th>이름</th><th>성별</th><th>NTRP</th><th>목표</th><th>실제</th><th>일치</th></tr>
            </thead>
            <tbody>
              {players.map((p) => {
                const actual = counts[p.id] || 0;
                const ok = actual === p.target;
                return (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td><span className={`badge ${p.gender === 'F' ? 'badge-purple' : 'badge-blue'}`}>{p.gender === 'F' ? '여' : '남'}</span></td>
                    <td>{p.ntrp.toFixed(1)}</td>
                    <td>{p.target}</td>
                    <td>{actual}</td>
                    <td className={ok ? 'text-green' : 'text-red'}>{ok ? '✓' : '✗'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

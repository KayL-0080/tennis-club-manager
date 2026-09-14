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

    </>
  );
}

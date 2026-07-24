// components/GroupConditions.js
'use client';
import styles from './GroupConditions.module.css';

let _gCounter = 1000;
const newGid = () => 'grp' + _gCounter++;

export default function GroupConditions({ players, groups, setGroups }) {
  const addGroup = (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const ids = ['g1', 'g2', 'g3', 'g4'].map((n) => form[n].value);
    const count = parseInt(form.gCount.value) || 1;
    if (new Set(ids).size < 4) { alert('4명을 서로 다르게 선택해주세요.'); return; }
    setGroups([...groups, { id: newGid(), memberIds: ids, count }]);
    form.reset();
  };

  const remove = (id) => setGroups(groups.filter((g) => g.id !== id));

  if (players.length < 4) {
    return <p className="text-muted" style={{ fontSize: '15px' }}>회원을 4명 이상 추가하면 특별 조건을 설정할 수 있습니다.</p>;
  }

  return (
    <div>
      <p className={styles.desc}>특정 4명이 함께 뛰는 게임 (같은 4명, 페어만 다르게 구성)</p>
      <form className={styles.addRow} onSubmit={addGroup}>
        {['g1','g2','g3','g4'].map((n) => (
          <select key={n} name={n} className="select input-sm" style={{ flex: 1, minWidth: 90 }}>
            {players.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        ))}
        <span style={{ fontSize: '15px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>게임수:</span>
        <input name="gCount" className="input input-sm" type="number" defaultValue={2} min={1} style={{ width: 55 }} />
        <button className="btn btn-secondary btn-sm" type="submit">추가</button>
      </form>

      {groups.length > 0 && (
        <div className={styles.list}>
          {groups.map((g) => {
            const names = g.memberIds.map((mid) => players.find((p) => p.id === mid)?.name ?? '(삭제됨)').join(', ');
            return (
              <div key={g.id} className={styles.item}>
                <span>{names} — <strong>{g.count}게임</strong></span>
                <button className="btn btn-danger btn-sm" onClick={() => remove(g.id)} type="button">삭제</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

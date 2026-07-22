// components/tabs/MembersTab.js — 전체 회원 관리
'use client';
import styles from './tabs.module.css';

const NTRP_OPTIONS = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0];
const ROLE_OPTIONS = ['회장', '총무', '경기이사', '운영이사', '고문', '정회원', '준회원', '게스트'];

export default function MembersTab({ members, onUpdateLocal, onSave, onAdd, onDelete, isAdmin }) {

  const sortedMembers = [...members].sort((a, b) => {
    // 1. 특정 직책 상단 고정 우선순위
    const rolePriority = { '회장': 1, '총무': 2, '경기이사': 3, '운영이사': 4 };
    const pA = rolePriority[a.role] || 99;
    const pB = rolePriority[b.role] || 99;
    if (pA !== pB) return pA - pB;

    // 2. 성별 (남성 'M' 우선)
    if (a.gender !== b.gender) return a.gender === 'M' ? -1 : 1;

    // 3. NTRP (내림차순, 높은 순)
    return (b.ntrp || 0) - (a.ntrp || 0);
  });

  return (
    <div>
      <div className={`card ${styles.section}`}>
        <h2 className={styles.sectionTitle}>
          회원 명단 <span className={styles.sectionNote}>(전체 회원 관리 — 오늘 참가자와 별개)</span>
        </h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>이름</th><th>직책/구분</th><th>성별</th><th>NTRP</th><th></th></tr>
            </thead>
            <tbody>
              {sortedMembers.map(p => (
                <tr key={p.id}>
                  <td>
                    <input className="input input-sm" type="text" value={p.name} style={{ width: 110 }}
                      disabled={!isAdmin}
                      onChange={e => onUpdateLocal(p.id, { name: e.target.value })}
                      onBlur={e => onSave(p.id, { name: e.target.value })} />
                  </td>
                  <td>
                    <select className="select input-sm" value={p.role || '정회원'} style={{ width: 85 }}
                      disabled={!isAdmin}
                      onChange={e => { onUpdateLocal(p.id, { role: e.target.value }); onSave(p.id, { role: e.target.value }); }}>
                      {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td>
                    <select className="select input-sm" value={p.gender} style={{ width: 64 }}
                      disabled={!isAdmin}
                      onChange={e => { onUpdateLocal(p.id, { gender: e.target.value }); onSave(p.id, { gender: e.target.value }); }}>
                      <option value="M">남</option>
                      <option value="F">여</option>
                    </select>
                  </td>
                  <td>
                    <select className="select input-sm" value={p.ntrp} style={{ width: 72 }}
                      disabled={!isAdmin}
                      onChange={e => { onUpdateLocal(p.id, { ntrp: parseFloat(e.target.value) }); onSave(p.id, { ntrp: parseFloat(e.target.value) }); }}>
                      {NTRP_OPTIONS.map(v => <option key={v} value={v}>{v.toFixed(1)}</option>)}
                    </select>
                  </td>
                  <td>
                    {isAdmin && <button className="btn btn-danger btn-sm" onClick={() => onDelete(p.id)} type="button">삭제</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isAdmin && (
          <div className={styles.toolbar}>
            <button className="btn btn-secondary btn-sm" onClick={onAdd} type="button">+ 회원 추가</button>
          </div>
        )}
      </div>
    </div>
  );
}

// components/tabs/MembersTab.js — 전체 회원 관리
'use client';
import { useState } from 'react';
import styles from './tabs.module.css';

const NTRP_OPTIONS = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0];
const ROLE_OPTIONS = ['회장', '총무', '경기이사', '운영이사', '고문', '정회원', '준회원', '게스트'];

export default function MembersTab({ members, onUpdateLocal, onSave, onAdd, onDelete, isAdmin, currentClub, onBulkUpdateFeeStatus }) {

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

  const [showAddModal, setShowAddModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderText, setReminderText] = useState('');
  const [newMember, setNewMember] = useState({ name: '', role: '정회원', gender: 'M', ntrp: 2.0, feePaid: false });

  const handleGenerateReminder = () => {
    const unpaidMembers = sortedMembers.filter(m => !m.feePaid);
    const names = unpaidMembers.map(m => m.name).join(', ');
    const cycleText = currentClub?.feeCycle === '연납' ? '올해' : currentClub?.feeCycle === '분기납' ? '이번 분기' : '이번 달';
    const text = `🎾 ${currentClub?.name || '클럽'} 회비 납부 안내 🎾

안녕하세요, ${cycleText} 회비 납부 안내드립니다.
아직 납부하지 않으신 회원님들은 아래 계좌로 입금 부탁드립니다!

📌 미납자 명단: ${names || '(미납자 없음)'}
📌 납부 금액: ${currentClub?.feeAmount || '0'}원
📌 입금 계좌: ${currentClub?.bankAccount || '미등록'} (예금주: ${currentClub?.accountHolder || '미등록'})

원활한 클럽 운영을 위해 빠른 납부 부탁드립니다. 감사합니다!`;
    setReminderText(text);
    setShowReminderModal(true);
  };

  const handleConfirmAdd = () => {
    if (!newMember.name.trim()) {
      alert('이름을 입력해주세요.');
      return;
    }
    onAdd({ ...newMember, name: newMember.name.trim() });
    setShowAddModal(false);
    setNewMember({ name: '', role: '정회원', gender: 'M', ntrp: 2.0 }); // reset
  };

  return (
    <div>
      <div className={`card ${styles.section}`}>
        <h2 className={styles.sectionTitle}>
          회원 명단 <span className={styles.sectionNote}>(전체 회원 관리 — 오늘 참가자와 별개)</span>
        </h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>이름</th><th>직책/구분</th><th>성별</th><th>NTRP</th><th>회비 납부</th><th></th></tr>
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
                    <select className="select input-sm" value={p.feePaid ? 'true' : 'false'} style={{ width: 72 }}
                      disabled={!isAdmin}
                      onChange={e => { 
                        const val = e.target.value === 'true';
                        onUpdateLocal(p.id, { feePaid: val }); 
                        onSave(p.id, { feePaid: val }); 
                      }}>
                      <option value="false">미납</option>
                      <option value="true">납부완료</option>
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
          <div className={styles.toolbar} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowAddModal(true)} type="button">+ 회원 추가</button>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => onBulkUpdateFeeStatus(true)} type="button" title="전체 회원을 납부완료 상태로 변경">✅ 일괄 납부완료</button>
              <button className="btn btn-secondary btn-sm" onClick={() => onBulkUpdateFeeStatus(false)} type="button" title="전체 회원을 미납 상태로 변경">🔄 일괄 미납</button>
              <button className="btn btn-primary btn-sm" onClick={handleGenerateReminder} type="button">📝 미납자 독촉 글 생성</button>
            </div>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '320px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px', color: 'var(--navy)', fontSize: '18px' }}>새 회원 추가</h3>
            
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '15px', marginBottom: '4px', color: 'var(--text-muted)' }}>이름</label>
              <input 
                className="input" 
                type="text" 
                value={newMember.name} 
                onChange={e => setNewMember({...newMember, name: e.target.value})}
                placeholder="이름을 입력하세요"
                autoFocus
              />
            </div>
            
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '15px', marginBottom: '4px', color: 'var(--text-muted)' }}>직책/구분</label>
              <select 
                className="select" 
                value={newMember.role}
                onChange={e => setNewMember({...newMember, role: e.target.value})}
              >
                {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            
            <div style={{ marginBottom: '12px', display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '15px', marginBottom: '4px', color: 'var(--text-muted)' }}>성별</label>
                <select 
                  className="select" 
                  value={newMember.gender}
                  onChange={e => setNewMember({...newMember, gender: e.target.value})}
                >
                  <option value="M">남</option>
                  <option value="F">여</option>
                </select>
              </div>
              
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '15px', marginBottom: '4px', color: 'var(--text-muted)' }}>NTRP</label>
                <select 
                  className="select" 
                  value={newMember.ntrp}
                  onChange={e => setNewMember({...newMember, ntrp: parseFloat(e.target.value)})}
                >
                  {NTRP_OPTIONS.map(v => <option key={v} value={v}>{v.toFixed(1)}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>취소</button>
              <button className="btn btn-primary" onClick={handleConfirmAdd}>추가하기</button>
            </div>
          </div>
        </div>
      )}

      {showReminderModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2 style={{ margin: 0, fontSize: '18px' }}>회비 독촉 글 생성</h2>
              <button className="modal-close" onClick={() => setShowReminderModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '15px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                미납자 명단이 포함된 안내 메시지입니다. 복사해서 사용하세요.
              </p>
              <textarea
                className="input"
                style={{ width: '100%', height: '220px', resize: 'vertical', padding: '12px', lineHeight: '1.5', fontFamily: 'inherit' }}
                value={reminderText}
                onChange={(e) => setReminderText(e.target.value)}
              />
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button className="btn btn-secondary" onClick={() => setShowReminderModal(false)}>닫기</button>
              <button className="btn btn-primary" onClick={() => {
                navigator.clipboard.writeText(reminderText);
                alert('복사되었습니다.');
              }}>복사하기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

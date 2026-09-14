// components/tabs/MembersTab.js — 전체 회원 관리
'use client';
import { useState } from 'react';
import styles from './tabs.module.css';

const NTRP_OPTIONS = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0];
const ROLE_OPTIONS = ['회장', '부회장', '총무', '경기이사', '정회원', '준회원', '게스트'];

export default function MembersTab({ members, onUpdateLocal, onSave, onAdd, onDelete, isAdmin, currentClub, onBulkUpdateFeeStatus }) {

  const sortedMembers = [...members].sort((a, b) => {
    // 1. 특정 직책 상단 고정 및 준회원/게스트 하단 배치
    const rolePriority = { '회장': 1, '부회장': 2, '총무': 3, '경기이사': 4, '정회원': 10, '준회원': 998, '게스트': 999 };
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
  const [newMember, setNewMember] = useState({
    name: '',
    role: '정회원',
    gender: 'M',
    birthYear: '',
    tennisStartedAt: '',
    ntrp: 2.0,
    feePaid: false
  });

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
    onAdd({
      ...newMember,
      name: newMember.name.trim(),
      birthYear: (newMember.birthYear || '').trim(),
      tennisStartedAt: (newMember.tennisStartedAt || '').trim()
    });
    setShowAddModal(false);
    setNewMember({
      name: '',
      role: '정회원',
      gender: 'M',
      birthYear: '',
      tennisStartedAt: '',
      ntrp: 2.0,
      feePaid: false
    });
  };

  return (
    <div>
      <div className={`card ${styles.section}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--txt)' }}>
              👥 회원 명단
            </h2>
            <span className="hero-chip" style={{ fontSize: '12px', padding: '3px 10px', color: '#1d4ed8', background: 'rgba(37,99,235,0.08)' }}>
              총 {members.length}명 (남 {members.filter(m => m.gender === 'M').length} / 여 {members.filter(m => m.gender === 'F').length})
            </span>
          </div>
          <span className={styles.sectionNote}>(전체 회원 명부 — 정기대회 및 모임 참가자 기준)</span>
        </div>

        <div className="table-wrap">
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ minWidth: 90 }}>이름</th>
                <th style={{ minWidth: 95 }}>직책/구분</th>
                <th style={{ minWidth: 60, textAlign: 'center' }}>성별</th>
                <th style={{ minWidth: 80, textAlign: 'center' }}>생년</th>
                <th style={{ minWidth: 100, textAlign: 'center' }}>테니스 시작</th>
                {isAdmin && <th style={{ minWidth: 75, textAlign: 'center' }}>NTRP</th>}
                <th style={{ minWidth: 90, textAlign: 'center' }}>회비 납부</th>
                {isAdmin && <th style={{ width: 60, textAlign: 'center' }}>관리</th>}
              </tr>
            </thead>
            <tbody>
              {sortedMembers.map(p => (
                <tr key={p.id}>
                  <td>
                    <input className="input input-sm" type="text" value={p.name} style={{ width: 95, fontWeight: 700 }}
                      disabled={!isAdmin}
                      onChange={e => onUpdateLocal(p.id, { name: e.target.value })}
                      onBlur={e => onSave(p.id, { name: e.target.value })} />
                  </td>
                  <td>
                    <select className="select input-sm" value={p.role || '정회원'} style={{ width: 90, fontWeight: 600 }}
                      disabled={!isAdmin}
                      onChange={e => { onUpdateLocal(p.id, { role: e.target.value }); onSave(p.id, { role: e.target.value }); }}>
                      {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <select className="select input-sm" value={p.gender} style={{ width: 60, textAlign: 'center', fontWeight: 600, color: p.gender === 'F' ? '#e11d48' : '#2563eb' }}
                      disabled={!isAdmin}
                      onChange={e => { onUpdateLocal(p.id, { gender: e.target.value }); onSave(p.id, { gender: e.target.value }); }}>
                      <option value="M">남</option>
                      <option value="F">여</option>
                    </select>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <input 
                      className="input input-sm" 
                      type="text" 
                      value={p.birthYear || ''} 
                      placeholder="예: 1988"
                      style={{ width: 80, textAlign: 'center' }}
                      disabled={!isAdmin}
                      onChange={e => onUpdateLocal(p.id, { birthYear: e.target.value })}
                      onBlur={e => onSave(p.id, { birthYear: e.target.value })} 
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <input 
                      className="input input-sm" 
                      type="text" 
                      value={p.tennisStartedAt || ''} 
                      placeholder="예: 2021.05"
                      style={{ width: 95, textAlign: 'center' }}
                      disabled={!isAdmin}
                      onChange={e => onUpdateLocal(p.id, { tennisStartedAt: e.target.value })}
                      onBlur={e => onSave(p.id, { tennisStartedAt: e.target.value })} 
                    />
                  </td>
                  {isAdmin && (
                    <td style={{ textAlign: 'center' }}>
                      <select className="select input-sm" value={p.ntrp} style={{ width: 70, textAlign: 'center', fontWeight: 700 }}
                        disabled={!isAdmin}
                        onChange={e => { onUpdateLocal(p.id, { ntrp: parseFloat(e.target.value) }); onSave(p.id, { ntrp: parseFloat(e.target.value) }); }}>
                        {NTRP_OPTIONS.map(v => <option key={v} value={v}>{v.toFixed(1)}</option>)}
                      </select>
                    </td>
                  )}
                  <td style={{ textAlign: 'center' }}>
                    <select 
                      className="select input-sm" 
                      value={p.feePaid ? 'true' : 'false'} 
                      style={{ 
                        width: 86, 
                        textAlign: 'center', 
                        fontWeight: 700,
                        color: p.feePaid ? '#15803d' : '#dc2626',
                        backgroundColor: p.feePaid ? 'rgba(22, 163, 74, 0.08)' : 'rgba(220, 38, 38, 0.08)',
                        borderColor: p.feePaid ? 'rgba(22, 163, 74, 0.3)' : 'rgba(220, 38, 38, 0.3)'
                      }}
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
                  {isAdmin && (
                    <td style={{ textAlign: 'center' }}>
                      <button className="btn btn-danger btn-sm" style={{ padding: '3px 8px', fontSize: '11px' }} onClick={() => onDelete(p.id)} type="button">삭제</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isAdmin && (
          <div className={styles.toolbar} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginTop: '16px' }}>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)} type="button">+ 새 회원 추가</button>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => onBulkUpdateFeeStatus(true)} type="button" title="전체 회원을 납부완료 상태로 변경">✅ 일괄 납부완료</button>
              <button className="btn btn-secondary btn-sm" onClick={() => onBulkUpdateFeeStatus(false)} type="button" title="전체 회원을 미납 상태로 변경">🔄 일괄 미납</button>
              <button className="btn btn-secondary btn-sm" onClick={handleGenerateReminder} type="button">📝 미납자 독촉 글 생성</button>
            </div>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="modal-overlay" style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="modal-content" style={{ maxWidth: '420px', width: '90%', borderRadius: '20px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: 'var(--txt)', fontSize: '1.15rem', fontWeight: 800 }}>➕ 새 회원 등록</h3>
              <button 
                type="button" 
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', color: 'var(--txt3)', cursor: 'pointer', padding: '4px' }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: 'var(--txt2)' }}>회원 성명 *</label>
                <input 
                  className="input" 
                  type="text" 
                  value={newMember.name} 
                  onChange={e => setNewMember({...newMember, name: e.target.value})}
                  placeholder="예: 홍길동"
                  autoFocus
                />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: 'var(--txt2)' }}>직책 및 구분</label>
                <select 
                  className="select" 
                  value={newMember.role}
                  onChange={e => setNewMember({...newMember, role: e.target.value})}
                >
                  {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: 'var(--txt2)' }}>성별</label>
                  <select 
                    className="select" 
                    value={newMember.gender}
                    onChange={e => setNewMember({...newMember, gender: e.target.value})}
                  >
                    <option value="M">남성 (M)</option>
                    <option value="F">여성 (F)</option>
                  </select>
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: 'var(--txt2)' }}>NTRP</label>
                  <select 
                    className="select" 
                    value={newMember.ntrp}
                    onChange={e => setNewMember({...newMember, ntrp: parseFloat(e.target.value)})}
                  >
                    {NTRP_OPTIONS.map(v => <option key={v} value={v}>{v.toFixed(1)}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: 'var(--txt2)' }}>출생년도</label>
                  <input 
                    className="input" 
                    type="text" 
                    value={newMember.birthYear || ''} 
                    onChange={e => setNewMember({...newMember, birthYear: e.target.value})}
                    placeholder="예: 1988"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: 'var(--txt2)' }}>테니스 시작</label>
                  <input 
                    className="input" 
                    type="text" 
                    value={newMember.tennisStartedAt || ''} 
                    onChange={e => setNewMember({...newMember, tennisStartedAt: e.target.value})}
                    placeholder="예: 2021.05"
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>취소</button>
              <button className="btn btn-primary" onClick={handleConfirmAdd}>추가 완료</button>
            </div>
          </div>
        </div>
      )}

      {showReminderModal && (
        <div className="modal-overlay" style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="modal-content" style={{ maxWidth: '520px', width: '90%', borderRadius: '20px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--txt)' }}>📝 미납자 회비 납부 안내문</h3>
              <button 
                type="button" 
                onClick={() => setShowReminderModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', color: 'var(--txt3)', cursor: 'pointer', padding: '4px' }}
              >
                ✕
              </button>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--txt2)', marginBottom: '12px', lineHeight: 1.5 }}>
              현재 미납 회원 명단과 계좌 정보가 자동으로 반영된 카카오톡/밴드 공지용 문구입니다.
            </p>
            <textarea
              className="input"
              style={{ width: '100%', height: '220px', resize: 'vertical', padding: '14px', lineHeight: '1.6', fontSize: '13.5px', borderRadius: '12px' }}
              value={reminderText}
              onChange={(e) => setReminderText(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
              <button className="btn btn-secondary" onClick={() => setShowReminderModal(false)}>닫기</button>
              <button className="btn btn-primary" onClick={() => {
                navigator.clipboard.writeText(reminderText);
                alert('공지 문구가 클립보드에 복사되었습니다.');
              }}>📋 문구 복사하기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

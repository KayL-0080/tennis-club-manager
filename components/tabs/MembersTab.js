// components/tabs/MembersTab.js — 전체 회원 관리 (깔끔한 표 형태 고도화)
'use client';
import { useState } from 'react';
import { UserPlusIcon, CheckCircleIcon, RefreshIcon, NoticeIcon } from '@/components/Icons';
import styles from './tabs.module.css';

const NTRP_OPTIONS = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0];
const ROLE_OPTIONS = ['회장', '부회장', '총무', '경기이사', '운영이사', '고문', '정회원', '준회원', '게스트'];

// 🏷️ 직책별 배지 스타일 및 아이콘 매핑
const getRoleBadgeStyle = (role) => {
  switch (role) {
    case '회장':
      return { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', icon: '👑' };
    case '부회장':
      return { bg: '#eef2ff', text: '#4338ca', border: '#c7d2fe', icon: '⭐' };
    case '총무':
      return { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0', icon: '💼' };
    case '경기이사':
      return { bg: '#fffbeb', text: '#b45309', border: '#fde68a', icon: '🎾' };
    case '운영이사':
      return { bg: '#faf5ff', text: '#7e22ce', border: '#e9d5ff', icon: '⚙️' };
    case '고문':
      return { bg: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe', icon: '🎖️' };
    case '정회원':
      return { bg: '#f8fafc', text: '#334155', border: '#cbd5e1', icon: '👤' };
    case '준회원':
      return { bg: '#fefce8', text: '#a16207', border: '#fef08a', icon: '🌱' };
    case '게스트':
      return { bg: '#f3f4f6', text: '#4b5563', border: '#e5e7eb', icon: '🙋' };
    default:
      return { bg: '#f8fafc', text: '#475569', border: '#e2e8f0', icon: '👤' };
  }
};

export default function MembersTab({ 
  members, 
  onUpdateLocal, 
  onSave, 
  onAdd, 
  onDelete, 
  isAdmin, 
  canManageFee = false,
  currentClub, 
  onBulkUpdateFeeStatus 
}) {
  const hasFeePerm = isAdmin || Boolean(canManageFee);
  // ── 정렬 로직 (직책 > 성별 남성 우선 > NTRP 높은 순) ──
  const sortedMembers = [...members].sort((a, b) => {
    const rolePriority = { '회장': 1, '부회장': 2, '총무': 3, '경기이사': 4, '운영이사': 5, '고문': 6, '정회원': 10, '준회원': 998, '게스트': 999 };
    const pA = rolePriority[a.role] || 99;
    const pB = rolePriority[b.role] || 99;
    if (pA !== pB) return pA - pB;

    if (a.gender !== b.gender) return a.gender === 'M' ? -1 : 1;
    return (b.ntrp || 0) - (a.ntrp || 0);
  });

  // ── 상태 관리 ──
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterRole, setFilterRole] = useState('ALL'); // 'ALL' | '정회원' | '준회원' | '게스트' | 'UNPAID'
  const [filterGender, setFilterGender] = useState('ALL'); // 'ALL' | 'M' | 'F'
  const [isQuickEdit, setIsQuickEdit] = useState(false); // 운영자 인라인 빠른 편집 토글
  const [editingMember, setEditingMember] = useState(null); // 수정 모달 대상

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

  // ── 필터링된 회원 목록 ──
  const displayedMembers = sortedMembers.filter(m => {
    if (searchKeyword.trim()) {
      const q = searchKeyword.trim().toLowerCase();
      const matchName = m.name?.toLowerCase().includes(q);
      const matchRole = m.role?.toLowerCase().includes(q);
      if (!matchName && !matchRole) return false;
    }
    if (filterRole === 'UNPAID') {
      if (m.feePaid) return false;
    } else if (filterRole === '정회원') {
      if (m.role === '준회원' || m.role === '게스트') return false;
    } else if (filterRole !== 'ALL') {
      if (m.role !== filterRole) return false;
    }
    if (filterGender !== 'ALL') {
      if (m.gender !== filterGender) return false;
    }
    return true;
  });

  // ── 통계 카운트 ──
  const regularCount = members.filter(m => m.role !== '준회원' && m.role !== '게스트').length;
  const associateCount = members.filter(m => m.role === '준회원').length;
  const guestCount = members.filter(m => m.role === '게스트').length;
  const unpaidCount = members.filter(m => !m.feePaid).length;

  // ── 회비 원클릭 토글 ──
  const handleToggleFee = async (m) => {
    if (!hasFeePerm) return;
    const newStatus = !m.feePaid;
    onUpdateLocal(m.id, { feePaid: newStatus });
    await onSave(m.id, { feePaid: newStatus });
  };

  // ── 미납 독촉 공지문 생성 ──
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

  // ── 신규 회원 추가 완료 ──
  const handleConfirmAdd = () => {
    if (!newMember.name.trim()) {
      alert('회원 이름을 입력해주세요.');
      return;
    }
    onAdd({
      ...newMember,
      name: newMember.name.trim(),
      birthYear: (newMember.birthYear || '').toString().trim(),
      tennisStartedAt: (newMember.tennisStartedAt || '').toString().trim()
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

  // ── 회원 정보 수정 모달 저장 완료 ──
  const handleSaveEditedMember = async () => {
    if (!editingMember || !editingMember.id) return;
    if (!editingMember.name?.trim()) {
      alert('회원 이름을 입력해주세요.');
      return;
    }
    const updateData = {
      ...editingMember,
      name: editingMember.name.trim(),
      birthYear: (editingMember.birthYear || '').toString().trim(),
      tennisStartedAt: (editingMember.tennisStartedAt || '').toString().trim(),
      ntrp: parseFloat(editingMember.ntrp) || 2.0,
      feePaid: Boolean(editingMember.feePaid)
    };
    onUpdateLocal(editingMember.id, updateData);
    await onSave(editingMember.id, updateData);
    setEditingMember(null);
  };

  return (
    <div>
      <div className={`card ${styles.section}`} style={{ padding: '20px' }}>
        
        {/* ── 1. 명단 헤더 & 상단 툴바 ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--txt)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>👥</span>
              <span>회원 명단</span>
            </h2>
            <span className="hero-chip" style={{ fontSize: '12px', padding: '3px 10px', color: '#1d4ed8', background: 'rgba(37,99,235,0.08)', fontWeight: 700 }}>
              총 {members.length}명
            </span>
          </div>

          {/* 우측 상단 액션 버튼 */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => setIsQuickEdit(!isQuickEdit)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    backgroundColor: isQuickEdit ? '#eff6ff' : '#ffffff',
                    color: isQuickEdit ? '#1d4ed8' : '#475569',
                    border: isQuickEdit ? '1px solid #93c5fd' : '1px solid #cbd5e1',
                    boxShadow: isQuickEdit ? '0 0 0 2px rgba(59, 130, 246, 0.2)' : 'none'
                  }}
                  title="표 내에서 직접 이름, 역할, 성별을 바로 수정할 수 있는 인라인 편집 모드"
                >
                  <span>{isQuickEdit ? '✓' : '⚡'}</span>
                  <span>{isQuickEdit ? '표 편집 완료' : '빠른 편집'}</span>
                </button>
                <button 
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    fontWeight: 800,
                    backgroundColor: '#007aff',
                    color: '#ffffff',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(0, 122, 255, 0.25)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <UserPlusIcon size={14} color="#ffffff" />
                  <span>새 회원 추가</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── 2. 검색 및 필터 툴바 ── */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
          padding: '12px 14px',
          backgroundColor: '#f8fafc',
          borderRadius: '12px',
          border: '1px solid #e2e8f0'
        }}>
          {/* 검색창 */}
          <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: '280px' }}>
            <input 
              type="text" 
              placeholder="회원 이름 검색..." 
              value={searchKeyword} 
              onChange={e => setSearchKeyword(e.target.value)}
              className="input input-sm"
              style={{
                width: '100%',
                paddingLeft: '32px',
                paddingRight: searchKeyword ? '28px' : '10px',
                borderRadius: '8px',
                fontSize: '13px',
                backgroundColor: '#ffffff'
              }}
            />
            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '13px', pointerEvents: 'none' }}>
              🔍
            </span>
            {searchKeyword && (
              <button 
                type="button" 
                onClick={() => setSearchKeyword('')} 
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '13px', padding: 0 }}
              >
                ✕
              </button>
            )}
          </div>

          {/* 역할별 필터 칩 */}
          <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setFilterRole('ALL')}
              style={{
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: filterRole === 'ALL' ? 800 : 600,
                border: filterRole === 'ALL' ? '1px solid #007aff' : '1px solid #cbd5e1',
                backgroundColor: filterRole === 'ALL' ? '#007aff' : '#ffffff',
                color: filterRole === 'ALL' ? '#ffffff' : '#475569',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              전체 ({members.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterRole('정회원')}
              style={{
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: filterRole === '정회원' ? 800 : 600,
                border: filterRole === '정회원' ? '1px solid #2563eb' : '1px solid #cbd5e1',
                backgroundColor: filterRole === '정회원' ? '#2563eb' : '#ffffff',
                color: filterRole === '정회원' ? '#ffffff' : '#475569',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              정회원 ({regularCount})
            </button>
            {associateCount > 0 && (
              <button
                type="button"
                onClick={() => setFilterRole('준회원')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: filterRole === '준회원' ? 800 : 600,
                  border: filterRole === '준회원' ? '1px solid #ca8a04' : '1px solid #cbd5e1',
                  backgroundColor: filterRole === '준회원' ? '#ca8a04' : '#ffffff',
                  color: filterRole === '준회원' ? '#ffffff' : '#475569',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                준회원 ({associateCount})
              </button>
            )}
            {guestCount > 0 && (
              <button
                type="button"
                onClick={() => setFilterRole('게스트')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: filterRole === '게스트' ? 800 : 600,
                  border: filterRole === '게스트' ? '1px solid #4b5563' : '1px solid #cbd5e1',
                  backgroundColor: filterRole === '게스트' ? '#4b5563' : '#ffffff',
                  color: filterRole === '게스트' ? '#ffffff' : '#475569',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                게스트 ({guestCount})
              </button>
            )}
            {hasFeePerm && unpaidCount > 0 && (
              <button
                type="button"
                onClick={() => setFilterRole('UNPAID')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: filterRole === 'UNPAID' ? 800 : 600,
                  border: filterRole === 'UNPAID' ? '1px solid #dc2626' : '1px solid #fecaca',
                  backgroundColor: filterRole === 'UNPAID' ? '#dc2626' : '#fef2f2',
                  color: filterRole === 'UNPAID' ? '#ffffff' : '#b91c1c',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                💰 미납 ({unpaidCount})
              </button>
            )}
          </div>

          {/* 성별 필터 */}
          <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setFilterGender('ALL')}
              style={{
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: filterGender === 'ALL' ? 700 : 500,
                border: '1px solid #cbd5e1',
                backgroundColor: filterGender === 'ALL' ? '#334155' : '#ffffff',
                color: filterGender === 'ALL' ? '#ffffff' : '#64748b',
                cursor: 'pointer'
              }}
            >
              전체
            </button>
            <button
              type="button"
              onClick={() => setFilterGender('M')}
              style={{
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: filterGender === 'M' ? 700 : 500,
                border: '1px solid #bfdbfe',
                backgroundColor: filterGender === 'M' ? '#2563eb' : '#eff6ff',
                color: filterGender === 'M' ? '#ffffff' : '#2563eb',
                cursor: 'pointer'
              }}
            >
              남
            </button>
            <button
              type="button"
              onClick={() => setFilterGender('F')}
              style={{
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: filterGender === 'F' ? 700 : 500,
                border: '1px solid #fbcfe8',
                backgroundColor: filterGender === 'F' ? '#db2777' : '#fdf2f8',
                color: filterGender === 'F' ? '#ffffff' : '#db2777',
                cursor: 'pointer'
              }}
            >
              여
            </button>
          </div>
        </div>

        {/* ── 3. 깔끔한 표 형태의 회원 명단 (Clean Table) ── */}
        <div style={{
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          background: '#ffffff',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)'
        }}>
          <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', textAlign: 'center', margin: 0 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: '12.5px', fontWeight: 700 }}>
                <th style={{ width: '52px', padding: '12px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>번호</th>
                <th style={{ minWidth: '95px', padding: '12px 14px', textAlign: 'left', whiteSpace: 'nowrap' }}>이름</th>
                <th style={{ width: '100px', padding: '12px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>직책/구분</th>
                <th style={{ width: '60px', padding: '12px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>성별</th>
                <th style={{ width: '75px', padding: '12px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>생년</th>
                <th style={{ width: '100px', padding: '12px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>테니스 시작</th>
                <th style={{ width: '75px', padding: '12px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>NTRP</th>
                <th style={{ width: '95px', padding: '12px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>회비 납부</th>
                {isAdmin && (
                  <th style={{ width: '105px', padding: '12px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>관리</th>
                )}
              </tr>
            </thead>
            <tbody>
              {displayedMembers.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} style={{ padding: '36px 16px', color: '#64748b', fontSize: '13.5px' }}>
                    <div style={{ fontSize: '28px', marginBottom: '8px' }}>🔍</div>
                    <div style={{ fontWeight: 700, color: '#334155', marginBottom: '4px' }}>조건에 일치하는 회원이 없습니다.</div>
                    <button 
                      type="button" 
                      onClick={() => { setSearchKeyword(''); setFilterRole('ALL'); setFilterGender('ALL'); }}
                      style={{ marginTop: '8px', padding: '5px 12px', borderRadius: '6px', fontSize: '12px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', cursor: 'pointer' }}
                    >
                      필터 초기화
                    </button>
                  </td>
                </tr>
              ) : (
                displayedMembers.map((p, idx) => {
                  const roleStyle = getRoleBadgeStyle(p.role);
                  const isFemale = p.gender === 'F';

                  // ── 빠른 편집 모드 활성화 시 (인라인 편집) ──
                  if (isAdmin && isQuickEdit) {
                    return (
                      <tr 
                        key={p.id}
                        style={{ 
                          borderBottom: '1px solid #f1f5f9',
                          backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafbfc'
                        }}
                      >
                        <td style={{ padding: '8px 4px', color: '#94a3b8', fontWeight: 600, fontSize: '12.5px' }}>
                          {idx + 1}
                        </td>
                        <td style={{ padding: '8px 6px', textAlign: 'left' }}>
                          <input 
                            className="input input-sm" 
                            type="text" 
                            value={p.name} 
                            style={{ width: '90px', fontWeight: 700, fontSize: '13px' }}
                            onChange={e => onUpdateLocal(p.id, { name: e.target.value })}
                            onBlur={e => onSave(p.id, { name: e.target.value })} 
                          />
                        </td>
                        <td style={{ padding: '8px 4px' }}>
                          <select 
                            className="select input-sm" 
                            value={p.role || '정회원'} 
                            style={{ width: '85px', fontWeight: 600, fontSize: '12px' }}
                            onChange={e => { onUpdateLocal(p.id, { role: e.target.value }); onSave(p.id, { role: e.target.value }); }}
                          >
                            {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '8px 4px' }}>
                          <select 
                            className="select input-sm" 
                            value={p.gender} 
                            style={{ width: '55px', textAlign: 'center', fontWeight: 700, color: p.gender === 'F' ? '#db2777' : '#2563eb', fontSize: '12px' }}
                            onChange={e => { onUpdateLocal(p.id, { gender: e.target.value }); onSave(p.id, { gender: e.target.value }); }}
                          >
                            <option value="M">남</option>
                            <option value="F">여</option>
                          </select>
                        </td>
                        <td style={{ padding: '8px 4px' }}>
                          <input 
                            className="input input-sm" 
                            type="text" 
                            value={p.birthYear || ''} 
                            placeholder="1988"
                            style={{ width: '65px', textAlign: 'center', fontSize: '12.5px' }}
                            onChange={e => onUpdateLocal(p.id, { birthYear: e.target.value })}
                            onBlur={e => onSave(p.id, { birthYear: e.target.value })} 
                          />
                        </td>
                        <td style={{ padding: '8px 4px' }}>
                          <input 
                            className="input input-sm" 
                            type="text" 
                            value={p.tennisStartedAt || ''} 
                            placeholder="2021.05"
                            style={{ width: '85px', textAlign: 'center', fontSize: '12.5px' }}
                            onChange={e => onUpdateLocal(p.id, { tennisStartedAt: e.target.value })}
                            onBlur={e => onSave(p.id, { tennisStartedAt: e.target.value })} 
                          />
                        </td>
                        <td style={{ padding: '8px 4px' }}>
                          <select 
                            className="select input-sm" 
                            value={p.ntrp || 2.0} 
                            style={{ width: '65px', textAlign: 'center', fontWeight: 800, fontSize: '12.5px' }}
                            onChange={e => { onUpdateLocal(p.id, { ntrp: parseFloat(e.target.value) }); onSave(p.id, { ntrp: parseFloat(e.target.value) }); }}
                          >
                            {NTRP_OPTIONS.map(v => <option key={v} value={v}>{v.toFixed(1)}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '8px 4px' }}>
                          <select 
                            className="select input-sm" 
                            value={p.feePaid ? 'true' : 'false'} 
                            style={{ 
                              width: '80px', 
                              textAlign: 'center', 
                              fontWeight: 800,
                              fontSize: '12px',
                              color: p.feePaid ? '#15803d' : '#dc2626',
                              backgroundColor: p.feePaid ? '#f0fdf4' : '#fef2f2',
                              borderColor: p.feePaid ? '#bbf7d0' : '#fecaca'
                            }}
                            onChange={e => { 
                              const val = e.target.value === 'true';
                              onUpdateLocal(p.id, { feePaid: val }); 
                              onSave(p.id, { feePaid: val }); 
                            }}
                          >
                            <option value="true">완납</option>
                            <option value="false">미납</option>
                          </select>
                        </td>
                        <td style={{ padding: '8px 4px' }}>
                          <button 
                            type="button"
                            className="btn btn-danger btn-sm" 
                            style={{ padding: '3px 8px', fontSize: '11px', borderRadius: '6px' }} 
                            onClick={() => onDelete(p.id)}
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  // ── 기본 깔끔한 표 모드 (Clean Table View) ──
                  return (
                    <tr 
                      key={p.id}
                      style={{ 
                        borderBottom: '1px solid #f1f5f9',
                        backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafbfc',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f7ff'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = (idx % 2 === 0 ? '#ffffff' : '#fafbfc')}
                    >
                      {/* 1. 번호 */}
                      <td style={{ padding: '12px 6px', color: '#94a3b8', fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap' }}>
                        {idx + 1}
                      </td>

                      {/* 2. 이름 */}
                      <td style={{ padding: '12px 14px', textAlign: 'left', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <strong style={{ fontSize: '14.5px', color: '#0f172a', fontWeight: 800, letterSpacing: '-0.01em' }}>
                            {p.name}
                          </strong>
                        </div>
                      </td>

                      {/* 3. 직책 및 구분 */}
                      <td style={{ padding: '12px 8px', whiteSpace: 'nowrap' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          padding: '3px 9px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 700,
                          backgroundColor: roleStyle.bg,
                          color: roleStyle.text,
                          border: `1px solid ${roleStyle.border}`,
                          whiteSpace: 'nowrap'
                        }}>
                          <span>{roleStyle.icon}</span>
                          <span>{p.role || '정회원'}</span>
                        </span>
                      </td>

                      {/* 4. 성별 */}
                      <td style={{ padding: '12px 6px', whiteSpace: 'nowrap' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2.5px 8px',
                          borderRadius: '6px',
                          fontSize: '11.5px',
                          fontWeight: 800,
                          backgroundColor: isFemale ? '#fdf2f8' : '#eff6ff',
                          color: isFemale ? '#db2777' : '#2563eb',
                          border: `1px solid ${isFemale ? '#fbcfe8' : '#bfdbfe'}`
                        }}>
                          {isFemale ? '여' : '남'}
                        </span>
                      </td>

                      {/* 5. 생년 */}
                      <td style={{ padding: '12px 6px', color: p.birthYear ? '#334155' : '#cbd5e1', fontSize: '13px', fontWeight: p.birthYear ? 600 : 400, whiteSpace: 'nowrap' }}>
                        {p.birthYear ? `${p.birthYear}` : '-'}
                      </td>

                      {/* 6. 테니스 시작 */}
                      <td style={{ padding: '12px 8px', color: p.tennisStartedAt ? '#334155' : '#cbd5e1', fontSize: '13px', fontWeight: p.tennisStartedAt ? 600 : 400, whiteSpace: 'nowrap' }}>
                        {p.tennisStartedAt || '-'}
                      </td>

                      {/* 7. NTRP */}
                      <td style={{ padding: '12px 6px', whiteSpace: 'nowrap' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2.5px 8px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 800,
                          backgroundColor: '#f0fdf4',
                          color: '#15803d',
                          border: '1px solid #bbf7d0'
                        }}>
                          {p.ntrp !== undefined && p.ntrp !== null ? Number(p.ntrp).toFixed(1) : '-'}
                        </span>
                      </td>

                      {/* 8. 회비 납부 (운영자는 원클릭 토글 버튼, 일반회원은 배지) */}
                      <td style={{ padding: '12px 8px', whiteSpace: 'nowrap' }}>
                        {hasFeePerm ? (
                          <button
                            type="button"
                            onClick={() => handleToggleFee(p)}
                            title={p.feePaid ? '클릭하여 [미납]으로 변경' : '클릭하여 [납부완료]로 변경'}
                            style={{
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              padding: '3px 10px',
                              borderRadius: '6px',
                              fontSize: '11.5px',
                              fontWeight: 800,
                              backgroundColor: p.feePaid ? '#dcfce7' : '#fee2e2',
                              color: p.feePaid ? '#15803d' : '#dc2626',
                              border: `1px solid ${p.feePaid ? '#86efac' : '#fca5a5'}`,
                              transition: 'all 0.15s ease',
                              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
                            }}
                          >
                            <span>{p.feePaid ? '✅' : '💰'}</span>
                            <span>{p.feePaid ? '완납' : '미납'}</span>
                          </button>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            backgroundColor: p.feePaid ? '#dcfce7' : '#fee2e2',
                            color: p.feePaid ? '#15803d' : '#dc2626',
                            border: `1px solid ${p.feePaid ? '#86efac' : '#fca5a5'}`
                          }}>
                            {p.feePaid ? '✅ 완납' : '미납'}
                          </span>
                        )}
                      </td>

                      {/* 9. 관리 (운영자 전용 액션) */}
                      {isAdmin && (
                        <td style={{ padding: '12px 8px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                            <button
                              type="button"
                              onClick={() => setEditingMember({ ...p })}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px',
                                padding: '3.5px 8px',
                                borderRadius: '6px',
                                fontSize: '11.5px',
                                fontWeight: 700,
                                backgroundColor: '#eff6ff',
                                color: '#1d4ed8',
                                border: '1px solid #bfdbfe',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                              title="회원 정보 상세 수정"
                            >
                              ✏️ 수정
                            </button>
                            <button
                              type="button"
                              onClick={() => onDelete(p.id)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '3.5px 7px',
                                borderRadius: '6px',
                                fontSize: '11.5px',
                                fontWeight: 600,
                                backgroundColor: '#ffffff',
                                color: '#ef4444',
                                border: '1px solid #fecaca',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                              title="회원 삭제"
                            >
                              삭제
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── 4. 하단 액션 툴바 (운영자 전용) ── */}
        {isAdmin ? (
          <div className={styles.memberFooterBar} style={{ marginTop: '16px' }}>
            {/* 회원 추가 액션 */}
            <div className={styles.memberAddArea}>
              <button 
                type="button"
                className={styles.btnAddMember} 
                onClick={() => setShowAddModal(true)}
              >
                <UserPlusIcon size={17} color="#ffffff" />
                <span>새 회원 추가</span>
              </button>
            </div>

            {/* 회비 일괄 관리 툴 */}
            <div className={styles.feeActionsGroup}>
              <span className={styles.feeGroupLabel}>
                <span>💰</span>
                <span>회비 일괄 관리</span>
              </span>
              <div className={styles.feeButtonsRow}>
                <button 
                  type="button"
                  className={styles.btnFeePaid} 
                  onClick={() => onBulkUpdateFeeStatus(true)}
                  title="전체 회원을 납부완료 상태로 변경"
                >
                  <CheckCircleIcon size={16} color="#15803d" />
                  <span>일괄 납부완료</span>
                </button>
                <button 
                  type="button"
                  className={styles.btnFeeUnpaid} 
                  onClick={() => onBulkUpdateFeeStatus(false)}
                  title="전체 회원을 미납 상태로 변경"
                >
                  <RefreshIcon size={16} color="#b91c1c" />
                  <span>일괄 미납</span>
                </button>
                <button 
                  type="button"
                  className={styles.btnFeeNotice} 
                  onClick={handleGenerateReminder}
                  title="미납 회원 대상 공지 및 독촉 글 생성"
                >
                  <NoticeIcon size={16} color="#1d4ed8" />
                  <span>미납자 독촉 글 생성</span>
                </button>
                <button 
                  type="button"
                  className={styles.btnFeeNotice} 
                  style={{ backgroundColor: '#fefce8', color: '#b45309', borderColor: '#fef08a' }}
                  onClick={() => window.location.href = '/posters?tab=fee'}
                  title="회비 안내 카드 이미지 제작 화면으로 이동"
                >
                  <span>🎨</span>
                  <span>회비 카드 이미지 제작</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            marginTop: '16px',
            padding: '12px 16px',
            background: 'rgba(241, 245, 249, 0.7)',
            borderRadius: '12px',
            border: '1px solid rgba(0, 0, 0, 0.05)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ fontSize: '12.5px', color: 'var(--txt3)', fontWeight: 600 }}>
              💡 회원 정보 수정 및 신규 등록은 클럽 운영자(관리자) 로그인 후 이용할 수 있습니다.
            </span>
          </div>
        )}
      </div>

      {/* ── 5. 새 회원 등록 모달 ── */}
      {showAddModal && (
        <div className="modal-overlay" style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 1000 }} onClick={() => setShowAddModal(false)}>
          <div className="modal-content" style={{ maxWidth: '420px', width: '90%', borderRadius: '20px', padding: '24px' }} onClick={e => e.stopPropagation()}>
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

      {/* ── 6. 회원 정보 수정 모달 (운영자 전용) ── */}
      {editingMember && (
        <div className="modal-overlay" style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 1000 }} onClick={() => setEditingMember(null)}>
          <div className="modal-content" style={{ maxWidth: '420px', width: '90%', borderRadius: '20px', padding: '24px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: 'var(--txt)', fontSize: '1.15rem', fontWeight: 800 }}>
                ✏️ 회원 정보 수정
              </h3>
              <button 
                type="button" 
                onClick={() => setEditingMember(null)}
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
                  value={editingMember.name || ''} 
                  onChange={e => setEditingMember({...editingMember, name: e.target.value})}
                  placeholder="예: 홍길동"
                />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: 'var(--txt2)' }}>직책 및 구분</label>
                <select 
                  className="select" 
                  value={editingMember.role || '정회원'}
                  onChange={e => setEditingMember({...editingMember, role: e.target.value})}
                >
                  {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: 'var(--txt2)' }}>성별</label>
                  <select 
                    className="select" 
                    value={editingMember.gender || 'M'}
                    onChange={e => setEditingMember({...editingMember, gender: e.target.value})}
                  >
                    <option value="M">남성 (M)</option>
                    <option value="F">여성 (F)</option>
                  </select>
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: 'var(--txt2)' }}>NTRP</label>
                  <select 
                    className="select" 
                    value={editingMember.ntrp || 2.0}
                    onChange={e => setEditingMember({...editingMember, ntrp: parseFloat(e.target.value)})}
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
                    value={editingMember.birthYear || ''} 
                    onChange={e => setEditingMember({...editingMember, birthYear: e.target.value})}
                    placeholder="예: 1988"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: 'var(--txt2)' }}>테니스 시작일</label>
                  <input 
                    className="input" 
                    type="text" 
                    value={editingMember.tennisStartedAt || ''} 
                    onChange={e => setEditingMember({...editingMember, tennisStartedAt: e.target.value})}
                    placeholder="예: 2021.05"
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: 'var(--txt2)' }}>회비 납부 상태</label>
                <select 
                  className="select" 
                  value={editingMember.feePaid ? 'true' : 'false'}
                  onChange={e => setEditingMember({...editingMember, feePaid: e.target.value === 'true'})}
                  style={{
                    color: editingMember.feePaid ? '#15803d' : '#dc2626',
                    fontWeight: 700
                  }}
                >
                  <option value="true">✅ 납부완료</option>
                  <option value="false">💰 미납</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button className="btn btn-secondary" onClick={() => setEditingMember(null)}>취소</button>
              <button className="btn btn-primary" onClick={handleSaveEditedMember}>저장 완료</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 7. 미납자 회비 납부 독촉 안내문 모달 ── */}
      {showReminderModal && (
        <div className="modal-overlay" style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 1000 }} onClick={() => setShowReminderModal(false)}>
          <div className="modal-content" style={{ maxWidth: '520px', width: '90%', borderRadius: '20px', padding: '24px' }} onClick={e => e.stopPropagation()}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginTop: '20px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ backgroundColor: '#fefce8', color: '#b45309', borderColor: '#fef08a', fontWeight: 700 }}
                onClick={() => window.location.href = '/posters?tab=fee'}
              >
                🎨 회비 카드 이미지 제작하기
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowReminderModal(false)}>닫기</button>
                <button className="btn btn-primary btn-sm" onClick={() => {
                  navigator.clipboard.writeText(reminderText);
                  alert('공지 문구가 클립보드에 복사되었습니다.');
                }}>📋 문구 복사하기</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

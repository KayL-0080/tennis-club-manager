// components/AddMemberToBracketModal.js — 대진표 정회원 현장/추가 참가 등록 모달
'use client';
import { useState, useMemo } from 'react';

const REGULAR_ROLES = ['회장', '부회장', '총무', '경기이사', '운영이사', '정회원'];

export default function AddMemberToBracketModal({
  isOpen,
  onClose,
  members = [],
  participants = [],
  schedule = [],
  todayRows = [],
  onAddParticipants,
  onRemoveParticipant,
  isAdmin,
}) {
  const [activeTab, setActiveTab] = useState('add'); // 'add' | 'manage'
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('REGULAR'); // 'ALL' | 'REGULAR' | 'M' | 'F'
  const [selectedMemberIds, setSelectedMemberIds] = useState(new Set());
  const [targetGames, setTargetGames] = useState(3);
  const [notification, setNotification] = useState(null);

  // 대진표 참가자 ID 세트
  const participatingIdSet = useMemo(() => {
    return new Set((participants || []).map(p => p.playerId));
  }, [participants]);

  // 대진표 내 각 선수의 배정 경기수 계산
  const assignedCounts = useMemo(() => {
    const map = {};
    if (!schedule) return map;
    schedule.forEach(round => {
      if (!Array.isArray(round)) return;
      round.forEach(match => {
        if (!match) return;
        [...(match.teamA || []), ...(match.teamB || [])].forEach(pId => {
          if (pId) map[pId] = (map[pId] || 0) + 1;
        });
      });
    });
    return map;
  }, [schedule]);

  // 미참가 회원 목록 (정회원/운영진 우선 정렬)
  const unjoinedMembers = useMemo(() => {
    const rolePriority = { '회장': 1, '부회장': 2, '총무': 3, '경기이사': 4, '운영이사': 5, '정회원': 10, '준회원': 998, '게스트': 999 };
    return members
      .filter(m => !participatingIdSet.has(m.id))
      .sort((a, b) => {
        const pA = rolePriority[a.role] || 99;
        const pB = rolePriority[b.role] || 99;
        if (pA !== pB) return pA - pB;
        if (a.gender !== b.gender) return a.gender === 'M' ? -1 : 1;
        return (b.ntrp || 0) - (a.ntrp || 0);
      });
  }, [members, participatingIdSet]);

  // 현재 참가자 목록 (회원 상세 정보 매핑)
  const joinedMembers = useMemo(() => {
    const byId = new Map(members.map(m => [m.id, m]));
    return participants.map(pt => {
      const m = byId.get(pt.playerId) || { id: pt.playerId, name: '알 수 없음', role: '회원', gender: 'M', ntrp: 2.0 };
      const assigned = assignedCounts[pt.playerId] || 0;
      const todayRow = (todayRows || []).find(r => r.id === pt.playerId);
      const played = todayRow?.played || 0;
      return {
        ...m,
        target: pt.target || 3,
        assigned,
        played,
      };
    });
  }, [participants, members, assignedCounts, todayRows]);

  // 필터링된 미참가 회원
  const filteredUnjoined = useMemo(() => {
    return unjoinedMembers.filter(m => {
      // 1. 이름/직책 검색
      if (searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        const nameMatch = m.name?.toLowerCase().includes(term);
        const roleMatch = m.role?.toLowerCase().includes(term);
        if (!nameMatch && !roleMatch) return false;
      }
      // 2. 탭 필터
      if (roleFilter === 'REGULAR') {
        return REGULAR_ROLES.includes(m.role) || !m.role;
      }
      if (roleFilter === 'M') return m.gender === 'M';
      if (roleFilter === 'F') return m.gender === 'F';
      return true;
    });
  }, [unjoinedMembers, searchTerm, roleFilter]);

  // 전체 선택 / 해제 토글
  const handleToggleSelectAll = () => {
    if (selectedMemberIds.size === filteredUnjoined.length && filteredUnjoined.length > 0) {
      setSelectedMemberIds(new Set());
    } else {
      setSelectedMemberIds(new Set(filteredUnjoined.map(m => m.id)));
    }
  };

  // 단일 선택 토글
  const handleToggleSelect = (id) => {
    setSelectedMemberIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const showToast = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  // 단일 즉시 추가
  const handleAddSingle = (member) => {
    if (onAddParticipants) {
      onAddParticipants([member.id], targetGames);
      showToast(`🎉 [${member.name}] 정회원이 대진표에 추가되었습니다!`);
    }
  };

  // 선택 회원 일괄 추가
  const handleAddSelected = () => {
    if (selectedMemberIds.size === 0) return;
    const ids = Array.from(selectedMemberIds);
    const addedNames = members.filter(m => ids.includes(m.id)).map(m => m.name).join(', ');
    if (onAddParticipants) {
      onAddParticipants(ids, targetGames);
      setSelectedMemberIds(new Set());
      showToast(`🎉 [${addedNames}] 회원이 대진표에 추가되었습니다!`);
    }
  };

  // 참가자 제외
  const handleRemove = (member) => {
    if (!onRemoveParticipant) return;
    onRemoveParticipant(member.id);
    showToast(`ℹ️ [${member.name}] 회원이 대진표 참가자에서 제외되었습니다.`);
  };

  const getRoleBadgeStyle = (role) => {
    if (role === '회장') return { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' };
    if (role === '부회장') return { bg: '#eef2ff', color: '#4338ca', border: '#c7d2fe' };
    if (role === '총무') return { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' };
    if (role === '경기이사') return { bg: '#fffbeb', color: '#b45309', border: '#fde68a' };
    if (role === '운영이사') return { bg: '#fdf2f8', color: '#be185d', border: '#fbcfe8' };
    if (role === '준회원') return { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' };
    if (role === '게스트') return { bg: '#faf5ff', color: '#7e22ce', border: '#e9d5ff' };
    return { bg: '#f0f9ff', color: '#0369a1', border: '#bae6fd' }; // 정회원
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 1000 }}>
      <div 
        className="modal-content" 
        style={{ 
          maxWidth: '560px', 
          width: '92%', 
          borderRadius: '22px', 
          padding: '24px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh'
        }}
      >
        {/* 모달 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '24px' }}>👥</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--txt)' }}>
                정회원 대진표 추가 등록
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: 'var(--txt3)' }}>
                사전 투표 없이 현장에 추가로 참석한 정회원을 선택하여 경기에 추가합니다.
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            style={{ 
              background: 'none', 
              border: 'none', 
              fontSize: '22px', 
              color: 'var(--txt3)', 
              cursor: 'pointer', 
              padding: '4px',
              lineHeight: 1
            }}
          >
            ✕
          </button>
        </div>

        {/* 탭 네비게이션 */}
        <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid var(--border)', paddingBottom: '10px', marginBottom: '14px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('add')}
            style={{
              padding: '6px 14px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: activeTab === 'add' ? 'var(--ios-blue)' : '#f1f5f9',
              color: activeTab === 'add' ? '#fff' : 'var(--txt2)',
              fontWeight: activeTab === 'add' ? 700 : 500,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <span>➕ 미참가 정회원 추가</span>
            <span style={{ 
              backgroundColor: activeTab === 'add' ? 'rgba(255,255,255,0.3)' : '#e2e8f0', 
              padding: '1px 6px', 
              borderRadius: '8px', 
              fontSize: '11px',
              fontWeight: 800 
            }}>
              {unjoinedMembers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('manage')}
            style={{
              padding: '6px 14px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: activeTab === 'manage' ? 'var(--ios-blue)' : '#f1f5f9',
              color: activeTab === 'manage' ? '#fff' : 'var(--txt2)',
              fontWeight: activeTab === 'manage' ? 700 : 500,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <span>📋 현재 참가자 관리</span>
            <span style={{ 
              backgroundColor: activeTab === 'manage' ? 'rgba(255,255,255,0.3)' : '#e2e8f0', 
              padding: '1px 6px', 
              borderRadius: '8px', 
              fontSize: '11px',
              fontWeight: 800 
            }}>
              {participants.length}
            </span>
          </button>
        </div>

        {/* 안내 알림 토스트 (모달 내부) */}
        {notification && (
          <div style={{ 
            marginBottom: '12px', 
            padding: '10px 14px', 
            backgroundColor: '#f0fdf4', 
            border: '1px solid #86efac', 
            borderRadius: '10px', 
            fontSize: '12.5px', 
            color: '#15803d', 
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {notification}
          </div>
        )}

        {/* ── 탭 1: 미참가 회원 추가 ── */}
        {activeTab === 'add' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            {/* 검색 & 필터 바 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="input input-sm"
                  style={{ width: '100%', paddingLeft: '32px', height: '36px', borderRadius: '10px' }}
                  placeholder="회원 이름 또는 직책 검색..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
                <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--txt3)', fontSize: '13px' }}>
                  🔍
                </span>
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--txt3)', cursor: 'pointer', fontSize: '14px' }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* 필터 칩 & 전체 선택 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  {[
                    { key: 'REGULAR', label: '⭐ 정회원/임원' },
                    { key: 'ALL', label: `전체 (${unjoinedMembers.length})` },
                    { key: 'M', label: '남성' },
                    { key: 'F', label: '여성' },
                  ].map(f => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setRoleFilter(f.key)}
                      style={{
                        padding: '3px 9px',
                        fontSize: '11.5px',
                        borderRadius: '14px',
                        border: roleFilter === f.key ? '1px solid var(--ios-blue)' : '1px solid var(--border)',
                        backgroundColor: roleFilter === f.key ? 'rgba(0, 122, 255, 0.1)' : '#fff',
                        color: roleFilter === f.key ? 'var(--ios-blue)' : 'var(--txt2)',
                        fontWeight: roleFilter === f.key ? 700 : 500,
                        cursor: 'pointer'
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {filteredUnjoined.length > 0 && (
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--ios-blue)',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: '2px 6px'
                    }}
                  >
                    {selectedMemberIds.size === filteredUnjoined.length ? '전체 해제' : '전체 선택'}
                  </button>
                )}
              </div>
            </div>

            {/* 미참가 회원 리스트 */}
            <div 
              style={{ 
                flex: 1, 
                overflowY: 'auto', 
                maxHeight: '340px', 
                border: '1px solid var(--border)', 
                borderRadius: '12px', 
                padding: '6px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                backgroundColor: '#f8fafc'
              }}
            >
              {filteredUnjoined.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 12px', color: 'var(--txt3)' }}>
                  <span style={{ fontSize: '28px', display: 'block', marginBottom: '8px' }}>🎾</span>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>
                    {searchTerm ? '검색된 회원이 없습니다.' : '추가 가능한 미참가 회원이 없습니다.'}
                  </p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--txt3)' }}>
                    모든 정회원이 이미 대진표 참가자로 등록되어 있습니다.
                  </p>
                </div>
              ) : (
                filteredUnjoined.map(m => {
                  const isSelected = selectedMemberIds.has(m.id);
                  const badgeStyle = getRoleBadgeStyle(m.role);
                  return (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: '10px',
                        backgroundColor: isSelected ? '#eff6ff' : '#fff',
                        border: isSelected ? '1.5px solid var(--ios-blue)' : '1px solid #e2e8f0',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div 
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flex: 1 }}
                        onClick={() => handleToggleSelect(m.id)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(m.id)}
                          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--txt)' }}>
                              {m.name}
                            </span>
                            <span style={{
                              fontSize: '10.5px',
                              padding: '1px 6px',
                              borderRadius: '6px',
                              backgroundColor: badgeStyle.bg,
                              color: badgeStyle.color,
                              border: `1px solid ${badgeStyle.border}`,
                              fontWeight: 700
                            }}>
                              {m.role || '정회원'}
                            </span>
                            <span style={{
                              fontSize: '10.5px',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              backgroundColor: m.gender === 'F' ? 'rgba(236, 72, 153, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                              color: m.gender === 'F' ? '#db2777' : '#2563eb',
                              fontWeight: 700
                            }}>
                              {m.gender === 'F' ? '여' : '남'} {m.ntrp}
                            </span>
                          </div>
                          {m.tennisStartedAt && (
                            <div style={{ fontSize: '11px', color: 'var(--txt3)', marginTop: '2px' }}>
                              구력 {m.tennisStartedAt}
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleAddSingle(m)}
                        style={{
                          fontSize: '11.5px',
                          padding: '3px 10px',
                          height: '28px',
                          fontWeight: 700,
                          borderRadius: '8px',
                          borderColor: 'var(--ios-blue)',
                          color: 'var(--ios-blue)',
                          backgroundColor: '#fff'
                        }}
                      >
                        + 즉시 추가
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* 하단 고정 바: 목표 경기수 & 일괄 추가 버튼 */}
            <div style={{ 
              marginTop: '14px', 
              paddingTop: '12px', 
              borderTop: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--txt2)' }}>
                  목표 경기수:
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ width: '26px', height: '26px', padding: 0, fontSize: '14px', fontWeight: 800 }}
                    onClick={() => setTargetGames(prev => Math.max(1, prev - 1))}
                  >
                    -
                  </button>
                  <span style={{ fontWeight: 800, fontSize: '13.5px', minWidth: '32px', textAlign: 'center' }}>
                    {targetGames}게임
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ width: '26px', height: '26px', padding: 0, fontSize: '14px', fontWeight: 800 }}
                    onClick={() => setTargetGames(prev => Math.min(10, prev + 1))}
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={selectedMemberIds.size === 0}
                onClick={handleAddSelected}
                style={{
                  padding: '7px 16px',
                  fontWeight: 800,
                  fontSize: '13px',
                  borderRadius: '10px',
                  opacity: selectedMemberIds.size === 0 ? 0.5 : 1,
                  cursor: selectedMemberIds.size === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                ➕ 선택한 {selectedMemberIds.size}명 대진표에 추가
              </button>
            </div>
          </div>
        )}

        {/* ── 탭 2: 현재 참가자 관리 ── */}
        {activeTab === 'manage' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <p style={{ margin: '0 0 10px 0', fontSize: '12.5px', color: 'var(--txt2)' }}>
              현재 대진표에 등록된 참가자 ({joinedMembers.length}명)입니다. 점수가 입력되지 않은 선수는 제외할 수 있습니다.
            </p>

            <div 
              style={{ 
                flex: 1, 
                overflowY: 'auto', 
                maxHeight: '380px', 
                border: '1px solid var(--border)', 
                borderRadius: '12px', 
                padding: '6px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                backgroundColor: '#f8fafc'
              }}
            >
              {joinedMembers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 12px', color: 'var(--txt3)' }}>
                  등록된 참가자가 없습니다.
                </div>
              ) : (
                joinedMembers.map(m => {
                  const badgeStyle = getRoleBadgeStyle(m.role);
                  const hasPlayed = m.played > 0;
                  return (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: '10px',
                        backgroundColor: '#fff',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--txt)' }}>
                            {m.name}
                          </span>
                          <span style={{
                            fontSize: '10.5px',
                            padding: '1px 6px',
                            borderRadius: '6px',
                            backgroundColor: badgeStyle.bg,
                            color: badgeStyle.color,
                            border: `1px solid ${badgeStyle.border}`,
                            fontWeight: 700
                          }}>
                            {m.role || '정회원'}
                          </span>
                          <span style={{
                            fontSize: '10.5px',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            backgroundColor: m.gender === 'F' ? 'rgba(236, 72, 153, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                            color: m.gender === 'F' ? '#db2777' : '#2563eb',
                            fontWeight: 700
                          }}>
                            {m.gender === 'F' ? '여' : '남'} {m.ntrp}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--txt3)', marginTop: '2px' }}>
                          진행: <strong>{m.played}</strong>경기 / 배정: <strong>{m.assigned}</strong>경기 (목표: {m.target}게임)
                        </div>
                      </div>

                      {hasPlayed ? (
                        <span 
                          className="badge badge-gray" 
                          style={{ fontSize: '11px', padding: '3px 8px' }}
                          title="경기 스코어가 입력되어 있어 참가자에서 제외할 수 없습니다."
                        >
                          기록 있음 ({m.played}G)
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleRemove(m)}
                          style={{
                            fontSize: '11.5px',
                            padding: '3px 10px',
                            height: '28px',
                            fontWeight: 700,
                            borderRadius: '8px',
                            borderColor: '#fca5a5',
                            color: '#dc2626',
                            backgroundColor: '#fff'
                          }}
                        >
                          🗑️ 제외
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* 닫기 버튼 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: '7px 20px', borderRadius: '10px' }}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

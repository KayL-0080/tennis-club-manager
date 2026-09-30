'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { 
  getAdmins, 
  addAdmin, 
  deleteAdmin, 
  getClubPermissions, 
  updateClubPermissions 
} from '@/lib/firestore';
import { PERMISSION_CATEGORIES, DEFAULT_PERMISSIONS } from '@/lib/permissions';
import Navbar from '@/components/Navbar';
import styles from '../dashboard/dashboard.module.css';

export default function AdminsPage() {
  const { user, isAdmin, isSuperAdmin, loading } = useAuth();
  const router = useRouter();

  // 탭 상태: 'permissions' (권한 비교 및 오픈 설정) | 'accounts' (운영진 계정 목록)
  const [activeTab, setActiveTab] = useState('permissions');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // 권한 설정 상태
  const [permissions, setPermissions] = useState(DEFAULT_PERMISSIONS);
  const [loadingPerms, setLoadingPerms] = useState(true);
  const [savingKey, setSavingKey] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  // 운영진 목록 상태
  const [admins, setAdmins] = useState([]);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  // 접근 권한 체크: 최고 관리자 또는 등록된 운영진만 접근 가능
  useEffect(() => {
    if (!loading && !isAdmin && !isSuperAdmin) {
      router.replace('/');
    } else if (isAdmin || isSuperAdmin) {
      loadInitialData();
    }
  }, [loading, isAdmin, isSuperAdmin, router]);

  const loadInitialData = async () => {
    try {
      setLoadingPerms(true);
      const [permsData, adminsData] = await Promise.all([
        getClubPermissions(),
        getAdmins()
      ]);
      setPermissions(permsData || DEFAULT_PERMISSIONS);
      setAdmins(adminsData || []);
    } catch (e) {
      console.error('Failed to load initial data:', e);
    } finally {
      setLoadingPerms(false);
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 2800);
  };

  // 단일 권한 토글 핸들러
  const handleTogglePermission = async (key) => {
    const nextVal = !permissions[key];
    const updated = { ...permissions, [key]: nextVal };
    setPermissions(updated);
    setSavingKey(key);

    try {
      await updateClubPermissions({ [key]: nextVal });
      const itemName = PERMISSION_CATEGORIES.flatMap(c => c.items).find(i => i.key === key)?.name || key;
      showToast(nextVal ? `[${itemName}] 일반 회원에게 오픈되었습니다.` : `[${itemName}] 운영진 전용으로 잠겼습니다.`);
    } catch (e) {
      console.error('권한 업데이트 실패:', e);
      // rollback
      setPermissions(permissions);
      alert('권한 설정을 저장하는 중 오류가 발생했습니다.');
    } finally {
      setSavingKey(null);
    }
  };

  // 프리셋 설정 적용
  const handleApplyPreset = async (presetType) => {
    let nextPerms = {};
    if (presetType === 'default') {
      if (!confirm('기본 권장 권한(회칙 열람만 오픈, 그 외 모든 기능 운영진 전용)으로 복원하시겠습니까?')) return;
      nextPerms = { ...DEFAULT_PERMISSIONS };
    } else if (presetType === 'all_open') {
      if (!confirm('모든 기능을 일반 사용자에게 전체 오픈하시겠습니까? (회원들이 점수, 대진, 투표를 직접 관리할 수 있게 됩니다)')) return;
      PERMISSION_CATEGORIES.flatMap(c => c.items).forEach(item => {
        nextPerms[item.key] = true;
      });
    } else if (presetType === 'all_locked') {
      if (!confirm('모든 기능을 운영진 전용으로 잠그시겠습니까? (회칙 포함 일반 사용자는 모든 수정/설정 불가)')) return;
      PERMISSION_CATEGORIES.flatMap(c => c.items).forEach(item => {
        nextPerms[item.key] = false;
      });
    }

    setPermissions(nextPerms);
    setBusy(true);
    try {
      await updateClubPermissions(nextPerms);
      showToast('선택한 권한 프리셋이 성공적으로 적용되었습니다.');
    } catch (e) {
      console.error('프리셋 저장 실패:', e);
      alert('설정 저장 실패');
      await loadInitialData();
    } finally {
      setBusy(false);
    }
  };

  // 운영진 계정 추가 (최고 관리자 전용 권장)
  const handleAddAdmin = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      await addAdmin(email.trim());
      setEmail('');
      const data = await getAdmins();
      setAdmins(data);
      showToast('운영진 계정이 성공적으로 등록되었습니다.');
    } catch (e) {
      console.error(e);
      alert('운영진 추가 실패');
    } finally {
      setBusy(false);
    }
  };

  // 운영진 계정 삭제
  const handleDeleteAdmin = async (id, adminEmail) => {
    if (!confirm(`[${adminEmail}] 관리자 권한을 삭제하시겠습니까?`)) return;
    setBusy(true);
    try {
      await deleteAdmin(id);
      const data = await getAdmins();
      setAdmins(data);
      showToast('운영진 권한이 삭제되었습니다.');
    } catch (e) {
      console.error(e);
      alert('삭제 실패');
    } finally {
      setBusy(false);
    }
  };

  if (loading || (!loading && !isAdmin && !isSuperAdmin)) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="spinner" />
      </div>
    );
  }

  // 통계 계산
  const allItems = PERMISSION_CATEGORIES.flatMap(c => c.items);
  const totalCount = allItems.length;
  const openCount = allItems.filter(item => Boolean(permissions[item.key])).length;
  const lockedCount = totalCount - openCount;

  // 필터링된 카테고리
  const displayedCategories = categoryFilter === 'ALL' 
    ? PERMISSION_CATEGORIES 
    : PERMISSION_CATEGORIES.filter(c => c.id === categoryFilter);

  return (
    <div className={styles.page}>
      <Navbar />
      <main className={styles.main} style={{ maxWidth: '840px', paddingBottom: '80px' }}>
        
        {/* 토스트 메시지 피드백 */}
        {toastMessage && (
          <div style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            backgroundColor: '#1e293b',
            color: '#ffffff',
            padding: '10px 20px',
            borderRadius: '9999px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
            fontSize: '13.5px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <span>⚡</span>
            <span>{toastMessage}</span>
          </div>
        )}

        {/* 상단 헤더 */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🛡️</span>
              <span>운영진 권한 관리</span>
            </h1>
            <p className={styles.sub}>
              운영진과 일반 사용자의 기능별 권한 차이를 비교하고, 필요 시 각 기능을 일반 회원에게 실시간 오픈할 수 있습니다.
            </p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => router.push('/dashboard')}>
            대시보드
          </button>
        </div>

        {/* 메인 탭 전환: 기능별 권한 비교 및 오픈 vs 운영진 계정 관리 */}
        <div style={{
          display: 'flex',
          gap: '8px',
          backgroundColor: 'rgba(0, 0, 0, 0.05)',
          padding: '4px',
          borderRadius: 'var(--radius-full)',
          marginBottom: '20px',
          width: 'fit-content'
        }}>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'permissions' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              borderRadius: 'var(--radius-full)',
              padding: '8px 18px',
              fontWeight: activeTab === 'permissions' ? 700 : 500,
              fontSize: '13px'
            }}
            onClick={() => setActiveTab('permissions')}
          >
            ⚙️ 기능별 권한 비교 & 오픈 설정
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'accounts' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              borderRadius: 'var(--radius-full)',
              padding: '8px 18px',
              fontWeight: activeTab === 'accounts' ? 700 : 500,
              fontSize: '13px'
            }}
            onClick={() => setActiveTab('accounts')}
          >
            👥 운영진 계정 관리 ({admins.length}명)
          </button>
        </div>

        {/* ══════════════════════════════════════════════════════════
            탭 1: 기능별 권한 비교 및 오픈 설정
        ══════════════════════════════════════════════════════════ */}
        {activeTab === 'permissions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* 권한 차이 핵심 원칙 & 현황 요약 카드 */}
            <div className="card" style={{ 
              padding: '20px', 
              background: 'linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(240,249,255,0.92) 100%)',
              border: '1px solid rgba(0, 122, 255, 0.2)',
              boxShadow: '0 4px 20px rgba(0, 122, 255, 0.06)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '20px' }}>💡</span>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--txt)' }}>
                      운영진(👑) vs 일반 사용자(👤) 권한 원칙
                    </h3>
                    <p style={{ fontSize: '12.5px', color: 'var(--txt2)', margin: '2px 0 0 0' }}>
                      운영진은 클럽 안정성을 위해 <strong>모든 기능에 대해 항상 100% 무제한 권한</strong>을 가집니다.
                    </p>
                  </div>
                </div>

                {/* 실시간 현황 배지 */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', fontSize: '12px', padding: '4px 10px' }}>
                    총 기능 <strong>{totalCount}개</strong>
                  </span>
                  <span className="badge" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontSize: '12px', padding: '4px 10px' }}>
                    🌐 일반 오픈 <strong>{openCount}개</strong>
                  </span>
                  <span className="badge" style={{ backgroundColor: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', fontSize: '12px', padding: '4px 10px' }}>
                    🔒 운영진 전용 <strong>{lockedCount}개</strong>
                  </span>
                </div>
              </div>

              {/* 프리셋 버튼 바 */}
              <div style={{ 
                display: 'flex', 
                gap: '8px', 
                flexWrap: 'wrap', 
                alignItems: 'center',
                paddingTop: '12px', 
                borderTop: '1px solid rgba(0,0,0,0.06)' 
              }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--txt3)', marginRight: '4px' }}>
                  ⚡ 빠른 프리셋 적용:
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '12px', padding: '5px 10px', borderRadius: '6px' }}
                  onClick={() => handleApplyPreset('default')}
                  disabled={busy}
                >
                  🔄 기본 권장 설정 (회칙 열람만 오픈)
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '12px', padding: '5px 10px', borderRadius: '6px', color: '#0369a1', borderColor: '#bae6fd' }}
                  onClick={() => handleApplyPreset('all_open')}
                  disabled={busy}
                >
                  🔓 전체 기능 일반 오픈
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '12px', padding: '5px 10px', borderRadius: '6px', color: '#b91c1c', borderColor: '#fecaca' }}
                  onClick={() => handleApplyPreset('all_locked')}
                  disabled={busy}
                >
                  🔒 전체 운영진 전용으로 잠금
                </button>
              </div>
            </div>

            {/* 카테고리 필터 버튼 */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                className={`btn btn-sm ${categoryFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '12px', padding: '5px 12px', borderRadius: 'var(--radius-full)' }}
                onClick={() => setCategoryFilter('ALL')}
              >
                전체 카테고리 ({totalCount})
              </button>
              {PERMISSION_CATEGORIES.map(c => (
                <button
                  key={c.id}
                  type="button"
                  className={`btn btn-sm ${categoryFilter === c.id ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '12px', padding: '5px 12px', borderRadius: 'var(--radius-full)' }}
                  onClick={() => setCategoryFilter(c.id)}
                >
                  {c.icon} {c.name} ({c.items.length})
                </button>
              ))}
            </div>

            {/* 기능별 권한 비교 및 설정 리스트 */}
            {displayedCategories.map(category => (
              <div key={category.id} className="card" style={{ padding: '0', overflow: 'hidden' }}>
                {/* 카테고리 헤더 */}
                <div style={{
                  padding: '16px 20px',
                  backgroundColor: 'rgba(0, 0, 0, 0.02)',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>{category.icon}</span>
                    <h2 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--txt)' }}>
                      {category.name}
                    </h2>
                    <span style={{ fontSize: '12px', color: 'var(--txt3)' }}>
                      — {category.desc}
                    </span>
                  </div>
                  <span className="badge" style={{ fontSize: '11px', padding: '3px 8px', backgroundColor: 'rgba(0,0,0,0.05)', color: 'var(--txt2)' }}>
                    {category.items.length}개 항목
                  </span>
                </div>

                {/* 카테고리 내 권한 테이블 */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {category.items.map((item, idx) => {
                    const isOpen = Boolean(permissions[item.key]);
                    const isUpdating = savingKey === item.key;

                    return (
                      <div 
                        key={item.key}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '16px 20px',
                          borderBottom: idx !== category.items.length - 1 ? '1px solid var(--border)' : 'none',
                          backgroundColor: isOpen ? 'rgba(0, 122, 255, 0.015)' : 'transparent',
                          transition: 'background-color 0.15s ease',
                          gap: '16px',
                          flexWrap: 'wrap'
                        }}
                      >
                        {/* 1. 기능 명칭 및 설명 */}
                        <div style={{ flex: 1, minWidth: '260px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--txt)' }}>
                              {item.name}
                            </span>
                            <span style={{ 
                              fontSize: '10.5px', 
                              fontFamily: 'monospace', 
                              backgroundColor: 'rgba(0,0,0,0.04)', 
                              color: 'var(--txt3)', 
                              padding: '2px 6px', 
                              borderRadius: '4px' 
                            }}>
                              {item.key}
                            </span>
                          </div>
                          <p style={{ fontSize: '12.5px', color: 'var(--txt2)', margin: 0, lineHeight: 1.45 }}>
                            {item.desc}
                          </p>
                        </div>

                        {/* 2. 권한 비교 및 토글 제어부 */}
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '12px',
                          flexShrink: 0
                        }}>
                          {/* 👑 운영진 권한 (항상 허용) */}
                          <div style={{ 
                            textAlign: 'center', 
                            padding: '6px 12px', 
                            borderRadius: '8px', 
                            backgroundColor: '#f0fdf4', 
                            border: '1px solid #bbf7d0',
                            minWidth: '105px'
                          }}>
                            <div style={{ fontSize: '10px', color: '#15803d', fontWeight: 700, marginBottom: '2px' }}>
                              👑 운영진
                            </div>
                            <span style={{ fontSize: '11.5px', color: '#166534', fontWeight: 600 }}>
                              🟢 항상 허용
                            </span>
                          </div>

                          <div style={{ color: 'var(--border)', fontSize: '18px' }}>⇄</div>

                          {/* 👤 일반 사용자 권한 (토글 스위치 및 상태 표시) */}
                          <button
                            type="button"
                            onClick={() => handleTogglePermission(item.key)}
                            disabled={isUpdating}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '10px',
                              padding: '6px 14px',
                              borderRadius: '10px',
                              border: `1.5px solid ${isOpen ? '#93c5fd' : '#e2e8f0'}`,
                              backgroundColor: isOpen ? '#eff6ff' : '#f8fafc',
                              cursor: 'pointer',
                              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                              boxShadow: isOpen ? '0 2px 8px rgba(37, 99, 235, 0.12)' : 'none',
                              minWidth: '160px'
                            }}
                            title={`클릭하여 일반 회원 오픈 여부 변경`}
                          >
                            <div style={{ textAlign: 'left' }}>
                              <div style={{ fontSize: '10px', color: isOpen ? '#1d4ed8' : '#64748b', fontWeight: 700, marginBottom: '2px' }}>
                                👤 일반 사용자
                              </div>
                              <span style={{ 
                                fontSize: '12px', 
                                fontWeight: 700, 
                                color: isOpen ? '#1e40af' : '#475569' 
                              }}>
                                {isOpen ? '🌐 일반 오픈됨' : '🔒 운영진 전용'}
                              </span>
                            </div>

                            {/* iOS 스타일 토글 스위치 */}
                            <div style={{
                              width: '42px',
                              height: '24px',
                              borderRadius: '9999px',
                              backgroundColor: isOpen ? '#2563eb' : '#cbd5e1',
                              position: 'relative',
                              transition: 'background-color 0.2s ease',
                              flexShrink: 0
                            }}>
                              <div style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                backgroundColor: '#ffffff',
                                position: 'absolute',
                                top: '2px',
                                left: isOpen ? '20px' : '2px',
                                transition: 'left 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.25)'
                              }} />
                            </div>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            탭 2: 운영진 계정 관리
        ══════════════════════════════════════════════════════════ */}
        {activeTab === 'accounts' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* 최고 관리자 안내 배너 */}
            <div className="card" style={{ 
              padding: '18px 22px', 
              background: 'linear-gradient(135deg, rgba(254,249,195,0.6) 0%, rgba(255,255,255,0.9) 100%)',
              border: '1px solid #fef08a'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '24px' }}>👑</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '14.5px', color: '#854d0e' }}>
                    최고 관리자 (Super Admin)
                  </div>
                  <div style={{ fontSize: '13px', color: '#a16207', marginTop: '2px' }}>
                    <strong>leeky1537@gmail.com</strong> (시스템 영구 최고 권한 보유)
                  </div>
                </div>
              </div>
            </div>

            {/* 새 운영진 추가 (최고 관리자 전용 권한 부여) */}
            {isSuperAdmin ? (
              <div className="card" style={{ padding: '24px' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 12px 0', color: 'var(--txt)' }}>
                  ➕ 새 운영진 권한 추가
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--txt2)', margin: '0 0 16px 0' }}>
                  추가된 이메일 계정은 로그인 시 모든 클럽 관리 기능 및 운영자 모드를 이용할 수 있습니다.
                </p>
                <form onSubmit={handleAddAdmin} style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="email" 
                    className="input" 
                    placeholder="추가할 운영진 구글 이메일 주소 입력" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    required
                    style={{ flex: 1 }}
                  />
                  <button type="submit" className="btn btn-primary" disabled={busy}>
                    추가하기
                  </button>
                </form>
              </div>
            ) : (
              <div className="card" style={{ padding: '16px 20px', backgroundColor: 'rgba(0,0,0,0.02)' }}>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--txt2)' }}>
                  ℹ️ 새 운영진 계정의 추가 및 삭제 권한은 <strong>최고 관리자(Super Admin)</strong>에게만 부여되어 있습니다.
                </p>
              </div>
            )}

            {/* 등록된 운영진 계정 목록 */}
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--txt)' }}>
                    👥 등록된 클럽 운영진 목록
                  </h2>
                  <p style={{ fontSize: '12.5px', color: 'var(--txt3)', margin: '4px 0 0 0' }}>
                    클럽 설정 및 대진표, 회비, 모임을 함께 관리하는 운영자 계정입니다.
                  </p>
                </div>
                <span className="badge badge-blue" style={{ fontSize: '12px', padding: '4px 10px' }}>
                  총 {admins.length}명
                </span>
              </div>

              {admins.length === 0 ? (
                <p style={{ color: 'var(--txt3)', fontSize: '14px', textAlign: 'center', padding: '30px 0' }}>
                  추가 등록된 운영진 계정이 없습니다.
                </p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {admins.map(admin => (
                    <li key={admin.id} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      padding: '14px 18px', 
                      borderRadius: '12px',
                      backgroundColor: 'rgba(0, 0, 0, 0.02)',
                      border: '1px solid var(--border)' 
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '18px' }}>🛡️</span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--txt)' }}>
                            {admin.email}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--txt3)' }}>
                            클럽 관리자 권한
                          </div>
                        </div>
                      </div>
                      {isSuperAdmin && (
                        <button 
                          className="btn btn-danger btn-sm" 
                          onClick={() => handleDeleteAdmin(admin.id, admin.email)} 
                          disabled={busy}
                          style={{ fontSize: '12px', padding: '4px 10px' }}
                        >
                          권한 삭제
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

          </div>
        )}

      </main>
    </div>
  );
}

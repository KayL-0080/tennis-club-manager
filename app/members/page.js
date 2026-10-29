'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  getMembers, addMember, updateMember, deleteMember, initDefaultMembers,
  getClubSettings, updateClubSettings
} from '@/lib/firestore';
import Navbar from '@/components/Navbar';
import { PageHeaderIcon, MembersIcon, LockIcon, IconClipboardList, IconBookOpen } from '@/components/Icons';
import MembersTab from '@/components/tabs/MembersTab';
import FeeLedgerTab from '@/components/FeeLedgerTab';
import FinanceCalculator from '@/components/FinanceCalculator';
import RoleDutiesModal from '@/components/RoleDutiesModal';
import ClubBylawsModal from '@/components/ClubBylawsModal';
import styles from '../dashboard/dashboard.module.css';

export default function MembersPage() {
  const { isAdmin, can, clubProfile } = useAuth();
  const canEditMember = can ? can('editMember') : false;
  const canManageFee = can ? can('manageFee') : false;
  const canCourtFinance = can ? can('courtFinance') : false;
  const canViewBylaws = can ? can('viewBylaws') : false;
  const canEditBylaws = can ? can('editBylaws') : false;
  const router = useRouter();
  const [showRolesModal, setShowRolesModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [members, setMembers] = useState([]);
  const [currentClub, setCurrentClub] = useState(null);
  const [fetching, setFetching] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('members'); // 'members' | 'finance'
  const [memberCategory, setMemberCategory] = useState('REGULAR'); // 'REGULAR' (정회원/준회원) | 'GUEST' (게스트)

  const [feeCycle, setFeeCycle] = useState('월납');
  const [feeAmount, setFeeAmount] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [accountHolder, setAccountHolder] = useState('');

  useEffect(() => {
    (async () => {
      try {
        await initDefaultMembers('shared');
        const [mbrs, settings] = await Promise.all([
          getMembers('shared'),
          getClubSettings()
        ]);
        setMembers(mbrs);
        
        if (settings) {
          setCurrentClub(settings);
          setFeeCycle(settings.feeCycle || '월납');
          setFeeAmount(settings.feeAmount || '');
          setBankAccount(settings.bankAccount || '');
          setAccountHolder(settings.accountHolder || '');
        } else {
          setCurrentClub({});
        }
      } catch (err) {
        console.error('Failed to load members data:', err);
        alert('데이터를 불러오지 못했습니다. Firestore 권한 설정을 확인해주세요.');
      } finally {
        setFetching(false);
      }
    })();
  }, []);

  const isGuestMember = (m) => m?.role === '게스트' || m?.isGuest === true;

  const handleBulkFeeUpdate = async (status) => {
    if (!isAdmin && !canManageFee) return;
    const targetMembers = members.filter(m => !isGuestMember(m));
    if (targetMembers.length === 0) {
      alert('일괄 변경할 정회원이 없습니다.');
      return;
    }
    if (!confirm(`정회원(${targetMembers.length}명, 게스트 제외)의 회비 납부 상태를 '${status ? '납부완료' : '미납'}'으로 일괄 변경하시겠습니까?`)) return;
    
    setMembers(prev => prev.map(m => isGuestMember(m) ? m : { ...m, feePaid: status }));
    
    try {
      await Promise.all(targetMembers.map(m => updateMember('shared', m.id, { feePaid: status })));
      alert('일괄 변경되었습니다.');
    } catch (e) {
      console.error(e);
      alert('일괄 변경 중 일부 실패가 발생했을 수 있습니다.');
    }
  };

  const handleSaveFinanceInfo = async () => {
    if (!isAdmin && !canManageFee) return;
    try {
      const data = { feeCycle, feeAmount, bankAccount, accountHolder };
      await updateClubSettings(data);
      setCurrentClub(prev => ({ ...prev, ...data }));
      alert('클럽 재무 정보가 저장되었습니다.');
    } catch (e) {
      console.error(e);
      alert('재무 정보 저장에 실패했습니다.');
    }
  };

  const handleSaveFullSettings = async (newData) => {
    if (!isAdmin && !canCourtFinance) return;
    await updateClubSettings(newData);
    setCurrentClub(prev => ({ ...prev, ...newData }));
    if (newData.feeCycle) setFeeCycle(newData.feeCycle);
    if (newData.feeAmount) setFeeAmount(String(newData.feeAmount));
  };

  const handleLocalUpdateMember = (memberId, data) => {
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, ...data } : m));
  };

  const handleSaveMember = async (memberId, data) => {
    if (!isAdmin && !canEditMember) return;
    await updateMember('shared', memberId, data);
  };

  const handleAddMember = async (memberData) => {
    if (!isAdmin && !canEditMember) return;
    const fid = await addMember('shared', memberData);
    setMembers(prev => [...prev, { id: fid, ...memberData }]);
  };

  const handleDeleteMember = async (memberId) => {
    if (!isAdmin && !canEditMember) return;
    if (!confirm('이 회원을 삭제할까요?')) return;
    await deleteMember('shared', memberId);
    setMembers(prev => prev.filter(m => m.id !== memberId));
  };

  if (fetching) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="spinner" />
      </div>
    );
  }

  const clubMembers = members.filter(m => !isGuestMember(m));
  const guestMembers = members.filter(m => isGuestMember(m));
  const totalCount = clubMembers.length;
  const maleCount = clubMembers.filter(m => m.gender === 'M').length;
  const femaleCount = clubMembers.filter(m => m.gender === 'F').length;
  const regularCount = clubMembers.filter(m => m.role !== '준회원').length;
  const associateCount = clubMembers.filter(m => m.role === '준회원').length;
  const guestCount = guestMembers.length;
  const guestMaleCount = guestMembers.filter(m => m.gender === 'M').length;
  const guestFemaleCount = guestMembers.filter(m => m.gender === 'F').length;
  const paidCount = clubMembers.filter(m => m.feePaid).length;
  const unpaidCount = clubMembers.filter(m => !m.feePaid).length;

  return (
    <div className={styles.page}>
      <Navbar />
      <main className={styles.main}>
        <div className={`${styles.header} no-print`} style={{ gap: '10px', marginBottom: '12px' }}>
          <div>
            <h1 className={styles.title} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'clamp(1.2rem, 4vw, 1.5rem)' }}>
              <PageHeaderIcon type="members" />
              <span>회원 관리</span>
            </h1>
            <p className={styles.sub} style={{ fontSize: '12.5px', marginTop: '2px' }}>
              {isAdmin ? '정회원/게스트 명단과 회비 내역을 관리합니다.' : '클럽 정회원 및 게스트 명부입니다.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontWeight: 700,
                fontSize: '12px',
                padding: '5px 10px',
                borderRadius: '8px',
                backgroundColor: '#ffffff',
                borderColor: '#bfdbfe',
                color: '#1d4ed8',
                whiteSpace: 'nowrap'
              }}
              onClick={() => setShowRolesModal(true)}
              title="운영진 5대 직책별 주요 업무 및 협업 체계 가이드 보기"
            >
              <IconClipboardList size={14} color="#1d4ed8" />
              <span>직책 업무</span>
            </button>
            {(isAdmin || canViewBylaws) && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: 700,
                  fontSize: '12px',
                  padding: '5px 10px',
                  borderRadius: '8px',
                  backgroundColor: '#ffffff',
                  borderColor: '#bfdbfe',
                  color: '#1d4ed8',
                  whiteSpace: 'nowrap'
                }}
                onClick={() => setShowRulesModal(true)}
                title="테친회 동호회 공식 회칙 및 역대 개정 이력 보기"
              >
                <IconBookOpen size={14} color="#1d4ed8" />
                <span>회칙</span>
              </button>
            )}
            {(isAdmin || canEditMember) ? (
              <span className="badge badge-blue" style={{ fontSize: '11.5px', padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                {isAdmin ? '👑 관리자' : '✏️ 편집권한'}
              </span>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => router.push('/login')}
                title="운영자 로그인"
                aria-label="운영자 로그인"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '30px',
                  padding: 0,
                  borderRadius: '8px'
                }}
              >
                <LockIcon size={14} color="#ffffff" />
              </button>
            )}
          </div>
        </div>

        <div style={{ marginTop: '0.5rem' }}>
          
          {/* ── 1. 회원 현황 종합 요약 바 (컴팩트 모바일 최적화) ── */}
          <div className="card no-print" style={{
            marginBottom: '12px',
            padding: '12px 14px',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(240,247,255,0.95) 100%)',
            borderRadius: '14px',
            border: '1px solid rgba(37, 99, 235, 0.16)',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
                {memberCategory === 'GUEST' ? (
                  <>
                    <span style={{ fontSize: '16px', fontWeight: 900, color: 'var(--txt)', whiteSpace: 'nowrap' }}>
                      🙋 게스트 {guestCount}명
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#7e22ce', whiteSpace: 'nowrap' }}>
                      (남 {guestMaleCount} · 여 {guestFemaleCount})
                    </span>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: '16px', fontWeight: 900, color: 'var(--txt)', whiteSpace: 'nowrap' }}>
                      🎾 정회원 {totalCount}명
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#1d4ed8', whiteSpace: 'nowrap' }}>
                      (남 {maleCount} · 여 {femaleCount})
                    </span>
                  </>
                )}
              </div>

              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                {associateCount > 0 && (
                  <span className="badge" style={{ background: '#fefce8', color: '#a16207', border: '1px solid #fef08a', padding: '3px 8px', fontSize: '11.5px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    🌱 준회원 {associateCount}명
                  </span>
                )}
                {(isAdmin || canManageFee) && memberCategory === 'REGULAR' && (
                  <span className="badge" style={{ background: unpaidCount === 0 ? '#f0fdf4' : '#fef2f2', color: unpaidCount === 0 ? '#15803d' : '#b91c1c', border: `1px solid ${unpaidCount === 0 ? '#bbf7d0' : '#fecaca'}`, padding: '3px 9px', fontSize: '11.5px', fontWeight: 800, whiteSpace: 'nowrap' }}>
                    {unpaidCount === 0 ? '✅ 회비 전원 완납' : `💰 미납 ${unpaidCount}명`}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── 2. 서브 탭 전환 버튼 (모바일 가로 스크롤 없이 한 줄 고정: 회원 명단 관리 / 회비 내역 / 코트비&최적 인원 산출기) ── */}
          {(isAdmin || canManageFee || canCourtFinance) && (
            <div className="no-print" style={{
              display: 'grid',
              gridTemplateColumns: (isAdmin || (canManageFee && canCourtFinance))
                ? '1fr 0.85fr 1.25fr'
                : '1fr 1fr',
              gap: '4px',
              marginBottom: '14px',
              background: '#e2e8f0',
              padding: '4px',
              borderRadius: '12px',
              width: '100%',
              overflow: 'hidden',
              boxSizing: 'border-box'
            }}>
              <button
                type="button"
                onClick={() => setActiveSubTab('members')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '9px 4px',
                  borderRadius: '9px',
                  border: 'none',
                  fontWeight: activeSubTab === 'members' ? 800 : 700,
                  fontSize: 'clamp(11px, 3vw, 13.5px)',
                  letterSpacing: '-0.04em',
                  cursor: 'pointer',
                  background: activeSubTab === 'members' ? '#ffffff' : 'transparent',
                  color: activeSubTab === 'members' ? '#1d4ed8' : '#475569',
                  boxShadow: activeSubTab === 'members' ? '0 2px 6px rgba(15, 23, 42, 0.1)' : 'none',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  minWidth: 0
                }}
              >
                회원 명단 관리
              </button>
              {(isAdmin || canManageFee) && (
                <button
                  type="button"
                  onClick={() => setActiveSubTab('ledger')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '9px 4px',
                    borderRadius: '9px',
                    border: 'none',
                    fontWeight: activeSubTab === 'ledger' ? 800 : 700,
                    fontSize: 'clamp(11px, 3vw, 13.5px)',
                    letterSpacing: '-0.04em',
                    cursor: 'pointer',
                    background: activeSubTab === 'ledger' ? '#ffffff' : 'transparent',
                    color: activeSubTab === 'ledger' ? '#1d4ed8' : '#475569',
                    boxShadow: activeSubTab === 'ledger' ? '0 2px 6px rgba(15, 23, 42, 0.1)' : 'none',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    minWidth: 0
                  }}
                >
                  회비 내역
                </button>
              )}
              {(isAdmin || canCourtFinance) && (
                <button
                  type="button"
                  onClick={() => setActiveSubTab('finance')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '9px 4px',
                    borderRadius: '9px',
                    border: 'none',
                    fontWeight: activeSubTab === 'finance' ? 800 : 700,
                    fontSize: 'clamp(11px, 3vw, 13.5px)',
                    letterSpacing: '-0.04em',
                    cursor: 'pointer',
                    background: activeSubTab === 'finance' ? '#ffffff' : 'transparent',
                    color: activeSubTab === 'finance' ? '#1d4ed8' : '#475569',
                    boxShadow: activeSubTab === 'finance' ? '0 2px 6px rgba(15, 23, 42, 0.1)' : 'none',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    minWidth: 0
                  }}
                >
                  코트비&최적 인원 산출기
                </button>
              )}
            </div>
          )}

          {/* ── 3. 회원 명단 탭 ── */}
          {(activeSubTab === 'members' || (!isAdmin && !canManageFee && !canCourtFinance)) && (
            <>
              {(isAdmin || canManageFee) && memberCategory === 'REGULAR' && (
                <div className="card" style={{ marginBottom: '14px', padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--txt)', margin: 0, letterSpacing: '-0.02em' }}>💰 클럽 회비 / 계좌 설정</h3>
                    <button className="btn btn-primary btn-sm" style={{ padding: '4px 12px', fontSize: '12px' }} onClick={handleSaveFinanceInfo}>저장</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px', color: 'var(--txt2)' }}>납부 주기</label>
                      <select className="select input-sm" value={feeCycle} onChange={e => setFeeCycle(e.target.value)}>
                        <option value="월납">월납</option>
                        <option value="분기납">분기납</option>
                        <option value="연납">연납</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px', color: 'var(--txt2)' }}>회비 금액</label>
                      <input className="input input-sm" type="text" placeholder="예: 120,000" value={feeAmount} onChange={e => setFeeAmount(e.target.value)} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px', color: 'var(--txt2)' }}>회비 통장</label>
                      <input className="input input-sm" type="text" placeholder="예: 국민 1234-5678" value={bankAccount} onChange={e => setBankAccount(e.target.value)} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px', color: 'var(--txt2)' }}>예금주</label>
                      <input className="input input-sm" type="text" placeholder="예: 홍길동" value={accountHolder} onChange={e => setAccountHolder(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              <MembersTab
                members={members}
                onUpdateLocal={handleLocalUpdateMember}
                onSave={handleSaveMember}
                onAdd={handleAddMember}
                onDelete={handleDeleteMember}
                isAdmin={isAdmin}
                canEditMember={canEditMember}
                canManageFee={canManageFee}
                currentClub={{ ...currentClub, name: clubProfile?.name || currentClub?.name || '클럽' }}
                onBulkUpdateFeeStatus={handleBulkFeeUpdate}
                memberCategory={memberCategory}
                onChangeMemberCategory={setMemberCategory}
              />
            </>
          )}

          {/* ── 4. 회비 내역 입력 · 조회 탭 (관리자 권한 전용) ── */}
          {(isAdmin || canManageFee) && activeSubTab === 'ledger' && (
            <FeeLedgerTab
              isAdmin={isAdmin}
              canManageFee={canManageFee}
              members={members}
              currentClub={{
                ...currentClub,
                name: clubProfile?.name || currentClub?.name || '테친회',
                feeAmount: feeAmount || currentClub?.feeAmount || '120000',
                bankAccount: bankAccount || currentClub?.bankAccount || '',
                accountHolder: accountHolder || currentClub?.accountHolder || ''
              }}
              onRequireLogin={() => router.push('/login')}
            />
          )}

          {/* ── 5. 코트비 & 최적 인원 산출기 탭 (운영자 전용) ── */}
          {(isAdmin || canCourtFinance) && activeSubTab === 'finance' && (
            <FinanceCalculator
              members={members}
              isAdmin={isAdmin || canCourtFinance}
              currentClub={currentClub}
              onSaveSettings={handleSaveFullSettings}
            />
          )}

        </div>
      </main>

      {/* ── 직책별 주요 업무 가이드 모달 ── */}
      <RoleDutiesModal
        isOpen={showRolesModal}
        onClose={() => setShowRolesModal(false)}
      />

      {/* ── 동호회 회칙 및 개정 이력 관리 모달 (열람 가능) ── */}
      {(isAdmin || canViewBylaws) && (
        <ClubBylawsModal
          isOpen={showRulesModal}
          onClose={() => setShowRulesModal(false)}
          isAdmin={isAdmin || canEditBylaws}
        />
      )}
    </div>
  );
}

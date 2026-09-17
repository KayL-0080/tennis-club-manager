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
import FinanceCalculator from '@/components/FinanceCalculator';
import RoleDutiesModal from '@/components/RoleDutiesModal';
import ClubBylawsModal from '@/components/ClubBylawsModal';
import styles from '../dashboard/dashboard.module.css';

export default function MembersPage() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const [showRolesModal, setShowRolesModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [members, setMembers] = useState([]);
  const [currentClub, setCurrentClub] = useState(null);
  const [fetching, setFetching] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('members'); // 'members' | 'finance'

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

  const handleBulkFeeUpdate = async (status) => {
    if (!isAdmin) return;
    if (!confirm(`전체 회원의 회비 납부 상태를 '${status ? '납부완료' : '미납'}'으로 일괄 변경하시겠습니까?`)) return;
    
    setMembers(prev => prev.map(m => ({ ...m, feePaid: status })));
    
    try {
      await Promise.all(members.map(m => updateMember('shared', m.id, { feePaid: status })));
      alert('일괄 변경되었습니다.');
    } catch (e) {
      console.error(e);
      alert('일괄 변경 중 일부 실패가 발생했을 수 있습니다.');
    }
  };

  const handleSaveFinanceInfo = async () => {
    if (!isAdmin) return;
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
    if (!isAdmin) return;
    await updateClubSettings(newData);
    setCurrentClub(prev => ({ ...prev, ...newData }));
    if (newData.feeCycle) setFeeCycle(newData.feeCycle);
    if (newData.feeAmount) setFeeAmount(String(newData.feeAmount));
  };

  const handleLocalUpdateMember = (memberId, data) => {
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, ...data } : m));
  };

  const handleSaveMember = async (memberId, data) => {
    if (!isAdmin) return;
    await updateMember('shared', memberId, data);
  };

  const handleAddMember = async (memberData) => {
    if (!isAdmin) return;
    const fid = await addMember('shared', memberData);
    setMembers(prev => [...prev, { id: fid, ...memberData }]);
  };

  const handleDeleteMember = async (memberId) => {
    if (!isAdmin) return;
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

  const totalCount = members.length;
  const maleCount = members.filter(m => m.gender === 'M').length;
  const femaleCount = members.filter(m => m.gender === 'F').length;
  const regularCount = members.filter(m => m.role !== '준회원' && m.role !== '게스트').length;
  const associateCount = members.filter(m => m.role === '준회원').length;
  const guestCount = members.filter(m => m.role === '게스트').length;
  const paidCount = members.filter(m => m.feePaid).length;
  const unpaidCount = members.filter(m => !m.feePaid).length;

  return (
    <div className={styles.page}>
      <Navbar />
      <main className={styles.main}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PageHeaderIcon type="members" />
              <span>회원 관리</span>
            </h1>
            <p className={styles.sub}>
              {isAdmin ? '클럽 정회원/준회원/게스트 명단과 회비 납부 현황을 관리합니다.' : '클럽 정회원/준회원/게스트 회원 명부입니다.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 700,
                fontSize: '12.5px',
                padding: '6px 12px',
                borderRadius: '8px',
                backgroundColor: '#ffffff',
                borderColor: '#bfdbfe',
                color: '#1d4ed8',
                boxShadow: '0 1px 3px rgba(29, 78, 216, 0.08)'
              }}
              onClick={() => setShowRolesModal(true)}
              title="운영진 5대 직책별 주요 업무 및 협업 체계 가이드 보기"
            >
              <IconClipboardList size={15} color="#1d4ed8" />
              <span>직책별 주요 업무</span>
            </button>
            {isAdmin && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 700,
                  fontSize: '12.5px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  backgroundColor: '#ffffff',
                  borderColor: '#bfdbfe',
                  color: '#1d4ed8',
                  boxShadow: '0 1px 3px rgba(29, 78, 216, 0.08)'
                }}
                onClick={() => setShowRulesModal(true)}
                title="테친회 동호회 공식 회칙 및 역대 개정 이력 보기"
              >
                <IconBookOpen size={15} color="#1d4ed8" />
                <span>동호회 회칙</span>
              </button>
            )}
            {isAdmin ? (
              <span className="badge badge-blue" style={{ fontSize: '12px', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                👑 운영자 모드
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
                  width: '34px',
                  height: '32px',
                  padding: 0,
                  borderRadius: '10px'
                }}
              >
                <LockIcon size={15} color="#ffffff" />
              </button>
            )}
            <button className="btn btn-secondary btn-sm" onClick={() => router.push('/dashboard')}>대시보드</button>
          </div>
        </div>

        <div style={{ marginTop: '1rem' }}>
          
          {/* ── 1. 회원 현황 종합 요약 카드 (총 몇명, 남자 00명, 여자 00명) ── */}
          <div className="card" style={{
            marginBottom: '16px',
            padding: '16px 20px',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(240,247,255,0.95) 100%)',
            borderRadius: '16px',
            border: '1px solid rgba(37, 99, 235, 0.18)',
            boxShadow: '0 4px 18px rgba(0, 0, 0, 0.04)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  📊 클럽 회원 현황
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '3px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '22px', fontWeight: 900, color: 'var(--txt)' }}>
                    총 {totalCount}명
                  </span>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: '#1d4ed8' }}>
                    (남자 {maleCount}명, 여자 {femaleCount}명)
                  </span>
                </div>
              </div>

              {/* 세부 분류 뱃지 */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="badge" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '5px 10px', fontSize: '12px', fontWeight: 700 }}>
                  🎾 정회원 {regularCount}명
                </span>
                {associateCount > 0 && (
                  <span className="badge" style={{ background: '#fefce8', color: '#a16207', border: '1px solid #fef08a', padding: '5px 10px', fontSize: '12px', fontWeight: 700 }}>
                    🌱 준회원 {associateCount}명
                  </span>
                )}
                {guestCount > 0 && (
                  <span className="badge" style={{ background: '#f3f4f6', color: '#4b5563', border: '1px solid #e5e7eb', padding: '5px 10px', fontSize: '12px', fontWeight: 700 }}>
                    🙋 게스트 {guestCount}명
                  </span>
                )}
                {isAdmin && (
                  <span className="badge" style={{ background: unpaidCount === 0 ? '#f0fdf4' : '#fef2f2', color: unpaidCount === 0 ? '#15803d' : '#b91c1c', border: `1px solid ${unpaidCount === 0 ? '#bbf7d0' : '#fecaca'}`, padding: '5px 10px', fontSize: '12px', fontWeight: 700 }}>
                    {unpaidCount === 0 ? '✅ 회비 전원 완납' : `💰 미납 ${unpaidCount}명`}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── 2. 서브 탭 전환 버튼 (운영자 전용: 회원 명단 관리 / 코트비 & 최적 인원 산출기) ── */}
          {isAdmin && (
            <div style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '20px',
              background: 'rgba(0, 0, 0, 0.05)',
              padding: '5px',
              borderRadius: 'var(--radius-full)',
              width: 'fit-content',
              maxWidth: '100%',
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.06)'
            }}>
              <button
                type="button"
                onClick={() => setActiveSubTab('members')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '10px 20px',
                  borderRadius: 'var(--radius-full)',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  background: activeSubTab === 'members' ? '#ffffff' : 'transparent',
                  color: activeSubTab === 'members' ? 'var(--ios-blue)' : 'var(--txt2)',
                  boxShadow: activeSubTab === 'members' ? '0 3px 10px rgba(0, 122, 255, 0.15), 0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  whiteSpace: 'nowrap'
                }}
              >
                <MembersIcon size={16} color={activeSubTab === 'members' ? 'var(--ios-blue)' : 'var(--txt2)'} active={activeSubTab === 'members'} />
                <span>회원 명단 관리</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab('finance')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '10px 20px',
                  borderRadius: 'var(--radius-full)',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  background: activeSubTab === 'finance' ? '#ffffff' : 'transparent',
                  color: activeSubTab === 'finance' ? 'var(--ios-blue)' : 'var(--txt2)',
                  boxShadow: activeSubTab === 'finance' ? '0 3px 10px rgba(0, 122, 255, 0.15), 0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  whiteSpace: 'nowrap'
                }}
              >
                🏟️ 코트비 & 최적 인원 산출기
              </button>
            </div>
          )}

          {/* ── 3. 회원 명단 탭 (일반 사용자는 기본 표시, 운영자는 members 탭일 때 표시) ── */}
          {(!isAdmin || activeSubTab === 'members') && (
            <>
              {isAdmin && (
                <div className="card" style={{ marginBottom: '24px', padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--txt)', margin: 0, letterSpacing: '-0.02em' }}>💰 클럽 회비 / 계좌 설정</h3>
                    <button className="btn btn-primary btn-sm" onClick={handleSaveFinanceInfo}>저장</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--txt2)' }}>납부 주기</label>
                      <select className="select" value={feeCycle} onChange={e => setFeeCycle(e.target.value)}>
                        <option value="월납">월납</option>
                        <option value="분기납">분기납</option>
                        <option value="연납">연납</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '15px', marginBottom: '4px', color: 'var(--text-muted)' }}>회비 금액</label>
                      <input className="input" type="text" placeholder="예: 30,000" value={feeAmount} onChange={e => setFeeAmount(e.target.value)} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '15px', marginBottom: '4px', color: 'var(--text-muted)' }}>회비 통장 (은행 및 계좌번호)</label>
                      <input className="input" type="text" placeholder="예: 국민 1234-5678" value={bankAccount} onChange={e => setBankAccount(e.target.value)} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '15px', marginBottom: '4px', color: 'var(--text-muted)' }}>예금주</label>
                      <input className="input" type="text" placeholder="예: 홍길동" value={accountHolder} onChange={e => setAccountHolder(e.target.value)} />
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
                currentClub={currentClub}
                onBulkUpdateFeeStatus={handleBulkFeeUpdate}
                onOpenRolesModal={() => setShowRolesModal(true)}
                onOpenRulesModal={() => setShowRulesModal(true)}
              />
            </>
          )}

          {/* ── 4. 코트비 & 최적 인원 산출기 탭 (운영자 전용) ── */}
          {isAdmin && activeSubTab === 'finance' && (
            <FinanceCalculator
              members={members}
              isAdmin={isAdmin}
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

      {/* ── 동호회 회칙 및 개정 이력 관리 모달 (운영자 전용) ── */}
      {isAdmin && (
        <ClubBylawsModal
          isOpen={showRulesModal}
          onClose={() => setShowRulesModal(false)}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}

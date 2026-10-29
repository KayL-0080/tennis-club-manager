'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  getMembers, addMember, updateMember, deleteMember, initDefaultMembers,
  getClubSettings, updateClubSettings
} from '@/lib/firestore';
import Navbar from '@/components/Navbar';
import { PageHeaderIcon, MembersIcon, LockIcon, IconClipboardList, IconBookOpen, NoticeIcon } from '@/components/Icons';
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

  // ── 토스트 알림, 계좌 복사, 회비 납부 모달 및 독촉 공지 모달 상태 ──
  const [toastMessage, setToastMessage] = useState('');
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderText, setReminderText] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 2800);
  };

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

        // 카카오톡/밴드 독촉 URL 파라미터(?pay=1 또는 ?action=pay) 감지 시 회비 납부 모달 자동 호출
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          if (params.get('pay') === '1' || params.get('pay') === 'true' || params.get('action') === 'pay') {
            setShowPayModal(true);
          }
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

  // ── 은행명 및 계좌번호 스마트 파싱 (토스 딥링크 규격) ──
  const parseBankAndAccount = (rawStr) => {
    if (!rawStr) return { bank: '', accountNo: '' };
    const text = String(rawStr).trim();

    const bankList = [
      { key: '카카오뱅크', bank: '카카오뱅크' },
      { key: '카카오', bank: '카카오뱅크' },
      { key: '토스뱅크', bank: '토스뱅크' },
      { key: '토스', bank: '토스뱅크' },
      { key: '케이뱅크', bank: '케이뱅크' },
      { key: 'KB국민', bank: '국민' },
      { key: '국민은행', bank: '국민' },
      { key: '국민', bank: '국민' },
      { key: '신한은행', bank: '신한' },
      { key: '신한', bank: '신한' },
      { key: '우리은행', bank: '우리' },
      { key: '우리', bank: '우리' },
      { key: '하나은행', bank: '하나' },
      { key: 'KEB하나', bank: '하나' },
      { key: '하나', bank: '하나' },
      { key: 'NH농협', bank: '농협' },
      { key: '농협은행', bank: '농협' },
      { key: '농협', bank: '농협' },
      { key: 'IBK기업', bank: '기업' },
      { key: '기업은행', bank: '기업' },
      { key: '기업', bank: '기업' },
      { key: 'SC제일', bank: 'SC제일' },
      { key: '우체국', bank: '우체국' },
      { key: '새마을금고', bank: '새마을' },
      { key: '새마을', bank: '새마을' },
      { key: '신협', bank: '신협' },
      { key: '수협', bank: '수협' },
      { key: '부산은행', bank: '부산' },
      { key: '부산', bank: '부산' },
      { key: '대구은행', bank: '대구' },
      { key: '대구', bank: '대구' },
      { key: '광주은행', bank: '광주' },
      { key: '광주', bank: '광주' },
      { key: '경남은행', bank: '경남' },
      { key: '경남', bank: '경남' },
      { key: '전북은행', bank: '전북' },
      { key: '전북', bank: '전북' },
      { key: '제주은행', bank: '제주' },
      { key: '제주', bank: '제주' },
      { key: '씨티은행', bank: '씨티' },
      { key: '씨티', bank: '씨티' },
      { key: 'KDB산업', bank: 'KDB산업' },
      { key: '산업은행', bank: 'KDB산업' }
    ];

    let detectedBank = '';
    for (const b of bankList) {
      if (text.includes(b.key)) {
        detectedBank = b.bank;
        break;
      }
    }

    if (!detectedBank) {
      const parts = text.split(/\s+/);
      if (parts.length > 1 && !/^\d+$/.test(parts[0])) {
        detectedBank = parts[0].replace(/은행$/, '');
      }
    }

    const accountNo = text.replace(/[^0-9]/g, '');
    return { bank: detectedBank, accountNo };
  };

  // ── 1. '토스로 내기' 핸들러 ──
  const handlePayWithToss = async () => {
    if (!bankAccount) {
      alert('등록된 회비 통장 계좌가 없습니다. 관리자에게 문의하거나 회비 통장을 먼저 입력해주세요.');
      return;
    }

    const { bank, accountNo } = parseBankAndAccount(bankAccount);
    const cleanAmount = (feeAmount || '').replace(/[^0-9]/g, '');

    const params = [];
    if (bank) params.push(`bank=${encodeURIComponent(bank)}`);
    if (accountNo) params.push(`accountNo=${accountNo}`);
    if (cleanAmount) params.push(`amount=${cleanAmount}`);

    const tossUrl = `supertoss://send?${params.join('&')}`;

    // 안전망: 클립보드에 계좌번호 및 예금주 선복사
    const copyTarget = `${bankAccount} ${accountHolder ? `(예금주: ${accountHolder})` : ''}`.trim();
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(copyTarget);
      }
    } catch (e) {
      console.warn('Clipboard write error:', e);
    }

    const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    // 토스 앱 딥링크 호출
    window.location.href = tossUrl;

    if (isMobile) {
      showToast('💙 토스 앱을 실행합니다!\n(계좌·금액 자동 세팅 / 계좌 복사됨)');
    } else {
      showToast(`💙 토스 송금 링크를 호출했습니다.\n(계좌: ${copyTarget}${cleanAmount ? ` / ${Number(cleanAmount).toLocaleString()}원` : ''})`);
    }
  };

  // ── 2. '계좌 복사' 핸들러 ──
  const handleCopyAccount = async () => {
    if (!bankAccount) {
      alert('등록된 회비 통장 계좌가 없습니다. 관리자에게 문의하거나 회비 통장을 먼저 입력해주세요.');
      return;
    }

    const copyTarget = `${bankAccount} ${accountHolder ? `(예금주: ${accountHolder})` : ''}`.trim();
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(copyTarget);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = copyTarget;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedAccount(true);
      showToast(`📋 회비 계좌가 복사되었습니다!\n${copyTarget}`);
      setTimeout(() => setCopiedAccount(false), 2500);
    } catch (err) {
      console.error('Clipboard copy error:', err);
      alert(`회비 입금 계좌: ${copyTarget}`);
    }
  };

  // ── 3. '미납자 독촉 글 생성' 핸들러 (회비 납부하기 영역) ──
  const handleGenerateReminder = () => {
    const regularMembers = members.filter(m => !isGuestMember(m));
    const unpaidMembers = regularMembers.filter(m => !m.feePaid);
    const names = unpaidMembers.map(m => m.name).join(', ');
    const cycleText = feeCycle === '연납' ? '올해' : feeCycle === '분기납' ? '이번 분기' : '이번 달';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const payUrl = `${origin}/members?pay=1`;
    const numAmt = feeAmount
      ? Number(String(feeAmount).replace(/[^0-9]/g, '') || 0).toLocaleString()
      : '0';
    const clubName = clubProfile?.name || currentClub?.name || '클럽';

    const text = `🎾 ${clubName} 회비 납부 안내 🎾

안녕하세요, ${cycleText} 회비 납부 안내드립니다.
아직 납부하지 않으신 회원님들은 아래 간편 납부 링크(토스 송금 / 계좌 복사) 또는 계좌로 입금 부탁드립니다!

📌 미납자 명단: ${names || '(미납자 없음)'}
📌 납부 금액: ${numAmt}원 (${feeCycle || '월납'})
📌 입금 계좌: ${bankAccount || '미등록'} (예금주: ${accountHolder || '미등록'})

💳 회비 간편 납부 링크 (토스로 내기 / 계좌 복사):
👉 ${payUrl}

원활한 클럽 운영을 위해 빠른 납부 부탁드립니다. 감사합니다!`;

    setReminderText(text);
    setShowReminderModal(true);
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
              {memberCategory === 'REGULAR' && (
                <div className="card" style={{ marginBottom: '14px', padding: '14px 16px', background: '#ffffff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--txt)', margin: 0, letterSpacing: '-0.02em' }}>
                        💰 {(isAdmin || canManageFee) ? '클럽 회비 / 계좌 설정' : '클럽 회비 / 계좌 안내'}
                      </h3>
                      {!isAdmin && !canManageFee && (
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                          (정기 회비 입금 계좌)
                        </span>
                      )}
                    </div>
                    {(isAdmin || canManageFee) && (
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ padding: '4px 12px', fontSize: '12px', fontWeight: 700 }}
                        onClick={handleSaveFinanceInfo}
                      >
                        저장
                      </button>
                    )}
                  </div>

                  {(isAdmin || canManageFee) ? (
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
                  ) : (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                      gap: '10px',
                      background: '#f8fafc',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0'
                    }}>
                      <div>
                        <span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 700, marginBottom: '2px' }}>납부 주기</span>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>{feeCycle || '월납'}</span>
                      </div>
                      <div>
                        <span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 700, marginBottom: '2px' }}>회비 금액</span>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: '#1d4ed8' }}>
                          {feeAmount ? `${Number(feeAmount.replace(/[^0-9]/g, '') || 0).toLocaleString()}원` : '미설정'}
                        </span>
                      </div>
                      <div>
                        <span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 700, marginBottom: '2px' }}>회비 통장</span>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>{bankAccount || '미등록'}</span>
                      </div>
                      <div>
                        <span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 700, marginBottom: '2px' }}>예금주</span>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>{accountHolder || '미등록'}</span>
                      </div>
                    </div>
                  )}

                  {/* ── 회비 납부 기능: '토스로 내기' or '계좌 복사' ── */}
                  <div style={{
                    marginTop: '12px',
                    paddingTop: '12px',
                    borderTop: '1px dashed #cbd5e1',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>
                        💳 회비 납부하기:
                      </span>
                      {feeAmount && (
                        <span style={{
                          fontSize: '11.5px',
                          fontWeight: 800,
                          color: '#1d4ed8',
                          background: '#eff6ff',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          border: '1px solid #bfdbfe'
                        }}>
                          {feeCycle} {Number(feeAmount.replace(/[^0-9]/g, '') || 0).toLocaleString()}원
                        </span>
                      )}
                      {bankAccount && (
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
                          {bankAccount} {accountHolder ? `(${accountHolder})` : ''}
                        </span>
                      )}
                    </div>

                    <div className="fee-pay-action-grid">
                      {/* 1. 토스로 내기 (계좌 복사 버튼과 동일한 크기 및 규격) */}
                      <button
                        type="button"
                        className="fee-pay-half-btn"
                        onClick={handlePayWithToss}
                        style={{
                          background: '#0064FF',
                          color: '#ffffff',
                          border: 'none',
                          boxShadow: '0 2px 8px rgba(0, 100, 255, 0.28)'
                        }}
                        title="토스 앱을 열어 계좌와 금액이 자동 입력된 상태로 송금합니다"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                          <line x1="22" y1="2" x2="11" y2="13"></line>
                          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                        토스로 내기
                      </button>

                      {/* 2. 계좌 복사 (토스로 내기 버튼과 동일한 크기 및 규격) */}
                      <button
                        type="button"
                        className="fee-pay-half-btn"
                        onClick={handleCopyAccount}
                        style={{
                          background: copiedAccount ? '#f0fdf4' : '#ffffff',
                          color: copiedAccount ? '#15803d' : '#1e293b',
                          border: `1.5px solid ${copiedAccount ? '#86efac' : '#cbd5e1'}`,
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
                        }}
                        title="입금 계좌번호를 클립보드에 복사합니다"
                      >
                        <span style={{ marginRight: '6px' }}>{copiedAccount ? '✅' : '📋'}</span>
                        {copiedAccount ? '복사 완료' : '계좌 복사'}
                      </button>

                      {/* 3. 미납자 독촉 글 생성 버튼 (그 아래 길게 100% 전체 폭으로 배치) */}
                      {(isAdmin || canManageFee) && (
                        <button
                          type="button"
                          className="fee-pay-full-btn"
                          onClick={handleGenerateReminder}
                          style={{
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            border: '1px solid #bfdbfe',
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
                          }}
                          title="미납 정회원 대상 공지 및 독촉 글(간편 납부 링크 포함)을 생성합니다"
                        >
                          <NoticeIcon size={15} color="#1d4ed8" style={{ marginRight: '6px' }} />
                          <span>미납자 독촉 글 생성</span>
                        </button>
                      )}
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
                currentClub={{
                  ...currentClub,
                  feeCycle,
                  feeAmount,
                  bankAccount,
                  accountHolder,
                  name: clubProfile?.name || currentClub?.name || '클럽'
                }}
                onBulkUpdateFeeStatus={handleBulkFeeUpdate}
                memberCategory={memberCategory}
                onChangeMemberCategory={setMemberCategory}
                onOpenPayModal={() => setShowPayModal(true)}
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

      {/* ── 8. 회비 간편 납부 모달창 (?pay=1 파라미터 또는 납부창 버튼 클릭 시 호출) ── */}
      {showPayModal && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px'
          }}
          onClick={() => setShowPayModal(false)}
        >
          <div
            className="modal-content"
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '24px',
              padding: '24px',
              maxWidth: '460px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.8)',
              animation: 'fadeInSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div>
                <span style={{
                  display: 'inline-block',
                  fontSize: '11px',
                  fontWeight: 800,
                  color: '#2563eb',
                  background: '#eff6ff',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  marginBottom: '6px'
                }}>
                  🎾 {clubProfile?.name || currentClub?.name || '테친회'}
                </span>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>
                  💳 회비 간편 납부
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPayModal(false)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  fontSize: '16px',
                  color: '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px', lineHeight: 1.5 }}>
              토스 앱으로 즉시 간편 송금하시거나 입금 계좌를 복사하여 회비를 편리하게 납부하세요.
            </p>

            {/* 회비 정보 요약 카드 */}
            <div style={{
              background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)',
              border: '1px solid #dbeafe',
              borderRadius: '16px',
              padding: '16px',
              marginBottom: '18px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#475569' }}>납부 금액 ({feeCycle || '월납'})</span>
                <span style={{ fontSize: '1.35rem', fontWeight: 900, color: '#1d4ed8' }}>
                  {feeAmount ? `${Number(feeAmount.replace(/[^0-9]/g, '') || 0).toLocaleString()}원` : '미설정'}
                </span>
              </div>
              <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                  <span style={{ color: '#64748b', fontWeight: 600 }}>입금 계좌</span>
                  <span style={{ fontWeight: 800, color: '#0f172a' }}>{bankAccount || '미등록'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                  <span style={{ color: '#64748b', fontWeight: 600 }}>예금주</span>
                  <span style={{ fontWeight: 800, color: '#0f172a' }}>{accountHolder || '미등록'}</span>
                </div>
              </div>
            </div>

            {/* 2대 핵심 납부 액션 버튼 (토스로 내기 & 계좌 복사) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              {/* 1. 토스로 내기 */}
              <button
                type="button"
                onClick={handlePayWithToss}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  padding: '12px 10px',
                  borderRadius: '14px',
                  background: '#0064FF',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '13.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0, 100, 255, 0.3)',
                  transition: 'transform 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                  토스로 내기
                </div>
                <span style={{ fontSize: '10.5px', fontWeight: 500, opacity: 0.85 }}>앱 자동 송금</span>
              </button>

              {/* 2. 계좌 복사 */}
              <button
                type="button"
                onClick={handleCopyAccount}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  padding: '12px 10px',
                  borderRadius: '14px',
                  background: copiedAccount ? '#f0fdf4' : '#ffffff',
                  color: copiedAccount ? '#15803d' : '#1e293b',
                  border: `1.5px solid ${copiedAccount ? '#86efac' : '#cbd5e1'}`,
                  fontSize: '13.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  {copiedAccount ? '✅' : '📋'} {copiedAccount ? '복사 완료' : '계좌 복사'}
                </div>
                <span style={{ fontSize: '10.5px', fontWeight: 500, color: copiedAccount ? '#16a34a' : '#64748b' }}>
                  클립보드 저장
                </span>
              </button>
            </div>

            {/* 닫기 버튼 */}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowPayModal(false)}
              style={{ width: '100%', padding: '10px', borderRadius: '12px', fontWeight: 700, fontSize: '13px' }}
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* ── 9. 미납자 회비 납부 독촉 안내문 모달 ── */}
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
              현재 미납 회원 명단과 계좌 정보, 간편 납부 링크(?pay=1)가 자동으로 반영된 공지용 문구입니다.
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
                  showToast('📋 공지 문구가 클립보드에 복사되었습니다.');
                }}>📋 문구 복사하기</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 플로팅 토스트 알림 ── */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(15, 23, 42, 0.94)',
          color: '#ffffff',
          padding: '11px 22px',
          borderRadius: '9999px',
          fontSize: '13px',
          fontWeight: 700,
          boxShadow: '0 10px 28px rgba(0, 0, 0, 0.3)',
          zIndex: 99999,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          whiteSpace: 'pre-line',
          textAlign: 'center',
          pointerEvents: 'none',
          animation: 'fadeInSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          {toastMessage}
        </div>
      )}
    </div>
  );
}

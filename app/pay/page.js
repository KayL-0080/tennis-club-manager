'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getClubSettings } from '@/lib/firestore';
import Navbar from '@/components/Navbar';

function parseBankAndAccount(bankAccountStr = '') {
  if (!bankAccountStr) return { bank: '', accountNo: '' };
  const text = bankAccountStr.trim();

  const bankList = [
    { key: '토스뱅크', bank: '토스뱅크' },
    { key: '토스', bank: '토스뱅크' },
    { key: '카카오뱅크', bank: '카카오뱅크' },
    { key: '카카오', bank: '카카오뱅크' },
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
}

function PayContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawAmount = searchParams.get('a') || searchParams.get('amount') || '';
  const rawTitle = searchParams.get('t') || searchParams.get('title') || '';

  const [clubName, setClubName] = useState('테니스 클럽');
  const [bankAccount, setBankAccount] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [defaultFeeAmount, setDefaultFeeAmount] = useState('');
  const [feeCycle, setFeeCycle] = useState('월납');
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2800);
  };

  useEffect(() => {
    // 1. 캐시에서 초고속 우선 복원
    try {
      const cachedProfile = localStorage.getItem('tcm_cached_club_profile');
      if (cachedProfile) {
        const p = JSON.parse(cachedProfile);
        if (p?.name) setClubName(p.name);
      }
    } catch (e) {}

    // 2. Firestore 최신 계좌 및 설정 조회
    (async () => {
      try {
        const settings = await getClubSettings();
        if (settings) {
          if (settings.name) setClubName(settings.name);
          setBankAccount(settings.bankAccount || '');
          setAccountHolder(settings.accountHolder || '');
          setDefaultFeeAmount(settings.feeAmount || '');
          setFeeCycle(settings.feeCycle || '월납');
        }
      } catch (err) {
        console.error('Failed to load club settings on /pay:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const effectiveAmount = rawAmount || defaultFeeAmount || '';
  const cleanAmountNum = Number(String(effectiveAmount).replace(/[^0-9]/g, '') || 0);
  const displayAmount = cleanAmountNum > 0 ? `${cleanAmountNum.toLocaleString()}원` : '무료 / 자율 납부';

  // 토스로 내기
  const handlePayWithToss = async () => {
    if (!bankAccount) {
      alert('등록된 클럽 계좌가 없습니다. 관리자에게 문의해주세요.');
      return;
    }

    const { bank, accountNo } = parseBankAndAccount(bankAccount);
    const cleanAmount = String(cleanAmountNum || '').replace(/[^0-9]/g, '');

    const params = [];
    if (bank) params.push(`bank=${encodeURIComponent(bank)}`);
    if (accountNo) params.push(`accountNo=${accountNo}`);
    if (cleanAmount && cleanAmount !== '0') params.push(`amount=${cleanAmount}`);

    const tossUrl = `supertoss://send?${params.join('&')}`;

    // 안전망: 계좌번호 및 예금주 선복사
    const copyTarget = `${bankAccount} ${accountHolder ? `(예금주: ${accountHolder})` : ''}`.trim();
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(copyTarget);
      }
    } catch (e) {
      console.warn('Clipboard write error:', e);
    }

    // 토스 앱 딥링크 호출
    window.location.href = tossUrl;
    showToast('💙 토스 앱을 실행합니다!\n(계좌·금액 자동 세팅 / 계좌 복사됨)');
  };

  // 계좌 복사
  const handleCopyAccount = async () => {
    if (!bankAccount) {
      alert('등록된 클럽 계좌가 없습니다. 관리자에게 문의해주세요.');
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
      setCopied(true);
      showToast(`📋 입금 계좌가 복사되었습니다!\n${copyTarget}`);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Clipboard copy error:', err);
      alert(`입금 계좌: ${copyTarget}`);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          padding: '28px 24px',
          maxWidth: '440px',
          width: '100%',
          boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          animation: 'fadeInSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          {/* 상단 클럽 배지 & 타이틀 */}
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <span style={{
              display: 'inline-block',
              fontSize: '12px',
              fontWeight: 800,
              color: '#2563eb',
              background: '#eff6ff',
              padding: '4px 12px',
              borderRadius: '20px',
              marginBottom: '10px'
            }}>
              🎾 {clubName}
            </span>
            <h1 style={{ margin: '0 0 6px 0', fontSize: '1.45rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>
              💳 {rawTitle || '간편 납부'}
            </h1>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
              토스 앱으로 즉시 간편 송금하시거나 계좌번호를 복사하여 편리하게 납부하세요.
            </p>
          </div>

          {/* 납부 금액 및 계좌 정보 카드 */}
          <div style={{
            background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)',
            border: '1px solid #dbeafe',
            borderRadius: '18px',
            padding: '20px',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#475569' }}>
                {rawTitle ? '납부 금액' : `납부 금액 (${feeCycle || '월납'})`}
              </span>
              <span style={{ fontSize: '1.5rem', fontWeight: 900, color: '#1d4ed8', letterSpacing: '-0.02em' }}>
                {displayAmount}
              </span>
            </div>

            <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>입금 계좌</span>
                <span style={{ fontWeight: 800, color: '#0f172a' }}>{bankAccount || '미등록'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>예금주</span>
                <span style={{ fontWeight: 800, color: '#0f172a' }}>{accountHolder || '미등록'}</span>
              </div>
            </div>
          </div>

          {/* 2대 핵심 액션 버튼 (토스로 내기 & 계좌 복사) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
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
                padding: '14px 10px',
                borderRadius: '16px',
                background: '#0064FF',
                color: '#ffffff',
                border: 'none',
                fontSize: '14px',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0, 100, 255, 0.35)',
                transition: 'transform 0.1s, opacity 0.1s'
              }}
              title="토스 앱을 열어 계좌와 금액을 자동 입력합니다"
            >
              <span style={{ fontSize: '18px' }}>💙</span>
              <span>토스로 내기</span>
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
                padding: '14px 10px',
                borderRadius: '16px',
                background: copied ? '#dcfce7' : '#f1f5f9',
                color: copied ? '#15803d' : '#334155',
                border: copied ? '1px solid #86efac' : '1px solid #cbd5e1',
                fontSize: '14px',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
              title="계좌번호와 예금주를 복사합니다"
            >
              <span style={{ fontSize: '18px' }}>{copied ? '✅' : '📋'}</span>
              <span>{copied ? '복사 완료!' : '계좌 복사'}</span>
            </button>
          </div>

          {/* 보조 안내 및 홈 이동 버튼 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '11.5px', color: '#94a3b8' }}>
              💡 입금 후 운영진이 확인하여 납부 상태를 반영합니다.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '12.5px',
                  color: '#2563eb',
                  cursor: 'pointer',
                  fontWeight: 700,
                  padding: '4px 8px'
                }}
              >
                🏠 클럽 홈으로
              </button>
              <button
                type="button"
                onClick={() => router.push('/members')}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '12.5px',
                  color: '#64748b',
                  cursor: 'pointer',
                  fontWeight: 600,
                  padding: '4px 8px'
                }}
              >
                👥 회원 명부
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* 플로팅 토스트 알림 */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#0f172a',
          color: '#ffffff',
          padding: '12px 20px',
          borderRadius: '14px',
          fontSize: '13px',
          fontWeight: 700,
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
          zIndex: 99999,
          textAlign: 'center',
          whiteSpace: 'pre-line',
          animation: 'fadeInSlideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          {toastMessage}
        </div>
      )}
    </div>
  );
}

export default function PayPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
        <span className="spinner" />
      </div>
    }>
      <PayContent />
    </Suspense>
  );
}

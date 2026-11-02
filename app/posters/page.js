// app/posters/page.js — 테니스 홍보 이미지 & 테니스 상품권 제작소 (회원모집 / 게스트모집 / 코트양도 / 회비안내 / 테니스상품권)
'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import { getClubSettings, getMembers } from '@/lib/firestore';
import {
  renderCardToCanvas,
  exportCanvasAsBlob,
  exportCanvasAsDataURL,
  generateShareText,
  numberToKoreanAmount
} from '@/lib/canvasCardRenderer';
import styles from './posters.module.css';

const DEFAULT_TEMPLATES = [
  {
    id: 'tpl_default_member',
    title: '테친회 2026 하반기 신규 회원 모집 (기본 템플릿)',
    category: 'member',
    createdAt: '2026. 09. 01 10:00',
    bgType: 'hard',
    aspectRatio: '1:1',
    formData: {
      title: '테친회 2026 하반기 신규 회원 모집',
      place: '올림픽공원 테니스장',
      schedule: '매주 일요일 07:00 ~ 11:00',
      target: '남/여 무관, 구력 2년 이상 (동배/은배 이상 환영)',
      joinFee: '없음',
      monthlyFee: '월 40,000원',
      contact: '010-1234-5678',
      kakaoId: 'tennis_club',
      notes: '2030 열정 동호인 환영! 게스트 1회 참석 후 입회 결정 가능'
    }
  },
  {
    id: 'tpl_default_guest',
    title: '주말 일요 정기모임 게스트 모집 (기본 템플릿)',
    category: 'guest',
    createdAt: '2026. 09. 10 14:30',
    bgType: 'grass',
    aspectRatio: '1:1',
    formData: {
      title: '이번 주 일요 정기모임 게스트 2명 모십니다',
      place: '올림픽공원 실내테니스장 3번 코트',
      dateTime: '2026.09.20 (일) 08:00 ~ 11:00 (3시간)',
      cost: '15,000원 (새 볼/음료 포함)',
      target: '남/여 무관 (NTRP 3.0+ / 구력 2년 이상)',
      contact: '010-1234-5678',
      kakaoId: 'tennis_guest',
      notes: '실내 하드코트 / 샤워실 및 주차 무료 / 매너 게임 환영!'
    }
  },
  {
    id: 'tpl_default_court',
    title: '올림픽공원 실내코트 양도 (기본 템플릿)',
    category: 'court',
    createdAt: '2026. 09. 12 18:00',
    bgType: 'clay',
    aspectRatio: '1:1',
    formData: {
      title: '[양도] 올림픽공원 실내코트 양도합니다',
      place: '올림픽공원 테니스경기장 실내코트',
      date: '2026.09.21 (월)',
      time: '19:00 ~ 21:00 (2시간)',
      courtInfo: '실내 하드 2코트 (냉난방 완비)',
      price: '40,000원 (원가 양도)',
      contact: '010-1234-5678',
      kakaoId: 'court_transfer',
      notes: '입금 즉시 예약 번호 및 명의 변경 안내 드립니다.'
    }
  },
  {
    id: 'tpl_default_fee',
    title: '2026년 정기 회비 납부 안내 (기본 템플릿)',
    category: 'fee',
    createdAt: '2026. 09. 17 12:00',
    bgType: 'hard',
    aspectRatio: '1:1',
    formData: {
      title: '2026년 9월 정기 회비 납부 안내',
      period: '2026년 9월 정기분',
      feeAmount: '월 30,000원',
      bankAccount: '카카오뱅크 3333-01-1234567',
      accountHolder: '홍길동 (총무)',
      dueDate: '2026.09.25 (금) 24:00까지',
      target: '클럽 정회원 전원',
      unpaidList: '',
      contact: '총무 010-1234-5678',
      kakaoId: 'tennis_treasurer',
      notes: '입금자명은 반드시 [회원 본인 실명]으로 송금해주세요.'
    }
  },
  {
    id: 'tpl_default_voucher',
    title: '테니스 용품 5만원 구매 상품권 (기본 템플릿)',
    category: 'voucher',
    createdAt: '2026. 11. 02 14:00',
    bgType: 'green',
    aspectRatio: 'banknote',
    formData: {
      title: '테니스 용품 구매 상품권',
      subtitle: 'TENNIS GOODS PURCHASE GIFT CERTIFICATE',
      amount: '50,000',
      amountUnit: '원',
      amountText: '금 오만 원 정',
      clubName: '테친회',
      targetItems: '테니스 라켓, 스트링 교체, 테니스화, 테니스공 및 용품 일체',
      validity: '발행일로부터 1년 (2027.12.31까지)',
      serialNumber: 'NO. 2026-TNS-0824',
      issuer: '테친회 운영위원회',
      notes: '본 상품권은 테니스 용품 구매 및 스트링 작업 시 현금과 동일하게 사용 가능합니다. (액면가의 60% 이상 사용 시 잔액 환불)',
      themeColor: 'green'
    }
  }
];

export default function PostersPage() {
  const [activeTab, setActiveTab] = useState('member'); // 'member' | 'guest' | 'court' | 'fee' | 'voucher'
  const [aspectRatio, setAspectRatio] = useState('1:1'); // '1:1' | '4:5' | '9:16' | 'banknote'
  const [bgType, setBgType] = useState('hard'); // 'hard' | 'grass' | 'clay' | 'custom'
  const [customImage, setCustomImage] = useState(null);
  const [clubSettings, setClubSettings] = useState(null);

  // 모달 상태
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareText, setShareText] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  // 🖨️ A4 상품권 인쇄 모달 상태
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printLayoutCount, setPrintLayoutCount] = useState(3); // 1 | 2 | 3 | 4
  const [printImageUri, setPrintImageUri] = useState('');

  // 템플릿 저장 및 이력 관리 상태
  const [savedHistory, setSavedHistory] = useState([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyFilter, setHistoryFilter] = useState('ALL'); // 'ALL' | 'member' | 'guest' | 'court' | 'fee' | 'voucher'
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [isSyncingFee, setIsSyncingFee] = useState(false);

  // 토스트 알림 표시
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // 1. 신규 회원 모집 폼 상태
  const [memberData, setMemberData] = useState({
    title: '테친회 2026 하반기 신규 회원 모집',
    place: '올림픽공원 테니스장',
    schedule: '매주 일요일 07:00 ~ 11:00',
    target: '남/여 무관, 구력 2년 이상 (동배/은배 이상 환영)',
    joinFee: '없음',
    monthlyFee: '월 40,000원',
    contact: '010-1234-5678',
    kakaoId: 'tennis_club',
    notes: '2030 열정 동호인 환영! 게스트 1회 참석 후 입회 결정 가능'
  });

  // 2. 게스트 모집 폼 상태
  const [guestData, setGuestData] = useState({
    title: '이번 주 일요 정기모임 게스트 2명 모십니다',
    place: '올림픽공원 실내테니스장 3번 코트',
    dateTime: '2026.09.20 (일) 08:00 ~ 11:00 (3시간)',
    cost: '15,000원 (새 볼/음료 포함)',
    target: '남/여 무관 (NTRP 3.0+ / 구력 2년 이상)',
    contact: '010-1234-5678',
    kakaoId: 'tennis_guest',
    notes: '실내 하드코트 / 샤워실 및 주차 무료 / 매너 게임 환영!'
  });

  // 3. 코트 양도 폼 상태
  const [courtData, setCourtData] = useState({
    title: '[양도] 올림픽공원 실내코트 양도합니다',
    place: '올림픽공원 테니스경기장 실내코트',
    date: '2026.09.21 (월)',
    time: '19:00 ~ 21:00 (2시간)',
    courtInfo: '실내 하드 2코트 (냉난방 완비)',
    price: '40,000원 (원가 양도)',
    contact: '010-1234-5678',
    kakaoId: 'court_transfer',
    notes: '입금 즉시 예약 번호 및 명의 변경 안내 드립니다.'
  });

  // 4. 동호회 회비 안내 폼 상태
  const [feeData, setFeeData] = useState({
    title: '2026년 9월 정기 회비 납부 안내',
    period: '2026년 9월 정기분',
    feeAmount: '월 30,000원',
    bankAccount: '카카오뱅크 3333-01-1234567',
    accountHolder: '홍길동 (총무)',
    dueDate: '2026.09.25 (금) 24:00까지',
    target: '클럽 정회원 전원',
    unpaidList: '',
    contact: '총무 010-1234-5678',
    kakaoId: 'tennis_treasurer',
    notes: '입금자명은 반드시 [회원 본인 실명]으로 송금해주세요.'
  });

  // 5. 🎟️ 테니스 구매 상품권 폼 상태 (만원지폐 규격 148mm x 68mm)
  const [voucherData, setVoucherData] = useState({
    title: '테니스 용품 구매 상품권',
    subtitle: 'TENNIS GOODS PURCHASE GIFT CERTIFICATE',
    amount: '50,000',
    amountUnit: '원',
    amountText: '금 오만 원 정',
    clubName: '테친회',
    targetItems: '테니스 라켓, 스트링 교체, 테니스화, 테니스공 및 용품 일체',
    validity: '발행일로부터 1년 (2027.12.31까지)',
    serialNumber: 'NO. 2026-TNS-0824',
    issuer: '테친회 운영위원회',
    notes: '본 상품권은 테니스 용품 구매 및 스트링 작업 시 현금과 동일하게 사용 가능합니다. (액면가의 60% 이상 사용 시 잔액 환불)',
    themeColor: 'green'
  });

  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // URL 쿼리 파라미터 감지 (예: /posters?tab=fee 또는 /posters?tab=voucher)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab && ['member', 'guest', 'court', 'fee', 'voucher'].includes(tab)) {
        setActiveTab(tab);
        if (tab === 'voucher') setAspectRatio('banknote');
      }
    }
  }, []);

  // 로컬 저장소에서 템플릿 이력 불러오기
  useEffect(() => {
    try {
      const stored = localStorage.getItem('tcm_poster_history');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSavedHistory(parsed);
          return;
        }
      }
      setSavedHistory(DEFAULT_TEMPLATES);
      localStorage.setItem('tcm_poster_history', JSON.stringify(DEFAULT_TEMPLATES));
    } catch (e) {
      console.warn('Failed to load poster history from localStorage:', e);
      setSavedHistory(DEFAULT_TEMPLATES);
    }
  }, []);

  // 클럽 기본 설정 로드 및 회비/상품권 정보 자동 매핑
  useEffect(() => {
    (async () => {
      try {
        const settings = await getClubSettings();
        if (settings) {
          setClubSettings(settings);
          if (settings.place) {
            setMemberData(prev => ({ ...prev, place: settings.place }));
            setGuestData(prev => ({ ...prev, place: settings.place }));
            setCourtData(prev => ({ ...prev, place: settings.place }));
          }
          if (settings.contact) {
            setMemberData(prev => ({ ...prev, contact: settings.contact }));
            setGuestData(prev => ({ ...prev, contact: settings.contact }));
            setCourtData(prev => ({ ...prev, contact: settings.contact }));
            setFeeData(prev => ({ ...prev, contact: settings.contact }));
          }
          if (settings.clubName) {
            setVoucherData(prev => ({
              ...prev,
              clubName: settings.clubName,
              issuer: `${settings.clubName} 운영위원회`
            }));
          }
          if (settings.feeAmount || settings.bankAccount || settings.accountHolder) {
            setFeeData(prev => ({
              ...prev,
              feeAmount: settings.feeAmount ? `${settings.feeCycle || '월'} ${settings.feeAmount}원` : prev.feeAmount,
              bankAccount: settings.bankAccount || prev.bankAccount,
              accountHolder: settings.accountHolder || prev.accountHolder
            }));
          }
        }
      } catch (err) {
        console.error('Failed to load club settings:', err);
      }
    })();
  }, []);

  // 상품권 금액 변경 및 한글 표기 자동 동기화 핸들러
  const handleVoucherAmountChange = (val) => {
    const raw = String(val).replace(/[^0-9]/g, '');
    const num = parseInt(raw, 10);
    const formatted = isNaN(num) ? '' : num.toLocaleString('ko-KR');
    const koreanTxt = isNaN(num) ? '' : numberToKoreanAmount(num);
    setVoucherData(prev => ({
      ...prev,
      amount: formatted || val,
      amountText: koreanTxt || prev.amountText
    }));
  };

  // 상품권 일련번호 자동 생성
  const generateRandomSerial = () => {
    const year = new Date().getFullYear();
    const randNum = Math.floor(1000 + Math.random() * 9000);
    const newSerial = `NO. ${year}-TNS-${randNum}`;
    setVoucherData(prev => ({ ...prev, serialNumber: newSerial }));
    showToast(`🎲 새 일련번호가 생성되었습니다: ${newSerial}`);
  };

  // 상품권 인쇄 모달 열기
  const handleOpenPrintModal = () => {
    if (!canvasRef.current) return;
    const uri = exportCanvasAsDataURL(canvasRef.current);
    setPrintImageUri(uri);
    setShowPrintModal(true);
  };

  // 클럽 설정 및 회원명부 미납자 원클릭 동기화
  const handleSyncClubDues = async () => {
    setIsSyncingFee(true);
    try {
      const [settings, mbrs] = await Promise.all([
        getClubSettings(),
        getMembers('shared').catch(() => [])
      ]);

      const now = new Date();
      const month = now.getMonth() + 1;
      const quarter = Math.ceil(month / 3);

      let updatedData = { ...feeData };
      if (settings) {
        if (settings.feeAmount) {
          updatedData.feeAmount = `${settings.feeCycle || '월'} ${settings.feeAmount}원`;
        }
        if (settings.bankAccount) updatedData.bankAccount = settings.bankAccount;
        if (settings.accountHolder) updatedData.accountHolder = settings.accountHolder;
        if (settings.contact) updatedData.contact = settings.contact;
        if (settings.feeCycle) {
          if (settings.feeCycle === '분기납') {
            updatedData.period = `${now.getFullYear()}년 ${quarter}분기 정기분`;
            updatedData.title = `${now.getFullYear()}년 ${quarter}분기 정기 회비 납부 안내`;
          } else if (settings.feeCycle === '연납') {
            updatedData.period = `${now.getFullYear()}년도 연회비`;
            updatedData.title = `${now.getFullYear()}년도 연회비 납부 안내`;
          } else {
            updatedData.period = `${now.getFullYear()}년 ${month}월 정기분`;
            updatedData.title = `${now.getFullYear()}년 ${month}월 정기 회비 납부 안내`;
          }
        }
      }

      if (Array.isArray(mbrs) && mbrs.length > 0) {
        const unpaid = mbrs.filter(m => !m.feePaid);
        if (unpaid.length > 0) {
          const names = unpaid.map(m => m.name).join(', ');
          updatedData.unpaidList = `${names} (총 ${unpaid.length}명 미납)`;
        } else {
          updatedData.unpaidList = '전원 완납 완료 (미납자 없음)';
        }
      }

      setFeeData(updatedData);
      showToast('🔄 클럽 설정 및 미납자 정보를 성공적으로 동기화했습니다!');
    } catch (e) {
      console.error('Failed to sync club dues:', e);
      alert('회원 및 회비 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsSyncingFee(false);
    }
  };

  // 활성 탭 데이터 반환
  const getCurrentData = useCallback(() => {
    if (activeTab === 'member') return memberData;
    if (activeTab === 'guest') return guestData;
    if (activeTab === 'court') return courtData;
    if (activeTab === 'fee') return feeData;
    return voucherData;
  }, [activeTab, memberData, guestData, courtData, feeData, voucherData]);

  // 실시간 캔버스 렌더링
  const updateCanvas = useCallback(() => {
    if (!canvasRef.current) return;
    const currentData = getCurrentData();
    const clubName = clubSettings?.clubName || '테친회';
    renderCardToCanvas(canvasRef.current, activeTab, currentData, {
      bgType,
      aspectRatio,
      customImage,
      clubName
    });
  }, [activeTab, getCurrentData, bgType, aspectRatio, customImage, clubSettings]);

  useEffect(() => {
    updateCanvas();
  }, [updateCanvas]);

  // 커스텀 배경 이미지 업로드 핸들러
  const handleCustomImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setCustomImage(img);
        setBgType('custom');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  // 프리셋 칩 클릭 시 해당 필드에 텍스트 추가/대체
  const handleAddPreset = (field, text) => {
    if (activeTab === 'member') {
      setMemberData(prev => {
        const current = prev[field] || '';
        if (current.includes(text)) return prev;
        return { ...prev, [field]: current ? `${current}, ${text}` : text };
      });
    } else if (activeTab === 'guest') {
      setGuestData(prev => {
        const current = prev[field] || '';
        if (current.includes(text)) return prev;
        return { ...prev, [field]: current ? `${current}, ${text}` : text };
      });
    } else if (activeTab === 'court') {
      setCourtData(prev => {
        const current = prev[field] || '';
        if (current.includes(text)) return prev;
        return { ...prev, [field]: current ? `${current}, ${text}` : text };
      });
    } else if (activeTab === 'fee') {
      setFeeData(prev => {
        const current = prev[field] || '';
        if (current.includes(text)) return prev;
        return { ...prev, [field]: current ? `${current}, ${text}` : text };
      });
    } else {
      setVoucherData(prev => {
        const current = prev[field] || '';
        if (current.includes(text)) return prev;
        return { ...prev, [field]: current ? `${current}, ${text}` : text };
      });
    }
  };

  // 1. 고화질 이미지 다운로드 (PNG)
  const handleDownload = async () => {
    if (!canvasRef.current) return;
    const blob = await exportCanvasAsBlob(canvasRef.current);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Date().toLocaleDateString('en-CA').replace(/-/g, '');
    const tabName = activeTab === 'member' ? '회원모집' : activeTab === 'guest' ? '게스트모집' : activeTab === 'court' ? '코트양도' : activeTab === 'fee' ? '회비안내' : '테니스상품권';
    link.download = `테니스_${tabName}_${dateStr}.png`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  // 2. 클립보드 이미지 복사 (Ctrl+V)
  const handleCopyImage = async () => {
    if (!canvasRef.current) return;
    try {
      const blob = await exportCanvasAsBlob(canvasRef.current);
      if (!blob) return;
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        alert('📋 이미지가 클립보드에 복사되었습니다!\n카카오톡 PC나 밴드 게시글에 [Ctrl + V]로 바로 붙여넣으세요.');
      } else {
        alert('이 브라우저는 클립보드 이미지 직접 복사를 지원하지 않습니다. [이미지 다운로드]를 이용해주세요.');
      }
    } catch (err) {
      console.error('Clipboard copy failed:', err);
      alert('이미지 복사에 실패했습니다. [이미지 다운로드]를 이용해주세요.');
    }
  };

  // 3. 모바일 기기 기본 공유
  const handleNativeShare = async () => {
    if (!canvasRef.current) return;
    const blob = await exportCanvasAsBlob(canvasRef.current);
    if (!blob) return;
    const tabName = activeTab === 'member' ? '회원모집' : activeTab === 'guest' ? '게스트모집' : activeTab === 'court' ? '코트양도' : activeTab === 'fee' ? '회비안내' : '테니스상품권';
    const file = new File([blob], `tennis_${activeTab}.png`, { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: `테친회 ${tabName}`,
          text: generateShareText(activeTab, getCurrentData(), clubSettings?.clubName || '테친회'),
          files: [file]
        });
      } catch (err) {
        if (err.name !== 'AbortError') console.error('Share error:', err);
      }
    } else {
      handleOpenShareText();
    }
  };

  // 4. 게시글 텍스트 공유 모달
  const handleOpenShareText = () => {
    const text = generateShareText(activeTab, getCurrentData(), clubSettings?.clubName || '테친회');
    setShareText(text);
    setShowShareModal(true);
    setCopySuccess(false);
  };

  // 템플릿 저장 모달 열기
  const handleOpenSaveModal = () => {
    let defaultTitle = '';
    if (activeTab === 'member') defaultTitle = memberData.title || '신규 회원 모집 포스터';
    else if (activeTab === 'guest') defaultTitle = guestData.title || '게스트 모집 포스터';
    else if (activeTab === 'court') defaultTitle = courtData.title || '코트 양도 포스터';
    else if (activeTab === 'fee') defaultTitle = feeData.title || '정기 회비 납부 안내 포스터';
    else defaultTitle = voucherData.title || '테니스 용품 구매 상품권';
    setSaveTemplateName(defaultTitle);
    setShowSaveModal(true);
  };

  // 템플릿 저장 확정
  const handleConfirmSaveTemplate = () => {
    const trimmedTitle = saveTemplateName.trim();
    if (!trimmedTitle) {
      alert('템플릿 이름을 입력해주세요.');
      return;
    }
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const createdAt = `${now.getFullYear()}. ${pad(now.getMonth() + 1)}. ${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    let currentFormData = {};
    if (activeTab === 'member') currentFormData = { ...memberData };
    else if (activeTab === 'guest') currentFormData = { ...guestData };
    else if (activeTab === 'court') currentFormData = { ...courtData };
    else if (activeTab === 'fee') currentFormData = { ...feeData };
    else currentFormData = { ...voucherData };

    const newTemplate = {
      id: 'tpl_' + Date.now(),
      title: trimmedTitle,
      category: activeTab,
      createdAt,
      bgType,
      aspectRatio,
      formData: currentFormData
    };

    const updated = [newTemplate, ...savedHistory];
    setSavedHistory(updated);
    try {
      localStorage.setItem('tcm_poster_history', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
    setShowSaveModal(false);
    showToast(`💾 "${trimmedTitle}" 템플릿이 저장되었습니다!`);
  };

  // 템플릿 불러오기 (적용)
  const handleApplyTemplate = (item) => {
    setActiveTab(item.category);
    if (item.category === 'member') {
      setMemberData(item.formData);
    } else if (item.category === 'guest') {
      setGuestData(item.formData);
    } else if (item.category === 'court') {
      setCourtData(item.formData);
    } else if (item.category === 'fee') {
      setFeeData(item.formData);
    } else if (item.category === 'voucher') {
      setVoucherData(item.formData);
      setAspectRatio('banknote');
    }

    if (item.bgType) setBgType(item.bgType);
    if (item.aspectRatio) setAspectRatio(item.aspectRatio);

    setShowHistoryModal(false);
    showToast(`📂 "${item.title}" 템플릿을 적용했습니다.`);
  };

  // 템플릿 삭제
  const handleDeleteTemplate = (id, title, e) => {
    e.stopPropagation();
    if (window.confirm(`"${title}" 저장 내역을 삭제하시겠습니까?`)) {
      const updated = savedHistory.filter(h => h.id !== id);
      setSavedHistory(updated);
      try {
        localStorage.setItem('tcm_poster_history', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to update localStorage:', e);
      }
      showToast(`🗑️ "${title}" 내역이 삭제되었습니다.`);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
      <Navbar />

      {/* 플로팅 토스트 알림 */}
      {toastMessage && (
        <div className={styles.toastFloating}>
          {toastMessage}
        </div>
      )}

      <main className={styles.container}>
        {/* 상단 헤더 */}
        <div className={styles.header}>
          <h1 className={styles.title}>
            <span>🎨</span>
            <span>테니스 홍보 이미지 & 상품권 제작소</span>
          </h1>
          <p className={styles.subtitle}>
            인스타그램, 네이버 밴드, 카카오톡 공유용 포스터부터 대회 시상·포상용 <strong>테니스 실물 구매 상품권(만원 지폐 규격 148×68mm)</strong>까지 감각적으로 제작하고 바로 인쇄하세요.
          </p>
        </div>

        {/* 모드 전환 탭 */}
        <div className={styles.modeTabs}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'member' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('member')}
          >
            <span>👥</span>
            <span>신규 회원 모집</span>
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'guest' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('guest')}
          >
            <span>🎾</span>
            <span>게스트 모집</span>
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'court' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('court')}
          >
            <span>⚡</span>
            <span>코트 양도</span>
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'fee' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('fee')}
          >
            <span>💰</span>
            <span>회비 안내</span>
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'voucher' ? styles.tabActive : ''}`}
            onClick={() => {
              setActiveTab('voucher');
              setAspectRatio('banknote');
            }}
          >
            <span>🎟️</span>
            <span>테니스 상품권</span>
          </button>
        </div>

        {/* 2열 메인 레이아웃 (폼 + 라이브 프리뷰) */}
        <div className={styles.layout}>
          {/* 좌측 입력 폼 */}
          <div className={styles.formCard}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                <span>📝</span>
                <span>
                  {activeTab === 'member' && '신규 회원 모집 정보 입력'}
                  {activeTab === 'guest' && '게스트 모집 정보 입력'}
                  {activeTab === 'court' && '코트 양도 정보 입력'}
                  {activeTab === 'fee' && '동호회 회비 납부 안내 정보 입력'}
                  {activeTab === 'voucher' && '테니스 구매 상품권 정보 설정 (지폐 규격)'}
                </span>
              </h2>
              <div className={styles.headerActions}>
                <button
                  type="button"
                  className={styles.historyTriggerBtn}
                  onClick={() => setShowHistoryModal(true)}
                  title="저장된 이전 작성 내역 불러오기"
                >
                  <span>📂</span>
                  <span>저장 이력 ({savedHistory.length})</span>
                </button>
                <button
                  type="button"
                  className={styles.saveCurrentBtn}
                  onClick={handleOpenSaveModal}
                  title="현재 입력한 내용을 템플릿으로 저장"
                >
                  <span>💾</span>
                  <span>현재 입력값 저장</span>
                </button>
              </div>
            </div>

            {/* 코트 배경 디자인 선택 (포스터 탭 전용) */}
            {activeTab !== 'voucher' && (
              <div className={styles.fieldGroup}>
                <label className={styles.label}>
                  <span>코트 배경 스타일</span>
                  <span className={styles.labelSub}>인조잔디 / 하드 / 클레이 / 내 사진</span>
                </label>
                <div className={styles.bgOptionGrid}>
                  <div
                    className={`${styles.bgOptionCard} ${bgType === 'hard' ? styles.bgOptionActive : ''}`}
                    onClick={() => setBgType('hard')}
                  >
                    <div className={styles.bgPreviewSphere} style={{ backgroundColor: '#0284c7' }} />
                    <span className={styles.bgOptionLabel}>하드 코트</span>
                  </div>

                  <div
                    className={`${styles.bgOptionCard} ${bgType === 'grass' ? styles.bgOptionActive : ''}`}
                    onClick={() => setBgType('grass')}
                  >
                    <div className={styles.bgPreviewSphere} style={{ backgroundColor: '#1e6f3d' }} />
                    <span className={styles.bgOptionLabel}>인조잔디</span>
                  </div>

                  <div
                    className={`${styles.bgOptionCard} ${bgType === 'clay' ? styles.bgOptionActive : ''}`}
                    onClick={() => setBgType('clay')}
                  >
                    <div className={styles.bgPreviewSphere} style={{ backgroundColor: '#c2410c' }} />
                    <span className={styles.bgOptionLabel}>클레이</span>
                  </div>

                  <div
                    className={`${styles.bgOptionCard} ${bgType === 'custom' ? styles.bgOptionActive : ''}`}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className={styles.bgPreviewSphere} style={{ backgroundColor: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '13px' }}>
                      📷
                    </div>
                    <span className={styles.bgOptionLabel}>직접 사진</span>
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleCustomImageUpload}
                />
              </div>
            )}

            {/* 1. 신규 회원 모집 필드들 */}
            {activeTab === 'member' && (
              <>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>포스터 제목</label>
                  <input
                    className="input"
                    value={memberData.title}
                    onChange={e => setMemberData({ ...memberData, title: e.target.value })}
                    placeholder="예: 테친회 2026 신규 회원 모집"
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label}>정기 활동 장소</label>
                  <input
                    className="input"
                    value={memberData.place}
                    onChange={e => setMemberData({ ...memberData, place: e.target.value })}
                    placeholder="예: 올림픽공원 테니스코트"
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label}>정기 모임 요일 및 시간</label>
                  <input
                    className="input"
                    value={memberData.schedule}
                    onChange={e => setMemberData({ ...memberData, schedule: e.target.value })}
                    placeholder="예: 매주 일요일 07:00 ~ 11:00"
                  />
                  <div className={styles.chipGroup}>
                    {['매주 토요일 오전', '매주 일요일 오전', '주말 오전 07~11시', '평일 야간 19~22시'].map(t => (
                      <button key={t} type="button" className={styles.presetChip} onClick={() => setMemberData(prev => ({ ...prev, schedule: t }))}>
                        + {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label}>모집 대상 (성별 / 급수 / 구력)</label>
                  <input
                    className="input"
                    value={memberData.target}
                    onChange={e => setMemberData({ ...memberData, target: e.target.value })}
                    placeholder="예: 남/여 무관, 구력 2년 이상"
                  />
                  <div className={styles.chipGroup}>
                    {['남/여 무관', '여성 우대', '남성', '구력 2년 이상', '구력 3년 이상', '동배 이상', '은배 이상', '금배 이상', 'NTRP 2.5~3.5'].map(t => (
                      <button key={t} type="button" className={styles.presetChip} onClick={() => handleAddPreset('target', t)}>
                        + {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>가입비</label>
                    <input
                      className="input"
                      value={memberData.joinFee}
                      onChange={e => setMemberData({ ...memberData, joinFee: e.target.value })}
                      placeholder="예: 없음"
                    />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>월/분기 회비</label>
                    <input
                      className="input"
                      value={memberData.monthlyFee}
                      onChange={e => setMemberData({ ...memberData, monthlyFee: e.target.value })}
                      placeholder="예: 월 40,000원"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>문의 연락처</label>
                    <input
                      className="input"
                      value={memberData.contact}
                      onChange={e => setMemberData({ ...memberData, contact: e.target.value })}
                      placeholder="예: 010-XXXX-XXXX"
                    />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>카카오톡 ID</label>
                    <input
                      className="input"
                      value={memberData.kakaoId}
                      onChange={e => setMemberData({ ...memberData, kakaoId: e.target.value })}
                      placeholder="예: tennis_club"
                    />
                  </div>
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label}>비고 및 추가 안내</label>
                  <textarea
                    className="input"
                    style={{ height: '70px', resize: 'vertical' }}
                    value={memberData.notes}
                    onChange={e => setMemberData({ ...memberData, notes: e.target.value })}
                    placeholder="예: 2030 열정 동호인 환영! 게스트 1회 참석 후 입회 결정 가능"
                  />
                  <div className={styles.chipGroup}>
                    {['게스트 1회 참석 환영', '레슨 코치 상주', '월례대회 개최', '2030 위주 클럽', '회식 강요 없음'].map(t => (
                      <button key={t} type="button" className={styles.presetChip} onClick={() => handleAddPreset('notes', t)}>
                        + {t}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* 2. 게스트 모집 필드들 */}
            {activeTab === 'guest' && (
              <>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>공지 제목</label>
                  <input
                    className="input"
                    value={guestData.title}
                    onChange={e => setGuestData({ ...guestData, title: e.target.value })}
                    placeholder="예: 이번 주 일요 정기모임 게스트 모십니다"
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label}>모임 장소</label>
                  <input
                    className="input"
                    value={guestData.place}
                    onChange={e => setGuestData({ ...guestData, place: e.target.value })}
                    placeholder="예: 올림픽공원 실내코트 3번"
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label}>날짜 / 요일 / 시간</label>
                  <input
                    className="input"
                    value={guestData.dateTime}
                    onChange={e => setGuestData({ ...guestData, dateTime: e.target.value })}
                    placeholder="예: 2026.09.20 (일) 08:00 ~ 11:00 (3시간)"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>게스트 비용</label>
                    <input
                      className="input"
                      value={guestData.cost}
                      onChange={e => setGuestData({ ...guestData, cost: e.target.value })}
                      placeholder="예: 15,000원 (공/음료 포함)"
                    />
                    <div className={styles.chipGroup}>
                      {['10,000원', '15,000원', '20,000원', '공/음료 포함'].map(t => (
                        <button key={t} type="button" className={styles.presetChip} onClick={() => setGuestData(prev => ({ ...prev, cost: t }))}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>카카오톡 ID</label>
                    <input
                      className="input"
                      value={guestData.kakaoId}
                      onChange={e => setGuestData({ ...guestData, kakaoId: e.target.value })}
                      placeholder="예: tennis_guest"
                    />
                  </div>
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label}>게스트 모집 대상</label>
                  <input
                    className="input"
                    value={guestData.target}
                    onChange={e => setGuestData({ ...guestData, target: e.target.value })}
                    placeholder="예: 남/여 무관 (NTRP 3.0+ / 구력 2년 이상)"
                  />
                  <div className={styles.chipGroup}>
                    {['남/여 무관', '남성', '여성', '구력 2년 이상', '구력 3년 이상', '동배 이상', '은배 이상', '금배 이상', 'NTRP 3.0+'].map(t => (
                      <button key={t} type="button" className={styles.presetChip} onClick={() => handleAddPreset('target', t)}>
                        + {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label}>문의 연락처</label>
                  <input
                    className="input"
                    value={guestData.contact}
                    onChange={e => setGuestData({ ...guestData, contact: e.target.value })}
                    placeholder="예: 010-XXXX-XXXX"
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label}>비고 및 준비물</label>
                  <textarea
                    className="input"
                    style={{ height: '70px', resize: 'vertical' }}
                    value={guestData.notes}
                    onChange={e => setGuestData({ ...guestData, notes: e.target.value })}
                    placeholder="예: 실내 하드코트 / 샤워실 완비 / 매너 게임 환영"
                  />
                  <div className={styles.chipGroup}>
                    {['매너 필수', '새 볼 제공', '음료 제공', '샤워 가능', '주차 무료'].map(t => (
                      <button key={t} type="button" className={styles.presetChip} onClick={() => handleAddPreset('notes', t)}>
                        + {t}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* 3. 코트 양도 필드들 */}
            {activeTab === 'court' && (
              <>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>양도 공지 제목</label>
                  <input
                    className="input"
                    value={courtData.title}
                    onChange={e => setCourtData({ ...courtData, title: e.target.value })}
                    placeholder="예: [급양도] 올림픽공원 실내코트 양도합니다"
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label}>코트 장소</label>
                  <input
                    className="input"
                    value={courtData.place}
                    onChange={e => setCourtData({ ...courtData, place: e.target.value })}
                    placeholder="예: 올림픽공원 테니스경기장"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>이용 일시</label>
                    <input
                      className="input"
                      value={courtData.date}
                      onChange={e => setCourtData({ ...courtData, date: e.target.value })}
                      placeholder="예: 2026.09.21 (월)"
                    />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>이용 시간</label>
                    <input
                      className="input"
                      value={courtData.time}
                      onChange={e => setCourtData({ ...courtData, time: e.target.value })}
                      placeholder="예: 19:00 ~ 21:00 (2시간)"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>코트 상세 정보</label>
                    <input
                      className="input"
                      value={courtData.courtInfo}
                      onChange={e => setCourtData({ ...courtData, courtInfo: e.target.value })}
                      placeholder="예: 실내 하드 2코트 (냉난방 완비)"
                    />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>양도 금액</label>
                    <input
                      className="input"
                      value={courtData.price}
                      onChange={e => setCourtData({ ...courtData, price: e.target.value })}
                      placeholder="예: 40,000원 (원가 양도)"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>문의 연락처</label>
                    <input
                      className="input"
                      value={courtData.contact}
                      onChange={e => setCourtData({ ...courtData, contact: e.target.value })}
                      placeholder="예: 010-XXXX-XXXX"
                    />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>카카오톡 ID</label>
                    <input
                      className="input"
                      value={courtData.kakaoId}
                      onChange={e => setCourtData({ ...courtData, kakaoId: e.target.value })}
                      placeholder="예: court_transfer"
                    />
                  </div>
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label}>비고 및 거래 방식</label>
                  <textarea
                    className="input"
                    style={{ height: '70px', resize: 'vertical' }}
                    value={courtData.notes}
                    onChange={e => setCourtData({ ...courtData, notes: e.target.value })}
                    placeholder="예: 입금 즉시 예약 번호 및 명의 변경 안내 드립니다."
                  />
                  <div className={styles.chipGroup}>
                    {['원가 양도', '입금 순 마감', '취소 불가', '냉난방 가동', '주차권 지급'].map(t => (
                      <button key={t} type="button" className={styles.presetChip} onClick={() => handleAddPreset('notes', t)}>
                        + {t}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* 4. 회비 납부 안내 필드들 */}
            {activeTab === 'fee' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleSyncClubDues}
                    disabled={isSyncingFee}
                    style={{ fontSize: '11.5px', fontWeight: 700, padding: '4px 10px', color: 'var(--ios-blue)', borderColor: 'rgba(0,122,255,0.3)', backgroundColor: 'rgba(0,122,255,0.06)' }}
                  >
                    {isSyncingFee ? '동기화 중...' : '🔄 클럽 설정 및 미납자 정보 자동 동기화'}
                  </button>
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label}>안내 제목</label>
                  <input
                    className="input"
                    value={feeData.title}
                    onChange={e => setFeeData({ ...feeData, title: e.target.value })}
                    placeholder="예: 2026년 9월 정기 회비 납부 안내"
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label}>납부 대상 회비 기간/명목</label>
                  <input
                    className="input"
                    value={feeData.period}
                    onChange={e => setFeeData({ ...feeData, period: e.target.value })}
                    placeholder="예: 2026년 9월 정기분"
                  />
                  <div className={styles.chipGroup}>
                    {['당월 정기분', '분기 정기분', '상반기 회비', '하반기 회비', '정기 대회 참가비', '클럽 연회비'].map(t => (
                      <button key={t} type="button" className={styles.presetChip} onClick={() => setFeeData(prev => ({ ...prev, period: t }))}>
                        + {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>납부 금액</label>
                    <input
                      className="input"
                      value={feeData.feeAmount}
                      onChange={e => setFeeData({ ...feeData, feeAmount: e.target.value })}
                      placeholder="예: 월 30,000원"
                    />
                    <div className={styles.chipGroup}>
                      {['월 30,000원', '월 40,000원', '분기 90,000원', '연회비 360,000원'].map(t => (
                        <button key={t} type="button" className={styles.presetChip} onClick={() => setFeeData(prev => ({ ...prev, feeAmount: t }))}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>납부 대상</label>
                    <input
                      className="input"
                      value={feeData.target}
                      onChange={e => setFeeData({ ...feeData, target: e.target.value })}
                      placeholder="예: 클럽 정회원 전원"
                    />
                    <div className={styles.chipGroup}>
                      {['클럽 정회원 전원', '정회원 및 준회원', '대회 참가자 전원'].map(t => (
                        <button key={t} type="button" className={styles.presetChip} onClick={() => setFeeData(prev => ({ ...prev, target: t }))}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '12px' }}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>입금 계좌 번호 (은행 포함)</label>
                    <input
                      className="input"
                      value={feeData.bankAccount}
                      onChange={e => setFeeData({ ...feeData, bankAccount: e.target.value })}
                      placeholder="예: 카카오뱅크 3333-01-1234567"
                    />
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>예금주</label>
                    <input
                      className="input"
                      value={feeData.accountHolder}
                      onChange={e => setFeeData({ ...feeData, accountHolder: e.target.value })}
                      placeholder="예: 홍길동 (총무)"
                    />
                  </div>
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label}>납부 마감 일시</label>
                  <input
                    className="input"
                    value={feeData.dueDate}
                    onChange={e => setFeeData({ ...feeData, dueDate: e.target.value })}
                    placeholder="예: 2026.09.25 (금) 24:00까지"
                  />
                  <div className={styles.chipGroup}>
                    {['당월 25일까지', '당월 말일까지', '이번 주 일요일까지', '정기 모임 전날까지', '수시 납부'].map(t => (
                      <button key={t} type="button" className={styles.presetChip} onClick={() => setFeeData(prev => ({ ...prev, dueDate: t }))}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label}>
                    <span>미납 안내 / 대상자 명단</span>
                    <span className={styles.labelSub}>미입력 시 카드에 미표시</span>
                  </label>
                  <input
                    className="input"
                    value={feeData.unpaidList}
                    onChange={e => setFeeData({ ...feeData, unpaidList: e.target.value })}
                    placeholder="예: 김철수, 이영희 (2명 미납) — 위 동기화 버튼 클릭 시 자동 채움"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>문의 연락처</label>
                    <input
                      className="input"
                      value={feeData.contact}
                      onChange={e => setFeeData({ ...feeData, contact: e.target.value })}
                      placeholder="예: 총무 010-XXXX-XXXX"
                    />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>카카오톡 ID / 오픈채팅</label>
                    <input
                      className="input"
                      value={feeData.kakaoId}
                      onChange={e => setFeeData({ ...feeData, kakaoId: e.target.value })}
                      placeholder="예: tennis_treasurer"
                    />
                  </div>
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label}>비고 및 전달 사항</label>
                  <textarea
                    className="input"
                    style={{ height: '70px', resize: 'vertical' }}
                    value={feeData.notes}
                    onChange={e => setFeeData({ ...feeData, notes: e.target.value })}
                    placeholder="예: 입금자명은 반드시 본인 성명으로 입금 부탁드립니다."
                  />
                  <div className={styles.chipGroup}>
                    {['본인 성명 입금 필수', '입금 후 단톡방 확인', '영수증/출납내역 공개', '미납 시 경기 제한', '빠른 납부 감사'].map(t => (
                      <button key={t} type="button" className={styles.presetChip} onClick={() => handleAddPreset('notes', t)}>
                        + {t}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* 5. 🎟️ 테니스 구매 상품권 전용 입력 필드 (만원 지폐 규격 148mm x 68mm) */}
            {activeTab === 'voucher' && (
              <>
                {/* 상품권 테마 스타일 선택 */}
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>
                    <span>상품권 테마 색상</span>
                    <span className={styles.labelSub}>윔블던 그린 (만원권 감성) / 로열 골드 / 하드코트 블루 / 클레이</span>
                  </label>
                  <div className={styles.bgOptionGrid}>
                    <div
                      className={`${styles.bgOptionCard} ${voucherData.themeColor === 'green' ? styles.bgOptionActive : ''}`}
                      onClick={() => setVoucherData(prev => ({ ...prev, themeColor: 'green' }))}
                    >
                      <div className={styles.bgPreviewSphere} style={{ backgroundColor: '#15803d' }} />
                      <span className={styles.bgOptionLabel}>윔블던 그린 (만원권)</span>
                    </div>

                    <div
                      className={`${styles.bgOptionCard} ${voucherData.themeColor === 'gold' ? styles.bgOptionActive : ''}`}
                      onClick={() => setVoucherData(prev => ({ ...prev, themeColor: 'gold' }))}
                    >
                      <div className={styles.bgPreviewSphere} style={{ backgroundColor: '#d97706' }} />
                      <span className={styles.bgOptionLabel}>로열 골드</span>
                    </div>

                    <div
                      className={`${styles.bgOptionCard} ${voucherData.themeColor === 'blue' ? styles.bgOptionActive : ''}`}
                      onClick={() => setVoucherData(prev => ({ ...prev, themeColor: 'blue' }))}
                    >
                      <div className={styles.bgPreviewSphere} style={{ backgroundColor: '#0284c7' }} />
                      <span className={styles.bgOptionLabel}>하드코트 블루</span>
                    </div>

                    <div
                      className={`${styles.bgOptionCard} ${voucherData.themeColor === 'clay' ? styles.bgOptionActive : ''}`}
                      onClick={() => setVoucherData(prev => ({ ...prev, themeColor: 'clay' }))}
                    >
                      <div className={styles.bgPreviewSphere} style={{ backgroundColor: '#c2410c' }} />
                      <span className={styles.bgOptionLabel}>클레이 오렌지</span>
                    </div>
                  </div>
                </div>

                {/* 상품권 제목 */}
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>상품권 메인 제목</label>
                  <input
                    className="input"
                    value={voucherData.title}
                    onChange={e => setVoucherData({ ...voucherData, title: e.target.value })}
                    placeholder="예: 테니스 용품 구매 상품권"
                  />
                  <div className={styles.chipGroup}>
                    {['테니스 용품 구매 상품권', '정기대회 우승 상품권', '월례대회 준우승 상품권', '클럽 특별 포상 상품권', '스트링 무료 교환권'].map(t => (
                      <button key={t} type="button" className={styles.presetChip} onClick={() => setVoucherData(prev => ({ ...prev, title: t }))}>
                        + {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 상품권 영문 소제목 */}
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>영문 서브타이틀</label>
                  <input
                    className="input"
                    value={voucherData.subtitle}
                    onChange={e => setVoucherData({ ...voucherData, subtitle: e.target.value })}
                    placeholder="예: TENNIS GOODS PURCHASE GIFT CERTIFICATE"
                  />
                </div>

                {/* 권면 금액 (임의 지정 가능) & 한글 금액 표기 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '12px' }}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>
                      <span>권면 금액 (임의 지정 가능)</span>
                      <span className={styles.labelSub}>숫자 또는 자유 입력</span>
                    </label>
                    <input
                      className="input"
                      value={voucherData.amount}
                      onChange={e => handleVoucherAmountChange(e.target.value)}
                      placeholder="예: 50,000"
                      style={{ fontSize: '15px', fontWeight: 800, color: '#15803d' }}
                    />
                    <div className={styles.chipGroup}>
                      {['10,000', '20,000', '30,000', '50,000', '100,000', '150,000', '200,000'].map(t => (
                        <button
                          key={t}
                          type="button"
                          className={styles.presetChip}
                          onClick={() => handleVoucherAmountChange(t)}
                        >
                          {t}원
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>한글 금액 표기 (자동 완성)</label>
                    <input
                      className="input"
                      value={voucherData.amountText}
                      onChange={e => setVoucherData({ ...voucherData, amountText: e.target.value })}
                      placeholder="예: 금 오만 원 정"
                    />
                  </div>
                </div>

                {/* 사용처 및 사용 가능 품목 */}
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>사용 가능 품목</label>
                  <input
                    className="input"
                    value={voucherData.targetItems}
                    onChange={e => setVoucherData({ ...voucherData, targetItems: e.target.value })}
                    placeholder="예: 테니스 라켓, 스트링 교체, 테니스화, 테니스공 및 용품 일체"
                  />
                  <div className={styles.chipGroup}>
                    {['테니스 용품 일체', '라켓 및 스트링 교체', '테니스화 및 전용 의류', '테니스공 1박스 교환', '레슨 및 코트비'].map(t => (
                      <button key={t} type="button" className={styles.presetChip} onClick={() => setVoucherData(prev => ({ ...prev, targetItems: t }))}>
                        + {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 유효기간 & 발행처 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>유효 기간</label>
                    <input
                      className="input"
                      value={voucherData.validity}
                      onChange={e => setVoucherData({ ...voucherData, validity: e.target.value })}
                      placeholder="예: 발행일로부터 1년"
                    />
                    <div className={styles.chipGroup}>
                      {['발행일로부터 1년', '발행일로부터 6개월', '2026.12.31까지', '상시 사용 가능'].map(t => (
                        <button key={t} type="button" className={styles.presetChip} onClick={() => setVoucherData(prev => ({ ...prev, validity: t }))}>
                          + {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>발행처 (클럽/기관명)</label>
                    <input
                      className="input"
                      value={voucherData.issuer}
                      onChange={e => setVoucherData({ ...voucherData, issuer: e.target.value })}
                      placeholder="예: 테친회 운영위원회"
                    />
                    <div className={styles.chipGroup}>
                      {['테친회 운영위원회', '테친회장', '지정 프로샵', '경기이사'].map(t => (
                        <button key={t} type="button" className={styles.presetChip} onClick={() => setVoucherData(prev => ({ ...prev, issuer: t }))}>
                          + {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 일련번호 (시리얼 넘버) */}
                <div className={styles.fieldGroup}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className={styles.label} style={{ margin: 0 }}>일련번호 (시리얼 넘버)</label>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '11px', padding: '2px 8px' }}
                      onClick={generateRandomSerial}
                    >
                      🎲 번호 자동 생성
                    </button>
                  </div>
                  <input
                    className="input"
                    value={voucherData.serialNumber}
                    onChange={e => setVoucherData({ ...voucherData, serialNumber: e.target.value })}
                    placeholder="예: NO. 2026-TNS-0824"
                  />
                </div>

                {/* 비고 및 사용 유의사항 */}
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>비고 및 사용 유의사항</label>
                  <textarea
                    className="input"
                    style={{ height: '70px', resize: 'vertical' }}
                    value={voucherData.notes}
                    onChange={e => setVoucherData({ ...voucherData, notes: e.target.value })}
                    placeholder="예: 본 상품권은 테니스 용품 구매 및 스트링 작업 시 현금과 동일하게 사용 가능합니다."
                  />
                  <div className={styles.chipGroup}>
                    {['액면가 60% 이상 시 잔액 환불', '타인 양도 가능', '분실 시 재발행 불가', '온·오프라인 매장 사용 가능'].map(t => (
                      <button key={t} type="button" className={styles.presetChip} onClick={() => handleAddPreset('notes', t)}>
                        + {t}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 우측 실시간 카드 미리보기 및 다운로드 패널 */}
          <div className={styles.previewPanel}>
            <div className={styles.previewCard}>
              {/* 이미지 비율 선택기 */}
              <div className={styles.ratioBar}>
                {activeTab === 'voucher' ? (
                  <>
                    <button
                      type="button"
                      className={`${styles.ratioBtn} ${aspectRatio === 'banknote' ? styles.ratioActive : ''}`}
                      onClick={() => setAspectRatio('banknote')}
                    >
                      💵 만원 지폐 규격 (148×68mm)
                    </button>
                    <button
                      type="button"
                      className={`${styles.ratioBtn} ${aspectRatio === '1:1' ? styles.ratioActive : ''}`}
                      onClick={() => setAspectRatio('1:1')}
                    >
                      1:1 정방형
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className={`${styles.ratioBtn} ${aspectRatio === '1:1' ? styles.ratioActive : ''}`}
                      onClick={() => setAspectRatio('1:1')}
                    >
                      1:1 정방형 (피드/당근)
                    </button>
                    <button
                      type="button"
                      className={`${styles.ratioBtn} ${aspectRatio === '4:5' ? styles.ratioActive : ''}`}
                      onClick={() => setAspectRatio('4:5')}
                    >
                      4:5 세로형 (인스타/밴드)
                    </button>
                    <button
                      type="button"
                      className={`${styles.ratioBtn} ${aspectRatio === '9:16' ? styles.ratioActive : ''}`}
                      onClick={() => setAspectRatio('9:16')}
                    >
                      9:16 스토리형
                    </button>
                  </>
                )}
              </div>

              {/* 캔버스 뷰어 */}
              <div className={styles.previewCanvasWrapper}>
                <canvas ref={canvasRef} className={styles.previewCanvas} />
              </div>

              {/* 액션 버튼군 */}
              <div className={styles.actionGroup}>
                {activeTab === 'voucher' && (
                  <button
                    type="button"
                    className={styles.actionBtnPrimary}
                    style={{ gridColumn: 'span 2', backgroundColor: '#15803d', borderColor: '#166534' }}
                    onClick={handleOpenPrintModal}
                  >
                    <span>🖨️</span>
                    <span>상품권 A4 실물 크기 즉시 인쇄 (148×68mm)</span>
                  </button>
                )}

                <button type="button" className={styles.actionBtnPrimary} onClick={handleDownload}>
                  <span>📥</span>
                  <span>고화질 이미지 저장 (PNG)</span>
                </button>

                <button type="button" className={styles.actionBtnSecondary} onClick={handleCopyImage}>
                  <span>📋</span>
                  <span>클립보드 복사 (Ctrl+V)</span>
                </button>

                <button type="button" className={styles.actionBtnSecondary} onClick={handleNativeShare}>
                  <span>📤</span>
                  <span>모바일 공유</span>
                </button>

                <button
                  type="button"
                  className={styles.actionBtnSecondary}
                  style={{ gridColumn: 'span 2' }}
                  onClick={handleOpenShareText}
                >
                  <span>💬</span>
                  <span>게시글 홍보 텍스트 생성 및 복사</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 🖨️ 테니스 상품권 A4 인쇄 모달 */}
      {showPrintModal && (
        <div className={`${styles.modalOverlay} noPrint`} onClick={() => setShowPrintModal(false)}>
          <div className={styles.printModalBox} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--txt)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🖨️</span>
                  <span>테니스 상품권 A4 인쇄 미리보기</span>
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: 'var(--txt3)' }}>
                  대한민국 10,000원 지폐와 동일한 실물 규격(148mm × 68mm)으로 출력됩니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--txt3)' }}
              >
                ✕
              </button>
            </div>

            {/* 인쇄 매수 및 레이아웃 옵션 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--txt)' }}>📄 페이지당 분할 인쇄:</span>
                {[1, 2, 3, 4].map(n => (
                  <button
                    key={n}
                    type="button"
                    className={`btn btn-sm ${printLayoutCount === n ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '12px', padding: '4px 10px', fontWeight: 700 }}
                    onClick={() => setPrintLayoutCount(n)}
                  >
                    {n}장 {n === 3 ? '(추천 알뜰)' : ''}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="badge badge-green" style={{ fontSize: '11px', padding: '3px 8px' }}>
                  📏 실물 규격: 148 × 68 mm
                </span>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ fontWeight: 800, padding: '7px 18px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  onClick={() => window.print()}
                >
                  <span>🖨️</span>
                  <span>지금 바로 인쇄</span>
                </button>
              </div>
            </div>

            {/* A4 용지 렌더링 미리보기 영역 */}
            <div className={styles.printSheetPreview}>
              <div className={`${styles.printA4Page} printA4TargetArea`}>
                {Array.from({ length: printLayoutCount }).map((_, idx) => (
                  <div key={idx} className={styles.voucherCutItem}>
                    {idx > 0 && (
                      <div className={styles.cutLine}>
                        <span>✂️ 절 취 선 (가위로 잘라 사용하세요)</span>
                      </div>
                    )}
                    {printImageUri && (
                      <img
                        src={printImageUri}
                        alt="테니스 상품권"
                        className={styles.voucherPrintImg}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 💬 홍보 텍스트 공지문 복사 모달 */}
      {showShareModal && (
        <div className={styles.modalOverlay} onClick={() => setShowShareModal(false)}>
          <div className={styles.modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--txt)' }}>
                💬 게시글 홍보 텍스트
              </h3>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--txt3)' }}
              >
                ✕
              </button>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--txt2)', marginBottom: '10px' }}>
              이미지와 함께 당근마켓, 카카오톡 오픈채팅방, 네이버 밴드에 복사해 붙여넣으세요.
            </p>
            <textarea
              className="input"
              style={{ width: '100%', height: '220px', resize: 'vertical', padding: '12px', fontSize: '13px', lineHeight: 1.6 }}
              value={shareText}
              onChange={e => setShareText(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowShareModal(false)}>닫기</button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  navigator.clipboard.writeText(shareText);
                  setCopySuccess(true);
                  setTimeout(() => setCopySuccess(false), 2000);
                }}
              >
                {copySuccess ? '✓ 복사 완료!' : '📋 본문 전체 복사'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 💾 현재 입력값 템플릿 저장 모달 */}
      {showSaveModal && (
        <div className={styles.modalOverlay} onClick={() => setShowSaveModal(false)}>
          <div className={styles.modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--txt)' }}>
                💾 현재 폼 내용 템플릿으로 저장
              </h3>
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--txt3)' }}
              >
                ✕
              </button>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--txt2)', marginBottom: '12px' }}>
              저장해두면 다음번에 작성할 때 언제든지 원클릭으로 다시 불러올 수 있습니다.
            </p>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>템플릿 이름</label>
              <input
                className="input"
                value={saveTemplateName}
                onChange={e => setSaveTemplateName(e.target.value)}
                placeholder="예: 테니스 용품 5만원 구매 상품권 템플릿"
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowSaveModal(false)}>취소</button>
              <button className="btn btn-primary btn-sm" onClick={handleConfirmSaveTemplate}>
                💾 저장하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📂 이전 저장 이력 관리 모달 */}
      {showHistoryModal && (
        <div className={styles.modalOverlay} onClick={() => setShowHistoryModal(false)}>
          <div className={styles.modalBox} style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--txt)' }}>
                📂 저장된 템플릿 목록
              </h3>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--txt3)' }}
              >
                ✕
              </button>
            </div>

            {/* 필터 탭 */}
            <div className={styles.historyFilterBar}>
              <button
                type="button"
                className={`${styles.filterChip} ${historyFilter === 'ALL' ? styles.filterChipActive : ''}`}
                onClick={() => setHistoryFilter('ALL')}
              >
                전체 ({savedHistory.length})
              </button>
              <button
                type="button"
                className={`${styles.filterChip} ${historyFilter === 'member' ? styles.filterChipActive : ''}`}
                onClick={() => setHistoryFilter('member')}
              >
                회원모집
              </button>
              <button
                type="button"
                className={`${styles.filterChip} ${historyFilter === 'guest' ? styles.filterChipActive : ''}`}
                onClick={() => setHistoryFilter('guest')}
              >
                게스트모집
              </button>
              <button
                type="button"
                className={`${styles.filterChip} ${historyFilter === 'court' ? styles.filterChipActive : ''}`}
                onClick={() => setHistoryFilter('court')}
              >
                코트양도
              </button>
              <button
                type="button"
                className={`${styles.filterChip} ${historyFilter === 'fee' ? styles.filterChipActive : ''}`}
                onClick={() => setHistoryFilter('fee')}
              >
                회비안내
              </button>
              <button
                type="button"
                className={`${styles.filterChip} ${historyFilter === 'voucher' ? styles.filterChipActive : ''}`}
                onClick={() => setHistoryFilter('voucher')}
              >
                상품권
              </button>
            </div>

            {/* 이력 리스트 */}
            <div className={styles.historyList}>
              {savedHistory
                .filter(item => historyFilter === 'ALL' || item.category === historyFilter)
                .map(item => (
                  <div
                    key={item.id}
                    className={styles.historyItem}
                    onClick={() => handleApplyTemplate(item)}
                  >
                    <div className={styles.historyInfo}>
                      <div className={styles.historyCategoryBadge}>
                        {item.category === 'member' && '👥 회원모집'}
                        {item.category === 'guest' && '🎾 게스트모집'}
                        {item.category === 'court' && '⚡ 코트양도'}
                        {item.category === 'fee' && '💰 회비안내'}
                        {item.category === 'voucher' && '🎟️ 테니스상품권'}
                      </div>
                      <h4 className={styles.historyItemTitle}>{item.title}</h4>
                      <div className={styles.historyItemDate}>{item.createdAt}</div>
                    </div>
                    <div className={styles.historyItemActions}>
                      <button
                        type="button"
                        className={styles.applyBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApplyTemplate(item);
                        }}
                      >
                        적용
                      </button>
                      <button
                        type="button"
                        className={styles.deleteBtn}
                        onClick={(e) => handleDeleteTemplate(item.id, item.title, e)}
                        title="템플릿 삭제"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowHistoryModal(false)}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

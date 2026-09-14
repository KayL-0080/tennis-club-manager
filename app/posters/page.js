// app/posters/page.js — 테니스 홍보 이미지 제작소 (회원모집 / 게스트모집 / 코트양도)
'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import { getClubSettings } from '@/lib/firestore';
import {
  renderCardToCanvas,
  exportCanvasAsBlob,
  exportCanvasAsDataURL,
  generateShareText
} from '@/lib/canvasCardRenderer';
import styles from './posters.module.css';

export default function PostersPage() {
  const [activeTab, setActiveTab] = useState('member'); // 'member' | 'guest' | 'court'
  const [aspectRatio, setAspectRatio] = useState('1:1'); // '1:1' | '4:5' | '9:16'
  const [bgType, setBgType] = useState('hard'); // 'hard' | 'grass' | 'clay' | 'custom'
  const [customImage, setCustomImage] = useState(null);
  const [clubSettings, setClubSettings] = useState(null);

  // 모달 상태
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareText, setShareText] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

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

  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // 클럽 기본 설정 로드
  useEffect(() => {
    (async () => {
      try {
        const settings = await getClubSettings();
        if (settings) {
          setClubSettings(settings);
          const clubName = settings.clubName || '테친회';
          if (settings.place) {
            setMemberData(prev => ({ ...prev, place: settings.place }));
            setGuestData(prev => ({ ...prev, place: settings.place }));
            setCourtData(prev => ({ ...prev, place: settings.place }));
          }
          if (settings.contact) {
            setMemberData(prev => ({ ...prev, contact: settings.contact }));
            setGuestData(prev => ({ ...prev, contact: settings.contact }));
            setCourtData(prev => ({ ...prev, contact: settings.contact }));
          }
        }
      } catch (err) {
        console.error('Failed to load club settings:', err);
      }
    })();
  }, []);

  // 활성 탭 데이터 반환
  const getCurrentData = useCallback(() => {
    if (activeTab === 'member') return memberData;
    if (activeTab === 'guest') return guestData;
    return courtData;
  }, [activeTab, memberData, guestData, courtData]);

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
    } else {
      setCourtData(prev => {
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
    const tabName = activeTab === 'member' ? '회원모집' : activeTab === 'guest' ? '게스트모집' : '코트양도';
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
    const tabName = activeTab === 'member' ? '회원모집' : activeTab === 'guest' ? '게스트모집' : '코트양도';
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
      // 텍스트 공유 모달 오픈
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

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
      <Navbar />

      <main className={styles.container}>
        {/* 상단 헤더 */}
        <div className={styles.header}>
          <h1 className={styles.title}>
            <span>🎨</span>
            <span>테니스 홍보 이미지 제작소</span>
          </h1>
          <p className={styles.subtitle}>
            인스타그램, 당근마켓, 네이버 밴드, 카카오톡 오픈채팅방에 즉시 공유할 수 있는 감각적인 테니스 카드를 손쉽게 제작하세요.
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
                </span>
              </h2>
              <span style={{ fontSize: '11px', color: 'var(--txt3)' }}>
                실시간 오른쪽 카드에 반영됩니다
              </span>
            </div>

            {/* 코트 배경 디자인 선택 */}
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
                      placeholder="예: 없음 또는 30,000원"
                    />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>정기 회비</label>
                    <input
                      className="input"
                      value={memberData.monthlyFee}
                      onChange={e => setMemberData({ ...memberData, monthlyFee: e.target.value })}
                      placeholder="예: 월 40,000원 / 분기 120,000원"
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
                  <label className={styles.label}>비고 및 특이사항</label>
                  <textarea
                    className="input"
                    style={{ height: '70px', resize: 'vertical' }}
                    value={memberData.notes}
                    onChange={e => setMemberData({ ...memberData, notes: e.target.value })}
                    placeholder="예: 주차 무료, 게스트 1회 참석 후 입회 결정 가능, 2030 열정 동호인 환영"
                  />
                  <div className={styles.chipGroup}>
                    {['주차 무료', '샤워실 완비', '게스트 1회 체험 가능', '2030 환영', '매너 필수'].map(t => (
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
                  <label className={styles.label}>게스트 모집 제목</label>
                  <input
                    className="input"
                    value={guestData.title}
                    onChange={e => setGuestData({ ...guestData, title: e.target.value })}
                    placeholder="예: 일요 정기모임 게스트 2명 모십니다"
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label}>코트 장소</label>
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
                    <label className={styles.label}>연락처</label>
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
                  <label className={styles.label}>비고 및 명의 변경 안내</label>
                  <textarea
                    className="input"
                    style={{ height: '70px', resize: 'vertical' }}
                    value={courtData.notes}
                    onChange={e => setCourtData({ ...courtData, notes: e.target.value })}
                    placeholder="예: 입금 확인 후 즉시 예약 번호 및 명의 변경 안내 드립니다."
                  />
                  <div className={styles.chipGroup}>
                    {['원가 양도', '입금 즉시 명의변경', '조명비 포함', '주차권 지급'].map(t => (
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
              </div>

              {/* 캔버스 뷰어 */}
              <div className={styles.previewCanvasWrapper}>
                <canvas ref={canvasRef} className={styles.previewCanvas} />
              </div>

              {/* 액션 버튼군 */}
              <div className={styles.actionGroup}>
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
    </div>
  );
}

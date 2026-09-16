// components/InstallAppModal.js — 모바일 홈 화면 웹/앱 추가 안내 모달
'use client';
import { useState, useEffect } from 'react';

export default function InstallAppModal({ isOpen, onClose, deferredPrompt, onInstallSuccess }) {
  const [isIOS, setIsIOS] = useState(false);
  const [isKakao, setIsKakao] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ua = navigator.userAgent || '';
    const isIOSDevice = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isKakaoTalk = /KAKAOTALK/i.test(ua);
    const isAndroidDevice = /android/i.test(ua);
    const standaloneMode = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

    setIsIOS(isIOSDevice);
    setIsKakao(isKakaoTalk);
    setIsAndroid(isAndroidDevice);
    setIsStandalone(standaloneMode);
  }, [isOpen]);

  if (!isOpen) return null;

  // 안드로이드 / 크롬 네이티브 A2HS 프롬프트 트리거
  const handleNativeInstall = async () => {
    if (!deferredPrompt) return;
    try {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        if (onInstallSuccess) onInstallSuccess();
        onClose();
      }
    } catch (err) {
      console.error('Install prompt error:', err);
    }
  };

  // 사이트 URL 클립보드 복사 (카카오톡 인앱 브라우저용)
  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      alert('주소 복사에 실패했습니다. 브라우저 주소창을 직접 복사해주세요.');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          width: '100%',
          maxWidth: '460px',
          maxHeight: '90vh',
          borderRadius: '22px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.25)',
          overflowY: 'auto',
          border: '1px solid rgba(255, 255, 255, 0.8)',
          boxSizing: 'border-box',
          padding: '24px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img
              src="/apple-touch-icon.png"
              alt="테친회 로고"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                objectFit: 'cover',
                boxShadow: '0 4px 10px rgba(0,0,0,0.12)',
                border: '1.5px solid #fff'
              }}
            />
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--navy, #0f172a)' }}>
                📲 홈 화면에 앱 추가하기
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--txt3, #64748b)' }}>
                Tennis Match — 테친회 모바일 웹/앱
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              fontSize: '16px',
              cursor: 'pointer',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold'
            }}
          >
            ✕
          </button>
        </div>

        {/* 안내 요약 */}
        <div
          style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '12px 14px',
            fontSize: '12.5px',
            lineHeight: 1.55,
            color: '#334155'
          }}
        >
          스마트폰 홈 화면에 추가하시면 별도의 앱스토어 설치 없이 <strong>바탕화면의 테친회 아이콘</strong>을 눌러 주소창 없는 전체 화면 앱으로 언제든지 빠르고 편리하게 이용하실 수 있습니다.
        </div>

        {/* CASE 1: 이미 홈 화면 앱으로 실행 중인 경우 */}
        {isStandalone && (
          <div
            style={{
              backgroundColor: '#f0fdf4',
              border: '1px solid #86efac',
              borderRadius: '14px',
              padding: '14px',
              textAlign: 'center'
            }}
          >
            <div style={{ fontSize: '24px', marginBottom: '6px' }}>🎉</div>
            <strong style={{ color: '#166534', fontSize: '14px' }}>
              이미 홈 화면 앱으로 실행 중입니다!
            </strong>
            <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#15803d' }}>
              현재 주소창 없이 전체 화면 웹/앱 모드로 쾌적하게 실행되고 있습니다.
            </p>
          </div>
        )}

        {/* CASE 2: 안드로이드 / 크롬 네이티브 원클릭 설치 버튼이 준비된 경우 */}
        {!isStandalone && deferredPrompt && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '14px',
                fontWeight: 800,
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                backgroundColor: '#16a34a',
                borderColor: '#16a34a'
              }}
              onClick={handleNativeInstall}
            >
              <span>📲</span>
              <span>지금 바로 홈 화면에 앱 설치하기</span>
            </button>
            <p style={{ margin: 0, fontSize: '11px', textAlign: 'center', color: '#64748b' }}>
              버튼을 누르면 브라우저의 공식 앱 설치 창이 팝업됩니다.
            </p>
          </div>
        )}

        {/* CASE 3: 카카오톡 인앱 브라우저 접속인 경우 경고 & 안내 */}
        {!isStandalone && isKakao && (
          <div
            style={{
              backgroundColor: '#fefce8',
              border: '1px solid #fde047',
              borderRadius: '14px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '18px' }}>⚠️</span>
              <strong style={{ color: '#854d0e', fontSize: '13.5px' }}>
                카카오톡 브라우저에서는 홈 화면 추가가 제한됩니다
              </strong>
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: '#713f12', lineHeight: 1.5 }}>
              카카오톡 인앱 브라우저 보안 정책상 홈 화면 추가가 차단되어 있습니다. <strong>기본 브라우저(Safari 또는 Chrome)</strong>로 열어주세요!
            </p>
            <div
              style={{
                backgroundColor: '#ffffff',
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid #fef08a',
                fontSize: '12px'
              }}
            >
              <div style={{ fontWeight: 700, color: '#854d0e', marginBottom: '4px' }}>📌 사파리 / 크롬으로 여는 방법:</div>
              <ol style={{ margin: 0, paddingLeft: '16px', color: '#451a03', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <li>카카오톡 화면 우측 하단(또는 상단) <strong>메뉴(⋮ 또는 ⋯)</strong> 터치</li>
                <li><strong>[다른 브라우저로 열기]</strong> (Safari 또는 Chrome) 선택</li>
                <li>열린 브라우저에서 '홈화면추가' 버튼 다시 누르기</li>
              </ol>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ width: '100%', fontSize: '12px', fontWeight: 700 }}
              onClick={handleCopyUrl}
            >
              {copied ? '✓ 사이트 주소 복사 완료!' : '🔗 사이트 주소 복사하기'}
            </button>
          </div>
        )}

        {/* CASE 4: 아이폰 / 아이패드 (iOS Safari) 가이드 */}
        {!isStandalone && isIOS && (
          <div
            style={{
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '14px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '18px' }}>🍎</span>
              <strong style={{ color: '#1e40af', fontSize: '13.5px' }}>
                아이폰 (Safari) 홈 화면 추가 방법
              </strong>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: '#1e3a8a' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span
                  style={{
                    background: '#2563eb',
                    color: '#fff',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 800,
                    flexShrink: 0,
                    marginTop: '1px'
                  }}
                >
                  1
                </span>
                <span>
                  사파리 화면 <strong>하단 중앙의 공유 버튼</strong> (네모 위 화살표 <strong style={{ fontSize: '13px' }}>⎋</strong> 또는 <strong style={{ fontSize: '13px' }}>⬆</strong>)을 터치합니다.
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span
                  style={{
                    background: '#2563eb',
                    color: '#fff',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 800,
                    flexShrink: 0,
                    marginTop: '1px'
                  }}
                >
                  2
                </span>
                <span>
                  공유 메뉴 창을 아래로 조금 내려 <strong>[홈 화면에 추가 ➕]</strong> 항목을 선택합니다.
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span
                  style={{
                    background: '#2563eb',
                    color: '#fff',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 800,
                    flexShrink: 0,
                    marginTop: '1px'
                  }}
                >
                  3
                </span>
                <span>
                  화면 우측 상단의 <strong>[추가]</strong> 버튼을 누르면 스마트폰 바탕화면에 테친회 앱이 완성됩니다!
                </span>
              </div>
            </div>
          </div>
        )}

        {/* CASE 5: 안드로이드 (Chrome / 삼성인터넷) 가이드 */}
        {!isStandalone && !isIOS && !deferredPrompt && (
          <div
            style={{
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '14px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '18px' }}>🤖</span>
              <strong style={{ color: '#166534', fontSize: '13.5px' }}>
                안드로이드 (Chrome / 삼성인터넷) 추가 방법
              </strong>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: '#14532d' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span
                  style={{
                    background: '#16a34a',
                    color: '#fff',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 800,
                    flexShrink: 0,
                    marginTop: '1px'
                  }}
                >
                  1
                </span>
                <span>
                  브라우저 우측 상단(또는 하단) <strong>메뉴 버튼(점 3개 ⋮ 또는 ≡)</strong>을 터치합니다.
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span
                  style={{
                    background: '#16a34a',
                    color: '#fff',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 800,
                    flexShrink: 0,
                    marginTop: '1px'
                  }}
                >
                  2
                </span>
                <span>
                  메뉴 목록에서 <strong>[홈 화면에 추가]</strong> 또는 <strong>[앱 설치]</strong>를 선택합니다.
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span
                  style={{
                    background: '#16a34a',
                    color: '#fff',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 800,
                    flexShrink: 0,
                    marginTop: '1px'
                  }}
                >
                  3
                </span>
                <span>
                  안내 팝업에서 <strong>[설치]</strong> 또는 <strong>[추가]</strong>를 누르면 완료됩니다.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ padding: '6px 18px', fontSize: '13px', borderRadius: '10px' }}
            onClick={onClose}
          >
            확인 및 닫기
          </button>
        </div>
      </div>
    </div>
  );
}

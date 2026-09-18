// components/RoleDutiesModal.js — 운영진 직책별 주요 업무 가이드 모달
'use client';
import { useState, useEffect, useRef } from 'react';
import { IconClipboardList, IconChevronDown } from './Icons';

export const ROLE_DUTIES_DATA = [
  {
    id: 'president',
    role: '회장',
    shortName: '회장',
    emoji: '👑',
    badge: '👑 클럽 대표',
    themeColor: '#1d4ed8',
    headerBg: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
    headerBgActive: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
    borderColor: '#93c5fd',
    badgeBg: '#dbeafe',
    badgeColor: '#1e40af',
    iconBg: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
    coreRole: '클럽 대표 및 총괄',
    description: '동호회를 대내외적으로 대표하며, 클럽의 전반적인 운영 방향성과 장기 발전 계획을 총괄 지휘합니다.',
    tasks: [
      '동호회 총괄 운영 및 연간 주요 일정·사업 계획 최종 수립',
      '회칙 제·개정, 코트 대관 및 특별 예산 승인 등 주요 안건 최종 결정 및 공지',
      '정기총회 및 임시총회 소집·주재',
      '회원 간 갈등 중재, 신입 회원 웰컴 멘토 지정 및 클럽 매너 관리 총괄'
    ],
    collaborations: [
      {
        partner: '부회장',
        type: '회장단 상시 협의 및 권한 위임',
        partnerColor: '#3730a3',
        partnerBg: '#e0e7ff',
        detail: '클럽 주요 정책 사전 협의, 대외 교류전 및 대형 행사 추진 역할 분담'
      },
      {
        partner: '전체 운영진',
        type: '최종 의결 및 총괄 조율',
        partnerColor: '#1e40af',
        partnerBg: '#dbeafe',
        detail: '운영위원회 주요 안건 최종 의결 및 운영진 전체 업무 총괄 조율'
      }
    ]
  },
  {
    id: 'vice_president',
    role: '부회장',
    shortName: '부회장',
    emoji: '🥈',
    badge: '🥈 회장 보좌·총괄 지원',
    themeColor: '#4f46e5',
    headerBg: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
    headerBgActive: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)',
    borderColor: '#a5b4fc',
    badgeBg: '#e0e7ff',
    badgeColor: '#3730a3',
    iconBg: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
    coreRole: '회장 보좌, 대내외 협력 및 행사 총괄',
    description: '회장을 보좌하고 유고 시 직무를 대행하며, 타 클럽과의 친선 교류전 추진, 클럽 대회 및 총회 등 주요 행사 기획, 회원 간 소통과 화합을 총괄 지원합니다.',
    tasks: [
      '회장 보좌 및 회장 유고 시 클럽 대표 직무 대행',
      '타 클럽과의 친선 교류전 추진 및 지역 연합회 등 대외 협력 소통 창구 총괄',
      '분기별 정기대회(월례대회, 청백전, 왕중왕전), 야유회(MT) 및 총회 등 특별 행사 기획·진행 총괄',
      '행사 상품·트로피 선정 및 찬조금/찬조물품 접수 관리',
      '신입 회원 적응 지원, 회원 건의사항 수렴 및 클럽 내 화합과 결속력 도모',
      '운영위원회 안건 사전 조율 및 각 직책(총무·경기·운영) 간 유기적 협업 체계 지원'
    ],
    collaborations: [
      {
        partner: '회장',
        type: '대표 직무 보좌 및 대행',
        partnerColor: '#1e40af',
        partnerBg: '#dbeafe',
        detail: '클럽 중장기 운영 방향 수립 및 회장 유고 시 대표 권한 대행 협업'
      },
      {
        partner: '경기이사',
        type: '대회 기획 및 경기 운영 연계',
        partnerColor: '#ea580c',
        partnerBg: '#ffedd5',
        detail: '친선 교류전 및 정기대회 기획(부회장)과 대진표 편성·룰 집행(경기이사) 협업'
      },
      {
        partner: '운영이사',
        type: '행사 코트 대관 및 비품 조율',
        partnerColor: '#7c3aed',
        partnerBg: '#ede9fe',
        detail: '대외 교류전 및 연간 행사 진행을 위한 전용 코트 대관 확보 및 비품 지원'
      },
      {
        partner: '총무',
        type: '행사 예산 수립 및 찬조금 정산',
        partnerColor: '#059669',
        partnerBg: '#d1fae5',
        detail: '대회 및 행사 예산 수립, 찬조금 관리 및 사후 정산 보고 협력'
      }
    ]
  },
  {
    id: 'treasurer',
    role: '총무',
    shortName: '총무',
    emoji: '💰',
    badge: '💰 재정·행정',
    themeColor: '#059669',
    headerBg: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
    headerBgActive: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
    borderColor: '#86efac',
    badgeBg: '#d1fae5',
    badgeColor: '#065f46',
    iconBg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    coreRole: '재정 및 행정 총괄',
    description: '클럽의 살림살이와 회계의 투명성을 책임지며, 회비 수납 및 지출 정산을 관리합니다.',
    tasks: [
      '월회비, 가입비, 게스트비 수납 및 관리',
      '코트비, 시합구, 음료 등 지출 정산 및 투명한 결산 보고',
      '회원 명부 최신화, 장기 병가/휴회자 회비 이월·정산 처리',
      '대회 참가비 및 찬조금 입금 관리'
    ],
    collaborations: [
      {
        partner: '회장단',
        type: '결산 보고 및 예산 협의',
        partnerColor: '#1e40af',
        partnerBg: '#dbeafe',
        detail: '월별 회계 결산 내역 보고 및 분기별 주요 사업 예산 집행 협의'
      },
      {
        partner: '운영이사',
        type: '물품 구매 예산 집행',
        partnerColor: '#7c3aed',
        partnerBg: '#ede9fe',
        detail: '시합구/구급약품 등 비품 구매 및 코트비 지출 예산 집행 연계'
      },
      {
        partner: '부회장',
        type: '행사 예산 집행',
        partnerColor: '#3730a3',
        partnerBg: '#e0e7ff',
        detail: '친선대회/교류전 행사비 및 뒤풀이 비용 정산 연계'
      }
    ]
  },
  {
    id: 'match_director',
    role: '경기이사',
    shortName: '경기이사',
    emoji: '🎾',
    badge: '🎾 경기·실력',
    themeColor: '#ea580c',
    headerBg: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
    headerBgActive: 'linear-gradient(135deg, #ffedd5 0%, #fed7aa 100%)',
    borderColor: '#fdba74',
    badgeBg: '#ffedd5',
    badgeColor: '#9a3412',
    iconBg: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
    coreRole: '경기 진행 및 실력 관리',
    description: '공정하고 재미있는 코트 플레이를 위해 대진표 밸런스와 경기 룰 및 회원 실력을 관리합니다.',
    tasks: [
      '정기 모임 및 팀전(청백전) 대진표 작성 (NTRP/성별 밸런스 매칭)',
      '공평한 게임 수(1인당 N게임 보장) 및 휴식 로테이션 관리',
      '경기 룰 확정(타임아웃제, 노애드 등) 및 네트 높이(91.4cm) 점검',
      '신입/게스트 실력 객관적 파악 및 월별 승점(Top 3) 관리'
    ],
    collaborations: [
      {
        partner: '부회장',
        type: '대회 기획 및 경기 집행 전담',
        partnerColor: '#3730a3',
        partnerBg: '#e0e7ff',
        detail: '분기/친선 교류 대회 기획(부회장)과 대진표 구성 및 현장 경기 룰 집행(경기이사) 협업'
      }
    ]
  },
  {
    id: 'operations_director',
    role: '운영이사',
    shortName: '운영이사',
    emoji: '🏟️',
    badge: '🏟️ 코트·비품',
    themeColor: '#7c3aed',
    headerBg: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
    headerBgActive: 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)',
    borderColor: '#d8b4fe',
    badgeBg: '#ede9fe',
    badgeColor: '#5b21b6',
    iconBg: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
    coreRole: '코트·비품 및 현장 운영',
    description: '회원들이 쾌적하게 운동할 수 있도록 코트 예약, 물품 구비 및 당일 현장을 총괄 운영합니다.',
    tasks: [
      '정기/비정기 모임 코트 예약 및 유휴 코트 양도/취소 관리',
      '시합구 구매·재고 관리 및 기본 비품(구급약품 등) 구비',
      '인원 부족 시 게스트 모집 공지 및 오리엔테이션 진행',
      '당일 코트 개방 및 현장 기본 환경 점검'
    ],
    collaborations: [
      {
        partner: '총무',
        type: '코트비/용품비 지출 연계',
        partnerColor: '#059669',
        partnerBg: '#d1fae5',
        detail: '코트 대관비 및 시합구/비품 구입 비용 정산 연계'
      },
      {
        partner: '부회장',
        type: '교류전/행사 코트 대관 지원',
        partnerColor: '#3730a3',
        partnerBg: '#e0e7ff',
        detail: '대외 친선 교류전 및 특별 행사 진행을 위한 전용 코트 대관 확보 지원'
      }
    ]
  }
];

export default function RoleDutiesModal({ isOpen, onClose }) {
  const [selectedRole, setSelectedRole] = useState('all');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' (아코디언) | 'table' (한눈에 표)

  // 각 직책별 펼침/접힘 상태 (초기: 전체 모두 펼침 상태로 하여 사용자가 즉시 모든 내용을 확인할 수 있게 지원)
  const [openRoles, setOpenRoles] = useState({
    president: true,
    vice_president: true,
    treasurer: true,
    match_director: true,
    operations_director: true
  });

  const scrollRef = useRef(null);

  const toggleRole = (roleId) => {
    setOpenRoles((prev) => ({
      ...prev,
      [roleId]: !prev[roleId]
    }));
  };

  const handleSelectTab = (roleId) => {
    setSelectedRole(roleId);
    if (roleId !== 'all') {
      // 특정 탭 선택 시 해당 직책을 반드시 펼침 상태로 설정
      setOpenRoles((prev) => ({
        ...prev,
        [roleId]: true
      }));
    }
    // 스크롤 상단 리셋
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  };

  // 모든 직책이 펼쳐져 있는지 확인
  const isAllOpen = ROLE_DUTIES_DATA.every((r) => openRoles[r.id]);

  // 전체 펼치기 / 접기
  const handleToggleAll = () => {
    if (isAllOpen) {
      // 모두 접기
      const closedObj = {};
      ROLE_DUTIES_DATA.forEach((r) => { closedObj[r.id] = false; });
      setOpenRoles(closedObj);
    } else {
      // 모두 펼치기 (전체 보기를 선택하고 모든 직책 펼침)
      setSelectedRole('all');
      const openedObj = {};
      ROLE_DUTIES_DATA.forEach((r) => { openedObj[r.id] = true; });
      setOpenRoles(openedObj);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const displayList = selectedRole === 'all'
    ? ROLE_DUTIES_DATA
    : ROLE_DUTIES_DATA.filter((r) => r.id === selectedRole);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.78)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        zIndex: 2000000, // 모바일 하단 내비게이션 바(999999)보다 높은 최상위 레이어
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px',
        paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
        boxSizing: 'border-box',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          width: '100%',
          maxWidth: '880px',
          height: 'calc(100dvh - 32px - env(safe-area-inset-bottom, 0px))',
          maxHeight: 'calc(100dvh - 32px - env(safe-area-inset-bottom, 0px))',
          borderRadius: '20px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.38)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid rgba(255, 255, 255, 0.8)',
          boxSizing: 'border-box'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모달 상단 헤더 */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#f8fafc',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #007aff 0%, #0056b3 100%)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 3px 10px rgba(0, 122, 255, 0.25)',
                flexShrink: 0
              }}
            >
              <IconClipboardList size={18} color="#ffffff" />
            </span>
            <div>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                직책별 주요 업무 가이드
              </h2>
              <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--txt3)', marginTop: '2px' }}>
                운영진 5대 직책의 핵심 역할, 세부 업무 및 주 협업 체계
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: '#e2e8f0',
              color: '#475569',
              fontSize: '18px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s',
              lineHeight: 1
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#cbd5e1')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#e2e8f0')}
            title="닫기 (Esc)"
          >
            ✕
          </button>
        </div>

        {/* 상단 탭 필터 & 전체 펼치기 / 보기 모드 바 */}
        <div
          style={{
            padding: '8px 14px',
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            flexShrink: 0,
            flexWrap: 'wrap'
          }}
        >
          {/* 가로 스크롤 직책 탭 */}
          <div
            style={{
              display: 'flex',
              gap: '6px',
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              flex: '1 1 auto',
              minWidth: '220px'
            }}
          >
            <button
              type="button"
              onClick={() => handleSelectTab('all')}
              style={{
                padding: '5px 12px',
                borderRadius: '16px',
                fontSize: '12px',
                fontWeight: selectedRole === 'all' ? 800 : 600,
                backgroundColor: selectedRole === 'all' ? '#0f172a' : '#f1f5f9',
                color: selectedRole === 'all' ? '#ffffff' : '#64748b',
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              전체 보기 (5)
            </button>
            {ROLE_DUTIES_DATA.map((item) => {
              const isSelected = selectedRole === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectTab(item.id)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '16px',
                    fontSize: '12px',
                    fontWeight: isSelected ? 800 : 600,
                    backgroundColor: isSelected ? item.themeColor : '#f1f5f9',
                    color: isSelected ? '#ffffff' : '#475569',
                    border: isSelected ? `1px solid ${item.themeColor}` : '1px solid transparent',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span>{item.emoji}</span>
                  <span>{item.shortName}</span>
                </button>
              );
            })}
          </div>

          {/* 우측 컨트롤: 뷰 모드 토글 및 전체 펼치기/접기 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            {/* 전체 펼치기 / 전체 접기 버튼 */}
            <button
              type="button"
              onClick={handleToggleAll}
              style={{
                padding: '5px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                backgroundColor: isAllOpen ? '#eff6ff' : '#f8fafc',
                border: isAllOpen ? '1px solid #93c5fd' : '1px solid #cbd5e1',
                color: isAllOpen ? '#1d4ed8' : '#334155',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
              }}
              title={isAllOpen ? '모든 직책 업무 내용 접기' : '모든 직책 업무 내용 펼쳐보기'}
            >
              <span>{isAllOpen ? '전체 접기 🔼' : '전체 펼치기 🔽'}</span>
            </button>

            {/* 표 / 카드 뷰 전환 */}
            <button
              type="button"
              onClick={() => setViewMode(prev => prev === 'cards' ? 'table' : 'cards')}
              style={{
                padding: '5px 10px',
                borderRadius: '8px',
                fontSize: '11.5px',
                fontWeight: 700,
                backgroundColor: viewMode === 'table' ? '#0f172a' : '#f1f5f9',
                border: '1px solid #cbd5e1',
                color: viewMode === 'table' ? '#ffffff' : '#475569',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
              title="한눈에 표로 보기 / 카드 뷰 전환"
            >
              {viewMode === 'cards' ? '📊 표로 보기' : '🗂️ 카드 뷰'}
            </button>
          </div>
        </div>

        {/* 본문 스크롤 영역 (flex: 1 1 0, height: 0, minHeight: 0 적용으로 스크롤바 100% 보장) */}
        <div
          ref={scrollRef}
          style={{
            flex: '1 1 0',
            height: '0px',
            minHeight: 0,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            padding: '16px 16px 36px 16px',
            backgroundColor: '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          {viewMode === 'table' ? (
            /* ── 한눈에 보는 원본 표 뷰 (Table View) ── */
            <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid #cbd5e1', overflowX: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left', minWidth: '680px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                    <th style={{ padding: '12px 14px', width: '90px', fontWeight: 800, color: '#1e293b' }}>직책</th>
                    <th style={{ padding: '12px 14px', width: '150px', fontWeight: 800, color: '#1e293b' }}>핵심 역할</th>
                    <th style={{ padding: '12px 14px', fontWeight: 800, color: '#1e293b' }}>주요 세부 업무</th>
                    <th style={{ padding: '12px 14px', width: '220px', fontWeight: 800, color: '#1e293b' }}>주 협업 포인트</th>
                  </tr>
                </thead>
                <tbody>
                  {displayList.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0', verticalAlign: 'top' }}>
                      <td style={{ padding: '14px', fontWeight: 800, color: item.themeColor, backgroundColor: '#fafafa' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>{item.emoji}</span>
                          <span>{item.role}</span>
                        </div>
                      </td>
                      <td style={{ padding: '14px', fontWeight: 700, color: '#334155' }}>
                        {item.coreRole}
                      </td>
                      <td style={{ padding: '14px' }}>
                        <ul style={{ margin: 0, paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '5px', lineHeight: 1.5, color: '#1e293b' }}>
                          {item.tasks.map((t, idx) => (
                            <li key={idx}>{t}</li>
                          ))}
                        </ul>
                      </td>
                      <td style={{ padding: '14px', fontSize: '12px', color: '#475569' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {item.collaborations.map((c, cIdx) => (
                            <div key={cIdx} style={{ lineHeight: 1.4 }}>
                              <strong style={{ color: c.partnerColor }}>{c.partner}</strong>: {c.detail || c.type}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* ── 카드 아코디언 뷰 (Card Accordion View) ── */
            displayList.map((item) => {
              const isOpen = !!openRoles[item.id];
              return (
                <div
                  key={item.id}
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '14px',
                    border: `1.5px solid ${isOpen ? item.borderColor : '#e2e8f0'}`,
                    boxShadow: isOpen ? '0 6px 18px rgba(0, 0, 0, 0.06)' : '0 2px 6px rgba(0, 0, 0, 0.02)',
                    overflow: 'hidden',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    flexShrink: 0
                  }}
                >
                  {/* 직책 카드 헤더 (전체 클릭 가능 버튼) */}
                  <div
                    onClick={() => toggleRole(item.id)}
                    style={{
                      padding: '12px 16px',
                      background: isOpen ? item.headerBgActive : item.headerBg,
                      borderBottom: isOpen ? `1px solid ${item.borderColor}` : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      userSelect: 'none',
                      gap: '10px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                      <span
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '10px',
                          background: item.iconBg,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '18px',
                          color: '#ffffff',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
                          flexShrink: 0
                        }}
                      >
                        {item.emoji}
                      </span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                            {item.role}
                          </span>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              backgroundColor: item.badgeBg,
                              color: item.badgeColor,
                              padding: '2px 7px',
                              borderRadius: '6px',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {item.badge}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px', fontWeight: 600 }}>
                          <span style={{ color: item.themeColor, fontWeight: 800 }}>[핵심 역할]</span> {item.coreRole}
                        </div>
                      </div>
                    </div>

                    {/* 우측 명시적인 '업무보기' / '접기' 버튼 */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleRole(item.id);
                      }}
                      style={{
                        fontSize: '12px',
                        fontWeight: 800,
                        color: isOpen ? '#ffffff' : item.themeColor,
                        padding: '6px 12px',
                        borderRadius: '10px',
                        backgroundColor: isOpen ? item.themeColor : '#ffffff',
                        border: `1.5px solid ${item.themeColor}`,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        cursor: 'pointer',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.06)',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        transition: 'all 0.15s ease'
                      }}
                      title={isOpen ? '상세 업무 접기' : '모든 세부 업무 및 협업 내용 펼쳐보기'}
                    >
                      <span>{isOpen ? '내용 접기' : '업무 보기'}</span>
                      <span
                        style={{
                          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.2s ease',
                          display: 'inline-flex'
                        }}
                      >
                        <IconChevronDown size={14} color={isOpen ? '#ffffff' : item.themeColor} />
                      </span>
                    </button>
                  </div>

                  {/* 아코디언 본문 (열렸을 때 모든 세부 내용 완벽 표시) */}
                  {isOpen && (
                    <div
                      style={{
                        padding: '16px 18px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '14px',
                        backgroundColor: '#ffffff',
                        animation: 'fadeIn 0.2s ease-out'
                      }}
                    >
                      {/* 설명 */}
                      <div style={{ fontSize: '12.5px', color: '#64748b', lineHeight: 1.45, fontWeight: 500, paddingBottom: '4px', borderBottom: '1px dashed #f1f5f9' }}>
                        💡 {item.description}
                      </div>

                      {/* 1. 주요 세부 업무 (모든 항목 완전 표시) */}
                      <div>
                        <div
                          style={{
                            fontSize: '13px',
                            fontWeight: 800,
                            color: '#1e293b',
                            marginBottom: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <span style={{ color: item.themeColor }}>📌</span>
                          <span>주요 세부 업무 ({item.tasks.length}개 항목)</span>
                        </div>
                        <ul
                          style={{
                            margin: 0,
                            padding: 0,
                            listStyle: 'none',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}
                        >
                          {item.tasks.map((task, tIdx) => (
                            <li
                              key={tIdx}
                              style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '10px',
                                backgroundColor: '#f8fafc',
                                padding: '10px 14px',
                                borderRadius: '8px',
                                border: '1px solid #f1f5f9',
                                fontSize: '13px',
                                lineHeight: 1.5,
                                color: '#0f172a'
                              }}
                            >
                              <span
                                style={{
                                  width: '6px',
                                  height: '6px',
                                  borderRadius: '50%',
                                  backgroundColor: item.themeColor,
                                  marginTop: '7px',
                                  flexShrink: 0
                                }}
                              />
                              <span style={{ flex: 1, wordBreak: 'keep-all' }}>{task}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* 2. 주 협업 포인트 (모든 파트너 및 연계 내용 완전 표시) */}
                      <div
                        style={{
                          backgroundColor: '#ffffff',
                          border: '1.5px dashed #cbd5e1',
                          borderRadius: '10px',
                          padding: '12px 14px'
                        }}
                      >
                        <div
                          style={{
                            fontSize: '13px',
                            fontWeight: 800,
                            color: '#334155',
                            marginBottom: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <span>🤝</span>
                          <span>주 협업 포인트 ({item.collaborations.length}개 연계)</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {item.collaborations.map((collab, cIdx) => (
                            <div
                              key={cIdx}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                flexWrap: 'wrap',
                                fontSize: '12.5px',
                                color: '#334155'
                              }}
                            >
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  backgroundColor: collab.partnerBg,
                                  color: collab.partnerColor,
                                  fontWeight: 800,
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontSize: '11.5px',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                <span>{collab.partner}</span>
                                <span style={{ opacity: 0.6, fontSize: '10px' }}>연계</span>
                              </span>
                              <span style={{ fontWeight: 700, color: '#0f172a' }}>
                                {collab.type}:
                              </span>
                              <span style={{ color: '#64748b' }}>
                                {collab.detail}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* 하단 고정 푸터 바 (절대 가려지지 않음) */}
        <div
          style={{
            padding: '12px 18px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#ffffff',
            flexShrink: 0,
            flexWrap: 'wrap',
            gap: '10px',
            boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.03)'
          }}
        >
          <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>💡</span>
            <span>우측 상단의 [전체 펼치기]나 [📊 표로 보기]로도 한눈에 확인하실 수 있습니다.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '9px 24px',
              borderRadius: '10px',
              backgroundColor: '#0f172a',
              color: '#ffffff',
              border: 'none',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              marginLeft: 'auto',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#1e293b')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#0f172a')}
          >
            확인 및 닫기
          </button>
        </div>
      </div>
    </div>
  );
}

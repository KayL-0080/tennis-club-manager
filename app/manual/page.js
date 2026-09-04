'use client';
import { useState } from 'react';
import Navbar from '@/components/Navbar';

export default function ManualPage() {
  const [activeTab, setActiveTab] = useState('user');
  const [searchQuery, setSearchQuery] = useState('');
  
  const allUserKeys = ['user-pwa', 'user-dashboard', 'user-votes', 'user-tournaments', 'user-stats'];
  const allAdminKeys = ['admin-login', 'admin-create', 'admin-editor', 'admin-tournaments', 'admin-members'];

  const [openSections, setOpenSections] = useState({
    'user-pwa': true,
    'user-dashboard': true,
    'user-votes': true,
    'user-tournaments': true,
    'user-stats': true,
    'admin-login': true,
    'admin-create': true,
    'admin-editor': true,
    'admin-tournaments': true,
    'admin-members': true,
  });

  const toggleSection = (id) => {
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => {
    const keys = activeTab === 'user' ? allUserKeys : allAdminKeys;
    setOpenSections(prev => {
      const next = { ...prev };
      keys.forEach(k => next[k] = true);
      return next;
    });
  };

  const collapseAll = () => {
    const keys = activeTab === 'user' ? allUserKeys : allAdminKeys;
    setOpenSections(prev => {
      const next = { ...prev };
      keys.forEach(k => next[k] = false);
      return next;
    });
  };

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '100px' }}>
      <Navbar />
      <main style={{ maxWidth: '960px', margin: '0 auto', padding: '24px 16px' }}>
        {/* Header Hero */}
        <div style={{ 
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', 
          borderRadius: '16px', 
          padding: '24px 28px', 
          color: '#ffffff',
          boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <img 
              src="/apple-touch-icon.png" 
              alt="테친회 로고" 
              style={{ width: '48px', height: '48px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.8)', objectFit: 'cover' }} 
            />
            <div>
              <div style={{ fontSize: '12px', color: '#93c5fd', fontWeight: 700, letterSpacing: '0.05em' }}>TENNIS CRAZY CLUB</div>
              <h1 style={{ margin: '2px 0 0 0', fontSize: '22px', fontWeight: 800 }}>Tennis Match 서비스 이용 매뉴얼</h1>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#cbd5e1' }}>
                일반 회원을 위한 사용자 매뉴얼 및 클럽 임원진을 위한 운영자 매뉴얼
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              type="button" 
              className="btn btn-secondary btn-sm"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', fontSize: '12px' }}
              onClick={() => window.print()}
            >
              🖨️ 매뉴얼 인쇄
            </button>
          </div>
        </div>

        {/* Tab & Control Bar (전체 펼치기 / 모으기 & 검색) */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          flexWrap: 'wrap', 
          gap: '12px', 
          backgroundColor: '#ffffff', 
          padding: '12px 18px', 
          borderRadius: '12px',
          border: '1px solid var(--border)',
          marginBottom: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', backgroundColor: '#e2e8f0', borderRadius: '10px', padding: '3px', gap: '3px' }}>
            <button
              type="button"
              onClick={() => setActiveTab('user')}
              style={{
                border: 'none',
                padding: '8px 18px',
                fontSize: '14px',
                fontWeight: activeTab === 'user' ? 800 : 600,
                backgroundColor: activeTab === 'user' ? '#ffffff' : 'transparent',
                color: activeTab === 'user' ? 'var(--blue)' : 'var(--txt2)',
                borderRadius: '8px',
                cursor: 'pointer',
                boxShadow: activeTab === 'user' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              👤 사용자 매뉴얼 (회원용)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              style={{
                border: 'none',
                padding: '8px 18px',
                fontSize: '14px',
                fontWeight: activeTab === 'admin' ? 800 : 600,
                backgroundColor: activeTab === 'admin' ? '#2563eb' : 'transparent',
                color: activeTab === 'admin' ? '#ffffff' : 'var(--txt2)',
                borderRadius: '8px',
                cursor: 'pointer',
                boxShadow: activeTab === 'admin' ? '0 2px 6px rgba(37,99,235,0.3)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              🔐 운영자 매뉴얼 (관리자용)
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{
                  padding: '4px 10px',
                  fontSize: '12px',
                  height: '32px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  borderRadius: '8px',
                  backgroundColor: '#f8fafc',
                  borderColor: '#cbd5e1',
                  color: '#334155',
                  fontWeight: 700
                }}
                onClick={expandAll}
                title="모든 항목 펼치기"
              >
                <span>📂</span>
                <span>모두 펼치기</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{
                  padding: '4px 10px',
                  fontSize: '12px',
                  height: '32px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  borderRadius: '8px',
                  backgroundColor: '#f8fafc',
                  borderColor: '#cbd5e1',
                  color: '#334155',
                  fontWeight: 700
                }}
                onClick={collapseAll}
                title="모든 항목 접기"
              >
                <span>📁</span>
                <span>모두 모으기</span>
              </button>
            </div>

            <input
              type="text"
              className="input input-sm"
              placeholder="🔍 매뉴얼 검색..."
              style={{ width: '220px', fontSize: '13px', padding: '6px 12px', height: '32px' }}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Content Body */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px', lineHeight: '1.7' }}>

          {/* ======================================================== */}
          {/* USER MANUAL TAB */}
          {/* ======================================================== */}
          {activeTab === 'user' && (
            <>
              {/* Section 1: Home Screen PWA */}
              <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <div 
                  style={{ 
                    padding: '14px 18px', 
                    backgroundColor: '#f0fdf4', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    cursor: 'pointer', 
                    fontWeight: 800, 
                    color: '#166534', 
                    fontSize: '15px',
                    userSelect: 'none',
                    transition: 'background-color 0.15s ease'
                  }}
                  onClick={() => toggleSection('user-pwa')}
                  title="클릭하여 상세 내용 펼치기/접기"
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    📱 1. 모바일 앱처럼 홈 화면에 추가하기 (바로가기)
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px', color: '#15803d', fontWeight: 600 }}>
                      {openSections['user-pwa'] ? '접기' : '펼치기'}
                    </span>
                    <span style={{ fontSize: '13px' }}>{openSections['user-pwa'] ? '▲' : '▼'}</span>
                  </div>
                </div>
                {openSections['user-pwa'] && (
                  <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid #dcfce7' }}>
                    <p style={{ margin: 0, fontSize: '14px' }}>
                      스마트폰 브라우저에서 접속 후 홈 화면에 추가하면 <strong>테친회 공식 캐릭터 로고 아이콘</strong>이 생성되며, 주소창 없이 실제 앱처럼 편리하게 이용할 수 있습니다.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px', marginTop: '4px' }}>
                      <div style={{ padding: '14px 16px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                        <strong style={{ color: '#0369a1', fontSize: '14px' }}>🍎 아이폰 (Safari)</strong>
                        <ol style={{ paddingLeft: '20px', margin: '8px 0 0 0', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <li>사파리 브라우저로 <strong>tcmngr.vercel.app</strong> 접속</li>
                          <li>하단 중앙의 <strong>공유 버튼(네모+위화살표)</strong> 터치</li>
                          <li>메뉴를 내려 <strong>[홈 화면에 추가]</strong> 터치</li>
                          <li>우측 상단 <strong>[추가]</strong> 터치 완료</li>
                        </ol>
                      </div>
                      <div style={{ padding: '14px 16px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                        <strong style={{ color: '#15803d', fontSize: '14px' }}>🤖 안드로이드 (Chrome/삼성인터넷)</strong>
                        <ol style={{ paddingLeft: '20px', margin: '8px 0 0 0', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <li>크롬 브라우저로 <strong>tcmngr.vercel.app</strong> 접속</li>
                          <li>우측 상단 <strong>메뉴 버튼(점 3개 ⋮)</strong> 터치</li>
                          <li><strong>[홈 화면에 추가]</strong> 또는 [앱 설치] 선택</li>
                          <li>팝업에서 <strong>[추가]</strong> 터치 완료</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Section 2: Dashboard & Schedules */}
              <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <div 
                  style={{ 
                    padding: '14px 18px', 
                    backgroundColor: '#eff6ff', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    cursor: 'pointer', 
                    fontWeight: 800, 
                    color: '#1e40af', 
                    fontSize: '15px',
                    userSelect: 'none',
                    transition: 'background-color 0.15s ease'
                  }}
                  onClick={() => toggleSection('user-dashboard')}
                  title="클릭하여 상세 내용 펼치기/접기"
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    🎾 2. 대진표 확인 및 실시간 점수 보기
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px', color: '#1d4ed8', fontWeight: 600 }}>
                      {openSections['user-dashboard'] ? '접기' : '펼치기'}
                    </span>
                    <span style={{ fontSize: '13px' }}>{openSections['user-dashboard'] ? '▲' : '▼'}</span>
                  </div>
                </div>
                {openSections['user-dashboard'] && (
                  <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid #dbeafe' }}>
                    <div>• <strong>대진표 목록 메뉴</strong>: 다가오는 정기 모임 대진표 카드를 터치하여 해당 날짜의 코트별 대진 및 본인의 경기 시간대를 확인할 수 있습니다.</div>
                    <div>• <strong>실시간 점수 확인</strong>: 운영자 또는 코트 대표가 점수를 입력하면 새로고침 없이 <strong>실시간으로 모든 회원의 모바일 화면에 동기화</strong>됩니다.</div>
                    <div>• <strong>지난 경기 기록</strong>: 완료된 경기 목록을 터치하여 이전 모임의 경기 결과 및 스코어를 언제든 열람할 수 있습니다.</div>
                  </div>
                )}
              </div>

              {/* Section 3: Attendance Voting */}
              <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <div 
                  style={{ 
                    padding: '14px 18px', 
                    backgroundColor: '#fefce8', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    cursor: 'pointer', 
                    fontWeight: 800, 
                    color: '#854d0e', 
                    fontSize: '15px',
                    userSelect: 'none',
                    transition: 'background-color 0.15s ease'
                  }}
                  onClick={() => toggleSection('user-votes')}
                  title="클릭하여 상세 내용 펼치기/접기"
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    🗓️ 3. 정기 모임 참석 투표하기
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px', color: '#a16207', fontWeight: 600 }}>
                      {openSections['user-votes'] ? '접기' : '펼치기'}
                    </span>
                    <span style={{ fontSize: '13px' }}>{openSections['user-votes'] ? '▲' : '▼'}</span>
                  </div>
                </div>
                {openSections['user-votes'] && (
                  <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid #fef08a' }}>
                    <div>• <strong>참석 투표 메뉴</strong>로 이동하여 등록된 모임 일정을 확인합니다.</div>
                    <div>• 본인 이름 옆의 <strong>[참석 / 불참 / 미정]</strong> 버튼을 터치하여 투표합니다.</div>
                    <div>• 현재 참석 확정 인원, 남녀 비율, 평균 NTRP를 실시간으로 확인할 수 있으며, 마감 전까지 투표 상태 변경이 가능합니다.</div>
                  </div>
                )}
              </div>

              {/* Section 4: Regular Tournament (4 Phases) */}
              <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <div 
                  style={{ 
                    padding: '14px 18px', 
                    backgroundColor: '#faf5ff', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    cursor: 'pointer', 
                    fontWeight: 800, 
                    color: '#6b21a8', 
                    fontSize: '15px',
                    userSelect: 'none',
                    transition: 'background-color 0.15s ease'
                  }}
                  onClick={() => toggleSection('user-tournaments')}
                  title="클릭하여 상세 내용 펼치기/접기"
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    🏆 4. 정기 대회 참가 및 실시간 경기 진행
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px', color: '#7e22ce', fontWeight: 600 }}>
                      {openSections['user-tournaments'] ? '접기' : '펼치기'}
                    </span>
                    <span style={{ fontSize: '13px' }}>{openSections['user-tournaments'] ? '▲' : '▼'}</span>
                  </div>
                </div>
                {openSections['user-tournaments'] && (
                  <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid #f3e8ff' }}>
                    <div>
                      <strong style={{ color: '#7e22ce' }}>① 대회 방식 3가지:</strong>
                      <ul style={{ paddingLeft: '20px', margin: '6px 0 0 0' }}>
                        <li><strong>팀전</strong>: 2~4개 팀으로 나누어 주장 드래프트 후 팀 대항 풀리그 진행</li>
                        <li><strong>개인전(무작위 파트너)</strong>: NTRP 기반으로 매 라운드 파트너가 균형있게 변경되는 방식</li>
                        <li><strong>개인전(고정 페어)</strong>: 2인 1조 고정 파트너로 페어 간 리그전 진행</li>
                      </ul>
                    </div>

                    <div>
                      <strong style={{ color: '#7e22ce' }}>② 경기 진행 규칙 (상단 안내 배너):</strong>
                      <ul style={{ paddingLeft: '20px', margin: '6px 0 0 0' }}>
                        <li><strong>복식 핸디캡 룰</strong>: 남남 vs 여여(여여 30:0 시작), 남남 vs 남여(남여 15:0 시작) 등</li>
                        <li><strong>타이브레이크 룰</strong>: 5:5 동점 시 7점 선취 타이브레이크 진행</li>
                        <li><strong>No-Ad 룰</strong>: 40:40 듀스 시 1포인트 결정구 (혼복 시 리시버 동성 선택)</li>
                      </ul>
                    </div>

                    <div>
                      <strong style={{ color: '#7e22ce' }}>③ 4단계 코트별 모아보기 기능:</strong>
                      <p style={{ margin: '4px 0 0 0' }}>
                        <strong>[⚡ 진행중 경기만 모아보기]</strong> 버튼을 누르면 이미 끝난 경기와 나중 대기 경기가 숨겨지고 <strong>현재 코트에서 치러지는 경기만 집중 노출</strong>됩니다. 점수가 입력되면 자동으로 다음 경기가 올라옵니다.
                      </p>
                    </div>

                    <div>
                      <strong style={{ color: '#7e22ce' }}>④ 실시간 순위표 및 시상:</strong>
                      <p style={{ margin: '4px 0 0 0' }}>
                        하단 실시간 순위표에서 승점, 전적, 득실차를 확인할 수 있으며, 대회 종료 후 <strong>1~3위 시상대 및 MVP 결과표</strong>가 발표됩니다.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Section 5: Stats Dashboard */}
              <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <div 
                  style={{ 
                    padding: '14px 18px', 
                    backgroundColor: '#f8fafc', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    cursor: 'pointer', 
                    fontWeight: 800, 
                    color: 'var(--navy)', 
                    fontSize: '15px',
                    userSelect: 'none',
                    transition: 'background-color 0.15s ease'
                  }}
                  onClick={() => toggleSection('user-stats')}
                  title="클릭하여 상세 내용 펼치기/접기"
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    📊 5. 통계 대시보드 및 개인 랭킹
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--txt3)', fontWeight: 600 }}>
                      {openSections['user-stats'] ? '접기' : '펼치기'}
                    </span>
                    <span style={{ fontSize: '13px' }}>{openSections['user-stats'] ? '▲' : '▼'}</span>
                  </div>
                </div>
                {openSections['user-stats'] && (
                  <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid #e2e8f0' }}>
                    <div>• <strong>통계 대시보드 메뉴</strong>에서 회원 전체의 통산 전적(승률, 승/무/패, 총 경기수)을 확인합니다.</div>
                    <div>• <strong>최근 5경기 폼 뱃지</strong>: 최근 경기 성적(W 승리, L 패배) 흐름을 파악할 수 있습니다.</div>
                    <div>• <strong>성별 필터</strong>: 전체 / 남성 / 여성 탭을 선택하여 세부 순위를 조회할 수 있습니다.</div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ======================================================== */}
          {/* ADMIN MANUAL TAB */}
          {/* ======================================================== */}
          {activeTab === 'admin' && (
            <>
              {/* Admin 1: Login & Access */}
              <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <div 
                  style={{ 
                    padding: '14px 18px', 
                    backgroundColor: '#eff6ff', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    cursor: 'pointer', 
                    fontWeight: 800, 
                    color: '#1e40af', 
                    fontSize: '15px',
                    userSelect: 'none',
                    transition: 'background-color 0.15s ease'
                  }}
                  onClick={() => toggleSection('admin-login')}
                  title="클릭하여 상세 내용 펼치기/접기"
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    🔐 1. 운영자 로그인 및 권한 체계
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px', color: '#1d4ed8', fontWeight: 600 }}>
                      {openSections['admin-login'] ? '접기' : '펼치기'}
                    </span>
                    <span style={{ fontSize: '13px' }}>{openSections['admin-login'] ? '▲' : '▼'}</span>
                  </div>
                </div>
                {openSections['admin-login'] && (
                  <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid #dbeafe' }}>
                    <div>• <strong>로그인 방법</strong>: 상단 메뉴 또는 회원관리 하단의 <strong>[🔐 운영자 로그인]</strong> 버튼을 통해 구글 계정 또는 이메일로 로그인합니다.</div>
                    <div>• <strong>최고 관리자(SuperAdmin)</strong>: <strong>[👑 운영진 관리]</strong> 메뉴에서 새로운 운영자를 등록하거나 권한을 회수할 수 있습니다.</div>
                    <div>• 운영자 로그인 시에만 대진표 생성, 선수 교체, 점수 입력, 대회 관리, 회원 정보 수정 권한이 활성화됩니다.</div>
                  </div>
                )}
              </div>

              {/* Admin 2: Create Smart Brackets */}
              <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <div 
                  style={{ 
                    padding: '14px 18px', 
                    backgroundColor: '#f0fdf4', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    cursor: 'pointer', 
                    fontWeight: 800, 
                    color: '#166534', 
                    fontSize: '15px',
                    userSelect: 'none',
                    transition: 'background-color 0.15s ease'
                  }}
                  onClick={() => toggleSection('admin-create')}
                  title="클릭하여 상세 내용 펼치기/접기"
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    🎲 2. 스마트 대진표 생성 및 자동 알고리즘
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px', color: '#15803d', fontWeight: 600 }}>
                      {openSections['admin-create'] ? '접기' : '펼치기'}
                    </span>
                    <span style={{ fontSize: '13px' }}>{openSections['admin-create'] ? '▲' : '▼'}</span>
                  </div>
                </div>
                {openSections['admin-create'] && (
                  <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid #dcfce7' }}>
                    <div>
                      <strong style={{ color: '#15803d' }}>① 대진표 생성 단계:</strong>
                      <ol style={{ paddingLeft: '20px', margin: '6px 0 0 0' }}>
                        <li><strong>대진표 목록</strong> 메뉴에서 <strong>[+ 대진표 만들기]</strong> 탭 클릭</li>
                        <li>경기 날짜 선택 후 <strong>[📅 투표 참석자 불러오기]</strong> 버튼으로 해당 날짜 투표 완료 인원 원클릭 자동 선택</li>
                        <li>코트 수(1~4코트), 총 라운드 수, 운영 시간(시작~종료) 설정</li>
                        <li>복식 종류(남복, 여복, 혼복, 잡복) 선호 비율 지정</li>
                        <li><strong>[🎲 대진표 자동 생성]</strong> 버튼 클릭</li>
                      </ol>
                    </div>

                    <div style={{ padding: '12px 14px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '13px' }}>
                      <strong style={{ color: '#0369a1' }}>💡 스마트 매칭 알고리즘 특징:</strong>
                      <ul style={{ paddingLeft: '18px', margin: '6px 0 0 0' }}>
                        <li><strong>NTRP 밸런싱</strong>: 1번(고수)+4번(초심자) vs 2번+3번 매칭으로 팀 전력 균등화</li>
                        <li><strong>연속 출전 제한</strong>: 특정 선수가 연속으로 쉬지 않고 경기하는 과부하 방지</li>
                        <li><strong>파트너 중복 최소화</strong>: 같은 모임에서 동일 파트너와의 반복 매칭 억제</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* Admin 3: Bracket Editor & Conflict Detection */}
              <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <div 
                  style={{ 
                    padding: '14px 18px', 
                    backgroundColor: '#fef2f2', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    cursor: 'pointer', 
                    fontWeight: 800, 
                    color: '#991b1b', 
                    fontSize: '15px',
                    userSelect: 'none',
                    transition: 'background-color 0.15s ease'
                  }}
                  onClick={() => toggleSection('admin-editor')}
                  title="클릭하여 상세 내용 펼치기/접기"
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    ✏️ 3. 대진표 편집 및 중복 선수 실시간 검증
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px', color: '#b91c1c', fontWeight: 600 }}>
                      {openSections['admin-editor'] ? '접기' : '펼치기'}
                    </span>
                    <span style={{ fontSize: '13px' }}>{openSections['admin-editor'] ? '▲' : '▼'}</span>
                  </div>
                </div>
                {openSections['admin-editor'] && (
                  <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid #fee2e2' }}>
                    <div>• <strong>드래그 & 드롭 순서 변경</strong>: 각 라운드/경기 카드를 드래그하여 순서를 즉시 맞바꿀 수 있습니다.</div>
                    <div>• <strong>선수 교체 시 중복 검증</strong>: 드롭다운으로 선수를 변경할 때, 해당 선수가 같은 시간대 다른 코트에 배정되어 있으면 <strong>빨간색 ⚠️ 중복 경고 태그 및 안내 배너</strong>가 즉시 노출되어 실수를 원천 방지합니다.</div>
                    <div>• <strong>실시간 점수 입력</strong>: 스코어를 입력하면 즉시 Firestore에 저장되어 모든 회원의 모바일 화면에 반영됩니다.</div>
                    <div>• <strong>인쇄 / PDF 출력</strong>: 상단 <strong>[🖨️ 대진표 인쇄]</strong> 버튼으로 A4 규격 최적화 출력 가능합니다.</div>
                  </div>
                )}
              </div>

              {/* Admin 4: Tournament Hosting (Full 4-Phase Guide) */}
              <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <div 
                  style={{ 
                    padding: '14px 18px', 
                    backgroundColor: '#faf5ff', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    cursor: 'pointer', 
                    fontWeight: 800, 
                    color: '#6b21a8', 
                    fontSize: '15px',
                    userSelect: 'none',
                    transition: 'background-color 0.15s ease'
                  }}
                  onClick={() => toggleSection('admin-tournaments')}
                  title="클릭하여 상세 내용 펼치기/접기"
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    🏆 4. 정기 대회 개설 및 단계별 운영 가이드
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px', color: '#7e22ce', fontWeight: 600 }}>
                      {openSections['admin-tournaments'] ? '접기' : '펼치기'}
                    </span>
                    <span style={{ fontSize: '13px' }}>{openSections['admin-tournaments'] ? '▲' : '▼'}</span>
                  </div>
                </div>
                {openSections['admin-tournaments'] && (
                  <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px', borderTop: '1px solid #f3e8ff' }}>
                    <div>
                      <strong style={{ color: '#7e22ce', fontSize: '14px' }}>📍 1단계: 대회 기본 환경 설정</strong>
                      <ul style={{ paddingLeft: '20px', margin: '6px 0 0 0' }}>
                        <li>대회 방식 선택: <strong>팀전 / 개인전 / 개인전(고정페어)</strong></li>
                        <li>참가비 및 클럽 입금계좌번호 설정 (회원관리 기본계좌 자동 불러오기 지원)</li>
                        <li><strong>경기 진행 규칙 설정</strong>: 복식 핸디캡, 타이브레이크 기준, No-Ad 규칙 입력</li>
                      </ul>
                    </div>

                    <div>
                      <strong style={{ color: '#7e22ce', fontSize: '14px' }}>📍 2단계: 참석자 명단 및 코트 배정</strong>
                      <ul style={{ paddingLeft: '20px', margin: '6px 0 0 0' }}>
                        <li>투표 참석자 자동 불러오기 또는 회원 수동 선택</li>
                        <li>고정페어의 경우: <strong>자동 밸런스 페어링</strong> vs <strong>주선수 지정 후 파트너 랜덤 뽑기</strong> 선택 가능</li>
                        <li>코트별 최대 경기수 및 시간 설정</li>
                      </ul>
                    </div>

                    <div>
                      <strong style={{ color: '#7e22ce', fontSize: '14px' }}>📍 3단계: 팀원 배정 및 출전 명단 구성 (팀전)</strong>
                      <ul style={{ paddingLeft: '20px', margin: '6px 0 0 0' }}>
                        <li>주장 선발 후 실시간 드래프트 진행 (스마트폰 간 실시간 동기화)</li>
                        <li>코트별 세트 출전 명단(선수1, 선수2) 배정</li>
                      </ul>
                    </div>

                    <div>
                      <strong style={{ color: '#7e22ce', fontSize: '14px' }}>📍 4단계: 대회 경기 진행 & 실시간 스코어보드</strong>
                      <ul style={{ paddingLeft: '20px', margin: '6px 0 0 0' }}>
                        <li><strong>[⚡ 진행중 경기만 모아보기]</strong> 활성화 시 각 코트의 현재 경기만 집중 표시</li>
                        <li>점수 입력 시 자동 저장 및 다음 대기 경기 전진</li>
                        <li>동시간대 중복 출전 선수 감지 배너 제공</li>
                        <li>모든 경기 완료 후 <strong>[대회 종료 🏁]</strong> 클릭 시 최종 시상대 및 순위표 생성</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* Admin 5: Member Management & Club Settings */}
              <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <div 
                  style={{ 
                    padding: '14px 18px', 
                    backgroundColor: '#f8fafc', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    cursor: 'pointer', 
                    fontWeight: 800, 
                    color: 'var(--navy)', 
                    fontSize: '15px',
                    userSelect: 'none',
                    transition: 'background-color 0.15s ease'
                  }}
                  onClick={() => toggleSection('admin-members')}
                  title="클릭하여 상세 내용 펼치기/접기"
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    👥 5. 회원 관리 및 클럽 계좌 환경설정
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--txt3)', fontWeight: 600 }}>
                      {openSections['admin-members'] ? '접기' : '펼치기'}
                    </span>
                    <span style={{ fontSize: '13px' }}>{openSections['admin-members'] ? '▲' : '▼'}</span>
                  </div>
                </div>
                {openSections['admin-members'] && (
                  <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid #e2e8f0' }}>
                    <div>• <strong>신규 회원 등록</strong>: 이름, 성별, NTRP 등급(1.5 ~ 6.0), 가입일, 상태를 등록합니다.</div>
                    <div>• <strong>NTRP 등급 수정</strong>: 실력 변동 시 회원 수정 모달에서 등급을 변경하면 향후 대진표에 즉시 반영됩니다.</div>
                    <div>• <strong>클럽 기본 계좌 설정</strong>: 상단 환경설정에서 은행명, 계좌번호, 예금주를 저장해두면 정기대회 생성 시 자동으로 입력됩니다.</div>
                    <div>• <strong>회원 명부 엑셀(CSV) 다운로드</strong>: 전체 회원 데이터를 스프레드시트용 파일로 내보낼 수 있습니다.</div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

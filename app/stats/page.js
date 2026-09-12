'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getMembers, getSchedules, getTournaments, initDefaultMembers } from '@/lib/firestore';
import { computeGlobalStandings } from '@/lib/scheduler';
import Navbar from '@/components/Navbar';
import styles from '../dashboard/dashboard.module.css';

export default function StatsPage() {
  const { loading } = useAuth();
  const router = useRouter();
  
  const [fetching, setFetching] = useState(true);
  const [members, setMembers] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [tournaments, setTournaments] = useState([]);

  // Filter states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sourceFilter, setSourceFilter] = useState('ALL'); // 'ALL' | 'REGULAR' | 'TOURNAMENT'
  const [showRulesDetail, setShowRulesDetail] = useState(true);

  useEffect(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const formatDate = (d) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };
    setStartDate(formatDate(firstDay));
    setEndDate(formatDate(lastDay));

    (async () => {
      try {
        setFetching(true);
        await initDefaultMembers('shared');
        const [mbrs, scheds, tours] = await Promise.all([
          getMembers('shared'),
          getSchedules('shared'),
          getTournaments('shared')
        ]);
        setMembers(mbrs);
        setSchedules(scheds);
        setTournaments(tours);
      } catch (err) {
        console.error('Failed to load stats data:', err);
        alert('데이터를 불러오지 못했습니다. Firestore 권한 설정을 확인해주세요.');
      } finally {
        setFetching(false);
      }
    })();
  }, []);

  const globalStandings = useMemo(() => {
    if (!members.length) return [];
    const allStandings = computeGlobalStandings(schedules, members, startDate, endDate, tournaments, sourceFilter);
    return allStandings.filter(s => {
      const m = members.find(member => member.id === s.id);
      if (!m) return false;
      return m.role !== '준회원' && m.role !== '게스트';
    });
  }, [schedules, members, startDate, endDate, tournaments, sourceFilter]);

  // 기간 내 포함된 정기모임 및 분기대회 수 & 총 경기수 요약 통계
  const statsSummary = useMemo(() => {
    const filteredSchedules = schedules.filter(s => {
      if (!s.matchDate) return false;
      if (startDate && s.matchDate < startDate) return false;
      if (endDate && s.matchDate > endDate) return false;
      return true;
    });

    const filteredTournaments = tournaments.filter(t => {
      const d = t.date || (t.createdAt?.toDate ? t.createdAt.toDate().toISOString().slice(0, 10) : '');
      if (startDate && d && d < startDate) return false;
      if (endDate && d && d > endDate) return false;
      return true;
    });

    const activePlayersCount = globalStandings.filter(s => s.played > 0).length;
    const totalGames = globalStandings.reduce((acc, s) => acc + s.played, 0);
    const regularGames = globalStandings.reduce((acc, s) => acc + s.regularPlayed, 0);
    const tournamentGames = globalStandings.reduce((acc, s) => acc + s.tournamentPlayed, 0);
    const avgGamesPerPlayer = activePlayersCount > 0 ? (totalGames / activePlayersCount).toFixed(1) : '0';

    return {
      filteredSchedulesCount: filteredSchedules.length,
      filteredTournamentsCount: filteredTournaments.length,
      activePlayersCount,
      totalGames,
      regularGames,
      tournamentGames,
      avgGamesPerPlayer
    };
  }, [schedules, tournaments, startDate, endDate, globalStandings]);

  if (fetching) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="spinner" />
      </div>
    );
  }

  const top3 = globalStandings.slice(0, 3);

  return (
    <div className={styles.page}>
      <Navbar />
      <main className={styles.main}>
        <div className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h1 className={styles.title}>📊 통계 대시보드</h1>
            <p className={styles.sub}>조회 기간 동안의 클럽 정기 모임 및 분기 대회 결과를 통합 집계합니다</p>
          </div>
        </div>

        {/* 필터 영역 (조회 기간 + 집계 대상 선택) */}
        <div className="card" style={{ marginBottom: '20px', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* 1. 조회 기간 선택 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <strong style={{ fontSize: '13.5px', color: 'var(--txt)', minWidth: '70px' }}>📅 조회 기간</strong>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input 
                className="input input-sm" 
                type="date" 
                value={startDate} 
                onChange={e => setStartDate(e.target.value)} 
                style={{ width: '135px', height: '32px', fontSize: '12px' }} 
              />
              <span style={{ color: 'var(--txt3)' }}>~</span>
              <input 
                className="input input-sm" 
                type="date" 
                value={endDate} 
                onChange={e => setEndDate(e.target.value)} 
                style={{ width: '135px', height: '32px', fontSize: '12px' }} 
              />
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => { setStartDate(''); setEndDate(''); }}>전체 기간</button>
              <button className="btn btn-secondary btn-sm" onClick={() => {
                const now = new Date();
                const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-CA');
                const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toLocaleDateString('en-CA');
                setStartDate(firstDay);
                setEndDate(lastDay);
              }}>이번 달</button>
              <button className="btn btn-secondary btn-sm" onClick={() => {
                const now = new Date();
                const quarter = Math.floor(now.getMonth() / 3);
                const firstDay = new Date(now.getFullYear(), quarter * 3, 1).toLocaleDateString('en-CA');
                const lastDay = new Date(now.getFullYear(), quarter * 3 + 3, 0).toLocaleDateString('en-CA');
                setStartDate(firstDay);
                setEndDate(lastDay);
              }}>이번 분기</button>
              <button className="btn btn-secondary btn-sm" onClick={() => {
                const now = new Date();
                const half = Math.floor(now.getMonth() / 6);
                const firstDay = new Date(now.getFullYear(), half * 6, 1).toLocaleDateString('en-CA');
                const lastDay = new Date(now.getFullYear(), half * 6 + 6, 0).toLocaleDateString('en-CA');
                setStartDate(firstDay);
                setEndDate(lastDay);
              }}>이번 반기</button>
            </div>
          </div>

          {/* 2. 집계 대상 (정기모임 / 분기대회 / 전체 통합) 선택 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
            <strong style={{ fontSize: '13.5px', color: 'var(--txt)', minWidth: '70px' }}>🎯 집계 대상</strong>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`btn btn-sm ${sourceFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ 
                  fontWeight: sourceFilter === 'ALL' ? 800 : 500,
                  fontSize: '12px',
                  padding: '5px 14px'
                }}
                onClick={() => setSourceFilter('ALL')}
              >
                🎾 전체 통합 (정기모임 + 분기대회)
              </button>
              <button
                type="button"
                className={`btn btn-sm ${sourceFilter === 'REGULAR' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ 
                  fontWeight: sourceFilter === 'REGULAR' ? 800 : 500,
                  fontSize: '12px',
                  padding: '5px 14px'
                }}
                onClick={() => setSourceFilter('REGULAR')}
              >
                🏸 정기 모임만
              </button>
              <button
                type="button"
                className={`btn btn-sm ${sourceFilter === 'TOURNAMENT' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ 
                  fontWeight: sourceFilter === 'TOURNAMENT' ? 800 : 500,
                  fontSize: '12px',
                  padding: '5px 14px'
                }}
                onClick={() => setSourceFilter('TOURNAMENT')}
              >
                🏆 분기 대회만
              </button>
            </div>
          </div>
        </div>

        {/* 📐 승점 산정 기준 및 순위 결정 공식 상세 안내 카드 */}
        <div className="card" style={{ marginBottom: '24px', padding: '16px 20px', backgroundColor: '#f8fafc', border: '1px solid #bfdbfe', borderRadius: '12px' }}>
          <div 
            style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              cursor: 'pointer',
              userSelect: 'none',
              flexWrap: 'wrap',
              gap: '8px'
            }}
            onClick={() => setShowRulesDetail(prev => !prev)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>📐</span>
              <div>
                <strong style={{ fontSize: '14px', color: '#1e40af' }}>승점 및 종합 순위 산정 기준 안내</strong>
                <div style={{ fontSize: '12px', color: '#2563eb', marginTop: '2px', fontWeight: 700 }}>
                  최종 승점 = 평균 경기 포인트(승3 / 무2 / 패1) + 출전 가산점(참여일수 × 1.0점)
                </div>
              </div>
            </div>
            <button 
              type="button" 
              className="btn btn-secondary btn-sm"
              style={{ padding: '4px 12px', fontSize: '11.5px', fontWeight: 800, color: '#2563eb', borderColor: '#bfdbfe', backgroundColor: '#fff' }}
            >
              {showRulesDetail ? '산정 기준 접기 ▲' : '계산 공식 & 예시 자세히 보기 ▼'}
            </button>
          </div>

          {showRulesDetail && (
            <div style={{ marginTop: '14px', borderTop: '1px solid #dbeafe', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {/* 3단계 산정 공식 블록 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
                
                {/* 1. 경기 포인트 */}
                <div style={{ padding: '12px 14px', backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <span style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800 }}>1</span>
                    <strong style={{ fontSize: '13px', color: 'var(--txt)' }}>경기별 포인트 (Match Points)</strong>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', fontWeight: 700 }}>
                      <span>🥇 승리 (Win)</span>
                      <span>+3.0점</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontWeight: 700 }}>
                      <span>🤝 무승부 (Draw)</span>
                      <span>+2.0점</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626', fontWeight: 700 }}>
                      <span>🥉 패배 (Loss)</span>
                      <span>+1.0점</span>
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--txt3)', marginTop: '8px', borderTop: '1px dashed #f1f5f9', paddingTop: '6px' }}>
                    총 포인트 = (승리수×3) + (무승부수×2) + (패배수×1)
                  </div>
                </div>

                {/* 2. 평균 경기 포인트 */}
                <div style={{ padding: '12px 14px', backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <span style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800 }}>2</span>
                    <strong style={{ fontSize: '13px', color: 'var(--txt)' }}>평균 경기 포인트 (Average)</strong>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--txt)', lineHeight: '1.5' }}>
                    <div style={{ fontWeight: 800, color: '#0369a1', backgroundColor: '#f0f9ff', padding: '6px 8px', borderRadius: '6px', textAlign: 'center', marginBottom: '6px' }}>
                      총 경기 포인트 ÷ 총 출전 경기수
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--txt2)' }}>
                      회원별 경기수 편차로 인한 왜곡을 방지하기 위해 1경기당 평균 기여 점수로 환산합니다. (1.00점 ~ 3.00점)
                    </span>
                  </div>
                </div>

                {/* 3. 출전 가산점 & 최종 승점 */}
                <div style={{ padding: '12px 14px', backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <span style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800 }}>3</span>
                    <strong style={{ fontSize: '13px', color: 'var(--txt)' }}>출전 가산점 & 최종 승점</strong>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#15803d', fontWeight: 700 }}>
                      <span>🎟️ 출전 가산점</span>
                      <span>참여일수 × 1.0점</span>
                    </div>
                    <div style={{ padding: '6px 8px', backgroundColor: '#eff6ff', borderRadius: '6px', border: '1px solid #bfdbfe', fontWeight: 800, color: '#1d4ed8', textAlign: 'center' }}>
                      최종 승점 = 평균 포인트 + 출전 가산점
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--txt3)', marginTop: '6px' }}>
                    성실하게 클럽 모임/대회에 참석한 회원에게 가산점을 부여합니다.
                  </div>
                </div>

              </div>

              {/* 계산 예시 & 동점자 처리 기준 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px', fontSize: '12px' }}>
                
                {/* 계산 예시 */}
                <div style={{ padding: '10px 14px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#14532d' }}>
                  <strong style={{ color: '#15803d' }}>💡 승점 계산 상세 예시:</strong>
                  <div style={{ marginTop: '4px', lineHeight: '1.5' }}>
                    • <strong>4일 참여</strong>하여 <strong>총 8경기 (6승 2패)</strong>를 치른 경우:
                    <div style={{ paddingLeft: '8px', color: '#166534', marginTop: '3px' }}>
                      - 총 경기 포인트: (6승×3점) + (2패×1점) = <strong>20점</strong><br />
                      - 1경기당 평균 포인트: 20점 ÷ 8경기 = <strong>2.50점</strong><br />
                      - 출전 가산점: 4일 × 1점 = <strong>4.00점</strong><br />
                      👉 <strong>최종 승점: 2.50 + 4.00 = 6.50점</strong>
                    </div>
                  </div>
                </div>

                {/* 동점자 처리 기준 */}
                <div style={{ padding: '10px 14px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', color: '#78350f' }}>
                  <strong style={{ color: '#b45309' }}>⚖️ 동점자 순위 결정 순서 (타이브레이크):</strong>
                  <div style={{ marginTop: '4px', lineHeight: '1.5' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '4px' }}>
                      <span>1️⃣ <strong>최종 승점</strong> 높은 순</span>
                      <span>2️⃣ <strong>세트 득실차(+/-)</strong> 높은 순</span>
                      <span>3️⃣ <strong>승률(%)</strong> 높은 순</span>
                      <span>4️⃣ <strong>다승(승리 경기수)</strong> 많은 순</span>
                    </div>
                    <span style={{ fontSize: '11px', color: '#92400e', marginTop: '4px', display: 'block' }}>
                      ※ 출전 경기수가 없는 미출전 회원은 최하위로 정렬됩니다.
                    </span>
                  </div>
                </div>

              </div>

              {/* 분기대회 및 정기모임 통합 반영 안내 */}
              <div style={{ padding: '8px 12px', backgroundColor: '#f1f5f9', borderRadius: '6px', color: '#475569', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>ℹ️</span>
                <span>
                  <strong>정기 모임</strong>(주간 모임 대진표) 및 <strong>분기 대회</strong>(팀전/개인전/페어전)에서 승패 및 점수가 입력된 모든 공식 매치가 공정하게 합산 반영됩니다.
                </span>
              </div>

            </div>
          )}
        </div>

        {/* 📊 주요 KPI 요약 지표 카드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontSize: '26px', width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(0, 122, 255, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              👥
            </div>
            <div>
              <div style={{ fontSize: '11.5px', color: 'var(--txt2)', fontWeight: 600 }}>총 출전 회원</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--txt)' }}>
                {statsSummary.activePlayersCount}명
                <span style={{ fontSize: '11px', color: 'var(--txt3)', fontWeight: 500, marginLeft: '4px' }}>/ {members.length}명</span>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontSize: '26px', width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(52, 199, 89, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              🎾
            </div>
            <div>
              <div style={{ fontSize: '11.5px', color: 'var(--txt2)', fontWeight: 600 }}>총 경기 수</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--txt)' }}>
                {statsSummary.totalGames}경기
                {sourceFilter === 'ALL' && (statsSummary.regularGames > 0 || statsSummary.tournamentGames > 0) && (
                  <div style={{ fontSize: '10.5px', color: 'var(--txt3)', fontWeight: 600, marginTop: '1px' }}>
                    (정기 {statsSummary.regularGames} + 대회 {statsSummary.tournamentGames})
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontSize: '26px', width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(255, 149, 0, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              📅
            </div>
            <div>
              <div style={{ fontSize: '11.5px', color: 'var(--txt2)', fontWeight: 600 }}>반영된 일정/대회</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--txt)' }}>
                {sourceFilter === 'ALL' ? (
                  <>정기 {statsSummary.filteredSchedulesCount}회 <span style={{ fontSize: '13px', color: 'var(--txt3)' }}>+</span> 대회 {statsSummary.filteredTournamentsCount}회</>
                ) : sourceFilter === 'REGULAR' ? (
                  <>정기 모임 {statsSummary.filteredSchedulesCount}회</>
                ) : (
                  <>분기 대회 {statsSummary.filteredTournamentsCount}회</>
                )}
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontSize: '26px', width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(175, 82, 222, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              ⚖️
            </div>
            <div>
              <div style={{ fontSize: '11.5px', color: 'var(--txt2)', fontWeight: 600 }}>1인 평균 경기수</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--txt)' }}>
                {statsSummary.avgGamesPerPlayer}경기
              </div>
            </div>
          </div>
        </div>

        {/* Top 3 영역 */}
        {top3.length > 0 && (
          <div style={{ marginBottom: '28px' }}>
            <div className="section-head">
              <span>🏆 명예의 전당 (Top 3)</span>
            </div>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {top3.map((s, idx) => (
                <div 
                  key={s.id} 
                  className="card" 
                  style={{ 
                    flex: '1 1 220px', 
                    padding: '20px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '16px',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ 
                    fontSize: '28px', 
                    width: '48px', 
                    height: '48px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    borderRadius: '16px',
                    background: idx === 0 ? 'rgba(255, 149, 0, 0.12)' : idx === 1 ? 'rgba(142, 142, 147, 0.12)' : 'rgba(175, 82, 222, 0.12)',
                    boxShadow: idx === 0 ? '0 4px 14px rgba(255, 149, 0, 0.25)' : 'none'
                  }}>
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 4px 0', letterSpacing: '-0.02em', color: 'var(--txt)' }}>
                      {s.name} <span style={{ fontSize: '11.5px', color: 'var(--txt3)', fontWeight: 500 }}>({s.gender === 'F' ? '여' : '남'})</span>
                    </h3>
                    <p style={{ fontSize: '12px', color: 'var(--txt2)', margin: 0 }}>
                      {s.win}승 {s.draw > 0 ? `${s.draw}무 ` : ''}{s.loss}패 <strong style={{ color: 'var(--ios-blue)' }}>(승점 {Number.isInteger(s.points) ? s.points : s.points.toFixed(1)}점)</strong>
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--txt3)' }}>득실: {s.diff > 0 ? `+${s.diff}` : s.diff}</span>
                      <span style={{ fontSize: '10.5px', color: '#16a34a', backgroundColor: '#f0fdf4', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                        {s.attendedDays}일 참여 ({s.played}경기)
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 전체 누적 순위표 */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--txt)' }}>전체 순위 및 참여 현황</h2>
              <span style={{ fontSize: '12px', color: 'var(--txt3)' }}>
                (※ 승점 산정 기준: 평균포인트(승3, 무2, 패1) + 출전가산점(참여일수당 1점))
              </span>
            </div>
            {sourceFilter === 'ALL' && (
              <span style={{ fontSize: '11.5px', color: '#2563eb', fontWeight: 700, backgroundColor: '#eff6ff', padding: '2px 8px', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                🎾 정기모임 + 🏆 분기대회 통합 반영중
              </span>
            )}
          </div>
          {globalStandings.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>해당 기간에 기록된 데이터가 없습니다.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 50 }}>순위</th>
                    <th>이름</th>
                    <th>참여 일수</th>
                    <th>경기수</th>
                    <th>승점</th>
                    <th>승률</th>
                    <th>승</th>
                    <th>무</th>
                    <th>패</th>
                    <th>득실차</th>
                  </tr>
                </thead>
                <tbody>
                  {globalStandings.map((s, i) => (
                    <tr key={s.id}>
                      <td>
                        <strong>
                          {i === 0 ? '🥇 1' : i === 1 ? '🥈 2' : i === 2 ? '🥉 3' : i + 1}
                        </strong>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 700, color: 'var(--txt)' }}>{s.name}</span>
                        <span style={{ fontSize: 11, color: s.gender === 'F' ? '#e11d48' : '#2563eb', marginLeft: '4px' }}>
                          ({s.gender === 'F' ? '여' : '남'})
                        </span>
                      </td>
                      <td>
                        <strong>{s.attendedDays}</strong>일
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                          <span style={{ fontWeight: 800 }}>{s.played}경기</span>
                          {sourceFilter === 'ALL' && s.played > 0 && (s.regularPlayed > 0 || s.tournamentPlayed > 0) && (
                            <span style={{ fontSize: '10px', color: 'var(--txt3)' }}>
                              (정기 {s.regularPlayed} / 대회 {s.tournamentPlayed})
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <strong style={{ color: 'var(--ios-blue)', fontSize: '13.5px' }}>
                          {Number.isInteger(s.points) ? s.points : s.points.toFixed(1)}
                        </strong>
                      </td>
                      <td>{s.played > 0 ? Math.round(s.winRate * 100) : 0}%</td>
                      <td><span style={{ color: '#16a34a', fontWeight: 700 }}>{s.win}</span></td>
                      <td><span style={{ color: '#64748b' }}>{s.draw}</span></td>
                      <td><span style={{ color: '#dc2626' }}>{s.loss}</span></td>
                      <td>
                        <strong style={{ color: s.diff > 0 ? '#16a34a' : s.diff < 0 ? '#dc2626' : 'inherit' }}>
                          {s.diff > 0 ? `+${s.diff}` : s.diff}
                        </strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}

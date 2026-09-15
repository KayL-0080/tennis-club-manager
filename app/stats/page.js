'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getMembers, getSchedules, getTournaments, initDefaultMembers, getRankingRules, updateRankingRules } from '@/lib/firestore';
import { computeGlobalStandings } from '@/lib/scheduler';
import Navbar from '@/components/Navbar';
import styles from '../dashboard/dashboard.module.css';

export default function StatsPage() {
  const { isAdmin, loading } = useAuth();
  const router = useRouter();
  
  const [fetching, setFetching] = useState(true);
  const [members, setMembers] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [tournaments, setTournaments] = useState([]);

  // Ranking calculation rules
  const [rankingRules, setRankingRules] = useState({
    winPoints: 3.0,
    drawPoints: 2.0,
    lossPoints: 1.0,
    bonusPerDay: 1.0,
    bonusPerMatch: 0.0,
    calcType: 'avg' // 'avg' | 'sum'
  });
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [ruleForm, setRuleForm] = useState({
    winPoints: 3.0,
    drawPoints: 2.0,
    lossPoints: 1.0,
    bonusPerDay: 1.0,
    bonusPerMatch: 0.0,
    calcType: 'avg'
  });
  const [savingRules, setSavingRules] = useState(false);

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
        const [mbrs, scheds, tours, rules] = await Promise.all([
          getMembers('shared'),
          getSchedules('shared'),
          getTournaments('shared'),
          getRankingRules()
        ]);
        setMembers(mbrs);
        setSchedules(scheds);
        setTournaments(tours);
        if (rules) {
          setRankingRules(rules);
          setRuleForm(rules);
        }
      } catch (err) {
        console.error('Failed to load stats data:', err);
        alert('데이터를 불러오지 못했습니다. Firestore 권한 설정을 확인해주세요.');
      } finally {
        setFetching(false);
      }
    })();
  }, []);

  const handleSaveRules = async (e) => {
    e.preventDefault();
    if (!isAdmin) {
      alert('운영진만 산정 기준을 변경할 수 있습니다.');
      return;
    }
    try {
      setSavingRules(true);
      const cleaned = {
        winPoints: Number(ruleForm.winPoints) || 0,
        drawPoints: Number(ruleForm.drawPoints) || 0,
        lossPoints: Number(ruleForm.lossPoints) || 0,
        bonusPerDay: Number(ruleForm.bonusPerDay) || 0,
        bonusPerMatch: Number(ruleForm.bonusPerMatch) || 0,
        calcType: ruleForm.calcType || 'avg'
      };
      await updateRankingRules(cleaned);
      setRankingRules(cleaned);
      setShowRuleModal(false);
      alert('승점 및 순위 산정 기준이 성공적으로 저장되었습니다.');
    } catch (err) {
      console.error('Failed to update ranking rules:', err);
      alert('산정 기준 저장에 실패했습니다. 관리자 권한을 확인해주세요.');
    } finally {
      setSavingRules(false);
    }
  };

  const handleResetDefaultRules = () => {
    setRuleForm({
      winPoints: 3.0,
      drawPoints: 2.0,
      lossPoints: 1.0,
      bonusPerDay: 1.0,
      bonusPerMatch: 0.0,
      calcType: 'avg'
    });
  };

  const globalStandings = useMemo(() => {
    if (!members.length) return [];
    const allStandings = computeGlobalStandings(schedules, members, startDate, endDate, tournaments, sourceFilter, rankingRules);
    return allStandings.filter(s => {
      const m = members.find(member => member.id === s.id);
      if (!m) return false;
      return m.role !== '준회원' && m.role !== '게스트';
    });
  }, [schedules, members, startDate, endDate, tournaments, sourceFilter, rankingRules]);

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

  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-CA');
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toLocaleDateString('en-CA');
  const isCurrentMonth = startDate === currentMonthStart && endDate === currentMonthEnd;

  const currentQuarter = Math.floor(now.getMonth() / 3);
  const currentQuarterStart = new Date(now.getFullYear(), currentQuarter * 3, 1).toLocaleDateString('en-CA');
  const currentQuarterEnd = new Date(now.getFullYear(), currentQuarter * 3 + 3, 0).toLocaleDateString('en-CA');
  const isCurrentQuarter = startDate === currentQuarterStart && endDate === currentQuarterEnd;

  const currentHalf = Math.floor(now.getMonth() / 6);
  const currentHalfStart = new Date(now.getFullYear(), currentHalf * 6, 1).toLocaleDateString('en-CA');
  const currentHalfEnd = new Date(now.getFullYear(), currentHalf * 6 + 6, 0).toLocaleDateString('en-CA');
  const isCurrentHalf = startDate === currentHalfStart && endDate === currentHalfEnd;

  const isAllTime = !startDate && !endDate;

  return (
    <div className={styles.page}>
      <Navbar />
      <main className={styles.main}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>📊 통계 대시보드</h1>
            <p className={styles.sub}>조회 기간 동안의 클럽 정기 모임 및 분기 대회 결과를 통합 집계합니다.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {isAdmin && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setRuleForm({ ...rankingRules });
                  setShowRuleModal(true);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderRadius: 'var(--radius-full)',
                  padding: '8px 16px',
                  fontWeight: 700,
                  fontSize: '0.86rem',
                  boxShadow: '0 2px 8px rgba(0, 122, 255, 0.2)'
                }}
              >
                ⚙️ 산정 기준 설정
              </button>
            )}
            <button 
              type="button"
              className="btn btn-secondary btn-sm" 
              onClick={() => router.push('/dashboard')}
              style={{
                borderRadius: 'var(--radius-full)',
                padding: '8px 16px',
                fontWeight: 600,
                fontSize: '0.86rem'
              }}
            >
              대시보드
            </button>
          </div>
        </div>

        {/* 필터 영역 (조회 기간 + 집계 대상 선택) */}
        <div className="card" style={{ marginBottom: '20px', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* 1. 조회 기간 선택 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '15px' }}>📅</span>
                <strong style={{ fontSize: '13.5px', color: 'var(--txt)', fontWeight: 700 }}>조회 기간</strong>
                {(startDate || endDate) && (
                  <span style={{ fontSize: '11px', color: 'var(--ios-blue)', fontWeight: 600, backgroundColor: 'rgba(0, 122, 255, 0.08)', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                    필터 적용 중
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '1 1 auto', justifyContent: 'flex-end' }}>
                <input 
                  className="input input-sm" 
                  type="date" 
                  value={startDate} 
                  onChange={e => setStartDate(e.target.value)} 
                  style={{ 
                    flex: '1 1 125px',
                    maxWidth: '150px',
                    height: '34px', 
                    fontSize: '12px',
                    borderRadius: 'var(--radius-md)',
                    padding: '4px 8px'
                  }} 
                />
                <span style={{ color: 'var(--txt3)', fontWeight: 600 }}>~</span>
                <input 
                  className="input input-sm" 
                  type="date" 
                  value={endDate} 
                  onChange={e => setEndDate(e.target.value)} 
                  style={{ 
                    flex: '1 1 125px',
                    maxWidth: '150px',
                    height: '34px', 
                    fontSize: '12px',
                    borderRadius: 'var(--radius-md)',
                    padding: '4px 8px'
                  }} 
                />
              </div>
            </div>

            {/* Quick Presets (4-column responsive grid) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '6px',
              width: '100%'
            }}>
              <button 
                type="button"
                className={`btn btn-sm ${isAllTime ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => { setStartDate(''); setEndDate(''); }}
                style={{
                  borderRadius: 'var(--radius-full)',
                  padding: '7px 4px',
                  fontSize: '12px',
                  fontWeight: isAllTime ? 700 : 500,
                  textAlign: 'center',
                  justifyContent: 'center',
                  whiteSpace: 'nowrap'
                }}
              >
                전체 기간
              </button>
              <button 
                type="button"
                className={`btn btn-sm ${isCurrentMonth ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => {
                  setStartDate(currentMonthStart);
                  setEndDate(currentMonthEnd);
                }}
                style={{
                  borderRadius: 'var(--radius-full)',
                  padding: '7px 4px',
                  fontSize: '12px',
                  fontWeight: isCurrentMonth ? 700 : 500,
                  textAlign: 'center',
                  justifyContent: 'center',
                  whiteSpace: 'nowrap'
                }}
              >
                이번 달
              </button>
              <button 
                type="button"
                className={`btn btn-sm ${isCurrentQuarter ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => {
                  setStartDate(currentQuarterStart);
                  setEndDate(currentQuarterEnd);
                }}
                style={{
                  borderRadius: 'var(--radius-full)',
                  padding: '7px 4px',
                  fontSize: '12px',
                  fontWeight: isCurrentQuarter ? 700 : 500,
                  textAlign: 'center',
                  justifyContent: 'center',
                  whiteSpace: 'nowrap'
                }}
              >
                이번 분기
              </button>
              <button 
                type="button"
                className={`btn btn-sm ${isCurrentHalf ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => {
                  setStartDate(currentHalfStart);
                  setEndDate(currentHalfEnd);
                }}
                style={{
                  borderRadius: 'var(--radius-full)',
                  padding: '7px 4px',
                  fontSize: '12px',
                  fontWeight: isCurrentHalf ? 700 : 500,
                  textAlign: 'center',
                  justifyContent: 'center',
                  whiteSpace: 'nowrap'
                }}
              >
                이번 반기
              </button>
            </div>
          </div>

          {/* 2. 집계 대상 (정기모임 / 분기대회 / 전체 통합) 선택 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '15px' }}>🎯</span>
                <strong style={{ fontSize: '13.5px', color: 'var(--txt)', fontWeight: 700 }}>집계 대상</strong>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--txt3)' }}>
                {sourceFilter === 'ALL' && '🎾 정기 모임 + 🏆 분기 대회 통합 집계'}
                {sourceFilter === 'REGULAR' && '🏸 주간 정기 모임 결과만 집계'}
                {sourceFilter === 'TOURNAMENT' && '🏆 분기 대회 경기 결과만 집계'}
              </span>
            </div>

            {/* Segmented Tab Pill Group (3 equal columns) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '6px',
              background: 'rgba(0, 0, 0, 0.05)',
              padding: '4px',
              borderRadius: 'var(--radius-full)',
              width: '100%',
              boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.05)'
            }}>
              <button
                type="button"
                onClick={() => setSourceFilter('ALL')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  padding: '9px 4px',
                  borderRadius: 'var(--radius-full)',
                  border: 'none',
                  fontWeight: sourceFilter === 'ALL' ? 700 : 500,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  background: sourceFilter === 'ALL' ? '#ffffff' : 'transparent',
                  color: sourceFilter === 'ALL' ? 'var(--ios-blue)' : 'var(--txt2)',
                  boxShadow: sourceFilter === 'ALL' ? '0 2px 8px rgba(0, 122, 255, 0.15), 0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  whiteSpace: 'nowrap'
                }}
              >
                🎾 전체 통합
              </button>
              <button
                type="button"
                onClick={() => setSourceFilter('REGULAR')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  padding: '9px 4px',
                  borderRadius: 'var(--radius-full)',
                  border: 'none',
                  fontWeight: sourceFilter === 'REGULAR' ? 700 : 500,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  background: sourceFilter === 'REGULAR' ? '#ffffff' : 'transparent',
                  color: sourceFilter === 'REGULAR' ? 'var(--ios-blue)' : 'var(--txt2)',
                  boxShadow: sourceFilter === 'REGULAR' ? '0 2px 8px rgba(0, 122, 255, 0.15), 0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  whiteSpace: 'nowrap'
                }}
              >
                🏸 정기 모임
              </button>
              <button
                type="button"
                onClick={() => setSourceFilter('TOURNAMENT')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  padding: '9px 4px',
                  borderRadius: 'var(--radius-full)',
                  border: 'none',
                  fontWeight: sourceFilter === 'TOURNAMENT' ? 700 : 500,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  background: sourceFilter === 'TOURNAMENT' ? '#ffffff' : 'transparent',
                  color: sourceFilter === 'TOURNAMENT' ? 'var(--ios-blue)' : 'var(--txt2)',
                  boxShadow: sourceFilter === 'TOURNAMENT' ? '0 2px 8px rgba(0, 122, 255, 0.15), 0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  whiteSpace: 'nowrap'
                }}
              >
                🏆 분기 대회
              </button>
            </div>
          </div>
        </div>

        {/* 📐 승점 산정 기준 및 순위 결정 공식 상세 안내 카드 */}
        <div className="card" style={{ marginBottom: '24px', padding: '16px 20px', backgroundColor: '#f8fafc', border: '1px solid #bfdbfe', borderRadius: '16px' }}>
          <div 
            style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              cursor: 'pointer',
              userSelect: 'none',
              flexWrap: 'wrap',
              gap: '12px'
            }}
            onClick={() => setShowRulesDetail(prev => !prev)}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: '1 1 280px' }}>
              <span style={{ fontSize: '22px', lineHeight: 1 }}>📐</span>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: '14px', color: '#1e40af' }}>승점 및 종합 순위 산정 기준 안내</strong>
                  {isAdmin && (
                    <span style={{ fontSize: '11px', color: '#0369a1', backgroundColor: '#e0f2fe', padding: '2px 7px', borderRadius: 'var(--radius-full)', fontWeight: 700 }}>
                      ⚙️ 설정 가능
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: '#2563eb', marginTop: '4px', fontWeight: 600, lineHeight: 1.4 }}>
                  최종 승점 = {rankingRules.calcType === 'sum' ? '누적 경기 포인트' : '평균 경기 포인트'}(승{rankingRules.winPoints} / 무{rankingRules.drawPoints} / 패{rankingRules.lossPoints}) + 출전 가산점(참여일수 × {rankingRules.bonusPerDay}점{rankingRules.bonusPerMatch > 0 ? ` + 경기수 × ${rankingRules.bonusPerMatch}점` : ''})
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {isAdmin && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRuleForm({ ...rankingRules });
                    setShowRuleModal(true);
                  }}
                  style={{ 
                    borderRadius: 'var(--radius-full)',
                    padding: '6px 14px', 
                    fontSize: '12px', 
                    fontWeight: 700,
                    boxShadow: '0 2px 6px rgba(0, 122, 255, 0.2)'
                  }}
                >
                  ⚙️ 기준 변경
                </button>
              )}
              <button 
                type="button" 
                className="btn btn-secondary btn-sm"
                style={{ 
                  borderRadius: 'var(--radius-full)',
                  padding: '6px 14px', 
                  fontSize: '12px', 
                  fontWeight: 700, 
                  color: '#2563eb', 
                  borderColor: '#bfdbfe', 
                  backgroundColor: '#fff' 
                }}
              >
                {showRulesDetail ? '산정 기준 접기 ▲' : '자세히 보기 ▼'}
              </button>
            </div>
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
                      <span>+{rankingRules.winPoints}점</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontWeight: 700 }}>
                      <span>🤝 무승부 (Draw)</span>
                      <span>+{rankingRules.drawPoints}점</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626', fontWeight: 700 }}>
                      <span>🥉 패배 (Loss)</span>
                      <span>+{rankingRules.lossPoints}점</span>
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--txt3)', marginTop: '8px', borderTop: '1px dashed #f1f5f9', paddingTop: '6px' }}>
                    총 경기포인트 = (승리수×{rankingRules.winPoints}) + (무승부수×{rankingRules.drawPoints}) + (패배수×{rankingRules.lossPoints})
                  </div>
                </div>

                {/* 2. 평균 / 누적 경기 포인트 */}
                <div style={{ padding: '12px 14px', backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <span style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800 }}>2</span>
                    <strong style={{ fontSize: '13px', color: 'var(--txt)' }}>
                      {rankingRules.calcType === 'sum' ? '누적 경기 포인트 합산' : '평균 경기 포인트 (Average)'}
                    </strong>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--txt)', lineHeight: '1.5' }}>
                    <div style={{ fontWeight: 800, color: '#0369a1', backgroundColor: '#f0f9ff', padding: '6px 8px', borderRadius: '6px', textAlign: 'center', marginBottom: '6px' }}>
                      {rankingRules.calcType === 'sum' ? '총 경기 포인트 합산' : '총 경기 포인트 ÷ 총 출전 경기수'}
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--txt2)' }}>
                      {rankingRules.calcType === 'sum'
                        ? '치른 모든 경기의 포인트를 단순 합산하여 반영합니다.'
                        : '회원별 경기수 편차로 인한 왜곡을 방지하기 위해 1경기당 평균 기여 점수로 환산합니다.'}
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
                      <span>
                        참여일수 × {rankingRules.bonusPerDay}점
                        {rankingRules.bonusPerMatch > 0 ? ` + 경기수 × ${rankingRules.bonusPerMatch}점` : ''}
                      </span>
                    </div>
                    <div style={{ padding: '6px 8px', backgroundColor: '#eff6ff', borderRadius: '6px', border: '1px solid #bfdbfe', fontWeight: 800, color: '#1d4ed8', textAlign: 'center' }}>
                      최종 승점 = {rankingRules.calcType === 'sum' ? '누적 경기포인트' : '평균 포인트'} + 출전 가산점
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
                {(() => {
                  const exWins = 6;
                  const exLoss = 2;
                  const exDays = 4;
                  const exGames = exWins + exLoss;
                  const exTotalMatch = (exWins * rankingRules.winPoints) + (exLoss * rankingRules.lossPoints);
                  const exBase = rankingRules.calcType === 'sum' ? exTotalMatch : (exTotalMatch / exGames);
                  const exBonus = (exDays * rankingRules.bonusPerDay) + (exGames * rankingRules.bonusPerMatch);
                  const exFinal = exBase + exBonus;

                  return (
                    <div style={{ padding: '10px 14px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#14532d' }}>
                      <strong style={{ color: '#15803d' }}>💡 승점 계산 상세 예시 (현재 설정 기준):</strong>
                      <div style={{ marginTop: '4px', lineHeight: '1.5' }}>
                        • <strong>{exDays}일 참여</strong>하여 <strong>총 {exGames}경기 ({exWins}승 {exLoss}패)</strong>를 치른 경우:
                        <div style={{ paddingLeft: '8px', color: '#166534', marginTop: '3px' }}>
                          - 총 경기 포인트: ({exWins}승×{rankingRules.winPoints}점) + ({exLoss}패×{rankingRules.lossPoints}점) = <strong>{exTotalMatch.toFixed(1)}점</strong><br />
                          {rankingRules.calcType === 'avg' && (
                            <>- 1경기당 평균 포인트: {exTotalMatch.toFixed(1)}점 ÷ {exGames}경기 = <strong>{exBase.toFixed(2)}점</strong><br /></>
                          )}
                          - 출전 가산점: {exDays}일 × {rankingRules.bonusPerDay}점{rankingRules.bonusPerMatch > 0 ? ` + ${exGames}경기 × ${rankingRules.bonusPerMatch}점` : ''} = <strong>{exBonus.toFixed(2)}점</strong><br />
                          👉 <strong>최종 승점: {exBase.toFixed(2)} + {exBonus.toFixed(2)} = {exFinal.toFixed(2)}점</strong>
                        </div>
                      </div>
                    </div>
                  );
                })()}

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
            <div className="section-head" style={{ marginBottom: '12px' }}>
              <span style={{ fontSize: '1rem', fontWeight: 800 }}>🏆 명예의 전당 (Top 3)</span>
            </div>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {top3.map((s, idx) => (
                <div 
                  key={s.id} 
                  className="card card-hoverable" 
                  style={{ 
                    flex: '1 1 240px', 
                    padding: '20px 22px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '16px',
                    position: 'relative',
                    overflow: 'hidden',
                    border: idx === 0 ? '1px solid rgba(255, 149, 0, 0.35)' : idx === 1 ? '1px solid rgba(142, 142, 147, 0.35)' : '1px solid rgba(175, 82, 222, 0.35)',
                    background: idx === 0 ? 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(255,247,237,0.92) 100%)' : 'var(--surface)'
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
        <div className="card" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--txt)' }}>전체 순위 및 참여 현황</h2>
              <span style={{ fontSize: '12px', color: 'var(--txt3)' }}>
                (※ 승점 산정 기준: {rankingRules.calcType === 'sum' ? '누적포인트' : '평균포인트'}(승{rankingRules.winPoints}, 무{rankingRules.drawPoints}, 패{rankingRules.lossPoints}) + 출전가산점(참여일수당 {rankingRules.bonusPerDay}점{rankingRules.bonusPerMatch > 0 ? `, 경기당 ${rankingRules.bonusPerMatch}점` : ''}))
              </span>
            </div>
            {sourceFilter === 'ALL' && (
              <span className="badge badge-blue" style={{ fontSize: '11.5px', padding: '4px 10px' }}>
                🎾 정기모임 + 🏆 분기대회 통합 반영중
              </span>
            )}
          </div>
          {globalStandings.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>해당 기간에 기록된 데이터가 없습니다.</p>
          ) : (
            <div className="table-wrap">
              <table className="table" style={{ width: '100%', textAlign: 'center' }}>
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

        {/* ⚙️ 산정 기준 설정 모달 (운영진 전용) */}
        {showRuleModal && (
          <div 
            className="modal-overlay" 
            style={{ 
              position: 'fixed', 
              top: 0, 
              left: 0, 
              right: 0, 
              bottom: 0, 
              backgroundColor: 'rgba(0,0,0,0.5)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              zIndex: 1000,
              padding: '16px'
            }}
            onClick={() => setShowRuleModal(false)}
          >
            <div 
              className="card" 
              style={{ 
                maxWidth: '520px', 
                width: '100%', 
                maxHeight: '90vh', 
                overflowY: 'auto', 
                padding: '24px',
                borderRadius: '16px',
                backgroundColor: '#fff',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: 'var(--txt)' }}>
                  ⚙️ 승점 및 순위 산정 기준 설정
                </h3>
                <button 
                  type="button" 
                  onClick={() => setShowRuleModal(false)}
                  style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--txt3)' }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveRules} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* 1. 경기별 승/무/패 포인트 */}
                <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <label style={{ fontSize: '13px', fontWeight: 800, color: 'var(--txt)', display: 'block', marginBottom: '8px' }}>
                    1️⃣ 경기별 포인트 (Match Points)
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                    <div>
                      <span style={{ fontSize: '11.5px', color: '#16a34a', fontWeight: 700, display: 'block', marginBottom: '4px' }}>🥇 승리 포인트</span>
                      <input 
                        className="input" 
                        type="number" 
                        step="0.1" 
                        min="0"
                        value={ruleForm.winPoints} 
                        onChange={e => setRuleForm({ ...ruleForm, winPoints: e.target.value })} 
                        required 
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: '4px' }}>🤝 무승부 포인트</span>
                      <input 
                        className="input" 
                        type="number" 
                        step="0.1" 
                        min="0"
                        value={ruleForm.drawPoints} 
                        onChange={e => setRuleForm({ ...ruleForm, drawPoints: e.target.value })} 
                        required 
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: '11.5px', color: '#dc2626', fontWeight: 700, display: 'block', marginBottom: '4px' }}>🥉 패배 포인트</span>
                      <input 
                        className="input" 
                        type="number" 
                        step="0.1" 
                        min="0"
                        value={ruleForm.lossPoints} 
                        onChange={e => setRuleForm({ ...ruleForm, lossPoints: e.target.value })} 
                        required 
                      />
                    </div>
                  </div>
                </div>

                {/* 2. 포인트 산정 방식 */}
                <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <label style={{ fontSize: '13px', fontWeight: 800, color: 'var(--txt)', display: 'block', marginBottom: '8px' }}>
                    2️⃣ 경기 포인트 산정 방식
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name="calcType" 
                        value="avg" 
                        checked={ruleForm.calcType === 'avg'} 
                        onChange={() => setRuleForm({ ...ruleForm, calcType: 'avg' })} 
                      />
                      <div>
                        <strong>1경기당 평균 기여도 방식 (권장)</strong>
                        <div style={{ fontSize: '11px', color: 'var(--txt3)' }}>
                          총 경기 포인트 ÷ 총 경기수 (회원별 출전 경기수 차이 왜곡 방지)
                        </div>
                      </div>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name="calcType" 
                        value="sum" 
                        checked={ruleForm.calcType === 'sum'} 
                        onChange={() => setRuleForm({ ...ruleForm, calcType: 'sum' })} 
                      />
                      <div>
                        <strong>누적 포인트 합산 방식</strong>
                        <div style={{ fontSize: '11px', color: 'var(--txt3)' }}>
                          치른 모든 경기의 포인트를 단순 합산하여 반영
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* 3. 출전 가산점 */}
                <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <label style={{ fontSize: '13px', fontWeight: 800, color: 'var(--txt)', display: 'block', marginBottom: '8px' }}>
                    3️⃣ 출전 가산점 (Attendance Bonus)
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                    <div>
                      <span style={{ fontSize: '11.5px', color: '#15803d', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                        📅 참여일수당 가산점
                      </span>
                      <input 
                        className="input" 
                        type="number" 
                        step="0.1" 
                        min="0"
                        value={ruleForm.bonusPerDay} 
                        onChange={e => setRuleForm({ ...ruleForm, bonusPerDay: e.target.value })} 
                        required 
                      />
                      <span style={{ fontSize: '10.5px', color: 'var(--txt3)', display: 'block', marginTop: '2px' }}>
                        (기본값: 1.0점)
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: '11.5px', color: '#15803d', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                        🎾 경기당 가산점 (선택)
                      </span>
                      <input 
                        className="input" 
                        type="number" 
                        step="0.1" 
                        min="0"
                        value={ruleForm.bonusPerMatch} 
                        onChange={e => setRuleForm({ ...ruleForm, bonusPerMatch: e.target.value })} 
                        required 
                      />
                      <span style={{ fontSize: '10.5px', color: 'var(--txt3)', display: 'block', marginTop: '2px' }}>
                        (기본값: 0.0점)
                      </span>
                    </div>
                  </div>
                </div>

                {/* 하단 버튼 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', gap: '8px', flexWrap: 'wrap' }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm"
                    onClick={handleResetDefaultRules}
                    style={{ 
                      borderRadius: 'var(--radius-full)',
                      padding: '8px 16px',
                      fontSize: '12.5px',
                      fontWeight: 600
                    }}
                  >
                    기본값 복원
                  </button>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      type="button" 
                      className="btn btn-secondary btn-sm"
                      onClick={() => setShowRuleModal(false)}
                      disabled={savingRules}
                      style={{ 
                        borderRadius: 'var(--radius-full)',
                        padding: '8px 16px',
                        fontSize: '12.5px',
                        fontWeight: 600
                      }}
                    >
                      취소
                    </button>
                    <button 
                      type="submit" 
                      className="btn btn-primary btn-sm"
                      disabled={savingRules}
                      style={{ 
                        borderRadius: 'var(--radius-full)',
                        padding: '8px 20px',
                        fontSize: '12.5px',
                        fontWeight: 700
                      }}
                    >
                      {savingRules ? '저장 중...' : '설정 저장'}
                    </button>
                  </div>
                </div>

              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getMembers, getSchedules, getTournaments, initDefaultMembers, getRankingRules, updateRankingRules } from '@/lib/firestore';
import { computeGlobalStandings } from '@/lib/scheduler';
import Navbar from '@/components/Navbar';
import { PageHeaderIcon, TrophyIcon, StatsIcon } from '@/components/Icons';
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
  const [showRulesDetail, setShowRulesDetail] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [showCustomDate, setShowCustomDate] = useState(false);

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

  const filteredStandings = useMemo(() => {
    if (!searchKeyword.trim()) return globalStandings;
    const kw = searchKeyword.trim().toLowerCase();
    return globalStandings.filter(s => s.name.toLowerCase().includes(kw));
  }, [globalStandings, searchKeyword]);

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
  const isCustom = !isAllTime && !isCurrentMonth && !isCurrentQuarter && !isCurrentHalf;

  return (
    <div className={styles.page}>
      <Navbar />
      <main className={styles.main}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title} style={{ display: 'flex', alignItems: 'center' }}>
              <PageHeaderIcon type="stats" />
              <span>통계 대시보드</span>
            </h1>
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

        {/* 통합 필터 컨트롤러 (슬림형) */}
        <div className="card" style={{ marginBottom: '18px', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {/* 1. 집계 대상 세그먼트 (전체 통합 / 정기 모임 / 분기 대회) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '6px',
            background: 'rgba(0, 0, 0, 0.05)',
            padding: '3px',
            borderRadius: 'var(--radius-full)',
            width: '100%'
          }}>
            <button
              type="button"
              onClick={() => setSourceFilter('ALL')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                padding: '8px 4px',
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
                gap: '5px',
                padding: '8px 4px',
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
                gap: '5px',
                padding: '8px 4px',
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

          {/* 2. 조회 기간 프리셋 칩 바 (5개) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(68px, 1fr))',
            gap: '6px',
            width: '100%'
          }}>
            <button 
              type="button"
              className={`btn btn-sm ${isAllTime ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setStartDate(''); setEndDate(''); setShowCustomDate(false); }}
              style={{
                borderRadius: 'var(--radius-full)',
                padding: '6px 4px',
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
                setShowCustomDate(false);
              }}
              style={{
                borderRadius: 'var(--radius-full)',
                padding: '6px 4px',
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
                setShowCustomDate(false);
              }}
              style={{
                borderRadius: 'var(--radius-full)',
                padding: '6px 4px',
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
                setShowCustomDate(false);
              }}
              style={{
                borderRadius: 'var(--radius-full)',
                padding: '6px 4px',
                fontSize: '12px',
                fontWeight: isCurrentHalf ? 700 : 500,
                textAlign: 'center',
                justifyContent: 'center',
                whiteSpace: 'nowrap'
              }}
            >
              이번 반기
            </button>
            <button 
              type="button"
              className={`btn btn-sm ${isCustom || showCustomDate ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setShowCustomDate(prev => !prev)}
              style={{
                borderRadius: 'var(--radius-full)',
                padding: '6px 4px',
                fontSize: '12px',
                fontWeight: isCustom || showCustomDate ? 700 : 500,
                textAlign: 'center',
                justifyContent: 'center',
                whiteSpace: 'nowrap'
              }}
            >
              📅 직접 지정
            </button>
          </div>

          {/* 직접 날짜 선택 영역 (showCustomDate 또는 isCustom 일 때만 노출) */}
          {(showCustomDate || isCustom) && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              paddingTop: '8px',
              borderTop: '1px solid var(--border)',
              flexWrap: 'wrap'
            }}>
              <span style={{ fontSize: '12px', color: 'var(--txt3)', fontWeight: 600 }}>기간 선택:</span>
              <input 
                className="input input-sm" 
                type="date" 
                value={startDate} 
                onChange={e => setStartDate(e.target.value)} 
                style={{ 
                  width: '135px',
                  height: '32px', 
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
                  width: '135px',
                  height: '32px', 
                  fontSize: '12px',
                  borderRadius: 'var(--radius-md)',
                  padding: '4px 8px'
                }} 
              />
            </div>
          )}

        </div>

        {/* 📐 승점 산정 기준 및 순위 결정 공식 안내 (접이식 아코디언) */}
        <div className="card" style={{ marginBottom: '18px', padding: '12px 18px', backgroundColor: '#f8fafc', border: '1px solid #bfdbfe', borderRadius: '14px' }}>
          <div 
            style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              cursor: 'pointer',
              userSelect: 'none',
              flexWrap: 'wrap',
              gap: '10px'
            }}
            onClick={() => setShowRulesDetail(prev => !prev)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '18px' }}>📐</span>
              <strong style={{ fontSize: '13px', color: '#1e40af' }}>승점 산정 기준:</strong>
              <span style={{ fontSize: '12px', color: '#2563eb', fontWeight: 600 }}>
                {rankingRules.calcType === 'sum' ? '누적 경기 포인트' : '평균 경기 포인트'}(승{rankingRules.winPoints} / 무{rankingRules.drawPoints} / 패{rankingRules.lossPoints}) + 출전 가산점(참여일당 {rankingRules.bonusPerDay}점{rankingRules.bonusPerMatch > 0 ? ` + 경기당 ${rankingRules.bonusPerMatch}점` : ''})
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                    padding: '4px 12px', 
                    fontSize: '11.5px', 
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
                  padding: '4px 12px', 
                  fontSize: '11.5px', 
                  fontWeight: 700, 
                  color: '#2563eb', 
                  borderColor: '#bfdbfe', 
                  backgroundColor: '#fff' 
                }}
              >
                {showRulesDetail ? '접기 ▲' : '상세 공식 보기 ▼'}
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

        {/* 📊 주요 KPI 요약 지표 카드 (슬림 4열 그리드) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '20px' }}>
          <div className="card" style={{ padding: '12px 14px', marginBottom: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ fontSize: '20px', width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(0, 122, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              👥
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '11px', color: 'var(--txt3)', fontWeight: 600 }}>출전 회원</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--txt)', whiteSpace: 'nowrap' }}>
                {statsSummary.activePlayersCount}명
                <span style={{ fontSize: '11px', color: 'var(--txt3)', fontWeight: 500, marginLeft: '3px' }}>/{members.length}명</span>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '12px 14px', marginBottom: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ fontSize: '20px', width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(52, 199, 89, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              🎾
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '11px', color: 'var(--txt3)', fontWeight: 600 }}>총 경기 수</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--txt)', whiteSpace: 'nowrap' }}>
                {statsSummary.totalGames}경기
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '12px 14px', marginBottom: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ fontSize: '20px', width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(255, 149, 0, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              📅
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '11px', color: 'var(--txt3)', fontWeight: 600 }}>반영 일정</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--txt)', whiteSpace: 'nowrap' }}>
                {sourceFilter === 'ALL' 
                  ? `${statsSummary.filteredSchedulesCount + statsSummary.filteredTournamentsCount}회`
                  : sourceFilter === 'REGULAR' 
                  ? `${statsSummary.filteredSchedulesCount}회`
                  : `${statsSummary.filteredTournamentsCount}회`}
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '12px 14px', marginBottom: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ fontSize: '20px', width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(175, 82, 222, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              ⚖️
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '11px', color: 'var(--txt3)', fontWeight: 600 }}>1인 평균 경기</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--txt)', whiteSpace: 'nowrap' }}>
                {statsSummary.avgGamesPerPlayer}경기
              </div>
            </div>
          </div>
        </div>

        {/* Top 3 영역 */}
        {top3.length > 0 && (
          <div style={{ marginBottom: '22px' }}>
            <div className="section-head" style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.98rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <TrophyIcon size={18} color="#d97706" active />
                <span>명예의 전당 (Top 3)</span>
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              {top3.map((s, idx) => (
                <div 
                  key={s.id} 
                  className="card card-hoverable" 
                  style={{ 
                    marginBottom: 0,
                    padding: '16px 18px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '14px',
                    position: 'relative',
                    overflow: 'hidden',
                    borderRadius: '14px',
                    border: idx === 0 
                      ? '1px solid rgba(255, 149, 0, 0.4)' 
                      : idx === 1 
                      ? '1px solid rgba(148, 163, 184, 0.4)' 
                      : '1px solid rgba(217, 119, 6, 0.3)',
                    background: idx === 0 
                      ? 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(255,247,237,0.95) 100%)' 
                      : idx === 1
                      ? 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.95) 100%)'
                      : 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(255,247,237,0.9) 100%)',
                    boxShadow: idx === 0 ? '0 4px 14px rgba(255, 149, 0, 0.12)' : '0 2px 8px rgba(0,0,0,0.03)'
                  }}
                >
                  <div style={{ 
                    fontSize: '24px', 
                    width: '42px', 
                    height: '42px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    borderRadius: '12px',
                    background: idx === 0 ? 'rgba(255, 149, 0, 0.15)' : idx === 1 ? 'rgba(148, 163, 184, 0.15)' : 'rgba(217, 119, 6, 0.15)',
                    flexShrink: 0
                  }}>
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                  </div>
                  <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', marginBottom: '3px' }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--txt)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {s.name}
                        <span style={{ fontSize: '11px', color: s.gender === 'F' ? '#e11d48' : '#2563eb', fontWeight: 600, marginLeft: '4px' }}>
                          ({s.gender === 'F' ? '여' : '남'})
                        </span>
                      </h3>
                      <strong style={{ color: 'var(--ios-blue)', fontSize: '13.5px', fontWeight: 800, flexShrink: 0 }}>
                        {Number.isInteger(s.points) ? s.points : s.points.toFixed(1)}점
                      </strong>
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--txt2)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span>{s.win}승 {s.draw > 0 ? `${s.draw}무 ` : ''}{s.loss}패</span>
                      <span style={{ color: 'var(--txt3)' }}>•</span>
                      <span>승률 {s.played > 0 ? Math.round(s.winRate * 100) : 0}%</span>
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#16a34a', marginTop: '2px', fontWeight: 600 }}>
                      {s.attendedDays}일 출전 ({s.played}경기, 득실 {s.diff > 0 ? `+${s.diff}` : s.diff})
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 전체 누적 순위표 */}
        <div className="card" style={{ padding: '18px 20px', borderRadius: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--txt)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <StatsIcon size={18} color="#2563eb" active />
                <span>전체 순위표</span>
              </h2>
              <span style={{ fontSize: '11.5px', color: 'var(--ios-blue)', backgroundColor: 'rgba(0, 122, 255, 0.08)', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontWeight: 700 }}>
                총 {filteredStandings.length}명
              </span>
            </div>

            {/* 실시간 회원 검색 인풋 */}
            <div style={{ position: 'relative', width: '100%', maxWidth: '200px' }}>
              <input
                type="text"
                className="input input-sm"
                placeholder="🔍 회원 이름 검색..."
                value={searchKeyword}
                onChange={e => setSearchKeyword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 26px 6px 12px',
                  fontSize: '12px',
                  borderRadius: 'var(--radius-full)'
                }}
              />
              {searchKeyword && (
                <button
                  type="button"
                  onClick={() => setSearchKeyword('')}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--txt3)',
                    cursor: 'pointer',
                    fontSize: '12px',
                    padding: 0
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {filteredStandings.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', textAlign: 'center', padding: '24px 0' }}>
              {searchKeyword ? `"${searchKeyword}" 검색 결과가 없습니다.` : '해당 기간에 기록된 데이터가 없습니다.'}
            </p>
          ) : (
            <div className="table-wrap" style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', textAlign: 'center' }}>
                <thead>
                  <tr>
                    <th style={{ width: 44 }}>순위</th>
                    <th>이름</th>
                    <th>승점</th>
                    <th>출전일</th>
                    <th>경기수</th>
                    <th>승률</th>
                    <th>승</th>
                    <th>무</th>
                    <th>패</th>
                    <th>득실차</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStandings.map((s, i) => (
                    <tr key={s.id}>
                      <td>
                        <strong>
                          {i === 0 && !searchKeyword ? '🥇 1' : i === 1 && !searchKeyword ? '🥈 2' : i === 2 && !searchKeyword ? '🥉 3' : i + 1}
                        </strong>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 700, color: 'var(--txt)' }}>{s.name}</span>
                        <span style={{ fontSize: 11, color: s.gender === 'F' ? '#e11d48' : '#2563eb', marginLeft: '4px' }}>
                          ({s.gender === 'F' ? '여' : '남'})
                        </span>
                      </td>
                      <td>
                        <strong style={{ color: 'var(--ios-blue)', fontSize: '13.5px' }}>
                          {Number.isInteger(s.points) ? s.points : s.points.toFixed(1)}
                        </strong>
                      </td>
                      <td>
                        <strong>{s.attendedDays}</strong>일
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                          <span style={{ fontWeight: 800 }}>{s.played}</span>
                          {sourceFilter === 'ALL' && s.played > 0 && (s.regularPlayed > 0 || s.tournamentPlayed > 0) && (
                            <span style={{ fontSize: '9.5px', color: 'var(--txt3)' }}>
                              ({s.regularPlayed}/{s.tournamentPlayed})
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{s.played > 0 ? Math.round(s.winRate * 100) : 0}%</td>
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

// components/FinanceCalculator.js — 코트비 관리 및 동호회 최적 인원 산출기
'use client';
import { useState, useEffect } from 'react';

function parseNum(val, fallback = 0) {
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  if (!val) return fallback;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  const n = parseInt(cleaned, 10);
  return isNaN(n) ? fallback : n;
}

export default function FinanceCalculator({
  members = [],
  isAdmin = false,
  currentClub = {},
  onSaveSettings
}) {
  // ── 클럽 회비 정보 ──
  const [feeCycle, setFeeCycle] = useState(currentClub?.feeCycle || '월납');
  const [feeAmount, setFeeAmount] = useState(currentClub?.feeAmount ? String(currentClub.feeAmount) : '30000');

  // ── 코트비 설정 (월 / 분기 / 연간) ──
  const [monthlyCourtFee, setMonthlyCourtFee] = useState(
    currentClub?.monthlyCourtFee !== undefined ? String(currentClub.monthlyCourtFee) : '400000'
  );
  const [quarterlyCourtFee, setQuarterlyCourtFee] = useState(
    currentClub?.quarterlyCourtFee !== undefined ? String(currentClub.quarterlyCourtFee) : '1200000'
  );
  const [annualCourtFee, setAnnualCourtFee] = useState(
    currentClub?.annualCourtFee !== undefined ? String(currentClub.annualCourtFee) : '4800000'
  );
  const [courtCount, setCourtCount] = useState(currentClub?.courtCount || 2);
  const [courtMemo, setCourtMemo] = useState(currentClub?.courtMemo || '');
  const [autoSyncCourt, setAutoSyncCourt] = useState(true);

  // ── 기타 지출 항목 (월 기준) ──
  const [ballCost, setBallCost] = useState(
    currentClub?.ballCost !== undefined ? String(currentClub.ballCost) : '50000'
  );
  const [snackCost, setSnackCost] = useState(
    currentClub?.snackCost !== undefined ? String(currentClub.snackCost) : '40000'
  );
  const [otherCost, setOtherCost] = useState(
    currentClub?.otherCost !== undefined ? String(currentClub.otherCost) : '30000'
  );

  // 볼 구매 간편 계산기
  const [showBallCalc, setShowBallCalc] = useState(false);
  const [ballCansPerMonth, setBallCansPerMonth] = useState(12);
  const [ballPricePerCan, setBallPricePerCan] = useState(4500);

  // ── 시간당 코트비 및 52주(1~12월) 월별 코트비 산출기 상태 ──
  const [hourlyCourtRate, setHourlyCourtRate] = useState(
    currentClub?.hourlyCourtRate !== undefined ? String(currentClub.hourlyCourtRate) : '25000'
  );
  const [hoursPerSession, setHoursPerSession] = useState(
    currentClub?.hoursPerSession !== undefined ? Number(currentClub.hoursPerSession) : 3
  );
  const [sessionsPerWeek, setSessionsPerWeek] = useState(
    currentClub?.sessionsPerWeek !== undefined ? Number(currentClub.sessionsPerWeek) : 1
  );
  const [discountRate, setDiscountRate] = useState(
    currentClub?.discountRate !== undefined ? String(currentClub.discountRate) : '0'
  );

  // ── 운영진 회비 감면 / 면제 옵션 (0%~100%) ──
  const [execDiscountRate, setExecDiscountRate] = useState(
    currentClub?.execDiscountRate !== undefined ? String(currentClub.execDiscountRate) : '0'
  );
  const [execCountOverride, setExecCountOverride] = useState(
    currentClub?.execCountOverride !== undefined ? String(currentClub.execCountOverride) : ''
  );

  // 기본 52주 배분 (1~12월: 총 52주)
  const defaultMonthWeeks = { 1: 4, 2: 4, 3: 5, 4: 4, 5: 4, 6: 4, 7: 5, 8: 4, 9: 4, 10: 5, 11: 4, 12: 5 };
  const [monthWeeks, setMonthWeeks] = useState(
    currentClub?.monthWeeks || defaultMonthWeeks
  );
  const [show52WeeksDetails, setShow52WeeksDetails] = useState(true);

  // 시뮬레이터 인원수
  const regularMembers = members.filter(m => m.role !== '준회원' && m.role !== '게스트');
  const [simulatedCount, setSimulatedCount] = useState(regularMembers.length || 15);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentClub) {
      if (currentClub.feeCycle) setFeeCycle(currentClub.feeCycle);
      if (currentClub.feeAmount) setFeeAmount(String(currentClub.feeAmount));
      if (currentClub.monthlyCourtFee !== undefined) setMonthlyCourtFee(String(currentClub.monthlyCourtFee));
      if (currentClub.quarterlyCourtFee !== undefined) setQuarterlyCourtFee(String(currentClub.quarterlyCourtFee));
      if (currentClub.annualCourtFee !== undefined) setAnnualCourtFee(String(currentClub.annualCourtFee));
      if (currentClub.courtCount !== undefined) setCourtCount(currentClub.courtCount);
      if (currentClub.courtMemo !== undefined) setCourtMemo(currentClub.courtMemo);
      if (currentClub.ballCost !== undefined) setBallCost(String(currentClub.ballCost));
      if (currentClub.snackCost !== undefined) setSnackCost(String(currentClub.snackCost));
      if (currentClub.otherCost !== undefined) setOtherCost(String(currentClub.otherCost));
      if (currentClub.hourlyCourtRate !== undefined) setHourlyCourtRate(String(currentClub.hourlyCourtRate));
      if (currentClub.hoursPerSession !== undefined) setHoursPerSession(Number(currentClub.hoursPerSession));
      if (currentClub.sessionsPerWeek !== undefined) setSessionsPerWeek(Number(currentClub.sessionsPerWeek));
      if (currentClub.discountRate !== undefined) setDiscountRate(String(currentClub.discountRate));
      if (currentClub.monthWeeks) setMonthWeeks(currentClub.monthWeeks);
      if (currentClub.execDiscountRate !== undefined) setExecDiscountRate(String(currentClub.execDiscountRate));
      if (currentClub.execCountOverride !== undefined) setExecCountOverride(String(currentClub.execCountOverride));
    }
  }, [currentClub]);

  const handleMonthlyCourtChange = (val) => {
    setMonthlyCourtFee(val);
    if (autoSyncCourt) {
      const num = parseNum(val, 0);
      setQuarterlyCourtFee(String(num * 3));
      setAnnualCourtFee(String(num * 12));
    }
  };

  const handleApplyBallCalc = () => {
    const total = ballCansPerMonth * ballPricePerCan;
    setBallCost(String(total));
    setShowBallCalc(false);
  };

  // ── 시간당 코트비 기반 52주 계산 ──
  const parsedHourlyRate = parseNum(hourlyCourtRate, 25000);
  const parsedDiscountRate = Math.min(100, Math.max(0, parseNum(discountRate, 0)));
  const parsedHours = Number(hoursPerSession) || 3;
  const parsedSessions = Number(sessionsPerWeek) || 1;
  const parsedCourts = Number(courtCount) || 2;

  // 1회 모임 코트비: 단가 × 시간 × 면수
  const costPerSessionBase = parsedHourlyRate * parsedHours * parsedCourts;
  const costPerSessionDiscount = Math.round(costPerSessionBase * (parsedDiscountRate / 100));
  const costPerSessionActual = costPerSessionBase - costPerSessionDiscount;

  // 주당 코트비: 1회 비용 × 주당 모임 횟수
  const weeklyBaseCost = costPerSessionBase * parsedSessions;
  const weeklyDiscountAmount = Math.round(weeklyBaseCost * (parsedDiscountRate / 100));
  const weeklyActualCost = weeklyBaseCost - weeklyDiscountAmount;

  // 1월 ~ 12월 월별 코트비 계산
  let totalWeeksSum = 0;
  let totalAnnualCost = 0;
  let totalAnnualBase = 0;
  let totalAnnualDiscount = 0;

  const monthlyBreakdown = [];
  for (let m = 1; m <= 12; m++) {
    const weeks = monthWeeks[m] !== undefined ? monthWeeks[m] : defaultMonthWeeks[m];
    totalWeeksSum += weeks;
    const baseCost = weeklyBaseCost * weeks;
    const actualCost = weeklyActualCost * weeks;
    const discountAmt = weeklyDiscountAmount * weeks;
    totalAnnualBase += baseCost;
    totalAnnualCost += actualCost;
    totalAnnualDiscount += discountAmt;

    monthlyBreakdown.push({
      month: m,
      weeks,
      baseCost,
      actualCost,
      discountAmt
    });
  }

  const averageMonthlyCost = Math.round(totalAnnualCost / 12);
  const averageQuarterlyCost = Math.round(totalAnnualCost / 4);

  // 분기별(Q1~Q4) 소계 계산
  const quarterlyBreakdown = [
    { name: '1분기 (1~3월)', months: [1, 2, 3], weeks: monthlyBreakdown.slice(0, 3).reduce((a, c) => a + c.weeks, 0), cost: monthlyBreakdown.slice(0, 3).reduce((a, c) => a + c.actualCost, 0) },
    { name: '2분기 (4~6월)', months: [4, 5, 6], weeks: monthlyBreakdown.slice(3, 6).reduce((a, c) => a + c.weeks, 0), cost: monthlyBreakdown.slice(3, 6).reduce((a, c) => a + c.actualCost, 0) },
    { name: '3분기 (7~9월)', months: [7, 8, 9], weeks: monthlyBreakdown.slice(6, 9).reduce((a, c) => a + c.weeks, 0), cost: monthlyBreakdown.slice(6, 9).reduce((a, c) => a + c.actualCost, 0) },
    { name: '4분기 (10~12월)', months: [10, 11, 12], weeks: monthlyBreakdown.slice(9, 12).reduce((a, c) => a + c.weeks, 0), cost: monthlyBreakdown.slice(9, 12).reduce((a, c) => a + c.actualCost, 0) }
  ];

  const handleApplyCalculatedCourtFee = () => {
    if (!isAdmin) return;
    setMonthlyCourtFee(String(averageMonthlyCost));
    if (autoSyncCourt) {
      setQuarterlyCourtFee(String(averageQuarterlyCost));
      setAnnualCourtFee(String(totalAnnualCost));
    }
  };

  const handleUpdateMonthWeeks = (month, delta) => {
    if (!isAdmin) return;
    setMonthWeeks(prev => {
      const current = prev[month] !== undefined ? prev[month] : defaultMonthWeeks[month];
      const next = Math.max(0, Math.min(6, current + delta));
      return { ...prev, [month]: next };
    });
  };

  const handleResetWeeks = () => {
    if (!isAdmin) return;
    setMonthWeeks(defaultMonthWeeks);
  };

  // ── 수치 계산 ──
  const parsedMonthlyCourt = parseNum(monthlyCourtFee, 0);
  const parsedQuarterlyCourt = parseNum(quarterlyCourtFee, parsedMonthlyCourt * 3);
  const parsedAnnualCourt = parseNum(annualCourtFee, parsedMonthlyCourt * 12);
  const parsedBallCost = parseNum(ballCost, 0);
  const parsedSnackCost = parseNum(snackCost, 0);
  const parsedOtherCost = parseNum(otherCost, 0);

  const totalMonthlyExpense = parsedMonthlyCourt + parsedBallCost + parsedSnackCost + parsedOtherCost;

  const rawFee = parseNum(feeAmount, 30000);
  let perMemberMonthlyFee = rawFee;
  if (feeCycle === '분기납') perMemberMonthlyFee = Math.round(rawFee / 3);
  if (feeCycle === '연납') perMemberMonthlyFee = Math.round(rawFee / 12);
  if (perMemberMonthlyFee <= 0) perMemberMonthlyFee = 30000;

  // ── 운영진 회비 감면 계산 ──
  const EXEC_ROLES = ['회장', '부회장', '총무', '경기이사', '운영이사'];
  const execMembers = regularMembers.filter(m => EXEC_ROLES.includes(m.role));
  const parsedExecDiscountRate = Math.min(100, Math.max(0, parseNum(execDiscountRate, 0)));

  // 운영진 1인당 월 납부 회비 및 1인당 감면 혜택액
  const execMonthlyFee = Math.round(perMemberMonthlyFee * (1 - parsedExecDiscountRate / 100));
  const execDiscountPerPerson = perMemberMonthlyFee - execMonthlyFee;

  // 적용 대상 운영진 수: 수동 지정값이 있으면 우선, 없으면 등록된 5대 직책 인원수, 직책 배정 전이면 기본 5명 (감면 설정 시)
  const parsedOverrideCount = execCountOverride !== '' && execCountOverride !== null && execCountOverride !== undefined
    ? Math.max(0, parseNum(execCountOverride, 0))
    : null;
  const appliedExecCount = parsedOverrideCount !== null
    ? parsedOverrideCount
    : (execMembers.length > 0 ? execMembers.length : (parsedExecDiscountRate > 0 ? Math.min(regularMembers.length || 5, 5) : 0));

  // 월간 운영진 감면 총액
  const totalExecDiscountMonthly = appliedExecCount * execDiscountPerPerson;

  // 현재 클럽 수입 계산 (운영진 감면액 반영)
  const currentRegularCount = regularMembers.length;
  const currentExecCount = Math.min(currentRegularCount, appliedExecCount);
  const currentGeneralCount = Math.max(0, currentRegularCount - currentExecCount);
  const currentTotalRevenue = (currentGeneralCount * perMemberMonthlyFee) + (currentExecCount * execMonthlyFee);
  const currentMonthlyBalance = currentTotalRevenue - totalMonthlyExpense;

  // 손익분기 최소 인원 (BEP): 운영진 수입을 제외한 남은 고정 지출을 충당하는 일반 회원 수 + 운영진 수
  const execBaseRevenue = appliedExecCount * execMonthlyFee;
  const bepRemainingExpense = Math.max(0, totalMonthlyExpense - execBaseRevenue);
  const bepGeneralNeeded = Math.ceil(bepRemainingExpense / perMemberMonthlyFee);
  const bepCount = appliedExecCount + bepGeneralNeeded;

  // 권장 최적 회원 수 (15% 예비비/적립금 포함): 운영진 감면 반영
  const targetExpenseWithReserve = totalMonthlyExpense * 1.15;
  const optRemainingExpense = Math.max(0, targetExpenseWithReserve - execBaseRevenue);
  const optGeneralNeeded = Math.ceil(optRemainingExpense / perMemberMonthlyFee);
  const recommendedOptimalCount = appliedExecCount + optGeneralNeeded;

  const courtCapacityMin = courtCount * 4;
  const courtCapacityMax = courtCount * 6;

  // 인원 변동 시뮬레이터 수지 (가상 회원 중 운영진 감면 우선 적용)
  const simExecCount = Math.min(simulatedCount, appliedExecCount);
  const simGeneralCount = Math.max(0, simulatedCount - simExecCount);
  const simRevenue = (simGeneralCount * perMemberMonthlyFee) + (simExecCount * execMonthlyFee);
  const simBalance = simRevenue - totalMonthlyExpense;

  const handleSaveAll = async () => {
    if (!isAdmin) return;
    setSaving(true);
    try {
      await onSaveSettings({
        feeCycle,
        feeAmount,
        monthlyCourtFee: parsedMonthlyCourt,
        quarterlyCourtFee: parsedQuarterlyCourt,
        annualCourtFee: parsedAnnualCourt,
        courtCount,
        courtMemo,
        ballCost: parsedBallCost,
        snackCost: parsedSnackCost,
        otherCost: parsedOtherCost,
        hourlyCourtRate: parsedHourlyRate,
        hoursPerSession: parsedHours,
        sessionsPerWeek: parsedSessions,
        discountRate: parsedDiscountRate,
        monthWeeks,
        execDiscountRate: parsedExecDiscountRate,
        execCountOverride: execCountOverride !== '' ? parseNum(execCountOverride, 0) : ''
      });
      alert('코트비 및 재정 설정이 성공적으로 저장되었습니다.');
    } catch (e) {
      console.error(e);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── 상단 타이틀 및 저장 버튼 ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--txt)', margin: 0, letterSpacing: '-0.02em' }}>
            🏟️ 코트비 현황 & 동호회 최적 인원 산출기
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            월·분기·연간 코트비와 정기 지출을 바탕으로 동호회 재정 손익분기점과 최적 회원 수를 실시간 분석합니다.
          </p>
        </div>
        {isAdmin && (
          <button 
            className="btn btn-primary" 
            onClick={handleSaveAll}
            disabled={saving}
            style={{ padding: '8px 18px', fontWeight: 700 }}
          >
            {saving ? '저장 중...' : '💾 설정값 저장'}
          </button>
        )}
      </div>

      {/* ── 1. 코트비 현황 관리 카드 ── */}
      <div className="card" style={{ padding: '20px', background: 'var(--surface)', borderRadius: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>🎾</span>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>코트비 현황 관리</h3>
          </div>
          {isAdmin && (
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: 'var(--txt2)', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={autoSyncCourt} 
                onChange={e => setAutoSyncCourt(e.target.checked)} 
              />
              월 코트비 입력 시 분기/연간 자동 연동
            </label>
          )}
        </div>

        {/* ── ⏱️ 시간당 코트비 & 52주(1~12월) 연간 코트비 정밀 산출기 ── */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.05) 0%, rgba(37, 99, 235, 0.05) 100%)',
          border: '1.5px solid rgba(56, 189, 248, 0.25)',
          borderRadius: '14px',
          padding: '16px',
          marginBottom: '20px'
        }}>
          {/* 타이틀 및 접기 토글 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '22px' }}>⏱️</span>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: '#0369a1' }}>
                    시간당 코트비 & 52주(1~12월) 연간 코트비 정밀 산출기
                  </h4>
                  <span className="badge badge-blue" style={{ fontSize: '11px', padding: '2px 8px', fontWeight: 700 }}>
                    연간 52주 풀캘린더
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--txt3)', margin: '2px 0 0 0' }}>
                  시간당 코트비와 할인율을 설정하여 1년 52주 전체의 실제 월별/연간 코트비를 정밀 산출합니다.
                </p>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShow52WeeksDetails(!show52WeeksDetails)}
              style={{ fontSize: '11.5px', height: '28px', padding: '3px 10px', borderRadius: '8px' }}
            >
              {show52WeeksDetails ? '상세 캘린더 접기 ▲' : '월별 52주 캘린더 펼치기 ▼'}
            </button>
          </div>

          {/* 입력 폼 그리드 (시간당 코트비, 1회 이용시간, 코트면수, 주당 모임횟수, 할인율) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
            backgroundColor: '#ffffff',
            padding: '14px',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            {/* 1. 시간당 코트비 */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--txt2)', display: 'block', marginBottom: '4px' }}>
                💰 시간당 코트비 (면당)
              </label>
              {isAdmin ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input 
                      className="input input-sm"
                      type="text"
                      value={Number(hourlyCourtRate).toLocaleString()}
                      onChange={e => setHourlyCourtRate(e.target.value.replace(/[^0-9]/g, ''))}
                      style={{ fontWeight: 800, fontSize: '15px' }}
                    />
                    <span style={{ fontSize: '12px', color: 'var(--txt2)', fontWeight: 600 }}>원</span>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                    {[20000, 25000, 30000, 35000].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setHourlyCourtRate(String(val))}
                        style={{
                          border: '1px solid #cbd5e1',
                          borderRadius: '4px',
                          padding: '1px 6px',
                          fontSize: '10.5px',
                          backgroundColor: Number(hourlyCourtRate) === val ? '#0284c7' : '#f8fafc',
                          color: Number(hourlyCourtRate) === val ? '#fff' : 'var(--txt2)',
                          cursor: 'pointer',
                          fontWeight: Number(hourlyCourtRate) === val ? 700 : 500
                        }}
                      >
                        {val.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--txt)' }}>
                  {parsedHourlyRate.toLocaleString()} <span style={{ fontSize: '12px' }}>원/시간</span>
                </div>
              )}
            </div>

            {/* 2. 1회 모임 이용 시간 */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--txt2)', display: 'block', marginBottom: '4px' }}>
                ⏰ 1회 모임 이용 시간
              </label>
              {isAdmin ? (
                <select
                  className="select input-sm"
                  value={hoursPerSession}
                  onChange={e => setHoursPerSession(Number(e.target.value))}
                  style={{ width: '100%', fontWeight: 700 }}
                >
                  <option value={2}>2시간</option>
                  <option value={2.5}>2시간 30분</option>
                  <option value={3}>3시간 (표준)</option>
                  <option value={3.5}>3시간 30분</option>
                  <option value={4}>4시간</option>
                  <option value={5}>5시간</option>
                </select>
              ) : (
                <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--txt)' }}>
                  {hoursPerSession}시간
                </div>
              )}
              <div style={{ fontSize: '11px', color: 'var(--txt3)', marginTop: '4px' }}>정기 모임 1회당 대관 시간</div>
            </div>

            {/* 3. 코트 면수 */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--txt2)', display: 'block', marginBottom: '4px' }}>
                🏟️ 코트 면수
              </label>
              {isAdmin ? (
                <select
                  className="select input-sm"
                  value={courtCount}
                  onChange={e => setCourtCount(Number(e.target.value))}
                  style={{ width: '100%', fontWeight: 700 }}
                >
                  <option value={1}>1면</option>
                  <option value={2}>2면 (표준)</option>
                  <option value={3}>3면</option>
                  <option value={4}>4면</option>
                  <option value={5}>5면</option>
                </select>
              ) : (
                <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--txt)' }}>
                  {courtCount}면
                </div>
              )}
              <div style={{ fontSize: '11px', color: 'var(--txt3)', marginTop: '4px' }}>동시 대관 코트 면수</div>
            </div>

            {/* 4. 주당 모임 횟수 */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--txt2)', display: 'block', marginBottom: '4px' }}>
                🗓️ 주당 모임 횟수
              </label>
              {isAdmin ? (
                <select
                  className="select input-sm"
                  value={sessionsPerWeek}
                  onChange={e => setSessionsPerWeek(Number(e.target.value))}
                  style={{ width: '100%', fontWeight: 700 }}
                >
                  <option value={1}>주 1회 (표준)</option>
                  <option value={2}>주 2회</option>
                  <option value={3}>주 3회</option>
                </select>
              ) : (
                <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--txt)' }}>
                  주 {sessionsPerWeek}회
                </div>
              )}
              <div style={{ fontSize: '11px', color: 'var(--txt3)', marginTop: '4px' }}>매주 정기 모임 빈도</div>
            </div>

            {/* 5. 할인율 (%) */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#047857', display: 'block', marginBottom: '4px' }}>
                🏷️ 할인율 / 감면율 (%)
              </label>
              {isAdmin ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input 
                      className="input input-sm"
                      type="text"
                      value={discountRate}
                      onChange={e => setDiscountRate(e.target.value.replace(/[^0-9]/g, ''))}
                      style={{ fontWeight: 800, fontSize: '15px', color: '#047857', borderColor: '#a7f3d0' }}
                    />
                    <span style={{ fontSize: '13px', color: '#047857', fontWeight: 700 }}>%</span>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                    {[0, 10, 20, 30, 50].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setDiscountRate(String(val))}
                        style={{
                          border: '1px solid #a7f3d0',
                          borderRadius: '4px',
                          padding: '1px 5px',
                          fontSize: '10px',
                          backgroundColor: Number(discountRate) === val ? '#059669' : '#f0fdf4',
                          color: Number(discountRate) === val ? '#fff' : '#047857',
                          cursor: 'pointer',
                          fontWeight: Number(discountRate) === val ? 700 : 500
                        }}
                      >
                        {val === 0 ? '0%(정상)' : `${val}%`}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#047857' }}>
                  {parsedDiscountRate}% <span style={{ fontSize: '11px' }}>{parsedDiscountRate > 0 ? '감면 적용' : '정상가'}</span>
                </div>
              )}
            </div>
          </div>

          {/* 실시간 4대 KPI 산출 요약 바 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
            marginTop: '12px'
          }}>
            {/* 1회 모임비용 */}
            <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: '#ffffff', border: '1px solid #e0f2fe' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--txt3)', fontWeight: 700 }}>1회 모임 비용 ({parsedHours}h × {parsedCourts}면)</span>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#0284c7', marginTop: '2px' }}>
                {costPerSessionActual.toLocaleString()} <span style={{ fontSize: '12px', fontWeight: 600 }}>원</span>
              </div>
              {parsedDiscountRate > 0 && (
                <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>
                  정상 {costPerSessionBase.toLocaleString()}원 (-{costPerSessionDiscount.toLocaleString()}원)
                </div>
              )}
            </div>

            {/* 1주 코트비 */}
            <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: '#ffffff', border: '1px solid #e0f2fe' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--txt3)', fontWeight: 700 }}>1주 코트비 (주 {parsedSessions}회)</span>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#0284c7', marginTop: '2px' }}>
                {weeklyActualCost.toLocaleString()} <span style={{ fontSize: '12px', fontWeight: 600 }}>원</span>
              </div>
              {parsedDiscountRate > 0 && (
                <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>
                  주당 -{weeklyDiscountAmount.toLocaleString()}원 절감
                </div>
              )}
            </div>

            {/* 연간 52주 총 코트비 */}
            <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: '#ffffff', border: '1px solid #e0f2fe' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--txt3)', fontWeight: 700 }}>🏆 연간 52주 총 코트비</span>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#7c3aed', marginTop: '2px' }}>
                {totalAnnualCost.toLocaleString()} <span style={{ fontSize: '12px', fontWeight: 600 }}>원</span>
              </div>
              {totalAnnualDiscount > 0 ? (
                <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>
                  총 -{totalAnnualDiscount.toLocaleString()}원 절감 ({parsedDiscountRate}%)
                </div>
              ) : (
                <div style={{ fontSize: '11px', color: 'var(--txt3)' }}>연간 52주 총 대관료</div>
              )}
            </div>

            {/* 월평균 코트비 & 적용 버튼 */}
            <div style={{ 
              padding: '12px', 
              borderRadius: '10px', 
              backgroundColor: '#eff6ff', 
              border: '2px solid #38bdf8',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <span style={{ fontSize: '11.5px', color: '#0369a1', fontWeight: 800 }}>⚡ 12개월 월평균 코트비</span>
                <div style={{ fontSize: '19px', fontWeight: 900, color: '#0284c7', marginTop: '2px' }}>
                  {averageMonthlyCost.toLocaleString()} <span style={{ fontSize: '12px', fontWeight: 600 }}>원</span>
                </div>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleApplyCalculatedCourtFee}
                  style={{ width: '100%', marginTop: '6px', fontSize: '11px', padding: '4px', fontWeight: 700 }}
                  title="이 산출 금액을 동호회 월 코트비에 즉시 반영합니다"
                >
                  ✨ 월 코트비로 일괄 적용
                </button>
              )}
            </div>
          </div>

          {/* ── 1월 ~ 12월 52주 월별 코트비 캘린더 그리드 ── */}
          {show52WeeksDetails && (
            <div style={{ marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--txt)' }}>
                    📅 1월 ~ 12월 월별 코트비 상세 산출표 (총 {totalWeeksSum}주)
                  </span>
                  <span className={`badge ${totalWeeksSum === 52 ? 'badge-green' : 'badge-gold'}`} style={{ fontSize: '11px', padding: '2px 8px' }}>
                    {totalWeeksSum === 52 ? '정확히 52주 완비 ✅' : `${totalWeeksSum}주 / 52주`}
                  </span>
                </div>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={handleResetWeeks}
                    style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '11.5px', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
                  >
                    기본 52주 주차배분 리셋
                  </button>
                )}
              </div>

              {/* 4분기 레이블 & 12개월 카드 그리드 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {quarterlyBreakdown.map((q, qIdx) => (
                  <div 
                    key={q.name}
                    style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '10px 12px'
                    }}
                  >
                    {/* 분기 헤더 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12.5px', fontWeight: 800, color: ['#0284c7', '#059669', '#d97706', '#7c3aed'][qIdx] }}>
                        {q.name} ({q.weeks}주)
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--txt2)' }}>
                        분기 소계: <strong style={{ color: 'var(--txt)', fontSize: '13px' }}>{q.cost.toLocaleString()}원</strong>
                      </span>
                    </div>

                    {/* 분기 내 3개 월 카드 */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                      gap: '8px'
                    }}>
                      {q.months.map(m => {
                        const mData = monthlyBreakdown[m - 1];
                        return (
                          <div 
                            key={m}
                            style={{
                              border: '1px solid #f1f5f9',
                              backgroundColor: '#f8fafc',
                              borderRadius: '8px',
                              padding: '8px 10px',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: 800, fontSize: '13px', color: 'var(--txt)' }}>
                                {m}월
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                {isAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateMonthWeeks(m, -1)}
                                    style={{
                                      border: '1px solid #cbd5e1',
                                      borderRadius: '3px',
                                      width: '18px',
                                      height: '18px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '11px',
                                      cursor: 'pointer',
                                      backgroundColor: '#fff'
                                    }}
                                    title="주 수 감소"
                                  >-</button>
                                )}
                                <span style={{
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  backgroundColor: mData.weeks === 5 ? '#e0f2fe' : '#f1f5f9',
                                  color: mData.weeks === 5 ? '#0284c7' : 'var(--txt2)',
                                  padding: '1px 5px',
                                  borderRadius: '4px'
                                }}>
                                  {mData.weeks}주
                                </span>
                                {isAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateMonthWeeks(m, 1)}
                                    style={{
                                      border: '1px solid #cbd5e1',
                                      borderRadius: '3px',
                                      width: '18px',
                                      height: '18px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '11px',
                                      cursor: 'pointer',
                                      backgroundColor: '#fff'
                                    }}
                                    title="주 수 증가"
                                  >+</button>
                                )}
                              </div>
                            </div>

                            {/* 금액 */}
                            <div style={{ marginTop: '6px' }}>
                              <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--txt)' }}>
                                {mData.actualCost.toLocaleString()} <span style={{ fontSize: '11px', fontWeight: 500 }}>원</span>
                              </div>
                              {mData.discountAmt > 0 && (
                                <div style={{ fontSize: '10px', color: '#16a34a', fontWeight: 600 }}>
                                  -{mData.discountAmt.toLocaleString()}원 할인
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── 확정 코트비 요약 카드 (월/분기/연간) ── */}
        <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--txt)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>📌</span>
          <span>동호회 확정 코트비 및 면수 현황</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          {/* 월 코트비 */}
          <div style={{
            background: 'rgba(37, 99, 235, 0.05)',
            border: '1px solid rgba(37, 99, 235, 0.15)',
            borderRadius: '12px',
            padding: '14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#1d4ed8' }}>📅 월 코트비</span>
              <span className="badge badge-blue" style={{ fontSize: '11px' }}>월 기준</span>
            </div>
            {isAdmin ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input 
                  className="input" 
                  type="text" 
                  value={Number(monthlyCourtFee).toLocaleString()} 
                  onChange={e => handleMonthlyCourtChange(e.target.value.replace(/[^0-9]/g, ''))}
                  style={{ fontWeight: 800, fontSize: '16px', color: 'var(--txt)' }}
                />
                <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--txt2)' }}>원</span>
              </div>
            ) : (
              <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--txt)', marginTop: '4px' }}>
                {parsedMonthlyCourt.toLocaleString()} <span style={{ fontSize: '14px', fontWeight: 600 }}>원</span>
              </div>
            )}
            <div style={{ fontSize: '11.5px', color: 'var(--txt3)', marginTop: '6px' }}>
              매월 고정으로 지출되는 코트 대관료
            </div>
          </div>

          {/* 분기 코트비 */}
          <div style={{
            background: 'rgba(16, 185, 129, 0.05)',
            border: '1px solid rgba(16, 185, 129, 0.15)',
            borderRadius: '12px',
            padding: '14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#047857' }}>📊 분기 코트비</span>
              <span className="badge badge-green" style={{ fontSize: '11px' }}>3개월분</span>
            </div>
            {isAdmin ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input 
                  className="input" 
                  type="text" 
                  value={Number(quarterlyCourtFee).toLocaleString()} 
                  disabled={autoSyncCourt}
                  onChange={e => setQuarterlyCourtFee(e.target.value.replace(/[^0-9]/g, ''))}
                  style={{ fontWeight: 800, fontSize: '16px', color: 'var(--txt)' }}
                />
                <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--txt2)' }}>원</span>
              </div>
            ) : (
              <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--txt)', marginTop: '4px' }}>
                {parsedQuarterlyCourt.toLocaleString()} <span style={{ fontSize: '14px', fontWeight: 600 }}>원</span>
              </div>
            )}
            <div style={{ fontSize: '11.5px', color: 'var(--txt3)', marginTop: '6px' }}>
              {autoSyncCourt ? '월 코트비 × 3 자동 환산' : '직접 입력한 분기 코트비'}
            </div>
          </div>

          {/* 연간 코트비 */}
          <div style={{
            background: 'rgba(168, 85, 247, 0.05)',
            border: '1px solid rgba(168, 85, 247, 0.15)',
            borderRadius: '12px',
            padding: '14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#7e22ce' }}>🏆 연간 코트비</span>
              <span className="badge" style={{ fontSize: '11px', background: '#f3e8ff', color: '#6b21a8' }}>1년분</span>
            </div>
            {isAdmin ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input 
                  className="input" 
                  type="text" 
                  value={Number(annualCourtFee).toLocaleString()} 
                  disabled={autoSyncCourt}
                  onChange={e => setAnnualCourtFee(e.target.value.replace(/[^0-9]/g, ''))}
                  style={{ fontWeight: 800, fontSize: '16px', color: 'var(--txt)' }}
                />
                <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--txt2)' }}>원</span>
              </div>
            ) : (
              <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--txt)', marginTop: '4px' }}>
                {parsedAnnualCourt.toLocaleString()} <span style={{ fontSize: '14px', fontWeight: 600 }}>원</span>
              </div>
            )}
            <div style={{ fontSize: '11.5px', color: 'var(--txt3)', marginTop: '6px' }}>
              {autoSyncCourt ? '월 코트비 × 12 자동 환산' : '직접 입력한 연간 코트비'}
            </div>
          </div>

          {/* 코트 면수 & 메모 */}
          <div style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--txt2)' }}>🏟️ 코트 규모 & 메모</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                <span style={{ fontSize: '13px', color: 'var(--txt2)' }}>면수:</span>
                {isAdmin ? (
                  <select 
                    className="select input-sm" 
                    value={courtCount} 
                    onChange={e => setCourtCount(Number(e.target.value))}
                    style={{ width: '80px', fontWeight: 700 }}
                  >
                    <option value={1}>1면</option>
                    <option value={2}>2면</option>
                    <option value={3}>3면</option>
                    <option value={4}>4면</option>
                    <option value={5}>5면</option>
                  </select>
                ) : (
                  <span style={{ fontWeight: 800 }}>{courtCount}면</span>
                )}
                <span style={{ fontSize: '12px', color: 'var(--txt3)' }}>(권장 {courtCapacityMin}~{courtCapacityMax}명)</span>
              </div>
            </div>
            <div style={{ marginTop: '8px' }}>
              {isAdmin ? (
                <input 
                  className="input input-sm" 
                  type="text" 
                  placeholder="예: 매주 화/목 19:00~22:00 그린코트"
                  value={courtMemo}
                  onChange={e => setCourtMemo(e.target.value)}
                  style={{ fontSize: '12px' }}
                />
              ) : (
                <div style={{ fontSize: '12px', color: 'var(--txt2)' }}>{courtMemo || '등록된 코트 이용 메모 없음'}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. 동호회 월간 운영 지출 항목 (볼구매, 간식, 기타) ── */}
      <div className="card" style={{ padding: '20px', background: 'var(--surface)', borderRadius: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>🛒</span>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>월간 운영 지출 항목 입력</h3>
          </div>
          <span style={{ fontSize: '13px', color: 'var(--txt2)', fontWeight: 600 }}>
            월 총 지출액: <strong style={{ color: '#dc2626', fontSize: '16px' }}>{totalMonthlyExpense.toLocaleString()}원</strong>
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px' }}>
          {/* 코트비 연동 */}
          <div style={{ padding: '14px', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--bg)' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--txt2)', marginBottom: '4px' }}>1. 월 코트비</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--txt)' }}>
              {parsedMonthlyCourt.toLocaleString()} <span style={{ fontSize: '13px', fontWeight: 500 }}>원</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--txt3)', marginTop: '4px' }}>상단 코트비 설정에서 자동 반영</div>
          </div>

          {/* 볼 구매비 */}
          <div style={{ padding: '14px', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--bg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--txt2)' }}>2. 볼(공) 구매비</span>
              {isAdmin && (
                <button 
                  type="button" 
                  onClick={() => setShowBallCalc(!showBallCalc)} 
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '11px', padding: '2px 6px', height: 'auto' }}
                >
                  {showBallCalc ? '닫기' : '🧮 캔수 계산'}
                </button>
              )}
            </div>

            {isAdmin ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input 
                  className="input input-sm" 
                  type="text" 
                  value={Number(ballCost).toLocaleString()} 
                  onChange={e => setBallCost(e.target.value.replace(/[^0-9]/g, ''))}
                  style={{ fontWeight: 800, fontSize: '15px' }}
                />
                <span style={{ fontSize: '13px', fontWeight: 600 }}>원</span>
              </div>
            ) : (
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--txt)' }}>
                {parsedBallCost.toLocaleString()} <span style={{ fontSize: '13px', fontWeight: 500 }}>원</span>
              </div>
            )}

            {/* 볼 계산기 펼침 */}
            {showBallCalc && (
              <div style={{
                marginTop: '10px',
                padding: '10px',
                background: 'var(--surface)',
                borderRadius: '8px',
                border: '1px dashed #3b82f6',
                fontSize: '12px'
              }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '6px' }}>
                  <span>월 사용량:</span>
                  <input 
                    type="number" 
                    className="input input-sm" 
                    style={{ width: '55px', padding: '2px 6px' }} 
                    value={ballCansPerMonth} 
                    onChange={e => setBallCansPerMonth(Math.max(1, Number(e.target.value)))} 
                  />
                  <span>캔</span>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '8px' }}>
                  <span>캔당 단가:</span>
                  <input 
                    type="number" 
                    className="input input-sm" 
                    style={{ width: '70px', padding: '2px 6px' }} 
                    value={ballPricePerCan} 
                    onChange={e => setBallPricePerCan(Math.max(0, Number(e.target.value)))} 
                  />
                  <span>원</span>
                </div>
                <button 
                  type="button" 
                  className="btn btn-primary btn-sm" 
                  style={{ width: '100%', fontSize: '11px', padding: '4px' }}
                  onClick={handleApplyBallCalc}
                >
                  합계 ({(ballCansPerMonth * ballPricePerCan).toLocaleString()}원) 적용
                </button>
              </div>
            )}
            <div style={{ fontSize: '11px', color: 'var(--txt3)', marginTop: '4px' }}>정기 모임용 시합구 교체 비용</div>
          </div>

          {/* 간식 및 음료비 */}
          <div style={{ padding: '14px', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--bg)' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--txt2)', marginBottom: '4px' }}>3. 간식 / 음료비</div>
            {isAdmin ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input 
                  className="input input-sm" 
                  type="text" 
                  value={Number(snackCost).toLocaleString()} 
                  onChange={e => setSnackCost(e.target.value.replace(/[^0-9]/g, ''))}
                  style={{ fontWeight: 800, fontSize: '15px' }}
                />
                <span style={{ fontSize: '13px', fontWeight: 600 }}>원</span>
              </div>
            ) : (
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--txt)' }}>
                {parsedSnackCost.toLocaleString()} <span style={{ fontSize: '13px', fontWeight: 500 }}>원</span>
              </div>
            )}
            <div style={{ fontSize: '11px', color: 'var(--txt3)', marginTop: '4px' }}>이온음료, 생수, 간식 등 월 평균 지출</div>
          </div>

          {/* 기타 운영비 */}
          <div style={{ padding: '14px', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--bg)' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--txt2)', marginBottom: '4px' }}>4. 기타 운영비 / 적립금</div>
            {isAdmin ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input 
                  className="input input-sm" 
                  type="text" 
                  value={Number(otherCost).toLocaleString()} 
                  onChange={e => setOtherCost(e.target.value.replace(/[^0-9]/g, ''))}
                  style={{ fontWeight: 800, fontSize: '15px' }}
                />
                <span style={{ fontSize: '13px', fontWeight: 600 }}>원</span>
              </div>
            ) : (
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--txt)' }}>
                {parsedOtherCost.toLocaleString()} <span style={{ fontSize: '13px', fontWeight: 500 }}>원</span>
              </div>
            )}
            <div style={{ fontSize: '11px', color: 'var(--txt3)', marginTop: '4px' }}>정기대회 찬조금 적립, 비품/구급약 등</div>
          </div>
        </div>

        {/* 수입 기준 (회비) */}
        <div style={{
          marginTop: '16px',
          padding: '12px 16px',
          background: 'rgba(37, 99, 235, 0.04)',
          border: '1px dashed rgba(37, 99, 235, 0.25)',
          borderRadius: '10px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px'
        }}>
          <div style={{ fontSize: '13px', color: '#1e40af' }}>
            💡 <strong>회원 1인당 회비 기준</strong>: {feeCycle} {rawFee.toLocaleString()}원 
            {feeCycle !== '월납' && ' (월 환산: 약 ' + perMemberMonthlyFee.toLocaleString() + '원)'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--txt2)' }}>
            회비 설정 변경은 상단 '회원 명단 관리' 탭의 클럽 회비 설정에서 가능합니다.
          </div>
        </div>
      </div>

      {/* ── 2-1. 운영진 회비 감면 / 면제 옵션 설정 카드 ── */}
      <div className="card" style={{
        padding: '20px',
        background: 'linear-gradient(135deg, rgba(254, 243, 199, 0.4) 0%, rgba(254, 249, 195, 0.25) 100%)',
        border: '1.5px solid #fde68a',
        borderRadius: '16px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '22px' }}>👑</span>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#92400e' }}>
                운영진 회비 감면 / 면제 옵션
              </h3>
              <p style={{ fontSize: '12.5px', color: '#78350f', margin: '2px 0 0 0' }}>
                동호회 봉사 및 헌신에 따른 운영진 회비 면제(100%) 또는 감면율을 설정하고 재정 수지에 즉시 반영합니다.
              </p>
            </div>
          </div>
          {parsedExecDiscountRate > 0 && (
            <span className="badge" style={{
              background: parsedExecDiscountRate === 100 ? '#fee2e2' : '#fef3c7',
              color: parsedExecDiscountRate === 100 ? '#b91c1c' : '#b45309',
              border: `1px solid ${parsedExecDiscountRate === 100 ? '#fca5a5' : '#fcd34d'}`,
              fontWeight: 800,
              fontSize: '12px',
              padding: '4px 10px'
            }}>
              {parsedExecDiscountRate === 100 ? '🏆 전액 면제 적용 중' : `🎁 ${parsedExecDiscountRate}% 감면 적용 중`}
            </span>
          )}
        </div>

        {/* 감면율 설정 컨트롤러 & 프리셋 버튼 */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #fde68a',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
            <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#451a03' }}>
              🎯 감면율 선택 및 입력:
            </span>
            {isAdmin && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { label: '🛡️ 0% (전액 납부)', val: 0 },
                  { label: '🎁 30% 감면', val: 30 },
                  { label: '⭐ 50% 감면 (반액)', val: 50 },
                  { label: '🏆 100% 면제 (전액)', val: 100 }
                ].map(p => (
                  <button
                    key={p.val}
                    type="button"
                    onClick={() => setExecDiscountRate(String(p.val))}
                    style={{
                      padding: '4px 10px',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: parsedExecDiscountRate === p.val ? '1.5px solid #d97706' : '1px solid #e2e8f0',
                      background: parsedExecDiscountRate === p.val ? '#fef3c7' : '#f8fafc',
                      color: parsedExecDiscountRate === p.val ? '#92400e' : '#64748b'
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 슬라이더 & 숫자 입력 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '180px' }}>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={parsedExecDiscountRate}
                disabled={!isAdmin}
                onChange={e => setExecDiscountRate(e.target.value)}
                style={{ width: '100%', accentColor: '#d97706', cursor: isAdmin ? 'pointer' : 'default' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#92400e', marginTop: '2px' }}>
                <span>0% (일반회원과 동일)</span>
                <span>30%</span>
                <span>50% (절반)</span>
                <span>70%</span>
                <span>100% (전액 면제)</span>
              </div>
            </div>

            {isAdmin ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="input input-sm"
                  style={{ width: '70px', fontWeight: 800, fontSize: '15px', textAlign: 'right', color: '#b45309' }}
                  value={execDiscountRate}
                  onChange={e => setExecDiscountRate(e.target.value)}
                />
                <span style={{ fontWeight: 700, fontSize: '14px', color: '#78350f' }}>%</span>
              </div>
            ) : (
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#b45309' }}>
                {parsedExecDiscountRate}%
              </div>
            )}
          </div>
        </div>

        {/* 운영진 명단 및 적용 인원 수 */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #fde68a',
          borderRadius: '12px',
          padding: '14px 16px',
          marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#451a03' }}>
                👥 감면 대상 운영진 직책 (회장·부회장·총무·경기이사·운영이사):
              </span>
              <span className="badge badge-gold" style={{ fontSize: '11px', padding: '1px 7px' }}>
                {execMembers.length > 0 ? `등록 ${execMembers.length}명` : `등록 0명 (가상 ${appliedExecCount}명 기준)`}
              </span>
            </div>

            {isAdmin && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#78350f' }}>
                <span>산출 적용 인원 직접 지정:</span>
                <input
                  type="number"
                  min="0"
                  max="20"
                  className="input input-sm"
                  placeholder={String(execMembers.length || 5)}
                  style={{ width: '55px', padding: '2px 6px', textAlign: 'center', fontWeight: 700 }}
                  value={execCountOverride}
                  onChange={e => setExecCountOverride(e.target.value)}
                />
                <span>명</span>
                {execCountOverride !== '' && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '10.5px', padding: '2px 6px', height: 'auto' }}
                    onClick={() => setExecCountOverride('')}
                    title="실제 등록된 운영진 수로 자동 연동"
                  >
                    자동연동
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 등록된 운영진 태그 리스트 */}
          {execMembers.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
              {execMembers.map(m => (
                <span
                  key={m.id || m.name}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 10px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    color: '#1e40af'
                  }}
                >
                  <span>{m.role === '회장' ? '👑' : m.role === '부회장' ? '🥈' : m.role === '총무' ? '💼' : m.role === '경기이사' ? '🎾' : '📋'}</span>
                  <span>{m.role}: <strong>{m.name}</strong></span>
                </span>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: '11.5px', color: '#b45309', marginTop: '4px', lineHeight: 1.5 }}>
              ℹ️ 현재 회원 명부에 5대 운영진 직책이 지정된 회원이 없습니다. 회원 명부에서 직책을 부여하면 자동 연동되며, 현재는 표준 운영진 정원 <strong>{appliedExecCount}명</strong>을 기준으로 시뮬레이션 산출합니다.
            </div>
          )}
        </div>

        {/* 4대 영향 지표 요약 바 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px'
        }}>
          {/* 1. 일반 회원 회비 */}
          <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: '#ffffff', border: '1px solid #fef3c7' }}>
            <span style={{ fontSize: '11.5px', color: 'var(--txt3)', fontWeight: 700 }}>일반 회원 회비 (월)</span>
            <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--txt)', marginTop: '2px' }}>
              {perMemberMonthlyFee.toLocaleString()} <span style={{ fontSize: '12px', fontWeight: 600 }}>원</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--txt3)' }}>정상 기준액 (감면 0%)</div>
          </div>

          {/* 2. 운영진 적용 회비 */}
          <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: '#ffffff', border: '1px solid #fef3c7' }}>
            <span style={{ fontSize: '11.5px', color: '#b45309', fontWeight: 700 }}>👑 운영진 회비 (1인당)</span>
            <div style={{ fontSize: '17px', fontWeight: 900, color: parsedExecDiscountRate === 100 ? '#16a34a' : '#d97706', marginTop: '2px' }}>
              {parsedExecDiscountRate === 100 ? '0 원 (면제)' : `${execMonthlyFee.toLocaleString()} 원`}
            </div>
            {parsedExecDiscountRate > 0 ? (
              <div style={{ fontSize: '11px', color: '#15803d', fontWeight: 600 }}>
                1인당 -{execDiscountPerPerson.toLocaleString()}원 감면 ({parsedExecDiscountRate}%)
              </div>
            ) : (
              <div style={{ fontSize: '11px', color: 'var(--txt3)' }}>감면 미적용 (전액 납부)</div>
            )}
          </div>

          {/* 3. 적용 운영진 수 */}
          <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: '#ffffff', border: '1px solid #fef3c7' }}>
            <span style={{ fontSize: '11.5px', color: '#b45309', fontWeight: 700 }}>감면 적용 운영진 인원</span>
            <div style={{ fontSize: '17px', fontWeight: 900, color: '#451a03', marginTop: '2px' }}>
              {appliedExecCount} <span style={{ fontSize: '12px', fontWeight: 600 }}>명</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--txt3)' }}>
              {parsedOverrideCount !== null ? '직접 지정 인원' : (execMembers.length > 0 ? '등록된 운영진 전원' : '표준 정원 기준')}
            </div>
          </div>

          {/* 4. 월간 총 감면 지원액 */}
          <div style={{
            padding: '12px',
            borderRadius: '10px',
            backgroundColor: parsedExecDiscountRate > 0 ? '#fef2f2' : '#ffffff',
            border: parsedExecDiscountRate > 0 ? '1.5px solid #fca5a5' : '1px solid #fef3c7'
          }}>
            <span style={{ fontSize: '11.5px', color: parsedExecDiscountRate > 0 ? '#b91c1c' : 'var(--txt3)', fontWeight: 700 }}>
              💸 월간 운영진 감면 총액
            </span>
            <div style={{ fontSize: '17px', fontWeight: 900, color: parsedExecDiscountRate > 0 ? '#dc2626' : 'var(--txt)', marginTop: '2px' }}>
              -{totalExecDiscountMonthly.toLocaleString()} <span style={{ fontSize: '12px', fontWeight: 600 }}>원/월</span>
            </div>
            <div style={{ fontSize: '11px', color: parsedExecDiscountRate > 0 ? '#991b1b' : 'var(--txt3)' }}>
              {parsedExecDiscountRate > 0 ? `연간 -${(totalExecDiscountMonthly * 12).toLocaleString()}원 동호회 재정 지원` : '감면액 없음'}
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. 동호회 최적 인원 산출 및 비교 분석 결과 카드 ── */}
      <div className="card" style={{
        padding: '24px',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(240,249,255,0.9) 100%)',
        border: '1px solid #bae6fd',
        borderRadius: '18px',
        boxShadow: '0 8px 30px rgba(14, 165, 233, 0.08)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
          <span style={{ fontSize: '24px' }}>🎯</span>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 900, margin: 0, color: '#0369a1' }}>
            동호회 최적 인원 분석 & 재정 진단 리포트
          </h3>
        </div>

        {/* 3대 핵심 지표 그리드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px', marginBottom: '22px' }}>
          
          {/* 지표 1: 손익분기 최소 인원 */}
          <div style={{
            background: '#ffffff',
            padding: '16px',
            borderRadius: '14px',
            border: '1px solid #e0f2fe',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
          }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#0284c7', textTransform: 'uppercase', marginBottom: '4px' }}>
              ① 손익분기 최소 인원 (BEP)
            </div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: '#0f172a' }}>
              {bepCount} <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--txt2)' }}>명</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--txt2)', marginTop: '4px', lineHeight: 1.4 }}>
              적자 없이 월 고정 지출({totalMonthlyExpense.toLocaleString()}원)을 충당하는 데 필요한 최소 인원입니다.
            </div>
            {parsedExecDiscountRate > 0 && (
              <div style={{
                marginTop: '8px',
                padding: '4px 8px',
                borderRadius: '6px',
                background: '#eff6ff',
                fontSize: '11px',
                color: '#1d4ed8',
                fontWeight: 600
              }}>
                ※ 운영진 {appliedExecCount}명({parsedExecDiscountRate}% 감면) + 일반 회원 {bepGeneralNeeded}명
              </div>
            )}
          </div>

          {/* 지표 2: 권장 최적 회원 수 */}
          <div style={{
            background: '#ffffff',
            padding: '16px',
            borderRadius: '14px',
            border: '2px solid #38bdf8',
            boxShadow: '0 4px 14px rgba(56, 189, 248, 0.12)',
            position: 'relative'
          }}>
            <div style={{
              position: 'absolute',
              top: '-10px',
              right: '12px',
              background: '#0284c7',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '999px'
            }}>
              강력 추천
            </div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', marginBottom: '4px' }}>
              ② 권장 최적 회원 수
            </div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: '#0284c7' }}>
              {recommendedOptimalCount} <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--txt2)' }}>명</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--txt2)', marginTop: '4px', lineHeight: 1.4 }}>
              매월 15%의 여유 예비비/대회비(약 {Math.round(totalMonthlyExpense * 0.15).toLocaleString()}원)를 적립하는 이상적인 규모입니다.
            </div>
            {parsedExecDiscountRate > 0 && (
              <div style={{
                marginTop: '8px',
                padding: '4px 8px',
                borderRadius: '6px',
                background: '#eff6ff',
                fontSize: '11px',
                color: '#1d4ed8',
                fontWeight: 600
              }}>
                ※ 운영진 {appliedExecCount}명({parsedExecDiscountRate}% 감면) + 일반 회원 {optGeneralNeeded}명
              </div>
            )}
          </div>

          {/* 지표 3: 코트 면수 기준 적정 운동 인원 */}
          <div style={{
            background: '#ffffff',
            padding: '16px',
            borderRadius: '14px',
            border: '1px solid #e0f2fe',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
          }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#0284c7', textTransform: 'uppercase', marginBottom: '4px' }}>
              ③ 코트 경기 수용 적정 인원
            </div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: '#0f172a' }}>
              {courtCapacityMin} ~ {courtCapacityMax} <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--txt2)' }}>명</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--txt2)', marginTop: '4px', lineHeight: 1.4 }}>
              {courtCount}면 기준 복식 게임 로테이션 시 대기 시간이 너무 길지 않은 적정 인원입니다.
            </div>
          </div>

        </div>

        {/* 현재 클럽 상태 진단 배너 */}
        <div style={{
          padding: '16px 20px',
          borderRadius: '14px',
          background: currentMonthlyBalance >= 0 
            ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' 
            : 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
          border: '1px solid ' + (currentMonthlyBalance >= 0 ? '#86efac' : '#fca5a5'),
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>{currentMonthlyBalance >= 0 ? '🟢' : '🔴'}</span>
              <span style={{
                fontWeight: 800,
                fontSize: '15px',
                color: currentMonthlyBalance >= 0 ? '#166534' : '#991b1b'
              }}>
                현재 클럽 재정 진단: {currentMonthlyBalance >= 0 ? '흑자 / 안정적 운영 중' : '적자 주의 / 보완 필요'}
              </span>
            </div>
            <div style={{
              fontSize: '13px',
              color: currentMonthlyBalance >= 0 ? '#15803d' : '#b91c1c',
              marginTop: '4px',
              lineHeight: 1.5
            }}>
              현재 정회원 <strong>{currentRegularCount}명</strong>
              {parsedExecDiscountRate > 0 ? (
                <span> (일반 {currentGeneralCount}명 + 운영진 {currentExecCount}명 {parsedExecDiscountRate}% 감면, 실 수입 약 <strong>{currentTotalRevenue.toLocaleString()}원</strong>)</span>
              ) : (
                <span> (월 회비 수입 약 {currentTotalRevenue.toLocaleString()}원)</span>
              )}
              기준으로, 월 총 지출({totalMonthlyExpense.toLocaleString()}원) 대비 
              매월 <strong style={{ textDecoration: 'underline' }}>
                {Math.abs(currentMonthlyBalance).toLocaleString()}원 {currentMonthlyBalance >= 0 ? '흑자(잉여금 적립)' : '적자(자금 부족)'}
              </strong> 상태입니다.
              {parsedExecDiscountRate > 0 && (
                <div style={{ fontSize: '11.5px', color: currentMonthlyBalance >= 0 ? '#166534' : '#991b1b', marginTop: '3px' }}>
                  👑 운영진 회비 감면 지원액: 매월 <strong>{totalExecDiscountMonthly.toLocaleString()}원</strong>(1인당 {execDiscountPerPerson.toLocaleString()}원) 반영됨
                </div>
              )}
              {currentMonthlyBalance < 0 && (
                <span style={{ display: 'block', marginTop: '2px' }}>
                  👉 손익분기를 맞추려면 <strong>{Math.max(0, bepCount - currentRegularCount)}명</strong> 추가 충원 또는 월 회비 약 {Math.ceil(totalMonthlyExpense / (currentRegularCount || 1) - perMemberMonthlyFee).toLocaleString()}원 인상이 권장됩니다.
                </span>
              )}
            </div>
          </div>

          <div style={{
            background: '#ffffff',
            padding: '10px 16px',
            borderRadius: '10px',
            border: '1px solid ' + (currentMonthlyBalance >= 0 ? '#bbf7d0' : '#fecaca'),
            textAlign: 'right'
          }}>
            <div style={{ fontSize: '11px', color: 'var(--txt3)', fontWeight: 600 }}>월 예상 수지 차액</div>
            <div style={{
              fontSize: '20px',
              fontWeight: 900,
              color: currentMonthlyBalance >= 0 ? '#16a34a' : '#dc2626'
            }}>
              {currentMonthlyBalance >= 0 ? '+' + currentMonthlyBalance.toLocaleString() : currentMonthlyBalance.toLocaleString()}원
            </div>
          </div>
        </div>

        {/* ── 4. 인원수 변동 실시간 시뮬레이터 (What-if Slider) ── */}
        <div style={{
          marginTop: '22px',
          background: '#ffffff',
          borderRadius: '14px',
          padding: '18px',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--txt)' }}>
              ⚡ 회원 수 변동에 따른 실시간 재정 시뮬레이터
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: 'var(--txt2)' }}>가상 회원 수:</span>
              <strong style={{ fontSize: '17px', color: '#0284c7' }}>{simulatedCount}명</strong>
              <button 
                type="button" 
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '11px', padding: '2px 8px' }}
                onClick={() => setSimulatedCount(currentRegularCount || 15)}
              >
                현재({currentRegularCount}명)로 리셋
              </button>
            </div>
          </div>

          <input 
            type="range" 
            min="4" 
            max="30" 
            step="1"
            value={simulatedCount} 
            onChange={e => setSimulatedCount(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#0284c7', cursor: 'pointer' }}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--txt3)', marginTop: '4px' }}>
            <span>4명 (최소 복식 1게임)</span>
            <span>15명 (일반적인 규모)</span>
            <span>30명 (대규모)</span>
          </div>

          {/* 시뮬레이션 결과 요약 바 */}
          <div style={{
            marginTop: '14px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '10px',
            background: '#f8fafc',
            padding: '12px',
            borderRadius: '10px'
          }}>
            <div>
              <div style={{ fontSize: '11.5px', color: 'var(--txt3)' }}>가상 회원 {simulatedCount}명 총 회비 수입</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#0369a1' }}>
                {simRevenue.toLocaleString()}원
              </div>
              {parsedExecDiscountRate > 0 && (
                <div style={{ fontSize: '10.5px', color: 'var(--txt2)', marginTop: '2px' }}>
                  일반 {simGeneralCount}명({(simGeneralCount * perMemberMonthlyFee).toLocaleString()}원) + 운영진 {simExecCount}명({(simExecCount * execMonthlyFee).toLocaleString()}원)
                </div>
              )}
            </div>
            <div>
              <div style={{ fontSize: '11.5px', color: 'var(--txt3)' }}>월간 고정 총 지출</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#475569' }}>
                {totalMonthlyExpense.toLocaleString()}원
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11.5px', color: 'var(--txt3)' }}>월 예상 수지 (잉여금/적자)</div>
              <div style={{
                fontSize: '16px',
                fontWeight: 900,
                color: simBalance >= 0 ? '#16a34a' : '#dc2626'
              }}>
                {simBalance >= 0 ? '+' + simBalance.toLocaleString() + '원 (흑자)' : simBalance.toLocaleString() + '원 (적자)'}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

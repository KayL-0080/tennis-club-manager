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

  const bepCount = Math.ceil(totalMonthlyExpense / perMemberMonthlyFee);
  const recommendedOptimalCount = Math.ceil((totalMonthlyExpense * 1.15) / perMemberMonthlyFee);

  const courtCapacityMin = courtCount * 4;
  const courtCapacityMax = courtCount * 6;

  const currentRegularCount = regularMembers.length;
  const currentTotalRevenue = currentRegularCount * perMemberMonthlyFee;
  const currentMonthlyBalance = currentTotalRevenue - totalMonthlyExpense;

  const simRevenue = simulatedCount * perMemberMonthlyFee;
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
        otherCost: parsedOtherCost
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
              현재 정회원 <strong>{currentRegularCount}명</strong> (월 회비 수입 약 {currentTotalRevenue.toLocaleString()}원) 기준으로,
              월 총 지출({totalMonthlyExpense.toLocaleString()}원) 대비 
              매월 <strong style={{ textDecoration: 'underline' }}>
                {Math.abs(currentMonthlyBalance).toLocaleString()}원 {currentMonthlyBalance >= 0 ? '흑자(잉여금 적립)' : '적자(자금 부족)'}
              </strong> 상태입니다.
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

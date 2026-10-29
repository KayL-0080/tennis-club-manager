'use client';
import { useState, useEffect, useMemo } from 'react';
import {
  subscribeFeeLedgerEntries,
  addFeeLedgerEntry,
  updateFeeLedgerEntry,
  deleteFeeLedgerEntry
} from '@/lib/firestore';

export const INCOME_CATEGORIES = ['이월잔액', '회비', '게스트비', '찬조', '대회참가비', '기타'];
export const EXPENSE_CATEGORIES = ['대관료', '식음료', '대회상품', '기타'];

// 카테고리별 기본 자동 입력 금액 (회비: 120,000원 / 게스트비: 15,000원)
const DEFAULT_CATEGORY_AMOUNTS = {
  'INCOME:회비': 120000,
  'INCOME:게스트비': 15000,
};

const getCategoryMeta = (category, type = 'INCOME') => {
  const isInc = type === 'INCOME';
  if (isInc) {
    switch (category) {
      case '이월잔액':
        return { type: 'INCOME', icon: '🏦', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' };
      case '회비':
        return { type: 'INCOME', icon: '💳', bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' };
      case '게스트비':
        return { type: 'INCOME', icon: '🙋', bg: '#f5f3ff', color: '#6d28d9', border: '#ddd6fe' };
      case '찬조':
        return { type: 'INCOME', icon: '🎁', bg: '#ecfeff', color: '#0e7490', border: '#a5f3fc' };
      case '대회참가비':
        return { type: 'INCOME', icon: '🎾', bg: '#eef2ff', color: '#4338ca', border: '#c7d2fe' };
      case '기타':
      default:
        return { type: 'INCOME', icon: '➕', bg: '#f0f9ff', color: '#0369a1', border: '#bae6fd' };
    }
  } else {
    switch (category) {
      case '대관료':
        return { type: 'EXPENSE', icon: '🏟️', bg: '#fff1f2', color: '#be123c', border: '#fecdd3' };
      case '식음료':
        return { type: 'EXPENSE', icon: '🥤', bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' };
      case '대회상품':
        return { type: 'EXPENSE', icon: '🏆', bg: '#fefce8', color: '#a16207', border: '#fef08a' };
      case '기타':
      default:
        return { type: 'EXPENSE', icon: '➖', bg: '#fdf2f8', color: '#be185d', border: '#fbcfe8' };
    }
  }
};

const resolveItemType = (item) => {
  if (item?.type === 'INCOME' || item?.type === 'EXPENSE') return item.type;
  if (Number(item?.income) > 0) return 'INCOME';
  if (Number(item?.expense) > 0) return 'EXPENSE';
  if (EXPENSE_CATEGORIES.includes(item?.category) && item?.category !== '기타') return 'EXPENSE';
  return 'INCOME';
};

const getTodayYMD = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatNum = (n) => {
  const num = Number(n) || 0;
  return num.toLocaleString('ko-KR');
};

const parseNumInput = (val) => {
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9]/g, '');
  return cleaned ? parseInt(cleaned, 10) : 0;
};

export default function FeeLedgerTab({
  isAdmin = false,
  canManageFee = false,
  members = [],
  currentClub = {},
  onRequireLogin
}) {
  const canEdit = Boolean(isAdmin || canManageFee);

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // 조회 월 상태 (기본: 현재 연월 YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState(() => getTodayYMD().substring(0, 7));
  const [viewAllMonths, setViewAllMonths] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('ALL'); // 'ALL' | 'INCOME_ALL' | 'EXPENSE_ALL' | 'INCOME:회비' 등
  const [searchQuery, setSearchQuery] = useState('');

  // 입력 / 수정 폼 상태 (기본값: 수입 - '회비' 120,000원)
  const [editingId, setEditingId] = useState(null);
  const [formDate, setFormDate] = useState(() => getTodayYMD());
  const [formType, setFormType] = useState('INCOME'); // 'INCOME' | 'EXPENSE'
  const [formCategory, setFormCategory] = useState('회비');
  const [formIncome, setFormIncome] = useState('120,000');
  const [formExpense, setFormExpense] = useState('');
  const [formMemo, setFormMemo] = useState('');

  // 월별 출력 미리보기 모달 상태
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printIncludeCategorySummary, setPrintIncludeCategorySummary] = useState(true);
  const [printIncludeBankInfo, setPrintIncludeBankInfo] = useState(true);
  const [printIncludeSignBox, setPrintIncludeSignBox] = useState(true);

  useEffect(() => {
    const unsub = subscribeFeeLedgerEntries((list) => {
      setEntries(list);
      setLoading(false);
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  // 선택된 월이 바뀔 때 신규 입력 중이면 사용일 기본값을 해당 월로 맞춤
  const handleMonthChange = (newMonth) => {
    if (!newMonth) return;
    setSelectedMonth(newMonth);
    setViewAllMonths(false);
    if (!editingId) {
      const today = getTodayYMD();
      if (today.startsWith(newMonth)) {
        setFormDate(today);
      } else {
        setFormDate(`${newMonth}-01`);
      }
    }
  };

  const shiftMonth = (delta) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const nextYm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    handleMonthChange(nextYm);
  };

  // 내용(카테고리) 및 구분(수입/지출) 변경 핸들러
  // - '회비' 클릭 시 120,000원 기본 입력
  // - '게스트비' 클릭 시 15,000원 기본 입력
  const handleCategoryChange = (newCat, explicitType = null) => {
    const nextType = explicitType || (INCOME_CATEGORIES.includes(newCat) && newCat !== '기타' ? 'INCOME' : formType);
    const prevKey = `${formType}:${formCategory}`;
    const nextKey = `${nextType}:${newCat}`;
    const prevDefaultAmt = DEFAULT_CATEGORY_AMOUNTS[prevKey];
    const nextDefaultAmt = DEFAULT_CATEGORY_AMOUNTS[nextKey];

    setFormType(nextType);
    setFormCategory(newCat);

    if (nextDefaultAmt) {
      // 회비(120,000원) 또는 게스트비(15,000원) 클릭 시 기본값 자동 세팅
      setFormIncome(formatNum(nextDefaultAmt));
      setFormExpense('');
      return;
    }

    const currentAmtNum = formType === 'INCOME' ? parseNumInput(formIncome) : parseNumInput(formExpense);
    const wasDefaultUnchanged = prevDefaultAmt && currentAmtNum === prevDefaultAmt;

    if (nextType === 'INCOME') {
      setFormExpense('');
      if (wasDefaultUnchanged) {
        setFormIncome('');
      } else if (formType === 'EXPENSE' && formExpense && !formIncome) {
        setFormIncome(formExpense);
      }
    } else {
      setFormIncome('');
      if (wasDefaultUnchanged) {
        setFormExpense('');
      } else if (formType === 'INCOME' && formIncome && !formExpense) {
        setFormExpense(formIncome);
      }
    }
  };

  // 셀렉트 박스('TYPE:CATEGORY') 변경 핸들러
  const handleSelectChange = (val) => {
    const [selType, selCat] = String(val).split(':');
    if (selType && selCat) {
      handleCategoryChange(selCat, selType);
    }
  };

  // 금액 빠른 추가 버튼
  const addQuickAmount = (amountToAdd) => {
    if (formType === 'INCOME') {
      const nextVal = parseNumInput(formIncome) + amountToAdd;
      setFormIncome(nextVal > 0 ? formatNum(nextVal) : '');
      setFormExpense('');
    } else {
      const nextVal = parseNumInput(formExpense) + amountToAdd;
      setFormExpense(nextVal > 0 ? formatNum(nextVal) : '');
      setFormIncome('');
    }
  };

  const resetForm = () => {
    setEditingId(null);
    const today = getTodayYMD();
    setFormDate(today.startsWith(selectedMonth) ? today : `${selectedMonth}-01`);
    setFormType('INCOME');
    setFormCategory('회비');
    setFormIncome('120,000');
    setFormExpense('');
    setFormMemo('');
  };

  // 전체 내역 정렬 (사용일 오름차순 -> 같은 날짜면 '이월잔액' 최우선 -> 생성일시 순)
  const sortedAllEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      const dateCmp = (a.date || '').localeCompare(b.date || '');
      if (dateCmp !== 0) return dateCmp;
      if (a.category === '이월잔액' && b.category !== '이월잔액') return -1;
      if (b.category === '이월잔액' && a.category !== '이월잔액') return 1;
      const tA = a.createdAt?.seconds || 0;
      const tB = b.createdAt?.seconds || 0;
      return tA - tB;
    });
  }, [entries]);

  // 해당 월(또는 전체 기간) 내역 및 누적 잔액 계산
  const periodEntriesWithBalance = useMemo(() => {
    const targetList = viewAllMonths
      ? sortedAllEntries
      : sortedAllEntries.filter(e => (e.date || '').startsWith(selectedMonth));

    let runningBalance = 0;
    return targetList.map((item, idx) => {
      const inc = Number(item.income) || 0;
      const exp = Number(item.expense) || 0;
      const resolvedType = resolveItemType(item);
      runningBalance += (inc - exp);
      return {
        ...item,
        type: resolvedType,
        rowNum: idx + 1,
        income: inc,
        expense: exp,
        balance: runningBalance,
      };
    });
  }, [sortedAllEntries, selectedMonth, viewAllMonths]);

  // 이전 달까지의 누적 잔액 계산 (전월 이월잔액 자동 입력용)
  const prevMonthClosingBalance = useMemo(() => {
    const prevEntries = sortedAllEntries.filter(e => e.date && e.date < `${selectedMonth}-01`);
    if (prevEntries.length === 0) return null;
    const prevMonths = [...new Set(prevEntries.map(e => e.date.substring(0, 7)))].sort();
    const lastMonth = prevMonths[prevMonths.length - 1];
    const lastMonthEntries = prevEntries.filter(e => e.date.substring(0, 7) === lastMonth);
    const lastMonthBalance = lastMonthEntries.reduce((acc, cur) => acc + (Number(cur.income) || 0) - (Number(cur.expense) || 0), 0);
    return {
      month: lastMonth,
      balance: lastMonthBalance
    };
  }, [sortedAllEntries, selectedMonth]);

  // 화면 필터링된 내역 (카테고리 필터 및 검색어 적용)
  const filteredEntries = useMemo(() => {
    return periodEntriesWithBalance.filter(item => {
      const itemType = item.type;
      const itemKey = `${itemType}:${item.category}`;

      if (categoryFilter === 'INCOME_ALL') {
        if (itemType !== 'INCOME') return false;
      } else if (categoryFilter === 'EXPENSE_ALL') {
        if (itemType !== 'EXPENSE') return false;
      } else if (categoryFilter !== 'ALL') {
        if (itemKey !== categoryFilter) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchCat = (item.category || '').toLowerCase().includes(q);
        const matchMemo = (item.memo || '').toLowerCase().includes(q);
        const matchDate = (item.date || '').includes(q);
        if (!matchCat && !matchMemo && !matchDate) return false;
      }
      return true;
    });
  }, [periodEntriesWithBalance, categoryFilter, searchQuery]);

  // 월별(기간별) 수입/지출/잔액 및 항목별 합계 요약
  const summary = useMemo(() => {
    const incomeTotals = {};
    const expenseTotals = {};
    INCOME_CATEGORIES.forEach(c => { incomeTotals[c] = 0; });
    EXPENSE_CATEGORIES.forEach(c => { expenseTotals[c] = 0; });

    let totalIncome = 0;
    let totalExpense = 0;

    periodEntriesWithBalance.forEach(item => {
      const inc = Number(item.income) || 0;
      const exp = Number(item.expense) || 0;
      totalIncome += inc;
      totalExpense += exp;

      if (item.type === 'INCOME' || inc > 0) {
        const cat = incomeTotals[item.category] !== undefined ? item.category : '기타';
        incomeTotals[cat] = (incomeTotals[cat] || 0) + inc;
      } else {
        const cat = expenseTotals[item.category] !== undefined ? item.category : '기타';
        expenseTotals[cat] = (expenseTotals[cat] || 0) + exp;
      }
    });

    const filteredIncome = filteredEntries.reduce((s, x) => s + (Number(x.income) || 0), 0);
    const filteredExpense = filteredEntries.reduce((s, x) => s + (Number(x.expense) || 0), 0);

    return {
      totalIncome,
      totalExpense,
      netBalance: totalIncome - totalExpense,
      incomeTotals,
      expenseTotals,
      filteredIncome,
      filteredExpense,
      filteredBalance: filteredIncome - filteredExpense
    };
  }, [periodEntriesWithBalance, filteredEntries]);

  // 정회원 완납 인원 및 월회비 자동 계산 도우미 정보
  const regularPaidInfo = useMemo(() => {
    const regularMembers = members.filter(m => m?.role !== '게스트' && !m?.isGuest);
    const paidMembers = regularMembers.filter(m => m.feePaid);
    const unitFee = parseNumInput(currentClub?.feeAmount) || 120000;
    return {
      paidCount: paidMembers.length,
      totalRegular: regularMembers.length,
      unitFee,
      totalFeeAmount: paidMembers.length * unitFee
    };
  }, [members, currentClub]);

  const handleFillCarryover = () => {
    setFormDate(`${selectedMonth}-01`);
    setFormType('INCOME');
    setFormCategory('이월잔액');
    setFormExpense('');
    if (prevMonthClosingBalance) {
      const [, pm] = prevMonthClosingBalance.month.split('-').map(Number);
      setFormIncome(formatNum(Math.max(0, prevMonthClosingBalance.balance)));
      setFormMemo(`${pm}월 이월잔액`);
    } else {
      setFormIncome('');
      setFormMemo('전월 이월잔액');
    }
  };

  const handleFillRegularFees = () => {
    const [, mNum] = selectedMonth.split('-').map(Number);
    setFormType('INCOME');
    setFormCategory('회비');
    setFormExpense('');
    setFormIncome(formatNum(regularPaidInfo.totalFeeAmount));
    setFormMemo(`${mNum}월 정회원 회비 (${regularPaidInfo.paidCount}명 완납 기준)`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canEdit) return;

    if (!formDate) {
      alert('사용일을 선택해주세요.');
      return;
    }

    const incVal = parseNumInput(formIncome);
    const expVal = parseNumInput(formExpense);

    if (incVal === 0 && expVal === 0) {
      alert('수입 또는 지출 금액을 입력해주세요.');
      return;
    }

    const isInc = formType === 'INCOME';
    const finalIncome = isInc ? (incVal || expVal) : 0;
    const finalExpense = !isInc ? (expVal || incVal) : 0;

    setSubmitting(true);
    try {
      const payload = {
        date: formDate,
        type: isInc ? 'INCOME' : 'EXPENSE',
        category: formCategory,
        income: finalIncome,
        expense: finalExpense,
        memo: formMemo.trim(),
      };

      if (editingId) {
        await updateFeeLedgerEntry(editingId, payload);
      } else {
        await addFeeLedgerEntry(payload);
      }

      // 입력한 날짜의 월로 자동 포커스 이동
      const entryYm = formDate.substring(0, 7);
      if (!viewAllMonths && entryYm !== selectedMonth) {
        setSelectedMonth(entryYm);
      }
      resetForm();
    } catch (err) {
      console.error('Failed to save fee ledger entry:', err);
      alert('회비 내역 저장 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = (item) => {
    if (!canEdit) return;
    const itemType = resolveItemType(item);
    setEditingId(item.id);
    setFormDate(item.date || getTodayYMD());
    setFormType(itemType);
    setFormCategory(item.category || '회비');
    setFormIncome(item.income > 0 ? formatNum(item.income) : '');
    setFormExpense(item.expense > 0 ? formatNum(item.expense) : '');
    setFormMemo(item.memo || '');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 180, behavior: 'smooth' });
    }
  };

  const handleDelete = async (item) => {
    if (!canEdit) return;
    const amtText = item.income > 0 ? `수입 +${formatNum(item.income)}원` : `지출 -${formatNum(item.expense)}원`;
    if (!confirm(`[${item.date}] ${item.category} (${amtText})\n적요: ${item.memo || '-'}\n\n이 내역을 삭제하시겠습니까?`)) return;
    try {
      await deleteFeeLedgerEntry(item.id);
      if (editingId === item.id) resetForm();
    } catch (err) {
      console.error('Delete fee ledger error:', err);
      alert('삭제에 실패했습니다.');
    }
  };

  // 월 포맷 표시 (예: 2026년 10월)
  const formattedPeriodTitle = useMemo(() => {
    if (viewAllMonths) return '전체 기간';
    const [y, m] = selectedMonth.split('-').map(Number);
    return `${y}년 ${m}월`;
  }, [selectedMonth, viewAllMonths]);

  // 엑셀(CSV) 다운로드
  const handleDownloadCsv = () => {
    if (periodEntriesWithBalance.length === 0) {
      alert('출력할 회비 내역이 없습니다.');
      return;
    }
    const headers = ['번호', '사용일', '내용', '수입', '지출', '잔액', '적요'];
    const rows = periodEntriesWithBalance.map(item => [
      item.rowNum,
      item.date,
      item.category,
      item.income || 0,
      item.expense || 0,
      item.balance || 0,
      `"${(item.memo || '').replace(/"/g, '""')}"`
    ]);
    rows.push([
      '합계',
      '',
      '',
      summary.totalIncome,
      summary.totalExpense,
      summary.netBalance,
      ''
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const clubName = currentClub?.name || '테친회';
    const filePeriod = viewAllMonths ? '전체기간' : selectedMonth;
    link.setAttribute('download', `${clubName}_회비내역_${filePeriod}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 카카오톡/텍스트 공유용 복사
  const handleCopyTextSummary = async () => {
    if (periodEntriesWithBalance.length === 0) {
      alert('복사할 회비 내역이 없습니다.');
      return;
    }
    const clubName = currentClub?.name || '테친회';
    const incBreakdown = INCOME_CATEGORIES.map(c => `${c} ${formatNum(summary.incomeTotals[c])}`).join(' / ');
    const expBreakdown = EXPENSE_CATEGORIES.map(c => `${c} ${formatNum(summary.expenseTotals[c])}`).join(' / ');
    const lines = [
      `📒 [${clubName}] ${formattedPeriodTitle} 회비 수입·지출 내역`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `🔵 총 수입: +${formatNum(summary.totalIncome)}원`,
      `   (${incBreakdown})`,
      `🔴 총 지출: -${formatNum(summary.totalExpense)}원`,
      `   (${expBreakdown})`,
      `🟢 최종 잔액: ${formatNum(summary.netBalance)}원`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `[상세 내역 (${periodEntriesWithBalance.length}건)]`
    ];

    periodEntriesWithBalance.forEach((item) => {
      const signAmt = item.income > 0
        ? `+${formatNum(item.income)}원(수입)`
        : `-${formatNum(item.expense)}원(지출)`;
      const memoPart = item.memo ? ` - ${item.memo}` : '';
      lines.push(`${item.date.substring(5)} [${item.category}] ${signAmt}${memoPart} (잔액: ${formatNum(item.balance)}원)`);
    });

    if (currentClub?.bankAccount) {
      lines.push(`━━━━━━━━━━━━━━━━━━━━`);
      lines.push(`🏦 회비 계좌: ${currentClub.bankAccount}${currentClub.accountHolder ? ` (예금주: ${currentClub.accountHolder})` : ''}`);
    }

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      alert(`${formattedPeriodTitle} 회비 내역이 클립보드에 복사되었습니다.\n카카오톡이나 밴드에 바로 붙여넣기 하실 수 있습니다.`);
    } catch {
      alert('클립보드 복사에 실패했습니다.');
    }
  };

  // A4 인쇄 실행
  const triggerA4Print = () => {
    if (typeof window === 'undefined') return;
    window.print();
  };

  // A4 출력용 문서 렌더링 (미리보기 모달 & 실제 @media print 공용)
  const renderA4LedgerSheet = () => {
    const clubName = currentClub?.name || '테친회';
    const printDate = getTodayYMD();
    const rowCount = periodEntriesWithBalance.length;
    const isCompact = rowCount > 18;
    const totalCatCount = INCOME_CATEGORIES.length + EXPENSE_CATEGORIES.length;

    return (
      <div
        style={{
          width: '100%',
          background: '#ffffff',
          color: '#0f172a',
          fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, 'Malgun Gothic', sans-serif",
          boxSizing: 'border-box',
          padding: '4px'
        }}
      >
        {/* 1. 상단 문서 타이틀 & 결재선 헤더 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          borderBottom: '2.5px solid #0f172a',
          paddingBottom: '10px',
          marginBottom: '12px',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#475569', letterSpacing: '0.04em' }}>
              🎾 {clubName} 공식 회비 회계 보고서
            </div>
            <h1 style={{ fontSize: '21px', fontWeight: 900, margin: '3px 0 0 0', color: '#0f172a', letterSpacing: '-0.02em' }}>
              {formattedPeriodTitle} 회비 수입·지출 내역서
            </h1>
            <div style={{ fontSize: '11.5px', color: '#334155', marginTop: '4px', fontWeight: 600 }}>
              출력일자: {printDate} | 총 {periodEntriesWithBalance.length}건
              {printIncludeBankInfo && currentClub?.bankAccount && (
                <span> | 회비계좌: {currentClub.bankAccount} {currentClub.accountHolder ? `(${currentClub.accountHolder})` : ''}</span>
              )}
            </div>
          </div>

          {printIncludeSignBox && (
            <table style={{ borderCollapse: 'collapse', border: '1px solid #334155', fontSize: '10.5px', textAlign: 'center' }}>
              <thead>
                <tr style={{ background: '#f1f5f9' }}>
                  <th style={{ border: '1px solid #334155', padding: '3px 14px', fontWeight: 800, color: '#0f172a' }}>작성 (총무)</th>
                  <th style={{ border: '1px solid #334155', padding: '3px 14px', fontWeight: 800, color: '#0f172a' }}>검토 (감사)</th>
                  <th style={{ border: '1px solid #334155', padding: '3px 14px', fontWeight: 800, color: '#0f172a' }}>승인 (회장)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ border: '1px solid #334155', height: '32px', width: '68px' }}></td>
                  <td style={{ border: '1px solid #334155', height: '32px', width: '68px' }}></td>
                  <td style={{ border: '1px solid #334155', height: '32px', width: '68px' }}></td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {/* 2. 월별 총괄 수지 요약 박스 */}
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #0f172a', marginBottom: '10px', textAlign: 'center' }}>
          <thead>
            <tr style={{ background: '#f8fafc', fontSize: '11.5px' }}>
              <th style={{ border: '1px solid #64748b', padding: '6px 8px', width: '33.3%', color: '#1e3a8a', fontWeight: 800 }}>
                총 수입 합계 (이월잔액 포함)
              </th>
              <th style={{ border: '1px solid #64748b', padding: '6px 8px', width: '33.3%', color: '#9f1239', fontWeight: 800 }}>
                총 지출 합계
              </th>
              <th style={{ border: '1px solid #64748b', padding: '6px 8px', width: '33.3%', color: '#065f46', fontWeight: 800 }}>
                최종 잔액 (수입 - 지출)
              </th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ fontSize: '15px', fontWeight: 900 }}>
              <td style={{ border: '1px solid #64748b', padding: '8px', color: '#1d4ed8', background: '#ffffff' }}>
                +{formatNum(summary.totalIncome)}원
              </td>
              <td style={{ border: '1px solid #64748b', padding: '8px', color: '#be123c', background: '#ffffff' }}>
                -{formatNum(summary.totalExpense)}원
              </td>
              <td style={{ border: '1px solid #64748b', padding: '8px', color: '#047857', background: '#f0fdf4' }}>
                {formatNum(summary.netBalance)}원
              </td>
            </tr>
          </tbody>
        </table>

        {/* 3. 항목별(수입 6항목 / 지출 4항목) 소계 요약표 */}
        {printIncludeCategorySummary && (
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #475569', marginBottom: '12px', fontSize: '10px', textAlign: 'center' }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                <th colSpan={INCOME_CATEGORIES.length} style={{ border: '1px solid #64748b', padding: '4px', color: '#1e40af', fontWeight: 800 }}>
                  수입 항목별 소계
                </th>
                <th colSpan={EXPENSE_CATEGORIES.length} style={{ border: '1px solid #64748b', padding: '4px', color: '#9f1239', fontWeight: 800 }}>
                  지출 항목별 소계
                </th>
              </tr>
              <tr style={{ background: '#f8fafc', fontWeight: 700, color: '#334155' }}>
                {INCOME_CATEGORIES.map(c => (
                  <th key={`inc-${c}`} style={{ border: '1px solid #94a3b8', padding: '4px 2px', width: `${100 / totalCatCount}%` }}>{c}</th>
                ))}
                {EXPENSE_CATEGORIES.map(c => (
                  <th key={`exp-${c}`} style={{ border: '1px solid #94a3b8', padding: '4px 2px', width: `${100 / totalCatCount}%` }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr style={{ fontWeight: 800 }}>
                {INCOME_CATEGORIES.map(c => (
                  <td key={`inc-val-${c}`} style={{ border: '1px solid #94a3b8', padding: '5px 2px', color: summary.incomeTotals[c] > 0 ? '#1d4ed8' : '#64748b' }}>
                    {formatNum(summary.incomeTotals[c])}
                  </td>
                ))}
                {EXPENSE_CATEGORIES.map(c => (
                  <td key={`exp-val-${c}`} style={{ border: '1px solid #94a3b8', padding: '5px 2px', color: summary.expenseTotals[c] > 0 ? '#be123c' : '#64748b' }}>
                    {formatNum(summary.expenseTotals[c])}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        )}

        {/* 4. 월별 전체 상세 내역 테이블 (관리항목: 사용일, 내용, 수입, 지출, 적요 + 잔액) */}
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #0f172a', fontSize: isCompact ? '10.5px' : '11.5px' }}>
          <thead>
            <tr style={{ background: '#e2e8f0', color: '#0f172a' }}>
              <th style={{ border: '1px solid #475569', padding: isCompact ? '4px' : '6px', width: '36px', textAlign: 'center', fontWeight: 900 }}>No.</th>
              <th style={{ border: '1px solid #475569', padding: isCompact ? '4px 6px' : '6px 8px', width: '92px', textAlign: 'center', fontWeight: 900 }}>사용일</th>
              <th style={{ border: '1px solid #475569', padding: isCompact ? '4px 6px' : '6px 8px', width: '88px', textAlign: 'center', fontWeight: 900 }}>내용</th>
              <th style={{ border: '1px solid #475569', padding: isCompact ? '4px 6px' : '6px 8px', width: '98px', textAlign: 'right', fontWeight: 900, color: '#1e3a8a' }}>수입</th>
              <th style={{ border: '1px solid #475569', padding: isCompact ? '4px 6px' : '6px 8px', width: '98px', textAlign: 'right', fontWeight: 900, color: '#9f1239' }}>지출</th>
              <th style={{ border: '1px solid #475569', padding: isCompact ? '4px 6px' : '6px 8px', width: '104px', textAlign: 'right', fontWeight: 900, color: '#065f46' }}>잔액</th>
              <th style={{ border: '1px solid #475569', padding: isCompact ? '4px 8px' : '6px 10px', textAlign: 'left', fontWeight: 900 }}>적요</th>
            </tr>
          </thead>
          <tbody>
            {periodEntriesWithBalance.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ border: '1px solid #64748b', padding: '24px', textAlign: 'center', color: '#64748b' }}>
                  해당 기간에 등록된 회비 수입·지출 내역이 없습니다.
                </td>
              </tr>
            ) : (
              periodEntriesWithBalance.map((item, idx) => (
                <tr key={item.id || idx} style={{ background: idx % 2 === 1 ? '#f8fafc' : '#ffffff' }}>
                  <td style={{ border: '1px solid #64748b', padding: isCompact ? '4px' : '6px', textAlign: 'center', fontWeight: 700, color: '#475569' }}>
                    {item.rowNum}
                  </td>
                  <td style={{ border: '1px solid #64748b', padding: isCompact ? '4px 6px' : '6px 8px', textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {item.date}
                  </td>
                  <td style={{ border: '1px solid #64748b', padding: isCompact ? '4px 6px' : '6px 8px', textAlign: 'center', fontWeight: 800, whiteSpace: 'nowrap' }}>
                    {item.category}
                  </td>
                  <td style={{ border: '1px solid #64748b', padding: isCompact ? '4px 6px' : '6px 8px', textAlign: 'right', fontWeight: 800, color: item.income > 0 ? '#1d4ed8' : '#94a3b8', whiteSpace: 'nowrap' }}>
                    {item.income > 0 ? `${formatNum(item.income)}` : '-'}
                  </td>
                  <td style={{ border: '1px solid #64748b', padding: isCompact ? '4px 6px' : '6px 8px', textAlign: 'right', fontWeight: 800, color: item.expense > 0 ? '#be123c' : '#94a3b8', whiteSpace: 'nowrap' }}>
                    {item.expense > 0 ? `${formatNum(item.expense)}` : '-'}
                  </td>
                  <td style={{ border: '1px solid #64748b', padding: isCompact ? '4px 6px' : '6px 8px', textAlign: 'right', fontWeight: 800, color: '#0f172a', background: '#f8fafc', whiteSpace: 'nowrap' }}>
                    {formatNum(item.balance)}
                  </td>
                  <td style={{ border: '1px solid #64748b', padding: isCompact ? '4px 8px' : '6px 10px', textAlign: 'left', color: '#1e293b', fontWeight: 600 }}>
                    {item.memo || ''}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr style={{ background: '#f1f5f9', fontWeight: 900, fontSize: isCompact ? '11.5px' : '12.5px' }}>
              <td colSpan={3} style={{ border: '1.5px solid #0f172a', padding: '7px 8px', textAlign: 'center', color: '#0f172a' }}>
                {formattedPeriodTitle} 합 계 ({periodEntriesWithBalance.length}건)
              </td>
              <td style={{ border: '1.5px solid #0f172a', padding: '7px 6px', textAlign: 'right', color: '#1d4ed8', whiteSpace: 'nowrap' }}>
                +{formatNum(summary.totalIncome)}원
              </td>
              <td style={{ border: '1.5px solid #0f172a', padding: '7px 6px', textAlign: 'right', color: '#be123c', whiteSpace: 'nowrap' }}>
                -{formatNum(summary.totalExpense)}원
              </td>
              <td style={{ border: '1.5px solid #0f172a', padding: '7px 6px', textAlign: 'right', color: '#047857', background: '#ecfdf5', whiteSpace: 'nowrap' }}>
                {formatNum(summary.netBalance)}원
              </td>
              <td style={{ border: '1.5px solid #0f172a', padding: '7px 8px', textAlign: 'left', fontSize: '10.5px', color: '#475569' }}>
                잔액 = 총수입 - 총지출
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
        <span className="spinner" />
        <p style={{ marginTop: '12px', color: 'var(--txt2)', fontSize: '14px' }}>회비 내역을 불러오는 중입니다...</p>
      </div>
    );
  }

  const activeIsIncome = formType === 'INCOME';

  return (
    <div>
      {/* ── 인쇄 전용 시트 (화면에서는 숨겨지고 A4 인쇄 시에만 출력됨) ── */}
      <div className="a4-print-only-sheet">
        {renderA4LedgerSheet()}
      </div>

      {/* ── 화면용 UI 컨테이너 (인쇄 시 숨김) ── */}
      <div className="no-print">
        {/* 1. 상단 월 선택 네비게이터 및 출력 도구 모음 */}
        <div className="card" style={{
          marginBottom: '18px',
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '14px', fontWeight: 800, color: '#334155', marginRight: '4px' }}>
              📅 조회 기간
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => shiftMonth(-1)}
              disabled={viewAllMonths}
              style={{ padding: '6px 10px', fontWeight: 800 }}
              title="이전 달"
            >
              ◀
            </button>
            <input
              type="month"
              className="input"
              value={selectedMonth}
              disabled={viewAllMonths}
              onChange={(e) => handleMonthChange(e.target.value)}
              style={{
                width: 'auto',
                minWidth: '150px',
                padding: '6px 12px',
                fontWeight: 800,
                fontSize: '15px',
                color: '#0f172a',
                borderRadius: '10px',
                textAlign: 'center'
              }}
            />
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => shiftMonth(1)}
              disabled={viewAllMonths}
              style={{ padding: '6px 10px', fontWeight: 800 }}
              title="다음 달"
            >
              ▶
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleMonthChange(getTodayYMD().substring(0, 7))}
              style={{
                padding: '6px 12px',
                fontSize: '12.5px',
                fontWeight: 700,
                background: (!viewAllMonths && selectedMonth === getTodayYMD().substring(0, 7)) ? '#eff6ff' : '#ffffff',
                color: (!viewAllMonths && selectedMonth === getTodayYMD().substring(0, 7)) ? '#1d4ed8' : '#475569',
                borderColor: (!viewAllMonths && selectedMonth === getTodayYMD().substring(0, 7)) ? '#93c5fd' : '#cbd5e1'
              }}
            >
              이번 달
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setViewAllMonths(prev => !prev)}
              style={{
                padding: '6px 12px',
                fontSize: '12.5px',
                fontWeight: 700,
                background: viewAllMonths ? '#1e293b' : '#ffffff',
                color: viewAllMonths ? '#ffffff' : '#475569',
                borderColor: viewAllMonths ? '#1e293b' : '#cbd5e1'
              }}
            >
              {viewAllMonths ? '✓ 전체 기간 보기 중' : '전체 기간 보기'}
            </button>
          </div>

          {/* 우측 출력 & 내보내기 버튼 그룹 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setShowPrintModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 15px',
                borderRadius: '10px',
                border: '1px solid #1d4ed8',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)'
              }}
            >
              <span>🖨️</span>
              <span>{viewAllMonths ? '전체 내역 출력 (A4)' : '월별 전체 내역 출력 (A4)'}</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleDownloadCsv}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '8px 12px',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '12.5px',
                background: '#ffffff',
                color: '#15803d',
                borderColor: '#86efac'
              }}
              title="현재 조회 중인 월의 전체 내역을 엑셀(CSV) 파일로 저장합니다"
            >
              📊 엑셀(CSV) 저장
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleCopyTextSummary}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '8px 12px',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '12.5px',
                background: '#ffffff',
                color: '#334155',
                borderColor: '#cbd5e1'
              }}
              title="카카오톡/밴드 공지용 텍스트로 복사합니다"
            >
              📋 카톡 공지 복사
            </button>
          </div>
        </div>

        {/* 2. 월별 수지 요약 대시보드 카드 (수입 / 지출 / 잔액 & 세부 항목별 집계) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '14px',
          marginBottom: '20px'
        }}>
          {/* 총 수입 카드 */}
          <div className="card" style={{
            padding: '18px 20px',
            background: 'linear-gradient(135deg, #ffffff 0%, #eff6ff 100%)',
            border: '1px solid #bfdbfe',
            borderRadius: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#1e40af' }}>
                🔵 {formattedPeriodTitle} 총 수입
              </span>
              <span className="badge" style={{ background: '#dbeafe', color: '#1d4ed8', fontSize: '11px', fontWeight: 800 }}>
                수입 6개 항목
              </span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: '#1d4ed8', letterSpacing: '-0.02em', marginBottom: '12px' }}>
              +{formatNum(summary.totalIncome)}원
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', fontSize: '11.5px' }}>
              {INCOME_CATEGORIES.map(cat => {
                const filterKey = `INCOME:${cat}`;
                const meta = getCategoryMeta(cat, 'INCOME');
                return (
                  <div
                    key={filterKey}
                    onClick={() => setCategoryFilter(categoryFilter === filterKey ? 'ALL' : filterKey)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      padding: '5px 7px',
                      borderRadius: '8px',
                      background: categoryFilter === filterKey ? '#1d4ed8' : 'rgba(255,255,255,0.85)',
                      color: categoryFilter === filterKey ? '#ffffff' : '#334155',
                      border: '1px solid #dbeafe',
                      cursor: 'pointer',
                      fontWeight: 700
                    }}
                    title={`클릭하여 '${cat} (수입)' 내역만 필터링`}
                  >
                    <span style={{ whiteSpace: 'nowrap' }}>{meta.icon} {cat}</span>
                    <span style={{ fontWeight: 800, fontSize: '12px' }}>{formatNum(summary.incomeTotals[cat])}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 총 지출 카드 */}
          <div className="card" style={{
            padding: '18px 20px',
            background: 'linear-gradient(135deg, #ffffff 0%, #fff1f2 100%)',
            border: '1px solid #fecdd3',
            borderRadius: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#9f1239' }}>
                🔴 {formattedPeriodTitle} 총 지출
              </span>
              <span className="badge" style={{ background: '#ffe4e6', color: '#be123c', fontSize: '11px', fontWeight: 800 }}>
                지출 4개 항목
              </span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: '#be123c', letterSpacing: '-0.02em', marginBottom: '12px' }}>
              -{formatNum(summary.totalExpense)}원
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '12px' }}>
              {EXPENSE_CATEGORIES.map(cat => {
                const filterKey = `EXPENSE:${cat}`;
                const meta = getCategoryMeta(cat, 'EXPENSE');
                return (
                  <div
                    key={filterKey}
                    onClick={() => setCategoryFilter(categoryFilter === filterKey ? 'ALL' : filterKey)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '5px 8px',
                      borderRadius: '8px',
                      background: categoryFilter === filterKey ? '#be123c' : 'rgba(255,255,255,0.85)',
                      color: categoryFilter === filterKey ? '#ffffff' : '#334155',
                      border: '1px solid #ffe4e6',
                      cursor: 'pointer',
                      fontWeight: 700
                    }}
                    title={`클릭하여 '${cat} (지출)' 내역만 필터링`}
                  >
                    <span>{meta.icon} {cat}</span>
                    <span style={{ fontWeight: 800 }}>{formatNum(summary.expenseTotals[cat])}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 최종 잔액 카드 */}
          <div className="card" style={{
            padding: '18px 20px',
            background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)',
            border: '1px solid #bbf7d0',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#166534' }}>
                  🟢 {formattedPeriodTitle} 최종 잔액
                </span>
                <span className="badge" style={{ background: '#dcfce7', color: '#15803d', fontSize: '11px', fontWeight: 800 }}>
                  수입 - 지출
                </span>
              </div>
              <div style={{
                fontSize: '26px',
                fontWeight: 900,
                color: summary.netBalance >= 0 ? '#15803d' : '#dc2626',
                letterSpacing: '-0.02em',
                marginBottom: '8px'
              }}>
                {formatNum(summary.netBalance)}원
              </div>
            </div>
            <div style={{
              padding: '8px 10px',
              borderRadius: '10px',
              background: 'rgba(255,255,255,0.85)',
              border: '1px solid #dcfce7',
              fontSize: '12px',
              color: '#334155',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '4px'
            }}>
              <span>당월 순수입(이월 제외): <strong>+{formatNum(summary.totalIncome - (summary.incomeTotals['이월잔액'] || 0))}원</strong></span>
              <span style={{ color: '#64748b' }}>총 {periodEntriesWithBalance.length}건</span>
            </div>
          </div>
        </div>

        {/* 3. 회비 내역 입력 / 수정 폼 (운영진 또는 회비관리 권한 보유자) */}
        {canEdit ? (
          <div className="card" style={{
            marginBottom: '22px',
            padding: '20px',
            border: editingId ? '2px solid #2563eb' : '1px solid var(--border)',
            background: editingId ? '#f8faff' : '#ffffff'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--txt)' }}>
                  {editingId ? '✏️ 회비 내역 수정' : '📝 회비 내역 입력'}
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                  관리항목: 사용일 · 내용 · 수입 · 지출 · 적요
                </span>
              </div>

              {/* 빠른 자동 입력 도우미 버튼 */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {!viewAllMonths && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleFillCarryover}
                    style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      padding: '5px 10px',
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      borderColor: '#bfdbfe'
                    }}
                    title="전월 최종 잔액을 계산하여 당월 1일자 이월잔액으로 자동 세팅합니다"
                  >
                    🏦 전월 이월잔액 불러오기
                    {prevMonthClosingBalance ? ` (${formatNum(prevMonthClosingBalance.balance)}원)` : ''}
                  </button>
                )}
                {regularPaidInfo.paidCount > 0 && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleFillRegularFees}
                    style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      padding: '5px 10px',
                      background: '#f0fdf4',
                      color: '#15803d',
                      borderColor: '#bbf7d0'
                    }}
                    title="현재 회비 완납 체크된 정회원 수 × 회비 금액을 자동으로 채웁니다"
                  >
                    💳 완납 정회원 회비 계산 ({regularPaidInfo.paidCount}명 · {formatNum(regularPaidInfo.totalFeeAmount)}원)
                  </button>
                )}
                {editingId && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={resetForm}
                    style={{ fontSize: '12px', fontWeight: 700, padding: '5px 10px' }}
                  >
                    수정 취소
                  </button>
                )}
              </div>
            </div>

            {/* 내용(수입 6항목 / 지출 4항목) 원클릭 선택 바 */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              marginBottom: '16px',
              padding: '12px 14px',
              borderRadius: '12px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#1d4ed8', paddingRight: '4px' }}>
                  🔵 수입 항목:
                </span>
                {INCOME_CATEGORIES.map(cat => {
                  const active = formType === 'INCOME' && formCategory === cat;
                  const meta = getCategoryMeta(cat, 'INCOME');
                  return (
                    <button
                      key={`btn-inc-${cat}`}
                      type="button"
                      onClick={() => handleCategoryChange(cat, 'INCOME')}
                      style={{
                        padding: '6px 13px',
                        borderRadius: '999px',
                        fontSize: '13px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        border: active ? '1.5px solid #1d4ed8' : '1px solid #cbd5e1',
                        background: active ? '#1d4ed8' : '#ffffff',
                        color: active ? '#ffffff' : '#334155',
                        boxShadow: active ? '0 2px 6px rgba(29, 78, 216, 0.25)' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {meta.icon} {cat}
                      {cat === '회비' && <span style={{ fontSize: '11px', opacity: 0.85, marginLeft: '3px' }}>(12만)</span>}
                      {cat === '게스트비' && <span style={{ fontSize: '11px', opacity: 0.85, marginLeft: '3px' }}>(1.5만)</span>}
                    </button>
                  );
                })}
              </div>

              <div style={{ width: '1px', background: '#cbd5e1', margin: '0 4px' }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#be123c', paddingRight: '4px' }}>
                  🔴 지출 항목:
                </span>
                {EXPENSE_CATEGORIES.map(cat => {
                  const active = formType === 'EXPENSE' && formCategory === cat;
                  const meta = getCategoryMeta(cat, 'EXPENSE');
                  return (
                    <button
                      key={`btn-exp-${cat}`}
                      type="button"
                      onClick={() => handleCategoryChange(cat, 'EXPENSE')}
                      style={{
                        padding: '6px 13px',
                        borderRadius: '999px',
                        fontSize: '13px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        border: active ? '1.5px solid #be123c' : '1px solid #cbd5e1',
                        background: active ? '#be123c' : '#ffffff',
                        color: active ? '#ffffff' : '#334155',
                        boxShadow: active ? '0 2px 6px rgba(190, 18, 60, 0.25)' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {meta.icon} {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 5대 관리항목 입력 그리드: 사용일 / 내용 / 수입 / 지출 / 적요 */}
            <form onSubmit={handleSubmit}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '12px',
                alignItems: 'end'
              }}>
                {/* 1. 사용일 */}
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 800, color: '#334155', marginBottom: '5px' }}>
                    📅 사용일
                  </label>
                  <input
                    type="date"
                    className="input"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    required
                    style={{ width: '100%', fontWeight: 700 }}
                  />
                </div>

                {/* 2. 내용 */}
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 800, color: '#334155', marginBottom: '5px' }}>
                    🏷️ 내용 ({activeIsIncome ? '수입' : '지출'})
                  </label>
                  <select
                    className="select"
                    value={`${formType}:${formCategory}`}
                    onChange={(e) => handleSelectChange(e.target.value)}
                    style={{
                      width: '100%',
                      fontWeight: 800,
                      color: activeIsIncome ? '#1d4ed8' : '#be123c',
                      backgroundColor: activeIsIncome ? '#eff6ff' : '#fff1f2',
                      borderColor: activeIsIncome ? '#93c5fd' : '#fda4af'
                    }}
                  >
                    <optgroup label="🔵 수입 항목">
                      {INCOME_CATEGORIES.map(c => (
                        <option key={`opt-inc-${c}`} value={`INCOME:${c}`}>{c} (수입)</option>
                      ))}
                    </optgroup>
                    <optgroup label="🔴 지출 항목">
                      {EXPENSE_CATEGORIES.map(c => (
                        <option key={`opt-exp-${c}`} value={`EXPENSE:${c}`}>{c} (지출)</option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {/* 3. 수입 금액 */}
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 800, color: activeIsIncome ? '#1d4ed8' : '#94a3b8', marginBottom: '5px' }}>
                    🔵 수입 (원)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="input"
                    placeholder={activeIsIncome ? '수입 금액 입력' : '- (지출 항목 선택됨)'}
                    value={formIncome}
                    disabled={!activeIsIncome}
                    onChange={(e) => {
                      const num = parseNumInput(e.target.value);
                      setFormIncome(num > 0 ? formatNum(num) : '');
                      setFormExpense('');
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'right',
                      fontWeight: 800,
                      color: '#1d4ed8',
                      backgroundColor: activeIsIncome ? '#ffffff' : '#f1f5f9',
                      borderColor: activeIsIncome ? '#60a5fa' : '#e2e8f0'
                    }}
                  />
                </div>

                {/* 4. 지출 금액 */}
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 800, color: !activeIsIncome ? '#be123c' : '#94a3b8', marginBottom: '5px' }}>
                    🔴 지출 (원)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="input"
                    placeholder={!activeIsIncome ? '지출 금액 입력' : '- (수입 항목 선택됨)'}
                    value={formExpense}
                    disabled={activeIsIncome}
                    onChange={(e) => {
                      const num = parseNumInput(e.target.value);
                      setFormExpense(num > 0 ? formatNum(num) : '');
                      setFormIncome('');
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'right',
                      fontWeight: 800,
                      color: '#be123c',
                      backgroundColor: !activeIsIncome ? '#ffffff' : '#f1f5f9',
                      borderColor: !activeIsIncome ? '#fb7185' : '#e2e8f0'
                    }}
                  />
                </div>

                {/* 5. 적요 (기본 한글 입력 모드 유지) */}
                <div style={{ gridColumn: 'span 2', minWidth: '220px' }}>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 800, color: '#334155', marginBottom: '5px' }}>
                    📝 적요 (상세 내역 / 비고 · 한글 입력 기본)
                  </label>
                  <input
                    type="text"
                    lang="ko"
                    inputMode="text"
                    autoComplete="off"
                    className="input ime-ko"
                    placeholder={
                      formCategory === '이월잔액' ? '예: 전월 이월잔액'
                        : formCategory === '회비' ? '예: 홍길동 연회비/월회비 납부'
                        : formCategory === '게스트비' ? '예: 김철수 게스트 참가비'
                        : formCategory === '찬조' ? '예: 회장님 대회 찬조금'
                        : formCategory === '대회참가비' ? '예: 정기 월례대회 참가비'
                        : formType === 'INCOME' && formCategory === '기타' ? '예: 예금 이자 및 기타 수입'
                        : formCategory === '대관료' ? '예: 시립테니스장 2코트 대관료'
                        : formCategory === '식음료' ? '예: 정기모임 음료 및 간식 구입'
                        : formCategory === '대회상품' ? '예: 정기대회 시상품(테니스공) 구매'
                        : '예: 구급약품 및 클럽 용품 구입'
                    }
                    value={formMemo}
                    onChange={(e) => setFormMemo(e.target.value)}
                    style={{
                      width: '100%',
                      fontWeight: 600,
                      imeMode: 'active',
                      WebkitImeMode: 'active'
                    }}
                  />
                </div>
              </div>

              {/* 하단 금액 빠른 입력 버튼 & 등록 버튼 */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '14px',
                paddingTop: '12px',
                borderTop: '1px dashed #e2e8f0',
                flexWrap: 'wrap',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>⚡ 빠른 금액 입력:</span>
                  {[
                    { label: '+5천', val: 5000 },
                    { label: '+1만', val: 10000 },
                    { label: '+1.5만', val: 15000 },
                    { label: '+3만', val: 30000 },
                    { label: '+5만', val: 50000 },
                    { label: '+12만', val: 120000 },
                  ].map(btn => (
                    <button
                      key={btn.label}
                      type="button"
                      onClick={() => addQuickAmount(btn.val)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: '#334155',
                        cursor: 'pointer'
                      }}
                    >
                      {btn.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => { setFormIncome(''); setFormExpense(''); }}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '8px',
                      border: '1px solid #fecaca',
                      background: '#fef2f2',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#b91c1c',
                      cursor: 'pointer'
                    }}
                  >
                    금액 0초기화
                  </button>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                  style={{
                    padding: '10px 24px',
                    borderRadius: '10px',
                    fontWeight: 800,
                    fontSize: '14px',
                    background: editingId
                      ? '#2563eb'
                      : (activeIsIncome ? '#1d4ed8' : '#be123c'),
                    border: 'none',
                    color: '#ffffff',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)'
                  }}
                >
                  {submitting
                    ? '저장 중...'
                    : editingId
                      ? '💾 수정 내역 저장'
                      : `➕ ${formCategory} (${activeIsIncome ? '수입' : '지출'}) 내역 등록`}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div style={{
            marginBottom: '16px',
            padding: '12px 16px',
            borderRadius: '12px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <span style={{ fontSize: '13px', color: '#475569', fontWeight: 600 }}>
              💡 회비 수입·지출 내역 열람 및 월별 내역서 출력이 가능합니다. (내역 입력/수정은 운영진 전용)
            </span>
            {onRequireLogin && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onRequireLogin}
                style={{ fontSize: '12px', fontWeight: 700 }}
              >
                🔒 운영자 로그인
              </button>
            )}
          </div>
        )}

        {/* 4. 내역 조회 필터 바 & 테이블 */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
            marginBottom: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--txt)' }}>
                📋 {formattedPeriodTitle} 회비 상세 내역
              </h3>
              <span className="badge" style={{ background: '#f1f5f9', color: '#334155', fontSize: '12px', fontWeight: 800 }}>
                총 {filteredEntries.length}건
              </span>
            </div>

            {/* 적요/내용 검색창 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="text"
                lang="ko"
                className="input ime-ko"
                placeholder="🔍 적요, 내용, 날짜 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '210px', padding: '6px 12px', fontSize: '13px', imeMode: 'active', WebkitImeMode: 'active' }}
              />
              {(categoryFilter !== 'ALL' || searchQuery) && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setCategoryFilter('ALL'); setSearchQuery(''); }}
                  style={{ fontSize: '12px', fontWeight: 700, padding: '6px 10px' }}
                >
                  필터 초기화
                </button>
              )}
            </div>
          </div>

          {/* 항목별 필터 탭 칩 */}
          <div style={{
            display: 'flex',
            gap: '6px',
            flexWrap: 'wrap',
            marginBottom: '16px',
            paddingBottom: '12px',
            borderBottom: '1px solid #e2e8f0'
          }}>
            {[
              { key: 'ALL', label: `전체 (${periodEntriesWithBalance.length})` },
              { key: 'INCOME_ALL', label: '🔵 수입 전체' },
              ...INCOME_CATEGORIES.map(c => {
                const m = getCategoryMeta(c, 'INCOME');
                return { key: `INCOME:${c}`, label: `${m.icon} ${c === '기타' ? '기타(수입)' : c}` };
              }),
              { key: 'EXPENSE_ALL', label: '🔴 지출 전체' },
              ...EXPENSE_CATEGORIES.map(c => {
                const m = getCategoryMeta(c, 'EXPENSE');
                return { key: `EXPENSE:${c}`, label: `${m.icon} ${c === '기타' ? '기타(지출)' : c}` };
              }),
            ].map(tab => {
              const active = categoryFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setCategoryFilter(tab.key)}
                  style={{
                    padding: '5px 11px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: active ? '1px solid #0f172a' : '1px solid #cbd5e1',
                    background: active ? '#0f172a' : '#f8fafc',
                    color: active ? '#ffffff' : '#475569'
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* 내역 테이블 */}
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', minWidth: '680px', borderCollapse: 'collapse', fontSize: '13.5px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1', color: '#334155' }}>
                  <th style={{ padding: '10px 8px', width: '48px', textAlign: 'center', fontWeight: 800 }}>No.</th>
                  <th style={{ padding: '10px 10px', width: '110px', textAlign: 'center', fontWeight: 800 }}>사용일</th>
                  <th style={{ padding: '10px 10px', width: '112px', textAlign: 'center', fontWeight: 800 }}>내용</th>
                  <th style={{ padding: '10px 12px', width: '120px', textAlign: 'right', fontWeight: 800, color: '#1d4ed8' }}>수입</th>
                  <th style={{ padding: '10px 12px', width: '120px', textAlign: 'right', fontWeight: 800, color: '#be123c' }}>지출</th>
                  <th style={{ padding: '10px 12px', width: '125px', textAlign: 'right', fontWeight: 800, color: '#047857' }}>잔액</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 800 }}>적요</th>
                  {canEdit && (
                    <th style={{ padding: '10px 8px', width: '104px', textAlign: 'center', fontWeight: 800 }}>관리</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 8 : 7} style={{ padding: '42px 16px', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
                      {periodEntriesWithBalance.length === 0
                        ? `${formattedPeriodTitle}에 등록된 회비 수입·지출 내역이 없습니다.`
                        : '선택한 필터/검색 조건에 일치하는 내역이 없습니다.'}
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((item) => {
                    const meta = getCategoryMeta(item.category, item.type);
                    const isBeingEdited = editingId === item.id;
                    return (
                      <tr
                        key={item.id}
                        style={{
                          borderBottom: '1px solid #e2e8f0',
                          background: isBeingEdited ? '#eff6ff' : '#ffffff',
                          transition: 'background 0.15s ease'
                        }}
                      >
                        <td style={{ padding: '11px 8px', textAlign: 'center', color: '#64748b', fontWeight: 700 }}>
                          {item.rowNum}
                        </td>
                        <td style={{ padding: '11px 10px', textAlign: 'center', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' }}>
                          {item.date}
                        </td>
                        <td style={{ padding: '11px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 10px',
                            borderRadius: '999px',
                            fontSize: '12px',
                            fontWeight: 800,
                            background: meta.bg,
                            color: meta.color,
                            border: `1px solid ${meta.border}`
                          }}>
                            <span>{meta.icon}</span>
                            <span>{item.category}</span>
                          </span>
                        </td>
                        <td style={{
                          padding: '11px 12px',
                          textAlign: 'right',
                          fontWeight: 800,
                          color: item.income > 0 ? '#1d4ed8' : '#cbd5e1',
                          whiteSpace: 'nowrap'
                        }}>
                          {item.income > 0 ? `+${formatNum(item.income)}원` : '-'}
                        </td>
                        <td style={{
                          padding: '11px 12px',
                          textAlign: 'right',
                          fontWeight: 800,
                          color: item.expense > 0 ? '#be123c' : '#cbd5e1',
                          whiteSpace: 'nowrap'
                        }}>
                          {item.expense > 0 ? `-${formatNum(item.expense)}원` : '-'}
                        </td>
                        <td style={{
                          padding: '11px 12px',
                          textAlign: 'right',
                          fontWeight: 800,
                          color: '#0f172a',
                          background: '#f8fafc',
                          whiteSpace: 'nowrap'
                        }}>
                          {formatNum(item.balance)}원
                        </td>
                        <td style={{ padding: '11px 12px', textAlign: 'left', color: '#334155', fontWeight: 600 }}>
                          {item.memo || <span style={{ color: '#cbd5e1' }}>-</span>}
                        </td>
                        {canEdit && (
                          <td style={{ padding: '11px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'inline-flex', gap: '4px' }}>
                              <button
                                type="button"
                                onClick={() => handleStartEdit(item)}
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #bfdbfe',
                                  background: '#eff6ff',
                                  color: '#1d4ed8',
                                  fontSize: '11.5px',
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                              >
                                수정
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(item)}
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #fecaca',
                                  background: '#fef2f2',
                                  color: '#b91c1c',
                                  fontSize: '11.5px',
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                              >
                                삭제
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
              {filteredEntries.length > 0 && (
                <tfoot>
                  <tr style={{ background: '#f1f5f9', borderTop: '2px solid #334155', fontWeight: 900, fontSize: '14px' }}>
                    <td colSpan={3} style={{ padding: '12px 10px', textAlign: 'center', color: '#0f172a' }}>
                      {categoryFilter === 'ALL' && !searchQuery ? `${formattedPeriodTitle} 전체 합계` : '필터링 내역 합계'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#1d4ed8', whiteSpace: 'nowrap' }}>
                      +{formatNum(summary.filteredIncome)}원
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#be123c', whiteSpace: 'nowrap' }}>
                      -{formatNum(summary.filteredExpense)}원
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#047857', background: '#ecfdf5', whiteSpace: 'nowrap' }}>
                      {formatNum(categoryFilter === 'ALL' && !searchQuery ? summary.netBalance : summary.filteredBalance)}원
                    </td>
                    <td colSpan={canEdit ? 2 : 1} style={{ padding: '12px', textAlign: 'left', fontSize: '12px', color: '#475569' }}>
                      수입 {formatNum(summary.filteredIncome)}원 - 지출 {formatNum(summary.filteredExpense)}원
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      {/* ── 5. 월별 전체 내역 출력 미리보기 & 인쇄 모달 ── */}
      {showPrintModal && (
        <div
          className="no-print"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={() => setShowPrintModal(false)}
        >
          <div
            style={{
              background: '#f1f5f9',
              borderRadius: '18px',
              width: '100%',
              maxWidth: '900px',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.35)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 & 인쇄 옵션 바 */}
            <div style={{
              background: '#ffffff',
              padding: '16px 20px',
              borderBottom: '1px solid #cbd5e1',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 900, color: '#0f172a' }}>
                  🖨️ {formattedPeriodTitle} 회비 전체 내역 출력 미리보기 (A4)
                </h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '12.5px', color: '#64748b', fontWeight: 600 }}>
                  인쇄 버튼을 누르면 용지(A4)에 맞게 표만 깔끔하게 출력되거나 PDF로 저장할 수 있습니다.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={triggerA4Print}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '13.5px',
                    cursor: 'pointer',
                    boxShadow: '0 3px 10px rgba(37, 99, 235, 0.3)'
                  }}
                >
                  🖨️ 지금 인쇄 / PDF 저장
                </button>
                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  style={{
                    padding: '9px 14px',
                    borderRadius: '10px',
                    border: '1px solid #86efac',
                    background: '#f0fdf4',
                    color: '#15803d',
                    fontWeight: 800,
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  📊 엑셀(CSV) 저장
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  style={{
                    padding: '9px 14px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#475569',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  닫기
                </button>
              </div>
            </div>

            {/* 출력 옵션 체크박스 바 */}
            <div style={{
              background: '#f8fafc',
              padding: '10px 20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '18px',
              flexWrap: 'wrap',
              fontSize: '12.5px',
              fontWeight: 700,
              color: '#334155'
            }}>
              <span style={{ color: '#0f172a', fontWeight: 800 }}>⚙️ 출력 표시 옵션:</span>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={printIncludeCategorySummary}
                  onChange={(e) => setPrintIncludeCategorySummary(e.target.checked)}
                />
                <span>항목별(이월/회비/게스트비/찬조/대회참가비/기타 · 대관료/식음료/대회상품/기타) 소계표 표시</span>
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={printIncludeBankInfo}
                  onChange={(e) => setPrintIncludeBankInfo(e.target.checked)}
                />
                <span>회비 통장 계좌번호 표시</span>
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={printIncludeSignBox}
                  onChange={(e) => setPrintIncludeSignBox(e.target.checked)}
                />
                <span>상단 결재란(총무·감사·회장) 표시</span>
              </label>
            </div>

            {/* A4 용지 미리보기 영역 */}
            <div style={{
              padding: '20px',
              overflowY: 'auto',
              flex: 1,
              display: 'flex',
              justifyContent: 'center'
            }}>
              <div style={{
                width: '100%',
                maxWidth: '794px',
                background: '#ffffff',
                padding: '24px 28px',
                borderRadius: '8px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                boxSizing: 'border-box'
              }}>
                {renderA4LedgerSheet()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

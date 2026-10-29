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
}) {
  const canEdit = Boolean(isAdmin || canManageFee);

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // 조회 시작월 ~ 종료월 상태 (기본값: 올해 전체 YYYY-01 ~ YYYY-12)
  const currentYm = getTodayYMD().substring(0, 7);
  const currentYear = currentYm.substring(0, 4);
  const [startMonth, setStartMonth] = useState(`${currentYear}-01`);
  const [endMonth, setEndMonth] = useState(`${currentYear}-12`);

  // 상세내역 조회 필터 콤보박스 및 페이징 상태
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'INCOME' | 'EXPENSE'
  const [filterCategory, setFilterCategory] = useState('ALL'); // 'ALL' | 'INCOME:회비' | 'EXPENSE:대관료' 등
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // 입력 / 수정 폼 상태 (기본값: 수입 - '회비' 120,000원)
  const [editingId, setEditingId] = useState(null);
  const [formDate, setFormDate] = useState(() => getTodayYMD());
  const [formType, setFormType] = useState('INCOME'); // 'INCOME' | 'EXPENSE'
  const [formCategory, setFormCategory] = useState('회비');
  const [formIncome, setFormIncome] = useState('120,000');
  const [formExpense, setFormExpense] = useState('');
  const [formMemo, setFormMemo] = useState('');

  // 출력 미리보기 모달 상태 ('DETAIL': 기간 상세내역 출력 | 'ANNUAL': 연간 월별 집계 출력)
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printMode, setPrintMode] = useState('DETAIL'); // 'DETAIL' | 'ANNUAL'
  const [annualPrintYear, setAnnualPrintYear] = useState(() => currentYm.substring(0, 4));
  const [printShowEmptyMonths, setPrintShowEmptyMonths] = useState(true);
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

  // 시작월 변경 핸들러 (등록 중인 사용일은 유지)
  const handleStartMonthChange = (newStart) => {
    if (!newStart) return;
    setStartMonth(newStart);
    if (newStart > endMonth) {
      setEndMonth(newStart);
    }
  };

  // 종료월 변경 핸들러
  const handleEndMonthChange = (newEnd) => {
    if (!newEnd) return;
    setEndMonth(newEnd);
    if (newEnd < startMonth) {
      setStartMonth(newEnd);
    }
  };

  // 빠른 기간 선택 (이번 달 / 올해 전체)
  const applyQuickPeriod = (mode) => {
    const todayYm = getTodayYMD().substring(0, 7);
    const thisYear = todayYm.substring(0, 4);
    if (mode === 'THIS_MONTH') {
      setStartMonth(todayYm);
      setEndMonth(todayYm);
    } else if (mode === 'THIS_YEAR') {
      setStartMonth(`${thisYear}-01`);
      setEndMonth(`${thisYear}-12`);
    }
  };

  // 입력 폼: 구분(수입/지출) 콤보박스 변경 핸들러
  const handleFormTypeChange = (nextType) => {
    if (nextType === formType) return;
    const defaultCat = nextType === 'INCOME' ? '회비' : '대관료';
    handleCategoryChange(defaultCat, nextType);
  };

  // 입력 폼: 내용(항목) 콤보박스 변경 핸들러
  // - '회비' 선택 시 120,000원 기본 입력
  // - '게스트비' 선택 시 15,000원 기본 입력
  const handleCategoryChange = (newCat, explicitType = null) => {
    const nextType = explicitType || formType;
    const prevKey = `${formType}:${formCategory}`;
    const nextKey = `${nextType}:${newCat}`;
    const prevDefaultAmt = DEFAULT_CATEGORY_AMOUNTS[prevKey];
    const nextDefaultAmt = DEFAULT_CATEGORY_AMOUNTS[nextKey];

    setFormType(nextType);
    setFormCategory(newCat);

    if (nextDefaultAmt) {
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

  // 상세내역 조회 필터: 구분(전체/수입/지출) 콤보박스 변경 핸들러
  const handleFilterTypeChange = (nextFilterType) => {
    setFilterType(nextFilterType);
    setFilterCategory('ALL');
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

  // 폼 초기화 시 현재 등록 중인 사용일(formDate)은 그대로 유지
  const resetForm = () => {
    setEditingId(null);
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

  // 조회 시작월 ~ 종료월 내역 및 누적 잔액 계산
  const periodEntriesWithBalance = useMemo(() => {
    const targetList = sortedAllEntries.filter(e => {
      const ym = (e.date || '').substring(0, 7);
      if (!ym) return false;
      return ym >= startMonth && ym <= endMonth;
    });

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
  }, [sortedAllEntries, startMonth, endMonth]);

  // 시작월 이전 달의 최종 잔액 계산 (전월 이월잔액 자동 입력용)
  const prevMonthClosingBalance = useMemo(() => {
    const prevEntries = sortedAllEntries.filter(e => e.date && e.date < `${startMonth}-01`);
    if (prevEntries.length === 0) return null;
    const prevMonths = [...new Set(prevEntries.map(e => e.date.substring(0, 7)))].sort();
    const lastMonth = prevMonths[prevMonths.length - 1];
    const lastMonthEntries = prevEntries.filter(e => e.date.substring(0, 7) === lastMonth);
    const lastMonthBalance = lastMonthEntries.reduce((acc, cur) => acc + (Number(cur.income) || 0) - (Number(cur.expense) || 0), 0);
    return {
      month: lastMonth,
      balance: lastMonthBalance
    };
  }, [sortedAllEntries, startMonth]);

  // 화면 필터링된 내역 (구분/항목 콤보박스 및 검색어 적용)
  const filteredEntries = useMemo(() => {
    return periodEntriesWithBalance.filter(item => {
      const itemType = item.type;
      const itemKey = `${itemType}:${item.category}`;

      if (filterType === 'INCOME' && itemType !== 'INCOME') return false;
      if (filterType === 'EXPENSE' && itemType !== 'EXPENSE') return false;

      if (filterCategory !== 'ALL') {
        if (itemKey !== filterCategory) return false;
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
  }, [periodEntriesWithBalance, filterType, filterCategory, searchQuery]);

  // 조회 조건/검색어/페이지크기 변경 시 1페이지로 이동
  useEffect(() => {
    setCurrentPage(1);
  }, [startMonth, endMonth, filterType, filterCategory, searchQuery, pageSize]);

  // 페이징 계산
  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedEntries = useMemo(() => {
    return filteredEntries.slice(startIndex, startIndex + pageSize);
  }, [filteredEntries, startIndex, pageSize]);

  const pageNumbers = useMemo(() => {
    const maxButtons = 5;
    let startP = Math.max(1, safePage - Math.floor(maxButtons / 2));
    let endP = Math.min(totalPages, startP + maxButtons - 1);
    if (endP - startP + 1 < maxButtons) {
      startP = Math.max(1, endP - maxButtons + 1);
    }
    const pages = [];
    for (let p = startP; p <= endP; p += 1) {
      pages.push(p);
    }
    return pages;
  }, [safePage, totalPages]);

  // 기간별 수입/지출/잔액 및 항목별 합계 요약
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

  const handleFillCarryover = () => {
    setFormDate(`${startMonth}-01`);
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

      // 입력한 날짜가 현재 조회 기간 밖이면 조회 기간을 자동 확장
      const entryYm = formDate.substring(0, 7);
      if (entryYm < startMonth) setStartMonth(entryYm);
      if (entryYm > endMonth) setEndMonth(entryYm);

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
      window.scrollTo({ top: 150, behavior: 'smooth' });
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

  // 조회 기간 타이틀 포맷 (예: 2026년 10월 또는 2026년 1월 ~ 2026년 10월)
  const formattedPeriodTitle = useMemo(() => {
    const [sy, sm] = startMonth.split('-').map(Number);
    const [ey, em] = endMonth.split('-').map(Number);
    if (startMonth === endMonth) {
      return `${sy}년 ${sm}월`;
    }
    if (sy === ey) {
      return `${sy}년 ${sm}월 ~ ${em}월`;
    }
    return `${sy}년 ${sm}월 ~ ${ey}년 ${em}월`;
  }, [startMonth, endMonth]);

  // 연간 출력용 선택 가능 연도 목록
  const availableYears = useMemo(() => {
    const curY = Number(currentYm.substring(0, 4)) || new Date().getFullYear();
    const yearSet = new Set([
      String(curY - 1),
      String(curY),
      String(curY + 1),
      startMonth.substring(0, 4),
      endMonth.substring(0, 4),
    ]);
    entries.forEach(e => {
      const y = (e.date || '').substring(0, 4);
      if (/^\d{4}$/.test(y)) yearSet.add(y);
    });
    return Array.from(yearSet).sort((a, b) => b.localeCompare(a));
  }, [entries, currentYm, startMonth, endMonth]);

  // 연간 내역 (월별 1월~12월 집계) 데이터 계산
  const annualMonthlySummary = useMemo(() => {
    const yearEntries = sortedAllEntries.filter(e => (e.date || '').startsWith(`${annualPrintYear}-`));
    const incomeTotals = {};
    const expenseTotals = {};
    INCOME_CATEGORIES.forEach(c => { incomeTotals[c] = 0; });
    EXPENSE_CATEGORIES.forEach(c => { expenseTotals[c] = 0; });

    let totalIncome = 0;
    let totalExpense = 0;
    let runningBalance = 0;

    const monthlyRows = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const mm = String(m).padStart(2, '0');
      const ym = `${annualPrintYear}-${mm}`;
      const mEntries = yearEntries.filter(e => (e.date || '').substring(0, 7) === ym);

      const mIncCats = {};
      const mExpCats = {};
      let mIncome = 0;
      let mExpense = 0;

      mEntries.forEach(item => {
        const inc = Number(item.income) || 0;
        const exp = Number(item.expense) || 0;
        const resolvedType = resolveItemType(item);

        mIncome += inc;
        mExpense += exp;
        totalIncome += inc;
        totalExpense += exp;

        if (resolvedType === 'INCOME' || inc > 0) {
          const cat = incomeTotals[item.category] !== undefined ? item.category : '기타';
          incomeTotals[cat] = (incomeTotals[cat] || 0) + inc;
          if (inc > 0) mIncCats[cat] = (mIncCats[cat] || 0) + inc;
        } else {
          const cat = expenseTotals[item.category] !== undefined ? item.category : '기타';
          expenseTotals[cat] = (expenseTotals[cat] || 0) + exp;
          if (exp > 0) mExpCats[cat] = (mExpCats[cat] || 0) + exp;
        }
      });

      const mNet = mIncome - mExpense;
      runningBalance += mNet;

      const incParts = INCOME_CATEGORIES
        .filter(c => mIncCats[c] > 0)
        .map(c => `${c} ${formatNum(mIncCats[c])}`);
      const expParts = EXPENSE_CATEGORIES
        .filter(c => mExpCats[c] > 0)
        .map(c => `${c} ${formatNum(mExpCats[c])}`);

      const breakdownSegments = [];
      if (incParts.length > 0) breakdownSegments.push(`[수입] ${incParts.join(', ')}`);
      if (expParts.length > 0) breakdownSegments.push(`[지출] ${expParts.join(', ')}`);

      return {
        month: m,
        ym,
        label: `${m}월`,
        count: mEntries.length,
        income: mIncome,
        expense: mExpense,
        net: mNet,
        balance: runningBalance,
        incSummary: incParts.join(', '),
        expSummary: expParts.join(', '),
        breakdownText: breakdownSegments.join('  |  ')
      };
    });

    const displayedRows = printShowEmptyMonths
      ? monthlyRows
      : monthlyRows.filter(r => r.count > 0 || r.income > 0 || r.expense > 0);

    return {
      year: annualPrintYear,
      totalCount: yearEntries.length,
      totalIncome,
      totalExpense,
      netBalance: totalIncome - totalExpense,
      incomeTotals,
      expenseTotals,
      monthlyRows,
      displayedRows
    };
  }, [sortedAllEntries, annualPrintYear, printShowEmptyMonths]);

  // 엑셀(CSV) 다운로드 (상세내역 모드 vs 연간 월별 집계 모드 자동 분기)
  const handleDownloadCsv = (forceMode = null) => {
    const targetMode = forceMode || (showPrintModal ? printMode : 'DETAIL');
    const clubName = currentClub?.name || '테친회';

    if (targetMode === 'ANNUAL') {
      if (annualMonthlySummary.totalCount === 0) {
        alert(`${annualPrintYear}년에 등록된 회비 내역이 없습니다.`);
        return;
      }
      const headers = ['월', '건수', '월 수입 합계', '월 지출 합계', '월 수지(증감)', '누적 잔액', '월별 수입·지출 집계 요약'];
      const rows = annualMonthlySummary.displayedRows.map(r => [
        `${annualPrintYear}년 ${r.label}`,
        `${r.count}건`,
        r.income || 0,
        r.expense || 0,
        r.net || 0,
        r.balance || 0,
        `"${(r.breakdownText || '-').replace(/"/g, '""')}"`
      ]);
      rows.push([
        `${annualPrintYear}년 연간 합계`,
        `${annualMonthlySummary.totalCount}건`,
        annualMonthlySummary.totalIncome,
        annualMonthlySummary.totalExpense,
        annualMonthlySummary.netBalance,
        annualMonthlySummary.netBalance,
        ''
      ]);

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${clubName}_연간회비월별집계_${annualPrintYear}년.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return;
    }

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
    const filePeriod = startMonth === endMonth ? startMonth : `${startMonth}_${endMonth}`;
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
                  <th style={{ border: '1px solid #334155', padding: '3px 14px', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap' }}>작성 (총무)</th>
                  <th style={{ border: '1px solid #334155', padding: '3px 14px', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap' }}>검토 (감사)</th>
                  <th style={{ border: '1px solid #334155', padding: '3px 14px', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap' }}>승인 (회장)</th>
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
                  <th key={`inc-${c}`} style={{ border: '1px solid #94a3b8', padding: '4px 2px', width: `${100 / totalCatCount}%`, whiteSpace: 'nowrap' }}>{c}</th>
                ))}
                {EXPENSE_CATEGORIES.map(c => (
                  <th key={`exp-${c}`} style={{ border: '1px solid #94a3b8', padding: '4px 2px', width: `${100 / totalCatCount}%`, whiteSpace: 'nowrap' }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr style={{ fontWeight: 800 }}>
                {INCOME_CATEGORIES.map(c => (
                  <td key={`inc-val-${c}`} style={{ border: '1px solid #94a3b8', padding: '5px 2px', color: summary.incomeTotals[c] > 0 ? '#1d4ed8' : '#64748b', whiteSpace: 'nowrap' }}>
                    {formatNum(summary.incomeTotals[c])}
                  </td>
                ))}
                {EXPENSE_CATEGORIES.map(c => (
                  <td key={`exp-val-${c}`} style={{ border: '1px solid #94a3b8', padding: '5px 2px', color: summary.expenseTotals[c] > 0 ? '#be123c' : '#64748b', whiteSpace: 'nowrap' }}>
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
              <th style={{ border: '1px solid #475569', padding: isCompact ? '4px' : '6px', width: '36px', textAlign: 'center', fontWeight: 900, whiteSpace: 'nowrap' }}>No.</th>
              <th style={{ border: '1px solid #475569', padding: isCompact ? '4px 6px' : '6px 8px', width: '92px', textAlign: 'center', fontWeight: 900, whiteSpace: 'nowrap' }}>사용일</th>
              <th style={{ border: '1px solid #475569', padding: isCompact ? '4px 6px' : '6px 8px', width: '88px', textAlign: 'center', fontWeight: 900, whiteSpace: 'nowrap' }}>내용</th>
              <th style={{ border: '1px solid #475569', padding: isCompact ? '4px 6px' : '6px 8px', width: '98px', textAlign: 'right', fontWeight: 900, color: '#1e3a8a', whiteSpace: 'nowrap' }}>수입</th>
              <th style={{ border: '1px solid #475569', padding: isCompact ? '4px 6px' : '6px 8px', width: '98px', textAlign: 'right', fontWeight: 900, color: '#9f1239', whiteSpace: 'nowrap' }}>지출</th>
              <th style={{ border: '1px solid #475569', padding: isCompact ? '4px 6px' : '6px 8px', width: '104px', textAlign: 'right', fontWeight: 900, color: '#065f46', whiteSpace: 'nowrap' }}>잔액</th>
              <th style={{ border: '1px solid #475569', padding: isCompact ? '4px 8px' : '6px 10px', textAlign: 'left', fontWeight: 900, whiteSpace: 'nowrap' }}>적요</th>
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
                  <td style={{ border: '1px solid #64748b', padding: isCompact ? '4px' : '6px', textAlign: 'center', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>
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
              <td colSpan={3} style={{ border: '1.5px solid #0f172a', padding: '7px 8px', textAlign: 'center', color: '#0f172a', whiteSpace: 'nowrap' }}>
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
              <td style={{ border: '1.5px solid #0f172a', padding: '7px 8px', textAlign: 'left', fontSize: '10.5px', color: '#475569', whiteSpace: 'nowrap' }}>
                잔액 = 총수입 - 총지출
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  // A4 연간 내역 출력용 문서 렌더링 (월별 1월~12월 집계 전용)
  const renderA4AnnualSheet = () => {
    const clubName = currentClub?.name || '테친회';
    const printDate = getTodayYMD();
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
              🎾 {clubName} 공식 연간 회비 회계 결산 보고서 (월별 집계)
            </div>
            <h1 style={{ fontSize: '21px', fontWeight: 900, margin: '3px 0 0 0', color: '#0f172a', letterSpacing: '-0.02em' }}>
              {annualPrintYear}년도 연간 회비 수입·지출 내역서 (월별 집계)
            </h1>
            <div style={{ fontSize: '11.5px', color: '#334155', marginTop: '4px', fontWeight: 600 }}>
              출력일자: {printDate} | 집계기간: {annualPrintYear}.01 ~ {annualPrintYear}.12 (총 {annualMonthlySummary.totalCount}건)
              {printIncludeBankInfo && currentClub?.bankAccount && (
                <span> | 회비계좌: {currentClub.bankAccount} {currentClub.accountHolder ? `(${currentClub.accountHolder})` : ''}</span>
              )}
            </div>
          </div>

          {printIncludeSignBox && (
            <table style={{ borderCollapse: 'collapse', border: '1px solid #334155', fontSize: '10.5px', textAlign: 'center' }}>
              <thead>
                <tr style={{ background: '#f1f5f9' }}>
                  <th style={{ border: '1px solid #334155', padding: '3px 14px', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap' }}>작성 (총무)</th>
                  <th style={{ border: '1px solid #334155', padding: '3px 14px', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap' }}>검토 (감사)</th>
                  <th style={{ border: '1px solid #334155', padding: '3px 14px', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap' }}>승인 (회장)</th>
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

        {/* 2. 연간 총괄 수지 요약 박스 */}
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #0f172a', marginBottom: '10px', textAlign: 'center' }}>
          <thead>
            <tr style={{ background: '#f8fafc', fontSize: '11.5px' }}>
              <th style={{ border: '1px solid #64748b', padding: '6px 8px', width: '33.3%', color: '#1e3a8a', fontWeight: 800 }}>
                {annualPrintYear}년 총 수입 합계 (이월잔액 포함)
              </th>
              <th style={{ border: '1px solid #64748b', padding: '6px 8px', width: '33.3%', color: '#9f1239', fontWeight: 800 }}>
                {annualPrintYear}년 총 지출 합계
              </th>
              <th style={{ border: '1px solid #64748b', padding: '6px 8px', width: '33.3%', color: '#065f46', fontWeight: 800 }}>
                {annualPrintYear}년 최종 잔액 (수입 - 지출)
              </th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ fontSize: '15px', fontWeight: 900 }}>
              <td style={{ border: '1px solid #64748b', padding: '8px', color: '#1d4ed8', background: '#ffffff' }}>
                +{formatNum(annualMonthlySummary.totalIncome)}원
              </td>
              <td style={{ border: '1px solid #64748b', padding: '8px', color: '#be123c', background: '#ffffff' }}>
                -{formatNum(annualMonthlySummary.totalExpense)}원
              </td>
              <td style={{ border: '1px solid #64748b', padding: '8px', color: '#047857', background: '#f0fdf4' }}>
                {formatNum(annualMonthlySummary.netBalance)}원
              </td>
            </tr>
          </tbody>
        </table>

        {/* 3. 연간 항목별(수입 6항목 / 지출 4항목) 소계 요약표 */}
        {printIncludeCategorySummary && (
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #475569', marginBottom: '12px', fontSize: '10px', textAlign: 'center' }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                <th colSpan={INCOME_CATEGORIES.length} style={{ border: '1px solid #64748b', padding: '4px', color: '#1e40af', fontWeight: 800 }}>
                  {annualPrintYear}년 수입 항목별 연간 소계
                </th>
                <th colSpan={EXPENSE_CATEGORIES.length} style={{ border: '1px solid #64748b', padding: '4px', color: '#9f1239', fontWeight: 800 }}>
                  {annualPrintYear}년 지출 항목별 연간 소계
                </th>
              </tr>
              <tr style={{ background: '#f8fafc', fontWeight: 700, color: '#334155' }}>
                {INCOME_CATEGORIES.map(c => (
                  <th key={`ann-inc-${c}`} style={{ border: '1px solid #94a3b8', padding: '4px 2px', width: `${100 / totalCatCount}%`, whiteSpace: 'nowrap' }}>{c}</th>
                ))}
                {EXPENSE_CATEGORIES.map(c => (
                  <th key={`ann-exp-${c}`} style={{ border: '1px solid #94a3b8', padding: '4px 2px', width: `${100 / totalCatCount}%`, whiteSpace: 'nowrap' }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr style={{ fontWeight: 800 }}>
                {INCOME_CATEGORIES.map(c => (
                  <td key={`ann-inc-val-${c}`} style={{ border: '1px solid #94a3b8', padding: '5px 2px', color: annualMonthlySummary.incomeTotals[c] > 0 ? '#1d4ed8' : '#64748b', whiteSpace: 'nowrap' }}>
                    {formatNum(annualMonthlySummary.incomeTotals[c])}
                  </td>
                ))}
                {EXPENSE_CATEGORIES.map(c => (
                  <td key={`ann-exp-val-${c}`} style={{ border: '1px solid #94a3b8', padding: '5px 2px', color: annualMonthlySummary.expenseTotals[c] > 0 ? '#be123c' : '#64748b', whiteSpace: 'nowrap' }}>
                    {formatNum(annualMonthlySummary.expenseTotals[c])}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        )}

        {/* 4. 연간 월별 집계 테이블 (1월 ~ 12월 월 단위 집계만 출력) */}
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #0f172a', fontSize: '11.5px' }}>
          <thead>
            <tr style={{ background: '#e2e8f0', color: '#0f172a' }}>
              <th style={{ border: '1px solid #475569', padding: '7px 6px', width: '58px', textAlign: 'center', fontWeight: 900, whiteSpace: 'nowrap' }}>월별</th>
              <th style={{ border: '1px solid #475569', padding: '7px 6px', width: '48px', textAlign: 'center', fontWeight: 900, whiteSpace: 'nowrap' }}>건수</th>
              <th style={{ border: '1px solid #475569', padding: '7px 8px', width: '106px', textAlign: 'right', fontWeight: 900, color: '#1e3a8a', whiteSpace: 'nowrap' }}>월 수입 합계</th>
              <th style={{ border: '1px solid #475569', padding: '7px 8px', width: '106px', textAlign: 'right', fontWeight: 900, color: '#9f1239', whiteSpace: 'nowrap' }}>월 지출 합계</th>
              <th style={{ border: '1px solid #475569', padding: '7px 8px', width: '104px', textAlign: 'right', fontWeight: 900, color: '#334155', whiteSpace: 'nowrap' }}>월 수지(증감)</th>
              <th style={{ border: '1px solid #475569', padding: '7px 8px', width: '108px', textAlign: 'right', fontWeight: 900, color: '#065f46', whiteSpace: 'nowrap' }}>누적 잔액</th>
              <th style={{ border: '1px solid #475569', padding: '7px 10px', textAlign: 'left', fontWeight: 900, whiteSpace: 'nowrap' }}>월별 항목 집계 요약</th>
            </tr>
          </thead>
          <tbody>
            {annualMonthlySummary.displayedRows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ border: '1px solid #64748b', padding: '28px', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
                  {annualPrintYear}년도에 등록된 회비 수입·지출 내역이 없습니다.
                </td>
              </tr>
            ) : (
              annualMonthlySummary.displayedRows.map((row, idx) => {
                const hasActivity = row.count > 0 || row.income > 0 || row.expense > 0;
                return (
                  <tr key={row.ym} style={{ background: idx % 2 === 1 ? '#f8fafc' : '#ffffff', color: hasActivity ? '#0f172a' : '#94a3b8' }}>
                    <td style={{ border: '1px solid #64748b', padding: '7px 6px', textAlign: 'center', fontWeight: 800, color: hasActivity ? '#0f172a' : '#94a3b8', whiteSpace: 'nowrap' }}>
                      {row.label}
                    </td>
                    <td style={{ border: '1px solid #64748b', padding: '7px 6px', textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {row.count > 0 ? `${row.count}건` : '-'}
                    </td>
                    <td style={{ border: '1px solid #64748b', padding: '7px 8px', textAlign: 'right', fontWeight: 800, color: row.income > 0 ? '#1d4ed8' : '#cbd5e1', whiteSpace: 'nowrap' }}>
                      {row.income > 0 ? `+${formatNum(row.income)}` : '-'}
                    </td>
                    <td style={{ border: '1px solid #64748b', padding: '7px 8px', textAlign: 'right', fontWeight: 800, color: row.expense > 0 ? '#be123c' : '#cbd5e1', whiteSpace: 'nowrap' }}>
                      {row.expense > 0 ? `-${formatNum(row.expense)}` : '-'}
                    </td>
                    <td style={{
                      border: '1px solid #64748b',
                      padding: '7px 8px',
                      textAlign: 'right',
                      fontWeight: 800,
                      color: !hasActivity ? '#cbd5e1' : row.net > 0 ? '#1d4ed8' : row.net < 0 ? '#be123c' : '#475569',
                      whiteSpace: 'nowrap'
                    }}>
                      {!hasActivity ? '-' : `${row.net > 0 ? '+' : ''}${formatNum(row.net)}`}
                    </td>
                    <td style={{
                      border: '1px solid #64748b',
                      padding: '7px 8px',
                      textAlign: 'right',
                      fontWeight: 800,
                      color: hasActivity || row.balance !== 0 ? '#0f172a' : '#cbd5e1',
                      background: '#f8fafc',
                      whiteSpace: 'nowrap'
                    }}>
                      {hasActivity || row.balance !== 0 ? formatNum(row.balance) : '-'}
                    </td>
                    <td style={{ border: '1px solid #64748b', padding: '6px 10px', textAlign: 'left', fontSize: '10.5px', color: '#334155', fontWeight: 600, lineHeight: 1.35 }}>
                      {hasActivity ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {row.incSummary && (
                            <span style={{ color: '#1e40af' }}>🔵 수입: {row.incSummary}</span>
                          )}
                          {row.expSummary && (
                            <span style={{ color: '#9f1239' }}>🔴 지출: {row.expSummary}</span>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: '#cbd5e1' }}>-</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot>
            <tr style={{ background: '#f1f5f9', fontWeight: 900, fontSize: '12.5px' }}>
              <td style={{ border: '1.5px solid #0f172a', padding: '8px 6px', textAlign: 'center', color: '#0f172a', whiteSpace: 'nowrap' }}>
                연간 합계
              </td>
              <td style={{ border: '1.5px solid #0f172a', padding: '8px 6px', textAlign: 'center', color: '#0f172a', whiteSpace: 'nowrap' }}>
                {annualMonthlySummary.totalCount}건
              </td>
              <td style={{ border: '1.5px solid #0f172a', padding: '8px 8px', textAlign: 'right', color: '#1d4ed8', whiteSpace: 'nowrap' }}>
                +{formatNum(annualMonthlySummary.totalIncome)}원
              </td>
              <td style={{ border: '1.5px solid #0f172a', padding: '8px 8px', textAlign: 'right', color: '#be123c', whiteSpace: 'nowrap' }}>
                -{formatNum(annualMonthlySummary.totalExpense)}원
              </td>
              <td style={{
                border: '1.5px solid #0f172a',
                padding: '8px 8px',
                textAlign: 'right',
                color: annualMonthlySummary.netBalance >= 0 ? '#1d4ed8' : '#be123c',
                whiteSpace: 'nowrap'
              }}>
                {annualMonthlySummary.netBalance > 0 ? '+' : ''}{formatNum(annualMonthlySummary.netBalance)}원
              </td>
              <td style={{ border: '1.5px solid #0f172a', padding: '8px 8px', textAlign: 'right', color: '#047857', background: '#ecfdf5', whiteSpace: 'nowrap' }}>
                {formatNum(annualMonthlySummary.netBalance)}원
              </td>
              <td style={{ border: '1.5px solid #0f172a', padding: '8px 10px', textAlign: 'left', fontSize: '10.5px', color: '#475569', whiteSpace: 'nowrap' }}>
                {annualPrintYear}년 1월 ~ 12월 월별 집계 결산
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
  const currentCategoryOptions = activeIsIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <div>
      {/* ── 인쇄 전용 시트 (화면에서는 숨겨지고 A4 인쇄 시에만 출력됨) ── */}
      <div className="a4-print-only-sheet">
        {printMode === 'ANNUAL' ? renderA4AnnualSheet() : renderA4LedgerSheet()}
      </div>

      {/* ── 화면용 UI 컨테이너 (인쇄 시 숨김) ── */}
      <div className="no-print">

        {/* 1. 회비 내역 입력 / 수정 폼 (구분 및 내용 콤보박스 적용) */}
        {canEdit && (
          <div className="card" style={{
            marginBottom: '16px',
            padding: '16px',
            border: editingId ? '2px solid #2563eb' : '1px solid var(--border)',
            background: editingId ? '#f8faff' : '#ffffff',
            overflow: 'hidden',
            width: '100%',
            maxWidth: '100%',
            boxSizing: 'border-box'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--txt)' }}>
                  {editingId ? '✏️ 회비 내역 수정' : '📝 회비 내역 입력'}
                </h3>
              </div>

              {/* 빠른 자동 입력 도우미 버튼 */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleFillCarryover}
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 700,
                    padding: '4px 10px',
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    borderColor: '#bfdbfe',
                    whiteSpace: 'nowrap'
                  }}
                  title="전월 최종 잔액을 계산하여 시작월 1일자 이월잔액으로 자동 세팅합니다"
                >
                  🏦 전월 이월잔액 불러오기
                  {prevMonthClosingBalance ? ` (${formatNum(prevMonthClosingBalance.balance)}원)` : ''}
                </button>
                {editingId && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={resetForm}
                    style={{ fontSize: '11.5px', fontWeight: 700, padding: '4px 10px', whiteSpace: 'nowrap' }}
                  >
                    수정 취소
                  </button>
                )}
              </div>
            </div>

            {/* 콤보박스 기반 관리항목 입력 폼: 사용일 / 구분 / 내용 / 금액 / 적요 (모바일 1열 스택으로 겹침 원천 차단) */}
            <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
              <div className="fee-form-grid">
                {/* 1. 사용일 */}
                <div style={{ minWidth: 0, width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '5px', whiteSpace: 'nowrap' }}>
                    📅 사용일
                  </label>
                  <input
                    type="date"
                    className="input"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    required
                    style={{
                      display: 'block',
                      width: '100%',
                      maxWidth: '100%',
                      minWidth: 0,
                      boxSizing: 'border-box',
                      WebkitAppearance: 'none',
                      appearance: 'none',
                      fontWeight: 700,
                      fontSize: '13.5px',
                      padding: '8px 10px',
                      backgroundColor: '#ffffff'
                    }}
                  />
                </div>

                {/* 2. 수입/지출 구분 콤보박스 */}
                <div style={{ minWidth: 0 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '5px', whiteSpace: 'nowrap' }}>
                    🔄 수입/지출 구분
                  </label>
                  <select
                    className="select"
                    value={formType}
                    onChange={(e) => handleFormTypeChange(e.target.value)}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      fontWeight: 800,
                      fontSize: '13.5px',
                      padding: '8px 10px',
                      color: activeIsIncome ? '#1d4ed8' : '#be123c',
                      backgroundColor: activeIsIncome ? '#eff6ff' : '#fff1f2',
                      borderColor: activeIsIncome ? '#93c5fd' : '#fda4af'
                    }}
                  >
                    <option value="INCOME">🔵 수입 (+)</option>
                    <option value="EXPENSE">🔴 지출 (-)</option>
                  </select>
                </div>

                {/* 3. 내용(항목) 콤보박스 */}
                <div style={{ minWidth: 0 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '5px', whiteSpace: 'nowrap' }}>
                    🏷️ 내용 ({activeIsIncome ? '수입 항목' : '지출 항목'})
                  </label>
                  <select
                    className="select"
                    value={formCategory}
                    onChange={(e) => handleCategoryChange(e.target.value, formType)}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      fontWeight: 800,
                      fontSize: '13.5px',
                      padding: '8px 10px',
                      color: activeIsIncome ? '#1d4ed8' : '#be123c',
                      backgroundColor: '#ffffff',
                      borderColor: activeIsIncome ? '#60a5fa' : '#fb7185'
                    }}
                  >
                    {currentCategoryOptions.map(c => {
                      const meta = getCategoryMeta(c, formType);
                      const defaultHint = c === '회비' ? ' (120,000원)' : c === '게스트비' ? ' (15,000원)' : '';
                      return (
                        <option key={c} value={c}>
                          {meta.icon} {c}{defaultHint}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* 4. 금액 (선택된 구분에 맞춰 단일 입력 필드로 깔끔하게 통합) */}
                <div style={{ minWidth: 0 }}>
                  <label style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 800,
                    color: activeIsIncome ? '#1d4ed8' : '#be123c',
                    marginBottom: '5px',
                    whiteSpace: 'nowrap'
                  }}>
                    {activeIsIncome ? '🔵 수입 금액 (원)' : '🔴 지출 금액 (원)'}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="input"
                    placeholder={activeIsIncome ? '수입 금액 입력' : '지출 금액 입력'}
                    value={activeIsIncome ? formIncome : formExpense}
                    onChange={(e) => {
                      const num = parseNumInput(e.target.value);
                      const formatted = num > 0 ? formatNum(num) : '';
                      if (activeIsIncome) {
                        setFormIncome(formatted);
                        setFormExpense('');
                      } else {
                        setFormExpense(formatted);
                        setFormIncome('');
                      }
                    }}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      textAlign: 'right',
                      fontWeight: 800,
                      fontSize: '13.5px',
                      padding: '8px 10px',
                      color: activeIsIncome ? '#1d4ed8' : '#be123c',
                      backgroundColor: '#ffffff',
                      borderColor: activeIsIncome ? '#60a5fa' : '#fb7185'
                    }}
                  />
                </div>

                {/* 5. 적요 (기본 한글 입력 모드 유지) */}
                <div style={{ gridColumn: '1 / -1', minWidth: 0 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '5px', whiteSpace: 'nowrap' }}>
                    📝 적요 (상세 내역 / 비고)
                  </label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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
                        flex: '1 1 200px',
                        maxWidth: '100%',
                        boxSizing: 'border-box',
                        fontWeight: 600,
                        fontSize: '13px',
                        padding: '8px 12px',
                        imeMode: 'active',
                        WebkitImeMode: 'active',
                        minWidth: 0
                      }}
                    />
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={submitting}
                      style={{
                        padding: '8px 20px',
                        borderRadius: '10px',
                        fontWeight: 800,
                        fontSize: '13.5px',
                        background: editingId
                          ? '#2563eb'
                          : (activeIsIncome ? '#1d4ed8' : '#be123c'),
                        border: 'none',
                        color: '#ffffff',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 3px 10px rgba(0, 0, 0, 0.12)'
                      }}
                    >
                      {submitting
                        ? '저장 중...'
                        : editingId
                          ? '💾 수정 저장'
                          : `➕ ${formCategory} 등록`}
                    </button>
                  </div>
                </div>
              </div>

              {/* 빠른 금액 입력 바 */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                marginTop: '10px',
                paddingTop: '10px',
                borderTop: '1px dashed #e2e8f0',
                flexWrap: 'wrap'
              }}>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap' }}>⚡ 금액:</span>
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
                      padding: '3px 8px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      color: '#334155',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {btn.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => { setFormIncome(''); setFormExpense(''); }}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '6px',
                    border: '1px solid #fecaca',
                    background: '#fef2f2',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    color: '#b91c1c',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  초기화
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 2. 기간별 수지 요약 카드 (간결한 3단 요약) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '10px',
          marginBottom: '16px'
        }}>
          {/* 총 수입 */}
          <div className="card" style={{
            padding: '14px 16px',
            background: 'linear-gradient(135deg, #ffffff 0%, #eff6ff 100%)',
            border: '1px solid #bfdbfe',
            borderRadius: '14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#1e40af', whiteSpace: 'nowrap' }}>
                🔵 {formattedPeriodTitle} 총 수입
              </span>
              <span style={{ fontSize: '18px', fontWeight: 900, color: '#1d4ed8', whiteSpace: 'nowrap' }}>
                +{formatNum(summary.totalIncome)}원
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 8px', fontSize: '11.5px', color: '#475569', fontWeight: 600 }}>
              {INCOME_CATEGORIES.map(c => (
                <span key={c} style={{ whiteSpace: 'nowrap' }}>
                  {c}: <strong style={{ color: '#1e293b' }}>{formatNum(summary.incomeTotals[c])}</strong>
                </span>
              ))}
            </div>
          </div>

          {/* 총 지출 */}
          <div className="card" style={{
            padding: '14px 16px',
            background: 'linear-gradient(135deg, #ffffff 0%, #fff1f2 100%)',
            border: '1px solid #fecdd3',
            borderRadius: '14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#9f1239', whiteSpace: 'nowrap' }}>
                🔴 {formattedPeriodTitle} 총 지출
              </span>
              <span style={{ fontSize: '18px', fontWeight: 900, color: '#be123c', whiteSpace: 'nowrap' }}>
                -{formatNum(summary.totalExpense)}원
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 8px', fontSize: '11.5px', color: '#475569', fontWeight: 600 }}>
              {EXPENSE_CATEGORIES.map(c => (
                <span key={c} style={{ whiteSpace: 'nowrap' }}>
                  {c}: <strong style={{ color: '#1e293b' }}>{formatNum(summary.expenseTotals[c])}</strong>
                </span>
              ))}
            </div>
          </div>

          {/* 최종 잔액 */}
          <div className="card" style={{
            padding: '14px 16px',
            background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)',
            border: '1px solid #bbf7d0',
            borderRadius: '14px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#166534', whiteSpace: 'nowrap' }}>
                🟢 최종 잔액 (수입 - 지출)
              </span>
              <span style={{
                fontSize: '19px',
                fontWeight: 900,
                color: summary.netBalance >= 0 ? '#15803d' : '#dc2626',
                whiteSpace: 'nowrap'
              }}>
                {formatNum(summary.netBalance)}원
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#475569', fontWeight: 600 }}>
              <span style={{ whiteSpace: 'nowrap' }}>당월 순수입(이월 제외): +{formatNum(summary.totalIncome - (summary.incomeTotals['이월잔액'] || 0))}원</span>
              <span style={{ whiteSpace: 'nowrap' }}>총 {periodEntriesWithBalance.length}건</span>
            </div>
          </div>
        </div>

        {/* 3. 회비 상세내역 카드 (조회 시작월~종료월 + 수입/지출 콤보박스 조건 + 가로형 테이블) */}
        <div className="card" style={{ padding: '16px' }}>
          {/* 상단 제목 및 출력 버튼 바 */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
            marginBottom: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--txt)', whiteSpace: 'nowrap' }}>
                📋 회비 상세내역
              </h3>
              <span className="badge" style={{ background: '#f1f5f9', color: '#334155', fontSize: '11.5px', fontWeight: 800, whiteSpace: 'nowrap' }}>
                {filteredEntries.length}건
              </span>
            </div>

            {/* 출력 및 공유 버튼 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  setPrintMode('DETAIL');
                  setShowPrintModal(true);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 11px',
                  borderRadius: '8px',
                  border: '1px solid #1d4ed8',
                  background: '#2563eb',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '12px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                <span>🖨️</span>
                <span>상세 출력 (A4)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAnnualPrintYear(endMonth.substring(0, 4));
                  setPrintMode('ANNUAL');
                  setShowPrintModal(true);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 11px',
                  borderRadius: '8px',
                  border: '1px solid #047857',
                  background: '#059669',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '12px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
                title="선택 연도의 1월~12월을 월별로만 집계하여 A4 1장으로 출력합니다"
              >
                <span>📅</span>
                <span>연간 내역 출력 (월별집계)</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleDownloadCsv('DETAIL')}
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '12px',
                  background: '#ffffff',
                  color: '#15803d',
                  borderColor: '#86efac',
                  whiteSpace: 'nowrap'
                }}
              >
                📊 CSV
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleCopyTextSummary}
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '12px',
                  background: '#ffffff',
                  color: '#334155',
                  borderColor: '#cbd5e1',
                  whiteSpace: 'nowrap'
                }}
              >
                📋 복사
              </button>
            </div>
          </div>

          {/* 조회 조건 박스: 시작월 ~ 종료월 + 구분 콤보박스 + 내용(항목) 콤보박스 + 검색어 */}
          <div style={{
            padding: '12px',
            borderRadius: '12px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            marginBottom: '14px',
            overflow: 'hidden',
            width: '100%',
            maxWidth: '100%',
            boxSizing: 'border-box'
          }}>
            <div className="fee-filter-grid">
              {/* 1. 조회 기간 (시작월 ~ 종료월 단일 행 결합으로 겹침 원천 차단) */}
              <div style={{ minWidth: 0, width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px', flexWrap: 'wrap', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155', whiteSpace: 'nowrap' }}>
                    📅 조회 기간 (시작월 ~ 종료월)
                  </label>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      onClick={() => applyQuickPeriod('THIS_MONTH')}
                      style={{
                        padding: '2px 7px',
                        fontSize: '11px',
                        fontWeight: 700,
                        borderRadius: '5px',
                        border: '1px solid #cbd5e1',
                        background: (startMonth === currentYm && endMonth === currentYm) ? '#1d4ed8' : '#ffffff',
                        color: (startMonth === currentYm && endMonth === currentYm) ? '#ffffff' : '#475569',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      이번달
                    </button>
                    <button
                      type="button"
                      onClick={() => applyQuickPeriod('THIS_YEAR')}
                      style={{
                        padding: '2px 7px',
                        fontSize: '11px',
                        fontWeight: 700,
                        borderRadius: '5px',
                        border: '1px solid #cbd5e1',
                        background: (startMonth.endsWith('-01') && endMonth.endsWith('-12')) ? '#1d4ed8' : '#ffffff',
                        color: (startMonth.endsWith('-01') && endMonth.endsWith('-12')) ? '#ffffff' : '#475569',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      올해전체
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
                  <input
                    type="month"
                    className="input"
                    value={startMonth}
                    onChange={(e) => handleStartMonthChange(e.target.value)}
                    style={{
                      flex: 1,
                      display: 'block',
                      width: '100%',
                      maxWidth: '100%',
                      minWidth: 0,
                      boxSizing: 'border-box',
                      WebkitAppearance: 'none',
                      appearance: 'none',
                      fontSize: '13px',
                      fontWeight: 700,
                      padding: '8px 8px',
                      backgroundColor: '#ffffff'
                    }}
                  />
                  <span style={{ fontWeight: 800, color: '#64748b', fontSize: '13px', whiteSpace: 'nowrap' }}>~</span>
                  <input
                    type="month"
                    className="input"
                    value={endMonth}
                    onChange={(e) => handleEndMonthChange(e.target.value)}
                    style={{
                      flex: 1,
                      display: 'block',
                      width: '100%',
                      maxWidth: '100%',
                      minWidth: 0,
                      boxSizing: 'border-box',
                      WebkitAppearance: 'none',
                      appearance: 'none',
                      fontSize: '13px',
                      fontWeight: 700,
                      padding: '8px 8px',
                      backgroundColor: '#ffffff'
                    }}
                  />
                </div>
              </div>

              {/* 2. 수입/지출 구분 조건 콤보박스 */}
              <div style={{ minWidth: 0 }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#475569', marginBottom: '5px', whiteSpace: 'nowrap' }}>
                  🔄 수입/지출 구분
                </label>
                <select
                  className="select"
                  value={filterType}
                  onChange={(e) => handleFilterTypeChange(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    fontSize: '13px',
                    fontWeight: 700,
                    padding: '8px 8px',
                    backgroundColor: '#ffffff'
                  }}
                >
                  <option value="ALL">전체 (수입 + 지출)</option>
                  <option value="INCOME">🔵 수입 항목만</option>
                  <option value="EXPENSE">🔴 지출 항목만</option>
                </select>
              </div>

              {/* 3. 내용(항목) 조건 콤보박스 */}
              <div style={{ minWidth: 0 }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#475569', marginBottom: '5px', whiteSpace: 'nowrap' }}>
                  🏷️ 내용 (항목 선택)
                </label>
                <select
                  className="select"
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    fontSize: '13px',
                    fontWeight: 700,
                    padding: '8px 8px',
                    backgroundColor: '#ffffff'
                  }}
                >
                  <option value="ALL">전체 항목</option>
                  {(filterType === 'ALL' || filterType === 'INCOME') && (
                    <optgroup label="🔵 수입 항목">
                      {INCOME_CATEGORIES.map(c => (
                        <option key={`flt-inc-${c}`} value={`INCOME:${c}`}>
                          {getCategoryMeta(c, 'INCOME').icon} {c} (수입)
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {(filterType === 'ALL' || filterType === 'EXPENSE') && (
                    <optgroup label="🔴 지출 항목">
                      {EXPENSE_CATEGORIES.map(c => (
                        <option key={`flt-exp-${c}`} value={`EXPENSE:${c}`}>
                          {getCategoryMeta(c, 'EXPENSE').icon} {c} (지출)
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {/* 4. 적요 검색 */}
              <div style={{ minWidth: 0 }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#475569', marginBottom: '5px', whiteSpace: 'nowrap' }}>
                  🔍 적요 검색
                </label>
                <input
                  type="text"
                  lang="ko"
                  className="input ime-ko"
                  placeholder="적요, 날짜 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '8px 10px',
                    fontSize: '13px',
                    imeMode: 'active',
                    WebkitImeMode: 'active',
                    backgroundColor: '#ffffff'
                  }}
                />
              </div>
            </div>
          </div>

          {/* 상세 내역 테이블 (모바일 환경에서 세로 줄바꿈 원천 차단: 전 셀 whiteSpace: nowrap 적용) */}
          <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', minWidth: '660px', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1', color: '#334155' }}>
                  <th style={{ padding: '9px 6px', width: '42px', textAlign: 'center', fontWeight: 800, whiteSpace: 'nowrap' }}>No.</th>
                  <th style={{ padding: '9px 8px', width: '98px', textAlign: 'center', fontWeight: 800, whiteSpace: 'nowrap' }}>사용일</th>
                  <th style={{ padding: '9px 8px', width: '96px', textAlign: 'center', fontWeight: 800, whiteSpace: 'nowrap' }}>내용</th>
                  <th style={{ padding: '9px 10px', width: '108px', textAlign: 'right', fontWeight: 800, color: '#1d4ed8', whiteSpace: 'nowrap' }}>수입</th>
                  <th style={{ padding: '9px 10px', width: '108px', textAlign: 'right', fontWeight: 800, color: '#be123c', whiteSpace: 'nowrap' }}>지출</th>
                  <th style={{ padding: '9px 10px', width: '112px', textAlign: 'right', fontWeight: 800, color: '#047857', whiteSpace: 'nowrap' }}>잔액</th>
                  <th style={{ padding: '9px 10px', minWidth: '170px', textAlign: 'left', fontWeight: 800, whiteSpace: 'nowrap' }}>적요</th>
                  {canEdit && (
                    <th style={{ padding: '9px 6px', width: '94px', textAlign: 'center', fontWeight: 800, whiteSpace: 'nowrap' }}>관리</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 8 : 7} style={{ padding: '38px 16px', textAlign: 'center', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {periodEntriesWithBalance.length === 0
                        ? `${formattedPeriodTitle} 기간에 등록된 회비 수입·지출 내역이 없습니다.`
                        : '선택한 조회 조건에 일치하는 내역이 없습니다.'}
                    </td>
                  </tr>
                ) : (
                  paginatedEntries.map((item) => {
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
                        <td style={{ padding: '10px 6px', textAlign: 'center', color: '#64748b', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {item.rowNum}
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' }}>
                          {item.date}
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2.5px 9px',
                            borderRadius: '999px',
                            fontSize: '11.5px',
                            fontWeight: 800,
                            background: meta.bg,
                            color: meta.color,
                            border: `1px solid ${meta.border}`,
                            whiteSpace: 'nowrap'
                          }}>
                            <span>{meta.icon}</span>
                            <span>{item.category}</span>
                          </span>
                        </td>
                        <td style={{
                          padding: '10px 10px',
                          textAlign: 'right',
                          fontWeight: 800,
                          color: item.income > 0 ? '#1d4ed8' : '#cbd5e1',
                          whiteSpace: 'nowrap'
                        }}>
                          {item.income > 0 ? `+${formatNum(item.income)}원` : '-'}
                        </td>
                        <td style={{
                          padding: '10px 10px',
                          textAlign: 'right',
                          fontWeight: 800,
                          color: item.expense > 0 ? '#be123c' : '#cbd5e1',
                          whiteSpace: 'nowrap'
                        }}>
                          {item.expense > 0 ? `-${formatNum(item.expense)}원` : '-'}
                        </td>
                        <td style={{
                          padding: '10px 10px',
                          textAlign: 'right',
                          fontWeight: 800,
                          color: '#0f172a',
                          background: '#f8fafc',
                          whiteSpace: 'nowrap'
                        }}>
                          {formatNum(item.balance)}원
                        </td>
                        <td style={{ padding: '10px 10px', textAlign: 'left', color: '#334155', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {item.memo || <span style={{ color: '#cbd5e1' }}>-</span>}
                        </td>
                        {canEdit && (
                          <td style={{ padding: '10px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'inline-flex', gap: '4px', whiteSpace: 'nowrap' }}>
                              <button
                                type="button"
                                onClick={() => handleStartEdit(item)}
                                style={{
                                  padding: '3.5px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #bfdbfe',
                                  background: '#eff6ff',
                                  color: '#1d4ed8',
                                  fontSize: '11.5px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                수정
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(item)}
                                style={{
                                  padding: '3.5px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #fecaca',
                                  background: '#fef2f2',
                                  color: '#b91c1c',
                                  fontSize: '11.5px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap'
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
                  <tr style={{ background: '#f1f5f9', borderTop: '2px solid #334155', fontWeight: 900, fontSize: '13px' }}>
                    <td colSpan={3} style={{ padding: '10px 8px', textAlign: 'center', color: '#0f172a', whiteSpace: 'nowrap' }}>
                      {filterType === 'ALL' && filterCategory === 'ALL' && !searchQuery ? `${formattedPeriodTitle} 합계` : '조회 조건 합계'} ({filteredEntries.length}건)
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', color: '#1d4ed8', whiteSpace: 'nowrap' }}>
                      +{formatNum(summary.filteredIncome)}원
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', color: '#be123c', whiteSpace: 'nowrap' }}>
                      -{formatNum(summary.filteredExpense)}원
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', color: '#047857', background: '#ecfdf5', whiteSpace: 'nowrap' }}>
                      {formatNum(filterType === 'ALL' && filterCategory === 'ALL' && !searchQuery ? summary.netBalance : summary.filteredBalance)}원
                    </td>
                    <td colSpan={canEdit ? 2 : 1} style={{ padding: '10px', textAlign: 'left', fontSize: '11.5px', color: '#475569', whiteSpace: 'nowrap' }}>
                      수입 {formatNum(summary.filteredIncome)}원 - 지출 {formatNum(summary.filteredExpense)}원
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* ── 페이징 네비게이션 바 ── */}
          {filteredEntries.length > 0 && (
            <div style={{
              marginTop: '14px',
              paddingTop: '12px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              {/* 좌측: 표시 범위 안내 및 페이지당 건수 콤보박스 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '12px', color: '#475569', fontWeight: 700 }}>
                <span style={{ whiteSpace: 'nowrap' }}>
                  전체 <strong style={{ color: '#0f172a' }}>{filteredEntries.length}건</strong> 중{' '}
                  <strong style={{ color: '#1d4ed8' }}>{startIndex + 1}~{Math.min(startIndex + pageSize, filteredEntries.length)}</strong>번째 표시
                </span>
                <select
                  className="select input-sm"
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  style={{
                    height: '30px',
                    padding: '0 8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    borderRadius: '6px',
                    backgroundColor: '#f8fafc',
                    color: '#334155',
                    borderColor: '#cbd5e1',
                    width: 'auto'
                  }}
                >
                  <option value={10}>10건씩 보기</option>
                  <option value={15}>15건씩 보기</option>
                  <option value={20}>20건씩 보기</option>
                  <option value={30}>30건씩 보기</option>
                  <option value={50}>50건씩 보기</option>
                </select>
              </div>

              {/* 우측: 페이지 이동 버튼 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage(1)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: safePage <= 1 ? '#f1f5f9' : '#ffffff',
                    color: safePage <= 1 ? '#94a3b8' : '#334155',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: safePage <= 1 ? 'default' : 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                  title="첫 페이지"
                >
                  «
                </button>
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  style={{
                    padding: '4px 9px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: safePage <= 1 ? '#f1f5f9' : '#ffffff',
                    color: safePage <= 1 ? '#94a3b8' : '#334155',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: safePage <= 1 ? 'default' : 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  ‹ 이전
                </button>

                {pageNumbers.map(pageNum => {
                  const isActive = pageNum === safePage;
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setCurrentPage(pageNum)}
                      style={{
                        minWidth: '30px',
                        height: '30px',
                        padding: '0 6px',
                        borderRadius: '6px',
                        border: isActive ? '1px solid #1d4ed8' : '1px solid #cbd5e1',
                        background: isActive ? '#2563eb' : '#ffffff',
                        color: isActive ? '#ffffff' : '#334155',
                        fontSize: '12.5px',
                        fontWeight: isActive ? 800 : 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  style={{
                    padding: '4px 9px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: safePage >= totalPages ? '#f1f5f9' : '#ffffff',
                    color: safePage >= totalPages ? '#94a3b8' : '#334155',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: safePage >= totalPages ? 'default' : 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  다음 ›
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: safePage >= totalPages ? '#f1f5f9' : '#ffffff',
                    color: safePage >= totalPages ? '#94a3b8' : '#334155',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: safePage >= totalPages ? 'default' : 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                  title="마지막 페이지"
                >
                  »
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 4. 기간별 전체 내역 출력 미리보기 & 인쇄 모달 ── */}
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
              padding: '14px 20px',
              borderBottom: '1px solid #cbd5e1',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16.5px', fontWeight: 900, color: '#0f172a' }}>
                  {printMode === 'ANNUAL'
                    ? `📅 ${annualPrintYear}년도 연간 회비 내역 출력 미리보기 (월별 집계)`
                    : `🖨️ ${formattedPeriodTitle} 회비 상세내역 출력 미리보기 (A4)`}
                </h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                  {printMode === 'ANNUAL'
                    ? '선택한 연도의 수입·지출을 1월~12월 월별로만 집계하여 A4 한 장으로 출력합니다.'
                    : '조회 기간의 회비 상세내역을 용지(A4)에 맞게 출력하거나 PDF로 저장합니다.'}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={triggerA4Print}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    border: 'none',
                    background: printMode === 'ANNUAL'
                      ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                      : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '13px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 3px 10px rgba(15, 23, 42, 0.18)'
                  }}
                >
                  🖨️ 지금 인쇄 / PDF 저장
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadCsv(printMode)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: '1px solid #86efac',
                    background: '#f0fdf4',
                    color: '#15803d',
                    fontWeight: 800,
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  📊 {printMode === 'ANNUAL' ? '연간집계 CSV' : '상세내역 CSV'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#475569',
                    fontWeight: 700,
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  닫기
                </button>
              </div>
            </div>

            {/* 출력 형식 선택 (상세내역 vs 연간 월별 집계) 및 옵션 바 */}
            <div style={{
              background: '#f8fafc',
              padding: '10px 20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
              fontSize: '12px',
              fontWeight: 700,
              color: '#334155'
            }}>
              {/* 출력 유형 전환 버튼 + 연도 선택 콤보박스 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{
                  display: 'inline-flex',
                  background: '#e2e8f0',
                  padding: '3px',
                  borderRadius: '8px',
                  gap: '3px'
                }}>
                  <button
                    type="button"
                    onClick={() => setPrintMode('DETAIL')}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      background: printMode === 'DETAIL' ? '#ffffff' : 'transparent',
                      color: printMode === 'DETAIL' ? '#1d4ed8' : '#475569',
                      boxShadow: printMode === 'DETAIL' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    📋 상세 내역 (건별)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintMode('ANNUAL')}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      background: printMode === 'ANNUAL' ? '#ffffff' : 'transparent',
                      color: printMode === 'ANNUAL' ? '#047857' : '#475569',
                      boxShadow: printMode === 'ANNUAL' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    📅 연간 내역 (월별 집계)
                  </button>
                </div>

                {printMode === 'ANNUAL' && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: 800, color: '#047857', whiteSpace: 'nowrap' }}>조회 연도:</span>
                    <select
                      className="select input-sm"
                      value={annualPrintYear}
                      onChange={(e) => setAnnualPrintYear(e.target.value)}
                      style={{
                        height: '30px',
                        padding: '0 8px',
                        fontSize: '12.5px',
                        fontWeight: 800,
                        borderRadius: '6px',
                        borderColor: '#6ee7b7',
                        color: '#065f46',
                        backgroundColor: '#ffffff'
                      }}
                    >
                      {availableYears.map(y => (
                        <option key={y} value={y}>{y}년</option>
                      ))}
                    </select>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', whiteSpace: 'nowrap', marginLeft: '4px' }}>
                      <input
                        type="checkbox"
                        checked={printShowEmptyMonths}
                        onChange={(e) => setPrintShowEmptyMonths(e.target.checked)}
                      />
                      <span>빈 월(0건) 포함 1~12월 전체 표시</span>
                    </label>
                  </div>
                )}
              </div>

              {/* 공통 표시 옵션 체크박스 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <input
                    type="checkbox"
                    checked={printIncludeCategorySummary}
                    onChange={(e) => setPrintIncludeCategorySummary(e.target.checked)}
                  />
                  <span>항목별 소계표</span>
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <input
                    type="checkbox"
                    checked={printIncludeBankInfo}
                    onChange={(e) => setPrintIncludeBankInfo(e.target.checked)}
                  />
                  <span>계좌번호</span>
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <input
                    type="checkbox"
                    checked={printIncludeSignBox}
                    onChange={(e) => setPrintIncludeSignBox(e.target.checked)}
                  />
                  <span>결재란</span>
                </label>
              </div>
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
                {printMode === 'ANNUAL' ? renderA4AnnualSheet() : renderA4LedgerSheet()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

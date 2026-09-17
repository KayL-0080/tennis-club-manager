// components/ClubBylawsModal.js — 동호회 회칙 열람, 수정 및 개정 이력 관리 모달
'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { IconBookOpen, IconChevronDown } from './Icons';
import { getClubBylaws, updateClubBylaws } from '@/lib/firestore';

// ── 표준 테친회 기본 회칙 템플릿 ──
export const DEFAULT_BYLAWS_CONTENT = `제1장 총칙

제1조 (명칭)
본 회는 '테친회 테니스 동호회'(이하 '본 회'라 칭함)라 칭한다.

제2조 (목적)
본 회는 테니스를 통하여 회원 상호 간의 건강 증진과 친목을 도모하고, 건전한 스포츠 정신과 매너를 함양하며 실력 향상을 목적으로 한다.

제3조 (활동 장소 및 거점)
본 회의 정기 활동 거점은 클럽 지정 테니스장으로 하며, 필요시 운영위원회의 의결을 거쳐 변경할 수 있다.

제2장 회원 및 자격

제4조 (회원의 구분)
본 회의 회원은 정회원, 준회원, 게스트로 구분한다.
① 정회원: 본 회의 설립 취지와 회칙에 찬동하고 소정의 입회 절차를 필하여 월회비를 성실히 납부하는 자.
② 준회원: 신규 가입 후 3개월 이내 적응 기간 중에 있거나, 부상·장기 출장 등으로 운영진의 승인을 얻어 일시 휴회 중인 자.
③ 게스트: 기존 회원의 추천 또는 운영진의 사전 승인을 받아 정기 모임에 1일 참가하는 자 (월 최대 2회 참석 제한).

제5조 (회원의 권리와 의무)
① 권리: 회원은 정기 모임 및 클럽 공식 대회 참가권, 총회에서의 발언권 및 의결권(정회원에 한함), 임원 피선거권을 가진다.
② 의무: 회원은 본 회의 회칙과 경기 규정을 준수하고, 정해진 회비를 기한 내에 성실히 납부하며, 코트 매너 및 안전 수칙을 준수할 의무를 진다.

제6조 (입회, 탈퇴 및 징계)
① 입회: 신규 가입 희망자는 운영위원회의 승인과 정해진 입회 절차(가입비 및 회비 납부)를 거쳐 정식 등록된다.
② 탈퇴: 본인의 자유 의사로 탈퇴할 수 있으나, 기 납부된 회비 및 가입비는 반환하지 아니한다.
③ 징계 및 제명: 클럽의 명예를 실추시키거나 폭언, 비매너, 파벌 조성, 정당한 사유 없는 3회 이상 장기 회비 미납자는 운영위원회 의결을 거쳐 경고 또는 제명 조치할 수 있다.

제3장 임원 및 직책별 업무

제7조 (임원의 구성)
본 회의 원활하고 체계적인 운영을 위하여 다음의 임원을 둔다.
① 회장: 1인 (클럽 대표 및 총괄)
② 부회장: 1인 (회장 보좌 및 유고 시 직무 대행)
③ 총무: 1인 (재정, 회비 수납, 지출 정산, 결산 보고 및 행정 총괄)
④ 경기이사: 1인 (정기모임 대진표 작성, 코트 밸런스 매칭, 룰 집행 및 실력 관리)
⑤ 운영이사: 1인 (코트 대관 확보, 시합구 및 클럽 공용 비품·구급약품 구매 및 관리)
⑥ 행사담당: 1인 (월례대회, 친선 교류전, 총회 및 이벤트 기획·진행)

제8조 (임원의 임무 및 협업)
임원은 클럽 규정과 '운영진 직책별 주요 업무 가이드'에 따라 상호 긴밀히 협력하며, 회원의 권익 증진과 모임 활성화를 위하여 헌신한다.

제9조 (임원의 임기 및 선출)
① 임원의 임기는 1년으로 하되, 총회의 신임을 얻어 연임할 수 있다.
② 회장은 정기총회에서 정회원 과반수의 출석과 출석 과반수의 찬성으로 선출한다.
③ 부회장, 총무 및 각 이사는 회장이 추천하여 총회의 인준을 받는다.

제4장 회의

제10조 (회의의 종류)
본 회의 회의는 정기총회, 임시총회, 운영위원회로 구분한다.
① 정기총회: 연 1회(매년 12월 또는 1월 중) 회장이 소집한다.
② 임시총회: 회장이 필요하다고 인정할 때 또는 정회원 3분의 1 이상의 서면 요구가 있을 때 소집한다.
③ 운영위원회: 임원진으로 구성되며 클럽 현안 처리를 위해 수시로 소집 개최한다.

제11조 (총회의 의결 사항)
총회는 다음 각 호의 사항을 심의·의결한다.
① 회칙의 제정 및 개정에 관한 사항
② 임원의 선출 및 해임에 관한 사항
③ 예산안 및 결산 보고의 승인에 관한 사항
④ 기타 클럽 운영에 필요한 중대한 안건

제12조 (의결 정족수)
총회는 정회원 과반수의 출석(위임장 포함)으로 개회하고, 출석 회원 과반수의 찬성으로 의결한다. 단, 회칙 개정 및 클럽 해산은 출석 회원 3분의 2 이상의 찬성으로 의결한다.

제5장 재정 및 회비

제13조 (재정의 구성)
본 회의 재정은 정회원의 월회비, 가입비, 게스트비, 찬조금 및 기타 수익금으로 충당한다.

제14조 (회비 납부 규정)
① 정회원 회비: 월 30,000원으로 하며, 매월 지정일까지 클럽 전용 계좌로 납부한다.
② 신규 가입비: 최초 가입 시 입회비 30,000원을 납부한다 (가입 웰컴팩 및 공용 비품 충당).
③ 게스트 참가비: 정기 모임 1회 참가 시 10,000원을 모임 시작 전 총무에게 선납한다.

제15조 (재정 관리 및 결산 공개)
① 총무는 매월 회비 수납 현황과 지출 내역을 정산하여 익월 초 단체 대화방 및 게시판에 투명하게 공개 보고한다.
② 클럽 재정은 클럽 공용 전용 계좌로 엄정히 관리하며, 사적 사용을 일체 불허한다.

제6장 정기 모임 및 코트 경기 규정

제16조 (정기 모임 일정)
본 회의 정기 모임은 매주 지정 코트에서 진행함을 원칙으로 하며, 코트 상황에 따라 운영진이 사전에 조정 공지한다.

제17조 (참석 신청 및 불참 페널티)
① 정기 모임 참석 여부는 지정된 투표 마감 시간까지 반드시 투표 시스템을 통해 표시하여야 한다.
② 무단 불참(노쇼) 또는 당일 임박 취소 시 대진 편성 및 코트 운영에 지장을 초래하므로 게스트비 상당의 위약금을 부과할 수 있다.

제18조 (경기 진행 및 매너)
① 모든 경기는 경기이사의 대진 편성에 따라 공정하게 배정되며, 1인당 최소 게임 수를 균등하게 보장하도록 운영한다.
② 경기 중 아웃 콜은 상대방이 잘 들리도록 크고 명확하게 선언하며, 의심스러울 때는 '인(In)'으로 판정하는 굿 테니스 매너를 준수한다.
③ 파트너의 실책에 대한 비난이나 코트 내 고성방가, 라켓을 던지는 등 분위기를 해치는 행위는 엄격히 금지한다.

제7장 부칙

제1조 (시행일)
본 회칙은 총회에서 의결 통과된 즉시 그 효력을 발생한다.

제2조 (통상 관례)
본 회칙에 구체적으로 명시되지 않은 사항은 일반 테니스 동호회의 통상 관례 및 운영위원회의 협의 결정에 따른다.`;

export const DEFAULT_BYLAWS_DATA = {
  title: '테친회 테니스 동호회 회칙',
  version: '제1차 개정',
  lastAmendedDate: '2026. 09. 17',
  authority: '2026 하반기 정기총회 의결',
  content: DEFAULT_BYLAWS_CONTENT,
  history: [
    {
      id: 'rev_1',
      version: '제1차 개정',
      date: '2026. 09. 17',
      authority: '2026 하반기 정기총회 의결',
      summary: '운영진 5대 직책(회장·부회장·총무·경기이사·운영이사·행사담당) 세분화 및 게스트 참석 규정(월 2회 제한) 명시',
      author: '운영위원회',
      contentSnapshot: DEFAULT_BYLAWS_CONTENT
    },
    {
      id: 'rev_init',
      version: '제정',
      date: '2024. 03. 01',
      authority: '창립총회 의결',
      summary: '테친회 테니스 동호회 회칙 최초 제정 및 시행',
      author: '창립총회',
      contentSnapshot: DEFAULT_BYLAWS_CONTENT
    }
  ]
};

export default function ClubBylawsModal({ isOpen, onClose, isAdmin }) {
  const [activeTab, setActiveTab] = useState('view'); // 'view' | 'history' | 'edit'
  const [bylaws, setBylaws] = useState(DEFAULT_BYLAWS_DATA);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 열람 탭 관련 상태
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChapter, setSelectedChapter] = useState('all');
  const [copied, setCopied] = useState(false);
  const contentRef = useRef(null);

  // 이력 탭 스냅샷 펼침 상태
  const [expandedSnapshots, setExpandedSnapshots] = useState({});

  // 편집 탭 폼 상태
  const [editMode, setEditMode] = useState('amend'); // 'amend' (새 개정안 등록) | 'quick' (단순 오타 수정)
  const [formTitle, setFormTitle] = useState('');
  const [formVersion, setFormVersion] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formAuthority, setFormAuthority] = useState('');
  const [formAuthor, setFormAuthor] = useState('운영위원회');
  const [formSummary, setFormSummary] = useState('');
  const [formContent, setFormContent] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // 1. 회칙 데이터 Firestore 로드
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchBylaws = async () => {
      setLoading(true);
      try {
        const data = await getClubBylaws();
        if (isMounted) {
          if (data && data.content) {
            setBylaws({
              title: data.title || DEFAULT_BYLAWS_DATA.title,
              version: data.version || DEFAULT_BYLAWS_DATA.version,
              lastAmendedDate: data.lastAmendedDate || DEFAULT_BYLAWS_DATA.lastAmendedDate,
              authority: data.authority || DEFAULT_BYLAWS_DATA.authority,
              content: data.content || DEFAULT_BYLAWS_DATA.content,
              history: Array.isArray(data.history) && data.history.length > 0 ? data.history : DEFAULT_BYLAWS_DATA.history
            });
          } else {
            setBylaws(DEFAULT_BYLAWS_DATA);
          }
        }
      } catch (err) {
        console.error('회칙 로드 실패:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchBylaws();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // 편집 폼 초기화 (편집 탭 진입 시 현재 데이터로 채움)
  useEffect(() => {
    if (activeTab === 'edit') {
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      const formattedToday = `${y}. ${m}. ${d}`;

      // 다음 개정 버전 자동 계산
      const currentVerMatch = (bylaws.version || '').match(/제(\d+)차/);
      const nextNum = currentVerMatch ? parseInt(currentVerMatch[1], 10) + 1 : 2;
      const nextVer = `제${nextNum}차 개정`;

      setFormTitle(bylaws.title || '테친회 테니스 동호회 회칙');
      setFormVersion(nextVer);
      setFormDate(formattedToday);
      setFormAuthority('2026 하반기 정기총회 의결');
      setFormAuthor('운영위원회');
      setFormSummary('');
      setFormContent(bylaws.content || DEFAULT_BYLAWS_CONTENT);
      setShowPreview(false);
    }
  }, [activeTab, bylaws]);

  // 모달 키보드 및 스크롤 잠금
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

  // 장(Chapter)별 파싱 메모이제이션
  const chapters = useMemo(() => {
    if (!bylaws?.content) return [];
    const rawChapters = bylaws.content.split(/(?=제\d+장\s+)/g);
    return rawChapters.map((block, idx) => {
      const lines = block.trim().split('\n');
      const chapterHeader = lines[0] ? lines[0].trim() : `제${idx + 1}장`;
      const body = lines.slice(1).join('\n').trim();
      return {
        id: `chap_${idx}`,
        title: chapterHeader,
        body: body,
        fullText: block.trim()
      };
    }).filter(c => c.title.startsWith('제'));
  }, [bylaws.content]);

  // 검색 또는 장 필터링된 결과
  const filteredChapters = useMemo(() => {
    let result = chapters;

    if (selectedChapter !== 'all') {
      result = result.filter(c => c.title.includes(selectedChapter));
    }

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      result = result.filter(c => 
        c.title.toLowerCase().includes(q) || 
        c.body.toLowerCase().includes(q)
      );
    }

    return result;
  }, [chapters, selectedChapter, searchTerm]);

  // 전체 회칙 클립보드 복사 (카카오톡/밴드 친화 포맷)
  const handleCopyFullBylaws = async () => {
    try {
      const copyText = `📜 [${bylaws.title}]
🏷️ 버전: ${bylaws.version} (${bylaws.lastAmendedDate})
🏛️ 의결: ${bylaws.authority}
────────────────────
${bylaws.content}
────────────────────
클럽 회원 여러분의 원활한 동호회 활동을 위한 공식 회칙입니다.`;

      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error(err);
      alert('클립보드 복사에 실패했습니다.');
    }
  };

  // 특정 스냅샷 전문 복사
  const handleCopySnapshot = async (historyItem) => {
    try {
      const copyText = `📜 [${bylaws.title}] - ${historyItem.version} 스냅샷
📅 개정일자: ${historyItem.date}
🏛️ 의결구분: ${historyItem.authority}
📝 주요골자: ${historyItem.summary}
────────────────────
${historyItem.contentSnapshot || bylaws.content}`;

      await navigator.clipboard.writeText(copyText);
      alert(`'${historyItem.version}' 당시 회칙 전문이 복사되었습니다.`);
    } catch (err) {
      console.error(err);
      alert('복사에 실패했습니다.');
    }
  };

  // 스냅샷 아코디언 토글
  const toggleSnapshot = (id) => {
    setExpandedSnapshots(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // 표준 템플릿 불러오기
  const handleLoadStandardTemplate = () => {
    if (!confirm('현재 작성 중인 회칙 내용이 테친회 표준 회칙 템플릿으로 대체됩니다. 계속하시겠습니까?')) return;
    setFormContent(DEFAULT_BYLAWS_CONTENT);
  };

  // 회칙 저장 (개정안 등록 or 단순 수정)
  const handleSaveBylaws = async () => {
    if (!isAdmin) {
      alert('운영자 권한이 필요합니다.');
      return;
    }

    if (!formContent.trim()) {
      alert('회칙 내용을 입력해주세요.');
      return;
    }

    if (editMode === 'amend') {
      if (!formVersion.trim()) {
        alert('개정 차수/버전을 입력해주세요. (예: 제2차 개정)');
        return;
      }
      if (!formSummary.trim()) {
        alert('개정 사유 및 골자 요약을 입력해주세요.');
        return;
      }
      if (!confirm(`'${formVersion}'으로 신규 개정 이력을 등록하고 회칙을 저장하시겠습니까?\n\n개정일자: ${formDate}\n의결구분: ${formAuthority}\n개정골자: ${formSummary}`)) {
        return;
      }

      setSaving(true);
      try {
        const newHistoryItem = {
          id: 'rev_' + Date.now(),
          version: formVersion.trim(),
          date: formDate.trim() || new Date().toISOString().slice(0, 10),
          authority: formAuthority.trim(),
          summary: formSummary.trim(),
          author: formAuthor.trim() || '운영위원회',
          contentSnapshot: formContent.trim()
        };

        const updatedHistory = [newHistoryItem, ...(bylaws.history || [])];

        const updatedData = {
          title: formTitle.trim() || bylaws.title,
          version: formVersion.trim(),
          lastAmendedDate: formDate.trim(),
          authority: formAuthority.trim(),
          content: formContent.trim(),
          history: updatedHistory
        };

        await updateClubBylaws(updatedData);
        setBylaws(updatedData);
        alert(`✅ ${formVersion} 개정안이 성공적으로 저장 및 이력에 등록되었습니다!`);
        setActiveTab('view');
      } catch (err) {
        console.error('회칙 저장 오류:', err);
        alert('회칙 저장에 실패했습니다. Firestore 권한을 확인해주세요.');
      } finally {
        setSaving(false);
      }
    } else {
      // 단순 문구 수정 모드
      if (!confirm('회칙 내용을 단순 수정합니다. (개정 이력 추가 없음)\n저장하시겠습니까?')) return;

      setSaving(true);
      try {
        const updatedData = {
          title: formTitle.trim() || bylaws.title,
          version: bylaws.version,
          lastAmendedDate: formDate.trim() || bylaws.lastAmendedDate,
          authority: formAuthority.trim() || bylaws.authority,
          content: formContent.trim(),
          history: bylaws.history || []
        };

        await updateClubBylaws(updatedData);
        setBylaws(updatedData);
        alert('✅ 회칙 문구가 수정되었습니다.');
        setActiveTab('view');
      } catch (err) {
        console.error('회칙 수정 오류:', err);
        alert('회칙 수정에 실패했습니다.');
      } finally {
        setSaving(false);
      }
    }
  };

  // 개정 이력 항목 삭제 (관리자 전용)
  const handleDeleteHistory = async (historyId, versionStr) => {
    if (!isAdmin) return;
    if (!confirm(`'${versionStr}' 개정 이력 기록을 삭제하시겠습니까?\n(주의: 삭제된 이력은 복구되지 않습니다.)`)) return;

    setSaving(true);
    try {
      const updatedHistory = (bylaws.history || []).filter(h => h.id !== historyId);
      const updatedData = {
        ...bylaws,
        history: updatedHistory
      };
      await updateClubBylaws(updatedData);
      setBylaws(updatedData);
      alert('개정 이력 항목이 삭제되었습니다.');
    } catch (err) {
      console.error(err);
      alert('이력 삭제에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !isAdmin) return null;

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
        zIndex: 2000000,
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
          maxWidth: '900px',
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
        {/* ── 1. 모달 상단 헤더 ── */}
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
                width: '38px',
                height: '38px',
                borderRadius: '11px',
                background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.28)',
                flexShrink: 0
              }}
            >
              <IconBookOpen size={20} color="#ffffff" />
            </span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3
                  style={{
                    fontSize: '17px',
                    fontWeight: 800,
                    color: '#0f172a',
                    margin: 0,
                    letterSpacing: '-0.02em',
                    lineHeight: 1.2
                  }}
                >
                  {bylaws.title}
                </h3>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    backgroundColor: '#dbeafe',
                    color: '#1e40af',
                    border: '1px solid #bfdbfe'
                  }}
                >
                  {bylaws.version}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span>최종 개정일: <strong style={{ color: '#334155' }}>{bylaws.lastAmendedDate}</strong></span>
                <span>•</span>
                <span>{bylaws.authority}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              fontSize: '15px',
              fontWeight: 700,
              cursor: 'pointer',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
              flexShrink: 0
            }}
            title="닫기 (Esc)"
          >
            ✕
          </button>
        </div>

        {/* ── 2. 서브 탭 내비게이션 바 (열람 / 개정 이력 / 개정 및 수정) ── */}
        <div
          style={{
            padding: '10px 18px',
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            flexWrap: 'wrap',
            flexShrink: 0
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              backgroundColor: '#f1f5f9',
              padding: '3px',
              borderRadius: '10px',
              gap: '4px'
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('view')}
              style={{
                border: 'none',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: activeTab === 'view' ? 800 : 600,
                backgroundColor: activeTab === 'view' ? '#ffffff' : 'transparent',
                color: activeTab === 'view' ? '#1d4ed8' : '#64748b',
                boxShadow: activeTab === 'view' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              📜 <span>회칙 열람</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('history')}
              style={{
                border: 'none',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: activeTab === 'history' ? 800 : 600,
                backgroundColor: activeTab === 'history' ? '#ffffff' : 'transparent',
                color: activeTab === 'history' ? '#059669' : '#64748b',
                boxShadow: activeTab === 'history' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              📋 <span>개정 이력</span>
              <span
                style={{
                  fontSize: '10.5px',
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: '10px',
                  backgroundColor: activeTab === 'history' ? '#d1fae5' : '#e2e8f0',
                  color: activeTab === 'history' ? '#065f46' : '#64748b'
                }}
              >
                {bylaws.history?.length || 0}
              </span>
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() => setActiveTab('edit')}
                style={{
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: activeTab === 'edit' ? 800 : 600,
                  backgroundColor: activeTab === 'edit' ? '#ffffff' : 'transparent',
                  color: activeTab === 'edit' ? '#d97706' : '#64748b',
                  boxShadow: activeTab === 'edit' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                ✏️ <span>회칙 개정 / 수정</span>
                <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', backgroundColor: '#fef3c7', color: '#92400e', fontWeight: 700 }}>
                  운영자
                </span>
              </button>
            )}
          </div>

          {/* 우측 공통 액션 버튼 (전체 복사) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handleCopyFullBylaws}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                border: '1px solid #bfdbfe',
                backgroundColor: copied ? '#dcfce7' : '#eff6ff',
                color: copied ? '#15803d' : '#1d4ed8',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="클럽 공지 또는 카카오톡 단톡방 공유를 위해 전체 회칙을 복사합니다."
            >
              {copied ? '✅ 복사 완료!' : '📋 회칙 전문 복사'}
            </button>
          </div>
        </div>

        {/* ── 3. 탭별 메인 바디 ── */}
        <div
          ref={contentRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px',
            backgroundColor: '#f8fafc',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '240px', gap: '12px' }}>
              <span className="spinner" />
              <span style={{ fontSize: '13px', color: '#64748b' }}>동호회 회칙 데이터를 불러오는 중...</span>
            </div>
          ) : activeTab === 'view' ? (
            /* ══════════════════════════════════════════════════════════
               [탭 1: 회칙 열람 (View)]
            ══════════════════════════════════════════════════════════ */
            <div>
              {/* 회칙 상태 정보 배너 */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '14px',
                  border: '1px solid #e2e8f0',
                  padding: '14px 18px',
                  marginBottom: '14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '20px' }}>📜</span>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                      {bylaws.title}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                      본 회칙은 클럽의 공정한 경기 및 화목한 동호회 운영을 위한 최고 규정입니다.
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setActiveTab('history')}
                    style={{
                      fontSize: '11.5px',
                      fontWeight: 700,
                      color: '#059669',
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    개정 이력 ({bylaws.history?.length || 0}건) 보기 →
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('edit')}
                      style={{
                        fontSize: '11.5px',
                        fontWeight: 700,
                        color: '#d97706',
                        backgroundColor: '#fffbeb',
                        border: '1px solid #fde68a',
                        padding: '4px 10px',
                        borderRadius: '8px',
                        cursor: 'pointer'
                      }}
                    >
                      회칙 개정하기 ✏️
                    </button>
                  )}
                </div>
              </div>

              {/* 검색 및 장(Chapter) 바로가기 칩스 바 */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '14px',
                  border: '1px solid #e2e8f0',
                  padding: '12px 16px',
                  marginBottom: '16px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                }}
              >
                {/* 실시간 조문 검색창 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <div
                    style={{
                      flex: 1,
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <span style={{ position: 'absolute', left: '10px', color: '#94a3b8', fontSize: '13px' }}>🔍</span>
                    <input
                      type="text"
                      placeholder="조문 내용 및 키워드 검색 (예: 회비, 게스트, 임원, 징계, 제3장)"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px 8px 32px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => setSearchTerm('')}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          background: 'none',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  {searchTerm && (
                    <span style={{ fontSize: '11.5px', color: '#2563eb', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      검색결과: {filteredChapters.length}개 장
                    </span>
                  )}
                </div>

                {/* 장(Chapter) 빠른 점프 칩스 */}
                <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px', WebkitOverflowScrolling: 'touch' }}>
                  <button
                    type="button"
                    onClick={() => { setSelectedChapter('all'); setSearchTerm(''); }}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '11.5px',
                      fontWeight: selectedChapter === 'all' && !searchTerm ? 800 : 600,
                      backgroundColor: selectedChapter === 'all' && !searchTerm ? '#1e293b' : '#f1f5f9',
                      color: selectedChapter === 'all' && !searchTerm ? '#ffffff' : '#475569',
                      border: 'none',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}
                  >
                    전체 보기
                  </button>
                  {chapters.map((chap) => {
                    const isSelected = selectedChapter === chap.title;
                    return (
                      <button
                        key={chap.id}
                        type="button"
                        onClick={() => { setSelectedChapter(chap.title); setSearchTerm(''); }}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '11.5px',
                          fontWeight: isSelected ? 800 : 600,
                          backgroundColor: isSelected ? '#2563eb' : '#f1f5f9',
                          color: isSelected ? '#ffffff' : '#475569',
                          border: 'none',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {chap.title}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 회칙 본문 카드 리스트 */}
              {filteredChapters.length === 0 ? (
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '14px',
                    padding: '36px 20px',
                    textAlign: 'center',
                    border: '1px dashed #cbd5e1'
                  }}
                >
                  <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
                    '{searchTerm}' 키워드에 해당하는 회칙 조항을 찾을 수 없습니다.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setSearchTerm(''); setSelectedChapter('all'); }}
                    style={{
                      marginTop: '10px',
                      fontSize: '12px',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      backgroundColor: '#f1f5f9',
                      border: 'none',
                      color: '#2563eb',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    전체 회칙 보기로 초기화
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {filteredChapters.map((chap) => (
                    <div
                      key={chap.id}
                      style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '14px',
                        border: '1px solid #e2e8f0',
                        overflow: 'hidden',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.03)'
                      }}
                    >
                      {/* 장(Chapter) 헤더 */}
                      <div
                        style={{
                          padding: '10px 16px',
                          background: 'linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%)',
                          borderBottom: '1px solid #e2e8f0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                      >
                        <h4
                          style={{
                            margin: 0,
                            fontSize: '14.5px',
                            fontWeight: 800,
                            color: '#1e3a8a',
                            letterSpacing: '-0.01em',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <span style={{ display: 'inline-block', width: '6px', height: '14px', backgroundColor: '#2563eb', borderRadius: '3px' }} />
                          {chap.title}
                        </h4>
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                          {bylaws.version}
                        </span>
                      </div>

                      {/* 장 내부 조문 본문 */}
                      <div style={{ padding: '16px 18px', lineHeight: 1.75, fontSize: '13.5px', color: '#334155' }}>
                        {chap.body.split('\n\n').map((para, pIdx) => {
                          const isArticleHeader = para.trim().startsWith('제') && para.includes('조');
                          return (
                            <div
                              key={pIdx}
                              style={{
                                marginBottom: pIdx === chap.body.split('\n\n').length - 1 ? 0 : '14px',
                                paddingLeft: isArticleHeader ? '0px' : '4px'
                              }}
                            >
                              {para.split('\n').map((line, lIdx) => {
                                const isSubItem = line.trim().startsWith('①') || line.trim().startsWith('②') || line.trim().startsWith('③') || line.trim().startsWith('④') || line.trim().startsWith('⑤') || line.trim().startsWith('⑥');
                                const isMainArticle = line.trim().startsWith('제') && line.includes('조');
                                return (
                                  <div
                                    key={lIdx}
                                    style={{
                                      fontWeight: isMainArticle ? 700 : 400,
                                      color: isMainArticle ? '#0f172a' : isSubItem ? '#334155' : '#475569',
                                      paddingLeft: isSubItem ? '8px' : '0px',
                                      marginTop: isMainArticle && lIdx > 0 ? '8px' : '2px',
                                      fontSize: isMainArticle ? '14px' : '13.5px',
                                      wordBreak: 'keep-all'
                                    }}
                                  >
                                    {line}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : activeTab === 'history' ? (
            /* ══════════════════════════════════════════════════════════
               [탭 2: 개정 이력 관리 (Revision History)]
            ══════════════════════════════════════════════════════════ */
            <div>
              {/* 안내 배너 */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '14px',
                  border: '1px solid #bbf7d0',
                  padding: '14px 18px',
                  marginBottom: '16px',
                  background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '14.5px', fontWeight: 800, color: '#166534', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      📋 회칙 개정 이력 타임라인
                    </h4>
                    <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#15803d' }}>
                      클럽 회칙의 최초 제정부터 정기/임시총회 의결을 거친 역대 모든 개정 이력과 당시 회칙 스냅샷 전문을 투명하게 보존합니다.
                    </p>
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('edit')}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        backgroundColor: '#16a34a',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(22, 163, 74, 0.25)'
                      }}
                    >
                      + 새 개정안 등록하기
                    </button>
                  )}
                </div>
              </div>

              {/* 타임라인 목록 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {(bylaws.history || []).map((rev, index) => {
                  const isLatest = index === 0;
                  const isExpanded = !!expandedSnapshots[rev.id];

                  return (
                    <div
                      key={rev.id || index}
                      style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '14px',
                        border: isLatest ? '1.5px solid #86efac' : '1px solid #e2e8f0',
                        overflow: 'hidden',
                        boxShadow: isLatest ? '0 4px 12px rgba(34, 197, 94, 0.08)' : '0 1px 3px rgba(0,0,0,0.02)'
                      }}
                    >
                      {/* 이력 헤더 바 */}
                      <div
                        style={{
                          padding: '12px 18px',
                          backgroundColor: isLatest ? '#f0fdf4' : '#f8fafc',
                          borderBottom: '1px solid #e2e8f0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '10px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontSize: '12px',
                              fontWeight: 800,
                              padding: '3px 9px',
                              borderRadius: '6px',
                              backgroundColor: isLatest ? '#22c55e' : '#e2e8f0',
                              color: isLatest ? '#ffffff' : '#334155'
                            }}
                          >
                            {rev.version}
                          </span>
                          {isLatest && (
                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#15803d', backgroundColor: '#dcfce7', padding: '2px 7px', borderRadius: '4px' }}>
                              현재 시행 중
                            </span>
                          )}
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                            📅 {rev.date}
                          </span>
                          <span style={{ fontSize: '12px', color: '#64748b' }}>
                            ({rev.authority || '총회 의결'})
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                            작성: {rev.author || '운영위원회'}
                          </span>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleDeleteHistory(rev.id, rev.version)}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                color: '#ef4444',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                padding: '2px 6px'
                              }}
                              title="이 개정 이력 기록 삭제"
                            >
                              삭제
                            </button>
                          )}
                        </div>
                      </div>

                      {/* 이력 본문 (개정 사유 및 골자 요약) */}
                      <div style={{ padding: '14px 18px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                          📝 개정 사유 및 골자 요약
                        </div>
                        <div
                          style={{
                            fontSize: '13.5px',
                            color: '#1e293b',
                            lineHeight: 1.6,
                            backgroundColor: '#f8fafc',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            border: '1px solid #f1f5f9',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'keep-all'
                          }}
                        >
                          {rev.summary || '개정 내용 없음'}
                        </div>

                        {/* 당시 회칙 전문 스냅샷 펼쳐보기 버튼 */}
                        <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <button
                            type="button"
                            onClick={() => toggleSnapshot(rev.id)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              background: 'none',
                              border: 'none',
                              color: '#2563eb',
                              fontSize: '12.5px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              padding: '4px 0'
                            }}
                          >
                            <span>{isExpanded ? '▲ 당시 회칙 전문 스냅샷 접기' : '▼ 당시 회칙 전문 스냅샷 펼쳐보기'}</span>
                          </button>

                          {isExpanded && (
                            <button
                              type="button"
                              onClick={() => handleCopySnapshot(rev)}
                              style={{
                                fontSize: '11.5px',
                                fontWeight: 700,
                                color: '#1d4ed8',
                                backgroundColor: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                cursor: 'pointer'
                              }}
                            >
                              📋 이 버전 전문 복사
                            </button>
                          )}
                        </div>

                        {/* 스냅샷 아코디언 본문 */}
                        {isExpanded && (
                          <div
                            style={{
                              marginTop: '10px',
                              padding: '14px',
                              borderRadius: '8px',
                              backgroundColor: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              fontSize: '12.5px',
                              lineHeight: 1.65,
                              color: '#334155',
                              maxHeight: '300px',
                              overflowY: 'auto',
                              whiteSpace: 'pre-wrap',
                              fontFamily: 'monospace'
                            }}
                          >
                            {rev.contentSnapshot || rev.content || bylaws.content}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ══════════════════════════════════════════════════════════
               [탭 3: 회칙 개정 및 수정 (Edit - 운영자 전용)]
            ══════════════════════════════════════════════════════════ */
            <div>
              {/* 모드 선택 세그먼트 (새 개정안 등록 vs 단순 자구 수정) */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '14px',
                  border: '1px solid #fde68a',
                  padding: '14px 18px',
                  marginBottom: '16px',
                  background: 'linear-gradient(135deg, #fffbeb 0%, #ffffff 100%)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '14.5px', fontWeight: 800, color: '#92400e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      👑 회칙 개정 및 운영 관리
                    </h4>
                    <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#b45309' }}>
                      새로운 총회 의결 사항을 반영하여 개정 이력을 등록하거나, 경미한 문구를 정비할 수 있습니다.
                    </p>
                  </div>

                  <div style={{ display: 'inline-flex', backgroundColor: '#fef3c7', padding: '3px', borderRadius: '8px', gap: '4px' }}>
                    <button
                      type="button"
                      onClick={() => setEditMode('amend')}
                      style={{
                        border: 'none',
                        padding: '5px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: editMode === 'amend' ? 800 : 600,
                        backgroundColor: editMode === 'amend' ? '#ffffff' : 'transparent',
                        color: editMode === 'amend' ? '#92400e' : '#78350f',
                        boxShadow: editMode === 'amend' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        cursor: 'pointer'
                      }}
                    >
                      ✨ 새 개정안 등록 (이력 추가)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditMode('quick')}
                      style={{
                        border: 'none',
                        padding: '5px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: editMode === 'quick' ? 800 : 600,
                        backgroundColor: editMode === 'quick' ? '#ffffff' : 'transparent',
                        color: editMode === 'quick' ? '#92400e' : '#78350f',
                        boxShadow: editMode === 'quick' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        cursor: 'pointer'
                      }}
                    >
                      ✏️ 단순 자구/오타 수정
                    </button>
                  </div>
                </div>
              </div>

              {/* 입력 폼 영역 */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '14px',
                  border: '1px solid #e2e8f0',
                  padding: '18px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
                }}
              >
                {/* 1행: 회칙 제목 & 개정 차수 */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                      회칙 제목
                    </label>
                    <input
                      type="text"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="예: 테친회 테니스 동호회 회칙"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                      {editMode === 'amend' ? '신규 개정 차수 (버전)' : '현재 버전'}
                    </label>
                    <input
                      type="text"
                      value={formVersion}
                      onChange={(e) => setFormVersion(e.target.value)}
                      placeholder="예: 제2차 개정"
                      disabled={editMode === 'quick'}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        boxSizing: 'border-box',
                        backgroundColor: editMode === 'quick' ? '#f8fafc' : '#ffffff'
                      }}
                    />
                  </div>
                </div>

                {/* 2행: 개정일자 & 의결기관 & 작성자 */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                      {editMode === 'amend' ? '개정 시행일자' : '최종 개정일'}
                    </label>
                    <input
                      type="text"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      placeholder="예: 2026. 09. 17"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                      의결 기구 / 총회 구분
                    </label>
                    <input
                      type="text"
                      value={formAuthority}
                      onChange={(e) => setFormAuthority(e.target.value)}
                      placeholder="예: 2026 하반기 정기총회 의결"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                      기안 / 작성 주체
                    </label>
                    <input
                      type="text"
                      value={formAuthor}
                      onChange={(e) => setFormAuthor(e.target.value)}
                      placeholder="예: 운영위원회"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                {/* 3행: 개정 사유 및 골자 요약 (새 개정안 등록 모드일 때 필수) */}
                {editMode === 'amend' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#166534', marginBottom: '5px' }}>
                      📝 이번 개정 사유 및 주요 골자 요약 (개정 이력 타임라인에 등록됩니다)
                    </label>
                    <textarea
                      rows={2}
                      value={formSummary}
                      onChange={(e) => setFormSummary(e.target.value)}
                      placeholder="예: 정기모임 게스트 참석 규정 신설(월 2회 제한), 회비 납부일(매월 25일) 명문화 및 장기 미납 제명 기준 보완"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1.5px solid #86efac',
                        fontSize: '13px',
                        lineHeight: 1.5,
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                )}

                {/* 회칙 본문 편집기 툴바 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap', gap: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                    📜 회칙 전문 (조문별 본문)
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={handleLoadStandardTemplate}
                      style={{
                        fontSize: '11.5px',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        backgroundColor: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        color: '#475569',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                    >
                      🔄 표준 템플릿 불러오기
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPreview(!showPreview)}
                      style={{
                        fontSize: '11.5px',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        backgroundColor: showPreview ? '#dbeafe' : '#f8fafc',
                        border: '1px solid #93c5fd',
                        color: '#1d4ed8',
                        cursor: 'pointer',
                        fontWeight: 700
                      }}
                    >
                      {showPreview ? '✏️ 편집창 보기' : '👁️ 미리보기'}
                    </button>
                  </div>
                </div>

                {/* 회칙 본문 Textarea or Preview */}
                {showPreview ? (
                  <div
                    style={{
                      padding: '16px',
                      borderRadius: '8px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      maxHeight: '400px',
                      overflowY: 'auto',
                      fontSize: '13px',
                      lineHeight: 1.7,
                      whiteSpace: 'pre-wrap',
                      color: '#1e293b'
                    }}
                  >
                    {formContent}
                  </div>
                ) : (
                  <textarea
                    rows={15}
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    placeholder="회칙 전문을 입력하세요 (예: 제1장 총칙 ...)"
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      lineHeight: 1.65,
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                      resize: 'vertical'
                    }}
                  />
                )}

                {/* 하단 저장 버튼 */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setActiveTab('view')}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#f8fafc',
                      color: '#475569',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveBylaws}
                    disabled={saving}
                    style={{
                      padding: '8px 20px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: editMode === 'amend' ? '#16a34a' : '#2563eb',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: 800,
                      cursor: saving ? 'not-allowed' : 'pointer',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {saving ? (
                      <>
                        <span className="spinner" style={{ width: '14px', height: '14px' }} />
                        <span>저장 중...</span>
                      </>
                    ) : editMode === 'amend' ? (
                      <span>💾 개정안 저장 및 이력 등록</span>
                    ) : (
                      <span>💾 회칙 내용 수정 저장</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── 4. 모달 하단 고정 풋터 ── */}
        <div
          style={{
            padding: '12px 18px',
            backgroundColor: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}
        >
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            {activeTab === 'view' && <span>📜 총 <strong>{chapters.length}개 장</strong> 수록</span>}
            {activeTab === 'history' && <span>📋 총 <strong>{bylaws.history?.length || 0}차례</strong> 개정 이력 보존 중</span>}
            {activeTab === 'edit' && <span>✏️ 운영자 전용 회칙 개정 및 이력 관리 모드</span>}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '6px 16px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#334155',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

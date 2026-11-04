// app/editor/[id]/page.js — 대진표 스코어 입력 뷰어
'use client';
import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  getSchedule, updateSchedule, subscribeSchedule,
  getMembers, initDefaultMembers, getClubSettings,
  getSchedules, getEvents
} from '@/lib/firestore';
import Navbar from '@/components/Navbar';
import BracketTab   from '@/components/tabs/BracketTab';
import styles from './editor.module.css';

export default function EditorPage({ params }) {
  const { id } = use(params);
  const { isAdmin, can, loading } = useAuth();
  const router = useRouter();

  const canEditScore = can ? can('editMatchScore') : false;
  const canEditPlayer = can ? can('editMatchPlayer') : false;

  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveLabel, setSaveLabel] = useState('');

  /* ── 전역 상태 ── */
  const [title, setTitle] = useState('');
  const [matchDate, setMatchDate] = useState('');
  const [members, setMembers] = useState([]);            // 전체 회원
  const [participants, setParticipants] = useState([]);  // 오늘 참가자 [{playerId, target}]
  const [groups, setGroups] = useState([]);
  const [rounds, setRounds] = useState(6);
  const [courts, setCourts] = useState(2);
  const [mensDoublesCount, setMensDoublesCount] = useState(0);
  const [womensDoublesCount, setWomensDoublesCount] = useState(0);
  const [mixedCount, setMixedCount] = useState(0);
  const [jointCount, setJointCount] = useState(0);
  const [allowSingles, setAllowSingles] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [schedule, setSchedule] = useState(null);        // [[{teamA, teamB, type}]]
  const [scores, setScores] = useState({});
  const [scheduleRounds, setScheduleRounds] = useState(0);
  const [scheduleCourts, setScheduleCourts] = useState(0);
  const [lastGenStats, setLastGenStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [penaltyAmount, setPenaltyAmount] = useState(1000); // 1인당 패배 벌칙금 (기본 1,000원)
  const [penaltyPaidMap, setPenaltyPaidMap] = useState({}); // { [playerId]: boolean }
  const [usePenalty, setUsePenalty] = useState(true); // 경기 벌칙금 정산 활성화 여부
  const [useScore, setUseScore] = useState(true); // 경기 점수(스코어) 입력 활성화 여부
  const [maxGames, setMaxGames] = useState(6); // 경기 방식(게임수, 기본 6게임 선승)
  const [clubSettings, setClubSettings] = useState(null);
  const [allSchedules, setAllSchedules] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
  const [status, setStatus] = useState('playing');

  /* ── 초기 데이터 로드 및 실시간 동기화 구독 (onSnapshot) ── */
  useEffect(() => {
    if (!id) return;
    let unsub = () => {};

    (async () => {
      // 회원 목록 및 클럽 설정
      await initDefaultMembers('shared');
      const [mbrs, settings, scheds, evts] = await Promise.all([
        getMembers('shared'),
        getClubSettings(),
        getSchedules('shared'),
        getEvents('shared')
      ]);
      setMembers(mbrs);
      setClubSettings(settings);
      setAllSchedules(scheds || []);
      setAllEvents(evts || []);

      // 대진표 문서 실시간 구독
      unsub = subscribeSchedule('shared', id, (data) => {
        if (!data) {
          router.replace('/dashboard');
          return;
        }
        setTitle(data.title ?? '');
        const defaultDate = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
        setMatchDate(data.matchDate ?? defaultDate);
        setParticipants(data.participants ?? []);
        setGroups(data.groups ?? []);
        setRounds(data.rounds ?? 6);
        setCourts(data.courts ?? 2);
        setMensDoublesCount(data.mensDoublesCount ?? 0);
        setWomensDoublesCount(data.womensDoublesCount ?? 0);
        setMixedCount(data.mixedCount ?? 0);
        setJointCount(data.jointCount ?? 0);
        setAllowSingles(data.allowSingles ?? false);
        setStartTime(data.startTime ?? '');
        setEndTime(data.endTime ?? '');
        setSchedule(data.schedule ?? null);
        setScores(data.scores ?? {});
        setScheduleRounds(data.scheduleRounds_ ?? 0);
        setScheduleCourts(data.scheduleCourts_ ?? 0);
        setLastGenStats(data.lastGenStats ?? null);
        setHistory(data.history ?? []);
        if (data.usePenalty !== undefined) {
          setUsePenalty(Boolean(data.usePenalty));
        } else {
          setUsePenalty(data.penaltyAmount !== 0);
        }
        if (data.useScore !== undefined) {
          setUseScore(Boolean(data.useScore));
        } else {
          setUseScore(true);
        }
        if (data.penaltyAmount !== undefined) {
          setPenaltyAmount(data.penaltyAmount);
        }
        if (data.penaltyPaidMap) {
          setPenaltyPaidMap(data.penaltyPaidMap);
        }
        if (data.maxGames !== undefined) {
          setMaxGames(data.maxGames);
        }
        setStatus(data.status || (data.isFinished ? 'completed' : 'playing'));
        setFetching(false);
      });
    })();

    return () => unsub();
  }, [id, router]);

  /* ── Firestore 저장 & 실시간 전파 ── */
  const save = useCallback(async (overrides = {}) => {
    if (!id) return;
    setSaving(true);

    // 대진표 선수/경기 배정 수정 권한
    const canEditPlayer = can ? can('editMatchPlayer') : false;
    const currentSchedule = (!isAdmin && !canEditPlayer && schedule) ? schedule : (overrides.schedule !== undefined ? overrides.schedule : schedule);
    const currentScores = overrides.scores !== undefined ? overrides.scores : scores;
    
    // Auto-save history entry for current bracket
    const d = new Date();
    const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const recordDate = matchDate || todayStr;
    
    let nextHistory = [...(overrides.history || history)];
    
    if (currentSchedule && currentSchedule.length > 0) {
      const entryIndex = nextHistory.findIndex(h => h.date === recordDate);
      const entry = {
        id: entryIndex >= 0 ? nextHistory[entryIndex].id : 'h' + Date.now(),
        date: recordDate,
        schedule: JSON.parse(JSON.stringify(currentSchedule)),
        scores: JSON.parse(JSON.stringify(currentScores)),
        playerSnapshot: members.map(m => ({ id: m.id, name: m.name, gender: m.gender, ntrp: m.ntrp })),
      };
      if (entryIndex >= 0) {
        nextHistory[entryIndex] = entry;
      } else {
        nextHistory.push(entry);
      }
      nextHistory.sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
    }
    
    if (!overrides.history) {
      setHistory(nextHistory);
    }

    const currentParticipants = overrides.participants !== undefined ? overrides.participants : participants;
    if (overrides.participants !== undefined) {
      setParticipants(overrides.participants);
    }

    const payload = {
      title, matchDate, participants: currentParticipants, groups, rounds, courts,
      mensDoublesCount, womensDoublesCount, mixedCount, jointCount, allowSingles,
      startTime, endTime,
      schedule: currentSchedule,
      scores: currentScores,
      scheduleRounds_: overrides.scheduleRounds_ !== undefined ? overrides.scheduleRounds_ : scheduleRounds,
      scheduleCourts_: overrides.scheduleCourts_ !== undefined ? overrides.scheduleCourts_ : scheduleCourts,
      lastGenStats, history: nextHistory,
      usePenalty: overrides.usePenalty !== undefined ? overrides.usePenalty : usePenalty,
      useScore: overrides.useScore !== undefined ? overrides.useScore : useScore,
      penaltyAmount: overrides.penaltyAmount !== undefined ? overrides.penaltyAmount : penaltyAmount,
      penaltyPaidMap: overrides.penaltyPaidMap !== undefined ? overrides.penaltyPaidMap : penaltyPaidMap,
      maxGames: overrides.maxGames !== undefined ? overrides.maxGames : maxGames,
      status: overrides.status !== undefined ? overrides.status : status,
      isFinished: overrides.isFinished !== undefined ? overrides.isFinished : (status === 'completed'),
      endedAt: overrides.endedAt !== undefined ? overrides.endedAt : (status === 'completed' ? new Date().toISOString() : null),
      ...overrides,
    };
    try {
      await updateSchedule('shared', id, payload);
      setSaveLabel('실시간 동기화됨 ✓');
      setTimeout(() => setSaveLabel(''), 2000);
    } catch (err) {
      console.error('Auto-save error:', err);
    } finally {
      setSaving(false);
    }
  }, [id, title, matchDate, participants, groups, rounds, courts, mensDoublesCount, womensDoublesCount, mixedCount, jointCount, allowSingles, startTime, endTime, schedule, scores, scheduleRounds, scheduleCourts, lastGenStats, history, members, usePenalty, useScore, penaltyAmount, penaltyPaidMap, maxGames, status]);

  const handleEndBracket = useCallback(async (extra = {}) => {
    if (!isAdmin && !canEditScore) {
      alert('대진 종료 권한이 없습니다.');
      return;
    }
    setStatus('completed');
    await save({
      status: 'completed',
      isFinished: true,
      endedAt: new Date().toISOString(),
      ...extra,
    });
    alert('대진이 정상적으로 종료되었습니다.\n대시보드의 지난 대진표(종료된 경기)로 분류됩니다.');
  }, [isAdmin, canEditScore, save]);

  const handleReopenBracket = useCallback(async () => {
    if (!isAdmin && !canEditScore) {
      alert('대진 상태를 변경할 권한이 없습니다.');
      return;
    }
    if (!confirm('대진 종료를 취소하고 다시 경기 진행 중 상태로 변경하시겠습니까?')) return;
    setStatus('playing');
    await save({
      status: 'playing',
      isFinished: false,
      endedAt: null,
    });
    alert('대진이 다시 진행 상태로 재개되었습니다.');
  }, [isAdmin, canEditScore, save]);

  if (loading || fetching) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="spinner" />
      </div>
    );
  }

  const todayStr = new Date().toLocaleDateString('en-CA');
  const isPastMatch = Boolean(matchDate && matchDate < todayStr);
  const isCompletedMatch = status === 'completed' || isPastMatch;
  const isReadOnly = (isCompletedMatch && !isAdmin) || (!isAdmin && !canEditScore);

  return (
    <div className={styles.page}>
      <Navbar />
      <main className={styles.main}>
        {/* 헤더 */}
        <div className={`${styles.editorHeader} no-print`}>
          <div className={styles.titleRow}>
            <div className={styles.titleMain}>
              <button className="btn btn-secondary btn-sm" onClick={() => router.push('/dashboard')}>
                ← 목록
              </button>
              <input 
                className={`input ${styles.titleInput}`} 
                value={title}
                onChange={e => setTitle(e.target.value)} 
                onBlur={() => save()} 
                placeholder="대진표 제목" 
                readOnly={!isAdmin} 
              />
            </div>
            
            <div className={styles.titleStatus} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {status === 'completed' ? (
                <span 
                  className={styles.pastMatchBadge}
                  style={{ 
                    backgroundColor: '#f0fdf4',
                    color: '#16a34a',
                    border: '1px solid #86efac',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  🏁 대진 종료됨 (결과 확정)
                </span>
              ) : isPastMatch ? (
                <span 
                  className={styles.pastMatchBadge}
                  style={{ 
                    backgroundColor: isReadOnly ? '#f1f5f9' : 'rgba(0, 122, 255, 0.1)',
                    color: isReadOnly ? '#64748b' : 'var(--ios-blue)',
                    border: `1px solid ${isReadOnly ? '#cbd5e1' : 'rgba(0, 122, 255, 0.25)'}`,
                  }}
                >
                  {isReadOnly ? '🔒 종료된 경기 (읽기 전용)' : '⚙️ 종료된 경기 (관리자 모드)'}
                </span>
              ) : !isAdmin ? (
                <span 
                  className={styles.pastMatchBadge}
                  style={{ 
                    backgroundColor: '#f8fafc',
                    color: '#64748b',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  {canEditPlayer && canEditScore
                    ? '🌐 전체 권한 오픈 모드 (선수/점수 입력 가능)'
                    : canEditScore
                    ? '🔒 선수 수정: 운영진 전용 (스코어 입력 가능)'
                    : canEditPlayer
                    ? '🔒 스코어 수정: 운영진 전용 (선수 배정 가능)'
                    : '🔒 읽기 전용 모드 (운영진 전용)'}
                </span>
              ) : null}

              {/* 🏁 상단 대진 종료 / 대진 재개 버튼 */}
              {(isAdmin || canEditScore) && (
                status === 'completed' ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleReopenBracket}
                    style={{ fontSize: '11.5px', fontWeight: 800, padding: '3px 10px', color: '#16a34a', borderColor: '#86efac', backgroundColor: '#f0fdf4' }}
                    title="대진 종료를 취소하고 다시 경기 진행 중 상태로 되돌립니다"
                  >
                    🔄 대진 재개
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => {
                      if (confirm('대진을 종료하시겠습니까?')) {
                        handleEndBracket();
                      }
                    }}
                    style={{ fontSize: '11.5px', fontWeight: 800, padding: '3px 10px', backgroundColor: '#16a34a', borderColor: '#15803d', color: '#fff' }}
                    title="대진을 종료하고 완료 상태로 변경합니다"
                  >
                    🏁 대진 종료
                  </button>
                )
              )}

              <span className={styles.saveLabel}>
                {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : saveLabel}
              </span>
            </div>
          </div>
        </div>

        {/* 대진표 콘텐츠 */}
        <div>
          <BracketTab
            schedule={schedule} setSchedule={setSchedule}
            scores={scores} setScores={setScores}
            members={members} participants={participants}
            setParticipants={setParticipants}
            lastGenStats={lastGenStats}
            scheduleRounds={scheduleRounds} scheduleCourts={scheduleCourts}
            setScheduleRounds={setScheduleRounds} setScheduleCourts={setScheduleCourts}
            usePenalty={usePenalty} setUsePenalty={(val) => {
              setUsePenalty(val);
              save({ usePenalty: val });
            }}
            useScore={useScore} setUseScore={(val) => {
              setUseScore(val);
              save({ useScore: val });
            }}
            penaltyAmount={penaltyAmount} setPenaltyAmount={setPenaltyAmount}
            penaltyPaidMap={penaltyPaidMap} setPenaltyPaidMap={setPenaltyPaidMap}
            maxGames={maxGames} setMaxGames={setMaxGames}
            clubSettings={clubSettings}
            allSchedules={allSchedules}
            allEvents={allEvents}
            matchDate={matchDate}
            title={title}
            onSave={save}
            onPrint={() => window.print()}
            isAdmin={isAdmin}
            canEditPlayer={canEditPlayer}
            canEditScore={canEditScore}
            isReadOnly={isReadOnly}
            isPastMatch={isPastMatch}
            scheduleStatus={status}
            setScheduleStatus={setStatus}
            onEndBracket={handleEndBracket}
            onReopenBracket={handleReopenBracket}
          />
        </div>
      </main>
    </div>
  );
}

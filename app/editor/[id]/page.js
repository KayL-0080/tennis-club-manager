// app/editor/[id]/page.js — 대진표 스코어 입력 뷰어
'use client';
import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  getSchedule, updateSchedule, subscribeSchedule,
  getMembers, initDefaultMembers
} from '@/lib/firestore';
import Navbar from '@/components/Navbar';
import BracketTab   from '@/components/tabs/BracketTab';
import HistoryTab   from '@/components/tabs/HistoryTab';
import styles from './editor.module.css';

const TABS = [
  { key: 'bracket',   label: '📋 오늘 대진표' },
  { key: 'history',   label: '🏆 기록 · 순위' },
];

export default function EditorPage({ params }) {
  const { id } = use(params);
  const { isAdmin, loading } = useAuth();
  const router = useRouter();

  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveLabel, setSaveLabel] = useState('');
  const [activeTab, setActiveTab] = useState('bracket');

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

  /* ── 초기 데이터 로드 및 실시간 동기화 구독 (onSnapshot) ── */
  useEffect(() => {
    if (!id) return;
    let unsub = () => {};

    (async () => {
      // 회원 목록 (별도 컬렉션)
      await initDefaultMembers('shared');
      const mbrs = await getMembers('shared');
      setMembers(mbrs);

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
        setFetching(false);
      });
    })();

    return () => unsub();
  }, [id, router]);

  /* ── Firestore 저장 & 실시간 전파 ── */
  const save = useCallback(async (overrides = {}) => {
    if (!id) return;
    setSaving(true);

    const currentSchedule = overrides.schedule !== undefined ? overrides.schedule : schedule;
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

    const payload = {
      title, matchDate, participants, groups, rounds, courts,
      mensDoublesCount, womensDoublesCount, mixedCount, jointCount, allowSingles,
      startTime, endTime,
      schedule: currentSchedule,
      scores: currentScores,
      scheduleRounds_: overrides.scheduleRounds_ !== undefined ? overrides.scheduleRounds_ : scheduleRounds,
      scheduleCourts_: overrides.scheduleCourts_ !== undefined ? overrides.scheduleCourts_ : scheduleCourts,
      lastGenStats, history: nextHistory,
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
  }, [id, title, matchDate, participants, groups, rounds, courts, mensDoublesCount, womensDoublesCount, mixedCount, jointCount, allowSingles, startTime, endTime, schedule, scores, scheduleRounds, scheduleCourts, lastGenStats, history, members]);

  if (loading || fetching) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="spinner" />
      </div>
    );
  }

  const todayStr = new Date().toLocaleDateString('en-CA');
  const isPastMatch = Boolean(matchDate && matchDate < todayStr);
  const isReadOnly = isPastMatch && !isAdmin;

  return (
    <div className={styles.page}>
      <Navbar />
      <main className={styles.main}>
        {/* 헤더 */}
        <div className={`${styles.editorHeader} no-print`}>
          <div className={styles.titleRow}>
            <button className="btn btn-secondary btn-sm" onClick={() => router.push('/dashboard')}>← 목록</button>
            <input className={`input ${styles.titleInput}`} value={title}
              onChange={e => setTitle(e.target.value)} onBlur={() => save()} placeholder="대진표 제목" readOnly={!isAdmin} />
            {isPastMatch && (
              <span 
                style={{ 
                  fontSize: '12px', 
                  padding: '4px 10px', 
                  borderRadius: '20px', 
                  fontWeight: 700,
                  backgroundColor: isReadOnly ? '#f1f5f9' : 'rgba(0, 122, 255, 0.1)',
                  color: isReadOnly ? '#64748b' : 'var(--ios-blue)',
                  border: `1px solid ${isReadOnly ? '#cbd5e1' : 'rgba(0, 122, 255, 0.25)'}`,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap'
                }}
              >
                {isReadOnly ? '🔒 종료된 경기 (읽기 전용)' : '⚙️ 종료된 경기 (관리자 모드)'}
              </span>
            )}
            <span className={styles.saveLabel}>
              {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : saveLabel}
            </span>
          </div>
        </div>

        {/* 탭 네비게이션 */}
        <div className={`${styles.tabNav} no-print`}>
          {TABS.map(t => (
            <button key={t.key}
              className={`${styles.tabBtn} ${activeTab === t.key ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(t.key)}
              type="button">
              {t.label}
            </button>
          ))}
        </div>

        {/* 탭 콘텐츠 */}
        <div>
          {activeTab === 'bracket' && (
            <BracketTab
              schedule={schedule} setSchedule={setSchedule}
              scores={scores} setScores={setScores}
              members={members} participants={participants}
              lastGenStats={lastGenStats}
              scheduleRounds={scheduleRounds} scheduleCourts={scheduleCourts}
              setScheduleRounds={setScheduleRounds} setScheduleCourts={setScheduleCourts}
              onSave={save}
              onPrint={() => window.print()}
              isAdmin={isAdmin}
              isReadOnly={isReadOnly}
              isPastMatch={isPastMatch}
            />
          )}
          {activeTab === 'history' && (
            <HistoryTab
              schedule={schedule} scores={scores}
              members={members} history={history} setHistory={setHistory}
              onSave={save}
              isAdmin={isAdmin}
            />
          )}
        </div>
      </main>
    </div>
  );
}

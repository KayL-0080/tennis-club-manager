// app/editor/[id]/page.js — 대진표 스코어 입력 뷰어
'use client';
import { useState, useEffect, useCallback, use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  getSchedule, updateSchedule,
  getMembers
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
  const { isAdmin, isSuperAdmin, loading, currentClubId, clubs } = useAuth();
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
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [schedule, setSchedule] = useState(null);        // [[{teamA, teamB, type}]]
  const [scores, setScores] = useState({});
  const [scheduleRounds, setScheduleRounds] = useState(0);
  const [scheduleCourts, setScheduleCourts] = useState(0);
  const [lastGenStats, setLastGenStats] = useState(null);
  const [history, setHistory] = useState([]);

  /* ── 인증 가드 ── */
  // 비로그인도 열람 허용이므로 삭제

  /* ── 초기 데이터 로드 ── */
  useEffect(() => {
    if (!id) return;
    (async () => {
      if (!currentClubId) return;
      try {
        // Removed initDefaultMembers
        
        let mbrs = [];
        try { mbrs = await getMembers(currentClubId); } catch(e) { console.warn(e); }
        setMembers(mbrs);

        // 대진표 문서
        let data = null;
        try { data = await getSchedule(currentClubId, id); } catch(e) { console.warn(e); }
        
        if (!data) { router.replace('/dashboard'); return; }
        
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
        setStartTime(data.startTime ?? '');
        setEndTime(data.endTime ?? '');
        setSchedule(data.schedule ?? null);
        setScores(data.scores ?? {});
        setScheduleRounds(data.scheduleRounds_ ?? 0);
        setScheduleCourts(data.scheduleCourts_ ?? 0);
        setLastGenStats(data.lastGenStats ?? null);
        setHistory(data.history ?? []);
      } catch (err) {
        console.error('Failed to load schedule data:', err);
      } finally {
        setFetching(false);
      }
    })();
  }, [id, currentClubId, router]);

  useEffect(() => {
    if (!loading && !fetching && !currentClubId) {
      router.replace('/');
    }
  }, [loading, fetching, currentClubId, router]);

  /* ── Firestore 저장 ── */
  const save = useCallback(async (overrides = {}) => {
    if (!id) return;
    setSaving(true);
    const payload = {
      title, matchDate, participants, groups, rounds, courts,
      mensDoublesCount, womensDoublesCount, mixedCount, jointCount,
      startTime, endTime,
      schedule, scores,
      scheduleRounds_: scheduleRounds,
      scheduleCourts_: scheduleCourts,
      lastGenStats, history,
      ...overrides,
    };
    try {
      await updateSchedule(currentClubId, id, payload);
      setSaveLabel('저장됨 ✓');
      setTimeout(() => setSaveLabel(''), 2000);
    } finally { setSaving(false); }
  }, [id, currentClubId, title, matchDate, participants, groups, rounds, courts, mensDoublesCount, womensDoublesCount, mixedCount, jointCount, startTime, endTime, schedule, scores, scheduleRounds, scheduleCourts, lastGenStats, history]);

  // participants에 있는 게스트를 members 배열에 임시로 포함시켜 하위 컴포넌트에 전달
  const extendedMembers = useMemo(() => {
    const list = [...members];
    participants.forEach(pt => {
      if (pt.isGuest && !list.find(m => m.id === pt.playerId)) {
        list.push({ id: pt.playerId, name: pt.name, gender: pt.gender, ntrp: pt.ntrp });
      }
    });
    return list;
  }, [members, participants]);

  if (loading || fetching || !currentClubId) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="spinner" />
      </div>
    );
  }

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
              members={extendedMembers} participants={participants}
              lastGenStats={lastGenStats}
              scheduleRounds={scheduleRounds} scheduleCourts={scheduleCourts}
              setScheduleRounds={setScheduleRounds} setScheduleCourts={setScheduleCourts}
              onSave={save}
              onPrint={() => window.print()}
              isAdmin={isAdmin}
              matchDate={matchDate}
              startTime={startTime}
              endTime={endTime}
              clubName={clubs.find(c => c.id === currentClubId)?.name || ''}
            />
          )}
          {activeTab === 'history' && (
            <HistoryTab
              schedule={schedule} scores={scores}
              members={extendedMembers} history={history} setHistory={setHistory}
              onSave={save}
              isAdmin={isAdmin}
              isSuperAdmin={isSuperAdmin}
            />
          )}
        </div>
      </main>
    </div>
  );
}

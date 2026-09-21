// components/tabs/SettingsTab.js — 오늘 참가자 선택 + 라운드/코트 + 특별조건 + 대진표 생성
'use client';
import { useState, useEffect } from 'react';
import { generateSchedule, makeEmptyMatch, calculateRecommendedSettings } from '@/lib/scheduler';
import { addMember } from '@/lib/firestore';
import styles from './tabs.module.css';

let _gCounter = 2000;
const newGid = () => 'grp' + _gCounter++;

const numOptions = (min, max) => {
  const opts = [];
  for (let i = min; i <= max; i++) opts.push(<option key={i} value={i}>{i}</option>);
  return opts;
};

export default function SettingsTab({
  events = [],
  matchDate, setMatchDate,
  members, participants, setParticipants,
  rounds, setRounds, courts, setCourts,
  mensDoublesCount, setMensDoublesCount,
  womensDoublesCount, setWomensDoublesCount,
  mixedCount, setMixedCount,
  jointCount, setJointCount,
  allowSingles, setAllowSingles,
  startTime, setStartTime, endTime, setEndTime,
  usePenalty = false, setUsePenalty,
  groups, setGroups,
  onScheduleGenerated, onScheduleManual, onSave, onSaveAndExit, onGoto, onReloadMembers
}) {
  const [status, setStatus] = useState('');
  const [warnMsg, setWarnMsg] = useState('');
  const [generating, setGenerating] = useState(false);
  const [enableConditions, setEnableConditions] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState([]);
  const [recExplanation, setRecExplanation] = useState('');
  const [recNotice, setRecNotice] = useState('');
  
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestForm, setGuestForm] = useState({ name: '', gender: 'M', ntrp: 2.0 });

  // 경기 시간(분 및 포맷) 계산
  const calcDuration = (start, end) => {
    if (!start || !end) return { text: '3시간 (180분)', diff: 180, hours: 3, mins: 0 };
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    let diff = (eH * 60 + eM) - (sH * 60 + sM);
    if (diff <= 0) diff += 24 * 60;
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    const text = `${hours > 0 ? `${hours}시간 ` : ''}${mins > 0 ? `${mins}분` : ''}`.trim() || '0분';
    return { text: `${text} (${diff}분)`, diff, hours, mins };
  };
  const durationInfo = calcDuration(startTime, endTime);

  // 균등 배분 계산 헬퍼
  const computeBalancedParticipants = (pts, rCount = rounds, cCount = courts, allowS = allowSingles) => {
    const n = pts.length;
    if (n === 0) return pts;
    const isSActive = allowS && n < cCount * 4 && n > 0;
    const sPerRound = isSActive ? Math.min(cCount, Math.ceil((cCount * 4 - n) / 2)) : 0;
    const dPerRound = cCount - sPerRound;
    const sSlots = sPerRound * 2 + dPerRound * 4;
    const tSlots = rCount * sSlots;
    if (tSlots <= 0) return pts;
    const base = Math.floor(tSlots / n);
    let rem = tSlots - base * n;
    return pts.map((pt, i) => ({ ...pt, target: base + (i < rem ? 1 : 0) }));
  };

  // 추천 설정 적용 함수
  const applyRecommendation = (pts = participants, sTime = startTime, eTime = endTime, numCourts = courts) => {
    const rec = calculateRecommendedSettings({
      startTime: sTime,
      endTime: eTime,
      courts: numCourts,
      participants: pts,
      members
    });

    setRounds(rec.rounds);
    setMensDoublesCount(rec.mensDoublesCount);
    setWomensDoublesCount(rec.womensDoublesCount);
    setMixedCount(rec.mixedCount);
    setJointCount(rec.jointCount);
    setRecExplanation(rec.explanation);

    if (pts.length > 0) {
      const balanced = computeBalancedParticipants(pts, rec.rounds, numCourts, allowSingles);
      setParticipants(balanced);
    }
    setRecNotice('💡 3단계 설정이 추천값으로 자동 반영되었습니다.');
    setTimeout(() => setRecNotice(''), 4000);
  };

  // 시간 변경 핸들러
  const handleStartTimeChange = (newStart) => {
    setStartTime(newStart);
    if (participants.length > 0) {
      applyRecommendation(participants, newStart, endTime, courts);
    } else {
      const rec = calculateRecommendedSettings({ startTime: newStart, endTime, courts, participants, members });
      setRounds(rec.rounds);
    }
  };

  const handleEndTimeChange = (newEnd) => {
    setEndTime(newEnd);
    if (participants.length > 0) {
      applyRecommendation(participants, startTime, newEnd, courts);
    } else {
      const rec = calculateRecommendedSettings({ startTime, endTime: newEnd, courts, participants, members });
      setRounds(rec.rounds);
    }
  };

  // 시간 프리셋 적용 (시작 시간 기준)
  const applyDurationPreset = (hoursToAdd, minsToAdd = 0) => {
    const [sH, sM] = (startTime || '09:00').split(':').map(Number);
    let totalMinutes = sH * 60 + sM + hoursToAdd * 60 + minsToAdd;
    if (totalMinutes >= 24 * 60) totalMinutes %= 24 * 60;
    const newEH = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
    const newEM = String(totalMinutes % 60).padStart(2, '0');
    const newEnd = `${newEH}:${newEM}`;
    handleEndTimeChange(newEnd);
  };

  // 참가자로 포함 여부
  const isParticipant = id => participants.some(pt => pt.playerId === id);

  const addParticipant = id => {
    if (!id || isParticipant(id)) return;
    const newPts = [...participants, { playerId: id, target: 0 }];
    applyRecommendation(newPts, startTime, endTime, courts);
  };
  const removeParticipant = id => {
    const newPts = participants.filter(pt => pt.playerId !== id);
    if (newPts.length > 0) {
      applyRecommendation(newPts, startTime, endTime, courts);
    } else {
      setParticipants([]);
      setMensDoublesCount(0);
      setWomensDoublesCount(0);
      setMixedCount(0);
      setJointCount(0);
      setRecExplanation('');
    }
  };
  const addAll = () => {
    const newPts = members.map(m => ({ playerId: m.id, target: 0 }));
    applyRecommendation(newPts, startTime, endTime, courts);
  };
  const clearAll = () => {
    if (!confirm('참가자 전체를 제외할까요?')) return;
    setParticipants([]);
    setMensDoublesCount(0);
    setWomensDoublesCount(0);
    setMixedCount(0);
    setJointCount(0);
    setRecExplanation('');
  };

  const matchedEvent = events.find(e => e.date === matchDate);
  const loadFromVote = () => {
    if (!matchedEvent) return;
    const attendingIds = Object.entries(matchedEvent.attendees || {})
      .filter(([id, status]) => status === 'Y')
      .map(([id]) => id);
    
    if (attendingIds.length === 0) {
      alert('참석 투표에 "참석"으로 표시된 인원이 없습니다.');
      return;
    }
    
    if (confirm(`투표에서 참석으로 표시된 ${attendingIds.length}명을 불러오시겠습니까?\n(기존 참가자 목록이 교체되며 3단계 설정이 추천값으로 세팅됩니다.)`)) {
      const newPts = attendingIds.map(id => ({ playerId: id, target: 0 }));
      const sTime = matchedEvent.startTime || startTime;
      const eTime = matchedEvent.endTime || endTime;
      if (matchedEvent.startTime) setStartTime(matchedEvent.startTime);
      if (matchedEvent.endTime) setEndTime(matchedEvent.endTime);
      applyRecommendation(newPts, sTime, eTime, courts);
    }
  };

  const toggleSelectToAdd = (id, isChecked) => {
    setSelectedToAdd(prev => isChecked ? [...prev, id] : prev.filter(x => x !== id));
  };
  const addSelectedParticipants = () => {
    if (selectedToAdd.length === 0) return;
    const newPts = [...participants, ...selectedToAdd.map(id => ({ playerId: id, target: 0 }))];
    setSelectedToAdd([]);
    applyRecommendation(newPts, startTime, endTime, courts);
  };

  const handleAddGuest = async (e) => {
    e.preventDefault();
    if (!guestForm.name.trim()) return;
    try {
      const newId = await addMember('shared', { ...guestForm, role: '게스트' });
      if (onReloadMembers) await onReloadMembers();
      const newPts = [...participants, { playerId: newId, target: 0 }];
      setShowGuestForm(false);
      setGuestForm({ name: '', gender: 'M', ntrp: 2.0 });
      applyRecommendation(newPts, startTime, endTime, courts);
    } catch (err) {
      alert('게스트 추가 실패: ' + err.message);
    }
  };

  const updateTarget = (playerId, val) => {
    setParticipants(prev => prev.map(pt => pt.playerId === playerId ? { ...pt, target: parseInt(val) || 0 } : pt));
  };

  const isSinglesActive = allowSingles && participants.length < courts * 4 && participants.length > 0;
  const singlesPerRound = isSinglesActive ? Math.min(courts, Math.ceil((courts * 4 - participants.length) / 2)) : 0;
  const doublesPerRound = courts - singlesPerRound;
  const slotsPerRound = singlesPerRound * 2 + doublesPerRound * 4;
  const totalSlots = rounds * slotsPerRound;
  
  const autoBalance = () => {
    const balanced = computeBalancedParticipants(participants, rounds, courts, allowSingles);
    setParticipants(balanced);
  };

  const targetSum = participants.reduce((s, pt) => s + (pt.target || 0), 0);
  const isBalanced = totalSlots === targetSum && totalSlots > 0 && participants.length >= 2;

  // 참가자 상세 (이름/성별/NTRP 포함)
  const getEntry = id => members.find(m => m.id === id);
  const entries = participants.map(pt => {
    const m = getEntry(pt.playerId);
    return m ? { ...m, target: pt.target } : null;
  }).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));

  const maleCount = entries.filter(e => e.gender === 'M').length;
  const femaleCount = entries.filter(e => e.gender === 'F').length;

  // 특별 조건 그룹 추가
  const addGroup = e => {
    e.preventDefault();
    const form = e.currentTarget;
    const ids = ['g1', 'g2', 'g3', 'g4'].map(n => form[n].value);
    const count = parseInt(form.gCount.value) || 1;
    if (ids.some(id => !id) || new Set(ids).size < 4) { alert('오늘 참가자 중 4명을 서로 다르게 선택해주세요.'); return; }
    setGroups(prev => [...prev, { id: newGid(), memberIds: ids, count }]);
    form.reset();
  };

  const removeGroup = id => setGroups(prev => prev.filter(g => g.id !== id));

  // 자동 생성
  const runGeneration = () => {
    setGenerating(true);
    setStatus('생성 중... (최대 3초)');
    setWarnMsg('');
    setTimeout(() => {
      const validGroups = groups.filter(g => g.memberIds.every(id => entries.some(p => p.id === id)));
      const activeGroups = enableConditions ? validGroups.map(g => ({ memberIds: g.memberIds, count: g.count })) : [];
      const opts = { 
        groups: activeGroups, 
        mensDoublesCount, womensDoublesCount, mixedCount, jointCount, 
        singlesPerRound,
        noFF: true 
      };
      const { result, attempts, failReasons } = generateSchedule(entries, rounds, courts, opts, 2500, 3000);
      setGenerating(false);
      setStatus(`시도 ${attempts}회 완료`);
      if (!result) {
        const KoreanReasons = {
          group_need_exhausted: "• 특별 조건 멤버의 목표 게임수 부족 (특별 조건 멤버들의 '목표 게임수'가 조건에 설정된 게임수보다 작음)",
          mens_not_enough_males: "• 남성 참가자 부족 (남식 복식을 위한 남성 회원 또는 남성 회원의 잔여 목표 게임수가 부족함)",
          mixed_not_enough_females: "• 여성 참가자 부족 (혼식 복식에 배정할 여성 회원 또는 여성 회원의 잔여 목표 게임수가 부족함)",
          mixed_not_enough_males: "• 남성 참가자 부족 (혼식 복식에 배정할 남성 회원 또는 남성 회원의 잔여 목표 게임수가 부족함)",
          singles_avail_lt_2: "• 단식 배정 인원 부족 (단식 경기를 위한 잔여 목표 게임수가 있는 참가자가 2명 미만임)",
          singles_pick_null: "• 단식 조합 불가능 (설정된 단식 경기 수에 맞는 조합을 찾을 수 없습니다)",
          joint_not_enough_players: "• 잡복 대기 참가자 부족 (잡식 복식을 채우기 위한 잔여 목표 게임수가 있는 참가자가 부족함)",
          joint_pick_null: "• 잡복 구성 불가능 (잡식 복식 조건을 맞추어 4인을 구성할 수 없습니다. 성비 또는 목표 게임수를 조절해주세요)",
          freeCount_negative: "• 특별/남복/혼복/잡복 조건 초과 (설정된 게임 수의 합이 총 경기 수(라운드×코트)보다 많음)",
          free_avail_lt_4: "• 대기 인원 부족 (남은 경기를 채울 대기 참가자가 4명 미만임. 참가자를 추가하거나 목표 게임수를 넓혀주세요)",
          free_pick_null: "• 성비 불균형 (남녀 참가자 비율 또는 특정 성별의 목표 게임수가 한쪽으로 너무 치우침)",
          leftover_need: "• 목표 게임수 불일치 (참가자들의 목표 게임수 합계가 '라운드 × 코트 × 4'와 완벽히 맞물리지 않음)",
          partition_round_fail: "• 라운드 중복 배정 한계 (특정 인원의 목표 게임수가 라운드 수보다 많거나 한 라운드에 동시 출전이 강제되어 분할 실패)"
        };

        const reasonsText = Object.entries(failReasons)
          .map(([k, v]) => {
            const desc = KoreanReasons[k] || k;
            return `${desc}`;
          })
          .join('\n');

        setWarnMsg(`조건을 만족하는 대진표를 찾지 못했습니다. 아래 추천 해결 조건을 참고하여 설정을 조정해보세요.\n\n[주요 실패 원인 분석]\n${reasonsText}\n\n💡 [추천 해결 가이드]\n1. '목표 게임수 자동 균등배분' 버튼을 눌러 참가자들의 목표 게임수 합계와 필요 게임수를 일치시켜 보세요.\n2. 특정 인원의 '목표 게임수'가 전체 '라운드 수'보다 크지 않도록 조절하세요. (한 사람이 같은 라운드에 두 번 뛸 수는 없습니다.)\n3. 여성 회원 수가 적다면 '혼복 게임 수'를 줄이거나 없애서 대진 조건을 완화해 보세요.`);
        return;
      }
      onScheduleGenerated(result.scheduleRounds, { dupCount: result.dupCount, ntrpDiffSum: result.ntrpDiffSum });
      onGoto('bracket');
    }, 50);
  };

  // 빈 대진표 직접 만들기
  const createManual = () => {
    if (!confirm('빈 대진표를 만들겠습니까? 기존 대진표와 점수는 초기화됩니다.')) return;
    const sched = [];
    for (let r = 0; r < rounds; r++) {
      const round = [];
      for (let c = 0; c < courts; c++) round.push(makeEmptyMatch());
      sched.push(round);
    }
    onScheduleManual(sched);
    onGoto('bracket');
  };

  const availableToAdd = members
    .filter(m => !isParticipant(m.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  const sumMatches = (mensDoublesCount || 0) + (womensDoublesCount || 0) + (mixedCount || 0) + (jointCount || 0);
  const requiredMatches = rounds * doublesPerRound;
  const isMatchSumOk = sumMatches <= requiredMatches;

  return (
    <div>
      {/* 1단계: 경기 일시 및 시간 설정 */}
      <div className={`card ${styles.section}`} style={{ overflow: 'hidden', maxWidth: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <h2 className={styles.sectionTitle} style={{ margin: 0, paddingBottom: 0, borderBottom: 'none' }}>1단계: 경기 일시 및 시간 설정</h2>
          {matchedEvent && (
            <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb', fontWeight: 'bold' }}>
              🗓️ 정기모임 투표 연동 ({matchedEvent.startTime || '19:00'} ~ {matchedEvent.endTime || '22:00'})
            </span>
          )}
        </div>
        
        <div className={styles.step1DateTimeContainer} style={{ maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
          <div className={styles.step1InputsGrid}>
            <div className={`${styles.step1FormGroup} ${styles.step1DateCol}`}>
              <label className={styles.step1Label}>
                <span>📅</span> 경기 날짜
              </label>
              <input
                className={styles.step1Input}
                type="date"
                value={matchDate}
                onChange={e => setMatchDate(e.target.value)}
              />
            </div>
            <div className={styles.step1FormGroup}>
              <label className={styles.step1Label}>
                <span>⏰</span> 시작 시간
              </label>
              <input
                className={styles.step1Input}
                type="time"
                value={startTime || '09:00'}
                onChange={e => handleStartTimeChange(e.target.value)}
                style={{ textAlign: 'center' }}
              />
            </div>
            <div className={styles.step1FormGroup}>
              <label className={styles.step1Label}>
                <span>🏁</span> 종료 시간
              </label>
              <input
                className={styles.step1Input}
                type="time"
                value={endTime || '12:00'}
                onChange={e => handleEndTimeChange(e.target.value)}
                style={{ textAlign: 'center' }}
              />
            </div>
          </div>
          
          <div className={styles.step1DurationRow}>
            <div className={styles.step1DurationBadge}>
              <span>⏱️</span>
              <span>총 <strong>{durationInfo.text}</strong></span>
            </div>
            
            {/* 시간 빠른 프리셋 버튼 */}
            <div className={styles.step1PresetGroup}>
              {[
                { label: '2시간', h: 2, m: 0 },
                { label: '2.5시간', h: 2, m: 30 },
                { label: '3시간', h: 3, m: 0 },
                { label: '4시간', h: 4, m: 0 }
              ].map(preset => {
                const isActive = preset.h === durationInfo.hours && preset.m === durationInfo.mins;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    className={isActive ? styles.step1PresetBtnActive : styles.step1PresetBtn}
                    onClick={() => applyDurationPreset(preset.h, preset.m)}
                    title={`시작 시간(${startTime || '09:00'}) 기준 ${preset.label} 경기`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 2단계: 참가자 선택 */}
      <div className={`card ${styles.section}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h2 className={styles.sectionTitle} style={{ margin: 0, paddingBottom: 0, borderBottom: 'none' }}>2단계: 참가자 선택</h2>
            {participants.length > 0 && (
              <span style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '12px', backgroundColor: 'var(--bg)', border: '1px solid var(--border)', fontWeight: '700' }}>
                👥 총 {participants.length}명 <span style={{ color: '#2563eb' }}>(남 {maleCount}명)</span> · <span style={{ color: '#9333ea' }}>(여 {femaleCount}명)</span>
              </span>
            )}
          </div>
          <button 
            className="btn btn-primary btn-sm" 
            onClick={loadFromVote}
            disabled={!matchedEvent}
            type="button"
          >
            🗓️ 참석 투표 불러오기 {matchedEvent ? `(참석 ${Object.values(matchedEvent.attendees || {}).filter(v => v === 'Y').length}명)` : '(투표 없음)'}
          </button>
        </div>

        {recNotice && (
          <div style={{ marginBottom: '12px', padding: '8px 12px', borderRadius: '6px', backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#16a34a', fontSize: '13px', fontWeight: '700' }}>
            {recNotice}
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '10px', border: '1px solid var(--border)', borderRadius: '6px', maxHeight: '150px', overflowY: 'auto', background: 'var(--bg)' }}>
            {availableToAdd.length === 0 ? <span className="text-muted" style={{ fontSize: 13 }}>추가할 회원이 없습니다.</span> : availableToAdd.map(m => (
              <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', background: 'var(--bg-card)', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border)', fontSize: 14 }}>
                <input type="checkbox" checked={selectedToAdd.includes(m.id)} onChange={e => toggleSelectToAdd(m.id, e.target.checked)} />
                {m.name}
                <span style={{ fontSize: '10px', color: m.gender === 'F' ? '#9333ea' : '#2563eb', fontWeight: 'bold' }}>
                  ({m.gender === 'F' ? '여' : '남'})
                </span>
              </label>
            ))}
          </div>
          <button className="btn btn-secondary btn-sm" type="button" onClick={addSelectedParticipants} style={{ marginTop: '8px' }}>
            + 선택한 인원 참가자로 추가
          </button>
        </div>
        
        {/* 게스트 추가 폼 */}
        <div style={{ marginBottom: 12 }}>
          {!showGuestForm ? (
            <button className="btn btn-secondary btn-sm" type="button" onClick={() => setShowGuestForm(true)}>
              👤 게스트 추가
            </button>
          ) : (
            <form onSubmit={handleAddGuest} style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'var(--bg)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <input className="input input-sm" placeholder="게스트 이름" value={guestForm.name} onChange={e => setGuestForm(prev => ({ ...prev, name: e.target.value }))} style={{ width: 100 }} required />
              <select className="input input-sm" value={guestForm.gender} onChange={e => setGuestForm(prev => ({ ...prev, gender: e.target.value }))} style={{ width: 60 }}>
                <option value="M">남</option>
                <option value="F">여</option>
              </select>
              <select className="input input-sm" value={guestForm.ntrp} onChange={e => setGuestForm(prev => ({ ...prev, ntrp: parseFloat(e.target.value) }))} style={{ width: 60 }}>
                {[1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0].map(v => <option key={v} value={v}>{v.toFixed(1)}</option>)}
              </select>
              <button className="btn btn-primary btn-sm" type="submit">추가</button>
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => setShowGuestForm(false)}>취소</button>
            </form>
          )}
        </div>

        <div className={styles.toolbar} style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '12px' }}>
          <button className="btn btn-secondary btn-sm" onClick={addAll}>회원 전체 추가</button>
          <button className="btn btn-secondary btn-sm" onClick={clearAll}>참가자 전체 제외</button>
        </div>
      </div>

      {/* 3단계: 경기 세부 설정 */}
      <div className={`card ${styles.section}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <h2 className={styles.sectionTitle} style={{ margin: 0, paddingBottom: 0, borderBottom: 'none' }}>3단계: 경기 세부 설정</h2>
          {participants.length > 0 && (
            <button 
              type="button" 
              className="btn btn-secondary btn-sm"
              onClick={() => applyRecommendation()}
              title="경기 시간과 참가자 성별 분포에 맞춰 추천 설정을 다시 적용합니다"
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              🔄 추천 설정 다시 적용
            </button>
          )}
        </div>

        {/* 추천 안내 카드 */}
        {participants.length > 0 && (
          <div style={{ 
            padding: '12px 14px', 
            borderRadius: '8px', 
            backgroundColor: 'rgba(59, 130, 246, 0.08)', 
            border: '1px solid rgba(59, 130, 246, 0.25)', 
            marginBottom: '16px',
            fontSize: '13px'
          }}>
            <div style={{ fontWeight: '800', color: '#1d4ed8', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>💡 경기시간({durationInfo.text}) & 참가자(남 {maleCount}명, 여 {femaleCount}명) 맞춤 추천 세팅</span>
              <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '4px', backgroundColor: '#2563eb', color: '#fff', fontWeight: 800 }}>자동 세팅됨</span>
            </div>
            <div style={{ color: 'var(--txt)', lineHeight: '1.45' }}>
              {recExplanation || `경기시간(${durationInfo.diff}분)에 맞춘 추천 라운드수(${rounds}R)와 성별 참가 인원에 적합한 게임 수가 세팅되었습니다.`}
            </div>
          </div>
        )}

        <div className={styles.settingsRow}>
          <div className="form-group">
            <label className="form-label">라운드 수</label>
            <select className="input input-sm" value={rounds} onChange={e => {
              const newR = parseInt(e.target.value) || 1;
              setRounds(newR);
              if (participants.length > 0) {
                setParticipants(computeBalancedParticipants(participants, newR, courts, allowSingles));
              }
            }} style={{ width: 90 }}>
              {numOptions(1, 20)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">코트 수</label>
            <select className="input input-sm" value={courts} onChange={e => {
              const newC = parseInt(e.target.value) || 1;
              setCourts(newC);
              if (participants.length > 0) {
                applyRecommendation(participants, startTime, endTime, newC);
              }
            }} style={{ width: 90 }}>
              {numOptions(1, 10)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">남복 게임 수</label>
            <select className="input input-sm" value={mensDoublesCount} onChange={e => setMensDoublesCount(parseInt(e.target.value) || 0)} style={{ width: 90 }}>
              {numOptions(0, 20)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">여복 게임 수</label>
            <select className="input input-sm" value={womensDoublesCount} onChange={e => setWomensDoublesCount(parseInt(e.target.value) || 0)} style={{ width: 90 }}>
              {numOptions(0, 20)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">혼복 게임 수</label>
            <select className="input input-sm" value={mixedCount} onChange={e => setMixedCount(parseInt(e.target.value) || 0)} style={{ width: 90 }}>
              {numOptions(0, 20)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">잡복 게임 수</label>
            <select className="input input-sm" value={jointCount} onChange={e => setJointCount(parseInt(e.target.value) || 0)} style={{ width: 90 }}>
              {numOptions(0, 20)}
            </select>
          </div>
          {participants.length > 0 && participants.length < courts * 4 && (
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', height: '32px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: 13, fontWeight: 'bold' }}>
                <input type="checkbox" checked={allowSingles} onChange={e => setAllowSingles(e.target.checked)} />
                단식 혼합 허용
              </label>
            </div>
          )}
        </div>

        <div style={{ marginTop: 12, fontSize: 13, color: isMatchSumOk ? 'var(--primary)' : 'var(--danger)', fontWeight: 'bold' }}>
          {isMatchSumOk 
            ? (sumMatches < requiredMatches ? `✓ 세부 게임(${sumMatches}) 외 남은 복식 경기(${requiredMatches - sumMatches})는 성별 무관(잡복)으로 자동 배정됩니다.` : '✓ 세부 게임 수 합계가 총 복식 경기 수와 일치합니다.')
            : `✗ 남복(${mensDoublesCount || 0}) + 여복(${womensDoublesCount || 0}) + 혼복(${mixedCount || 0}) + 잡복(${jointCount || 0}) 합계(${sumMatches})가 총 복식 경기 수(${requiredMatches} = 라운드×복식코트)보다 클 수 없습니다.`}
        </div>
        {isSinglesActive && (
          <div style={{ marginTop: 6, fontSize: 13, color: 'var(--primary)', fontWeight: 'bold' }}>
            🎾 참가자 부족으로 라운드 당 단식 {singlesPerRound}경기, 복식 {doublesPerRound}경기가 진행됩니다.
          </div>
        )}

        {/* 벌칙금 여부 설정 */}
        <div style={{
          marginTop: '16px',
          padding: '12px 16px',
          borderRadius: '8px',
          backgroundColor: usePenalty ? 'rgba(225, 29, 72, 0.05)' : 'var(--bg)',
          border: `1px solid ${usePenalty ? 'rgba(225, 29, 72, 0.3)' : 'var(--border)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0, fontWeight: 700, fontSize: '13.5px', color: 'var(--txt)' }}>
            <input 
              type="checkbox" 
              checked={!!usePenalty} 
              onChange={e => setUsePenalty && setUsePenalty(e.target.checked)} 
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            💸 경기 패배 벌칙금(진팀 벌금) 정산 적용
          </label>
          <span style={{ fontSize: '12px', color: usePenalty ? '#e11d48' : 'var(--txt3)', fontWeight: 600 }}>
            {usePenalty 
              ? '✓ 체크됨: 대진표 화면에 패배 벌칙금 정산소가 활성화됩니다.' 
              : '✓ 체크 해제됨: 벌칙금 정산소 대신 선수별 경기 진행/완료 현황이 표시됩니다.'}
          </span>
        </div>
      </div>

      {/* 4단계: 참가자 목표 게임수 설정 및 균등 배분 */}
      <div className={`card ${styles.section}`}>
        <h2 className={styles.sectionTitle}>4단계: 참가자 목표 게임수 설정 및 균등 배분</h2>
        <div className="table-wrap" style={{ marginTop: 10 }}>
          <table>
            <thead><tr><th>이름</th><th>성별</th><th>NTRP</th><th>목표 게임수</th><th></th></tr></thead>
            <tbody>
              {entries.map(p => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td><span className={`badge ${p.gender === 'F' ? 'badge-purple' : 'badge-blue'}`}>{p.gender === 'F' ? '여' : '남'}</span></td>
                  <td>{p.ntrp.toFixed(1)}</td>
                  <td>
                    <select className="input input-sm" value={p.target} style={{ width: 60 }}
                      onChange={e => updateTarget(p.id, e.target.value)}>
                      {numOptions(0, 20)}
                    </select>
                  </td>
                  <td><button className="btn btn-danger btn-sm" onClick={() => removeParticipant(p.id)}>제외</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.toolbar} style={{ marginTop: 12 }}>
          <button className="btn btn-primary btn-sm" onClick={autoBalance}>
            ⚖️ 목표 게임수 자동 균등배분
          </button>
        </div>
        <div className={`${styles.balanceRow} ${isBalanced ? styles.ok : styles.bad}`} style={{ marginTop: 12 }}>
          참가자 <strong>{participants.length}명</strong> · 목표 합계: <strong>{targetSum}</strong> / 필요 슬롯: <strong>{totalSlots}</strong>
          {isBalanced ? ' ✓ 일치' : ' ✗ 불일치 (균등배분을 실행하거나 숫자를 직접 맞추어 주세요)'}
        </div>
      </div>

      {/* 특별 조건 */}
      <div className={`card ${styles.section}`}>
        <h2 className={styles.sectionTitle}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={enableConditions} onChange={e => setEnableConditions(e.target.checked)} />
            특별 조건 적용
          </label>
          <span className={styles.sectionNote}>(체크 시 자동 생성에 반영)</span>
        </h2>
        <p className="text-muted" style={{ fontSize: 13, marginBottom: 12 }}>특정 4명이 함께 뛰는 게임 (같은 4명, 페어만 다르게 구성)</p>
        {entries.length >= 4 && (
          <form className={styles.addRow} onSubmit={addGroup}>
            {['g1', 'g2', 'g3', 'g4'].map(n => (
              <select key={n} name={n} className="select input-sm" style={{ flex: 1, minWidth: 90 }}>
                {entries.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            ))}
            <span style={{ fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>게임수:</span>
            <select name="gCount" className="input input-sm" defaultValue={2} style={{ width: 55 }}>
              {numOptions(1, 10)}
            </select>
            <button className="btn btn-secondary btn-sm" type="submit">추가</button>
          </form>
        )}
        {groups.length > 0 && (
          <div className={styles.groupList}>
            {groups.map(g => {
              const names = g.memberIds.map(id => members.find(m => m.id === id)?.name ?? '(삭제됨)').join(', ');
              return (
                <div key={g.id} className={styles.groupItem}>
                  <span>{names} — <strong>{g.count}게임</strong></span>
                  <button className="btn btn-danger btn-sm" onClick={() => removeGroup(g.id)}>삭제</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 생성 버튼 */}
      <div className={`card ${styles.section}`}>
        <h2 className={styles.sectionTitle}>대진표 만들기</h2>
        <div className={styles.genRow}>
          <button className="btn btn-primary btn-lg" onClick={runGeneration}
            disabled={!isBalanced || !isMatchSumOk || generating}>
            {generating ? <><span className="spinner" /> 생성 중...</> : '🎾 자동으로 대진표 생성'}
          </button>
          <button className="btn btn-secondary" onClick={createManual}>빈 대진표 직접 만들기</button>
          <button className="btn btn-secondary" onClick={onSaveAndExit}>💾 저장 후 목록으로</button>
          {status && <span className="text-muted" style={{ fontSize: 13 }}>{status}</span>}
        </div>
        {warnMsg && (
          <div className="alert alert-warn" style={{ marginTop: 12, whiteSpace: 'pre-line' }}>⚠️ {warnMsg}</div>
        )}
      </div>
    </div>
  );
}

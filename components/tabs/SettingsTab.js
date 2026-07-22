// components/tabs/SettingsTab.js — 오늘 참가자 선택 + 라운드/코트 + 특별조건 + 대진표 생성
'use client';
import { useState } from 'react';
import { generateSchedule, makeEmptyMatch } from '@/lib/scheduler';
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
  mixedCount, setMixedCount,
  jointCount, setJointCount,
  startTime, setStartTime, endTime, setEndTime,
  groups, setGroups,
  onScheduleGenerated, onScheduleManual, onSave, onSaveAndExit, onGoto,
}) {
  const [status, setStatus] = useState('');
  const [warnMsg, setWarnMsg] = useState('');
  const [generating, setGenerating] = useState(false);
  const [enableConditions, setEnableConditions] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState([]);

  // 참가자로 포함 여부
  const isParticipant = id => participants.some(pt => pt.playerId === id);

  const addParticipant = id => {
    if (!id || isParticipant(id)) return;
    setParticipants(prev => [...prev, { playerId: id, target: 0 }]);
  };
  const removeParticipant = id => setParticipants(prev => prev.filter(pt => pt.playerId !== id));
  const addAll = () => {
    const newPts = members.filter(m => !isParticipant(m.id)).map(m => ({ playerId: m.id, target: 0 }));
    setParticipants(prev => [...prev, ...newPts]);
  };
  const clearAll = () => {
    if (!confirm('참가자 전체를 제외할까요?')) return;
    setParticipants([]);
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
    
    if (confirm(`투표에서 참석으로 표시된 ${attendingIds.length}명을 불러오시겠습니까?\n(기존 참가자 목록은 교체됩니다.)`)) {
      const newPts = attendingIds.map(id => ({ playerId: id, target: 0 }));
      setParticipants(newPts);
      if (matchedEvent.startTime) setStartTime(matchedEvent.startTime);
      if (matchedEvent.endTime) setEndTime(matchedEvent.endTime);
    }
  };

  const toggleSelectToAdd = (id, isChecked) => {
    setSelectedToAdd(prev => isChecked ? [...prev, id] : prev.filter(x => x !== id));
  };
  const addSelectedParticipants = () => {
    if (selectedToAdd.length === 0) return;
    const newPts = selectedToAdd.map(id => ({ playerId: id, target: 0 }));
    setParticipants(prev => [...prev, ...newPts]);
    setSelectedToAdd([]);
  };

  const addGuest = () => {
    const name = prompt('게스트 이름을 입력하세요:', '게스트');
    if (!name) return;
    const gender = confirm('남성이면 확인(OK), 여성이면 취소(Cancel)를 누르세요.') ? 'M' : 'F';
    const ntrpStr = prompt('NTRP 점수를 입력하세요 (예: 2.0):', '2.0');
    const ntrp = parseFloat(ntrpStr) || 2.0;
    
    const guestId = 'guest_' + Date.now();
    setParticipants(prev => [...prev, { 
      playerId: guestId, 
      target: 0, 
      isGuest: true, 
      name, 
      gender, 
      ntrp 
    }]);
  };

  const updateTarget = (playerId, val) => {
    setParticipants(prev => prev.map(pt => pt.playerId === playerId ? { ...pt, target: parseInt(val) || 0 } : pt));
  };

  const autoBalance = () => {
    const total = rounds * courts * 4;
    const n = participants.length;
    if (n === 0 || total <= 0) return;
    const base = Math.floor(total / n);
    let rem = total - base * n;
    setParticipants(prev => prev.map((pt, i) => ({ ...pt, target: base + (i < rem ? 1 : 0) })));
  };

  const totalSlots = rounds * courts * 4;
  const targetSum = participants.reduce((s, pt) => s + (pt.target || 0), 0);
  const isBalanced = totalSlots === targetSum && totalSlots > 0 && participants.length >= 4;

  // 참가자 상세 (이름/성별/NTRP 포함)
  const getEntry = id => {
    const m = members.find(m => m.id === id);
    if (m) return m;
    const pt = participants.find(p => p.playerId === id);
    if (pt && pt.isGuest) return { id: pt.playerId, name: pt.name, gender: pt.gender, ntrp: pt.ntrp };
    return null;
  };
  const entries = participants.map(pt => {
    const m = getEntry(pt.playerId);
    return m ? { ...m, target: pt.target } : null;
  }).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));

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
      const opts = { groups: activeGroups, mensDoublesCount, mixedCount, jointCount, noFF: true };
      const { result, attempts, failReasons } = generateSchedule(entries, rounds, courts, opts, 2500, 3000);
      setGenerating(false);
      setStatus(`시도 ${attempts}회 완료`);
      if (!result) {
        const KoreanReasons = {
          group_need_exhausted: "• 특별 조건 멤버의 목표 게임수 부족 (특별 조건 멤버들의 '목표 게임수'가 조건에 설정된 게임수보다 작음)",
          mens_not_enough_males: "• 남성 참가자 부족 (남식 복식을 위한 남성 회원 또는 남성 회원의 잔여 목표 게임수가 부족함)",
          mixed_not_enough_females: "• 여성 참가자 부족 (혼식 복식에 배정할 여성 회원 또는 여성 회원의 잔여 목표 게임수가 부족함)",
          mixed_not_enough_males: "• 남성 참가자 부족 (혼식 복식에 배정할 남성 회원 또는 남성 회원의 잔여 목표 게임수가 부족함)",
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

  const sumMatches = (mensDoublesCount || 0) + (mixedCount || 0) + (jointCount || 0);
  const requiredMatches = rounds * courts;
  const isMatchSumOk = sumMatches <= requiredMatches;

  return (
    <div>
      {/* 1단계: 경기 날짜 설정 */}
      <div className={`card ${styles.section}`}>
        <h2 className={styles.sectionTitle}>1단계: 경기 날짜</h2>
        <div className={styles.settingsRow}>
          <div className="form-group">
            <label className="form-label">경기 날짜</label>
            <input className="input input-sm" type="date" value={matchDate}
              onChange={e => setMatchDate(e.target.value)} style={{ width: 140 }} />
          </div>
        </div>
      </div>

      {/* 2단계: 참가자 선택 */}
      <div className={`card ${styles.section}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 className={styles.sectionTitle} style={{ margin: 0 }}>2단계: 참가자 선택</h2>
          <button 
            className="btn btn-primary btn-sm" 
            onClick={loadFromVote}
            disabled={!matchedEvent}
            type="button"
          >
            🗓️ 참석 투표 불러오기 {matchedEvent ? `(참석 ${Object.values(matchedEvent.attendees || {}).filter(v => v === 'Y').length}명)` : '(투표 없음)'}
          </button>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '10px', border: '1px solid var(--border)', borderRadius: '6px', maxHeight: '150px', overflowY: 'auto', background: 'var(--bg)' }}>
            {availableToAdd.length === 0 ? <span className="text-muted" style={{ fontSize: 13 }}>추가할 회원이 없습니다.</span> : availableToAdd.map(m => (
              <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', background: 'var(--bg-card)', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border)', fontSize: 14 }}>
                <input type="checkbox" checked={selectedToAdd.includes(m.id)} onChange={e => toggleSelectToAdd(m.id, e.target.checked)} />
                {m.name}
              </label>
            ))}
          </div>
          <button className="btn btn-secondary btn-sm" type="button" onClick={addSelectedParticipants} style={{ marginTop: '8px' }}>
            + 선택한 인원 참가자로 추가
          </button>
        </div>
        <div className={styles.toolbar} style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '12px' }}>
          <button className="btn btn-secondary btn-sm" onClick={addAll}>회원 전체 추가</button>
          <button className="btn btn-secondary btn-sm" onClick={addGuest}>+ 게스트 추가</button>
          <button className="btn btn-secondary btn-sm" onClick={clearAll}>참가자 전체 제외</button>
        </div>
      </div>

      {/* 3단계: 경기 세부 설정 */}
      <div className={`card ${styles.section}`}>
        <h2 className={styles.sectionTitle}>3단계: 경기 세부 설정</h2>
        <div className={styles.settingsRow}>
          <div className="form-group">
            <label className="form-label">라운드 수</label>
            <select className="input input-sm" value={rounds} onChange={e => setRounds(parseInt(e.target.value) || 1)} style={{ width: 90 }}>
              {numOptions(1, 20)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">코트 수</label>
            <select className="input input-sm" value={courts} onChange={e => setCourts(parseInt(e.target.value) || 1)} style={{ width: 90 }}>
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
          <div className="form-group">
            <label className="form-label">시작 시간</label>
            <input className="input input-sm" type="time" value={startTime || ''}
              onChange={e => setStartTime(e.target.value)} style={{ width: 110 }} />
          </div>
          <div className="form-group">
            <label className="form-label">종료 시간</label>
            <input className="input input-sm" type="time" value={endTime || ''}
              onChange={e => setEndTime(e.target.value)} style={{ width: 110 }} />
          </div>
        </div>
        <div style={{ marginTop: 12, fontSize: 13, color: isMatchSumOk ? 'var(--primary)' : 'var(--danger)', fontWeight: 'bold' }}>
          {isMatchSumOk 
            ? (sumMatches < requiredMatches ? `✓ 세부 게임(${sumMatches}) 외 남은 ${requiredMatches - sumMatches}게임은 성별 무관(잡복)으로 자동 배정됩니다.` : '✓ 세부 게임 수 합계가 총 경기 수와 일치합니다.')
            : `✗ 남복(${mensDoublesCount || 0}) + 혼복(${mixedCount || 0}) + 잡복(${jointCount || 0}) 합계(${sumMatches})가 총 경기 수(${requiredMatches} = 라운드×코트)보다 클 수 없습니다.`}
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
          참가자 <strong>{participants.length}명</strong> · 목표 합계: <strong>{targetSum}</strong> / 필요 (라운드×코트×4): <strong>{totalSlots}</strong>
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

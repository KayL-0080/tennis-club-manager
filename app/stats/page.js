'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getMembers, getSchedules, initDefaultMembers } from '@/lib/firestore';
import { computeGlobalStandings } from '@/lib/scheduler';
import Navbar from '@/components/Navbar';
import styles from '../dashboard/dashboard.module.css';

export default function StatsPage() {
  const { loading, currentClubId } = useAuth();
  const router = useRouter();
  
  const [fetching, setFetching] = useState(true);
  const [members, setMembers] = useState([]);
  const [schedules, setSchedules] = useState([]);

  // Filter states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (!currentClubId) return;
    (async () => {
      try {
        setFetching(true);
        await initDefaultMembers(currentClubId);
        const mbrs = await getMembers(currentClubId);
        const scheds = await getSchedules(currentClubId);
        setMembers(mbrs);
        setSchedules(scheds);
      } catch (err) {
        console.error('Failed to load stats data:', err);
        alert('데이터를 불러오지 못했습니다. Firestore 권한 설정을 확인해주세요.');
      } finally {
        setFetching(false);
      }
    })();
  }, [currentClubId]);

  useEffect(() => {
    if (!loading && !fetching && !currentClubId) {
      router.replace('/');
    }
  }, [loading, fetching, currentClubId, router]);

  const globalStandings = useMemo(() => {
    if (!members.length) return [];
    return computeGlobalStandings(schedules, members, startDate, endDate);
  }, [schedules, members, startDate, endDate]);

  if (!currentClubId) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="spinner" />
      </div>
    );
  }

  if (fetching) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="spinner" />
      </div>
    );
  }

  const top3 = globalStandings.slice(0, 3);

  return (
    <div className={styles.page}>
      <Navbar />
      <main className={styles.main}>
        <div className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className={styles.title}>📊 통계 대시보드</h1>
            <p className={styles.sub}>조회 기간 동안의 클럽 순위와 참여 횟수를 확인하세요</p>
          </div>
        </div>

        {/* 필터 영역 */}
        <div className="card" style={{ marginBottom: '24px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: '14px', color: 'var(--text)' }}>📅 조회 기간</strong>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input 
              className="input input-sm" 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)} 
              style={{ width: '130px' }} 
            />
            <span style={{ color: 'var(--text-muted)' }}>~</span>
            <input 
              className="input input-sm" 
              type="date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)} 
              style={{ width: '130px' }} 
            />
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => { setStartDate(''); setEndDate(''); }}>전체 기간</button>
            <button className="btn btn-secondary btn-sm" onClick={() => {
              const now = new Date();
              const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-CA');
              const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toLocaleDateString('en-CA');
              setStartDate(firstDay);
              setEndDate(lastDay);
            }}>이번 달</button>
            <button className="btn btn-secondary btn-sm" onClick={() => {
              const now = new Date();
              const quarter = Math.floor(now.getMonth() / 3);
              const firstDay = new Date(now.getFullYear(), quarter * 3, 1).toLocaleDateString('en-CA');
              const lastDay = new Date(now.getFullYear(), quarter * 3 + 3, 0).toLocaleDateString('en-CA');
              setStartDate(firstDay);
              setEndDate(lastDay);
            }}>이번 분기</button>
            <button className="btn btn-secondary btn-sm" onClick={() => {
              const now = new Date();
              const half = Math.floor(now.getMonth() / 6);
              const firstDay = new Date(now.getFullYear(), half * 6, 1).toLocaleDateString('en-CA');
              const lastDay = new Date(now.getFullYear(), half * 6 + 6, 0).toLocaleDateString('en-CA');
              setStartDate(firstDay);
              setEndDate(lastDay);
            }}>이번 반기</button>
          </div>
        </div>

        {/* Top 3 영역 */}
        {top3.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', color: 'var(--navy)' }}>🏆 해당 기간 Top 3</h2>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {top3.map((s, idx) => (
                <div key={s.id} className="card" style={{ flex: '1 1 200px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ fontSize: '28px', width: '36px', textAlign: 'center' }}>
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 4px 0' }}>{s.name}</h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                      {s.win}승 {s.draw}무 {s.loss}패 (득실 {s.diff > 0 ? `+${s.diff}` : s.diff})
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 전체 누적 순위표 */}
        <div className="card">
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', color: 'var(--navy)' }}>전체 순위 및 참여 현황</h2>
          {globalStandings.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>해당 기간에 기록된 데이터가 없습니다.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 50 }}>순위</th>
                    <th>이름</th>
                    <th>참여 일수</th>
                    <th>경기수</th>
                    <th>승률</th>
                    <th>승</th>
                    <th>무</th>
                    <th>패</th>
                    <th>득실차</th>
                  </tr>
                </thead>
                <tbody>
                  {globalStandings.map((s, i) => (
                    <tr key={s.id}>
                      <td><strong>{i + 1}</strong></td>
                      <td>
                        {s.name} <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({s.gender === 'F' ? '여' : '남'})</span>
                      </td>
                      <td><strong>{s.attendedDays}</strong>일</td>
                      <td>{s.played}</td>
                      <td>{s.played > 0 ? Math.round(s.winRate * 100) : 0}%</td>
                      <td><span style={{ color: 'var(--primary)' }}>{s.win}</span></td>
                      <td><span style={{ color: '#888' }}>{s.draw}</span></td>
                      <td><span style={{ color: '#e53e3e' }}>{s.loss}</span></td>
                      <td><strong style={{ color: s.diff > 0 ? 'var(--primary)' : s.diff < 0 ? '#e53e3e' : 'inherit' }}>{s.diff > 0 ? `+${s.diff}` : s.diff}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}

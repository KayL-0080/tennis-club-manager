'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getTournament, updateTournament, getMembers } from '@/lib/firestore';
import Navbar from '@/components/Navbar';
import styles from '../../dashboard/dashboard.module.css';

import DraftPhase from './DraftPhase';
import PickingPhase from './PickingPhase';
import PlayingPhase from './PlayingPhase';
import CompletedPhase from './CompletedPhase';

export default function TournamentDetailPage() {
  const { user, isAdmin } = useAuth();
  const router = useRouter();
  const { id } = useParams();
  
  const [tournament, setTournament] = useState(null);
  const [members, setMembers] = useState([]);
  const [fetching, setFetching] = useState(true);

  const loadData = async () => {
    try {
      const [tData, mList] = await Promise.all([
        getTournament('shared', id),
        getMembers('shared')
      ]);
      if (!tData) {
        alert('대회를 찾을 수 없습니다.');
        router.replace('/tournaments');
        return;
      }
      setTournament(tData);
      setMembers(mList);
    } catch (e) {
      console.error(e);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleUpdate = async (updates) => {
    await updateTournament('shared', id, updates);
    setTournament(prev => ({ ...prev, ...updates }));
  };

  if (fetching) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="spinner" />
      </div>
    );
  }
  if (!tournament) return null;

  return (
    <div className={styles.page}>
      <Navbar />
      <main className={styles.main}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>🏆 {tournament.title}</h1>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                <span className="hero-chip" style={{ fontSize: '11px', padding: '3px 10px' }}>
                  📅 {tournament.date} {tournament.time && `⏰ ${tournament.time}`}
                </span>
                <span className="hero-chip" style={{ fontSize: '11px', padding: '3px 10px' }}>
                  🎾 {tournament.courtDetails ? tournament.courtDetails.map(c => c.name).join(', ') : `${tournament.courts}코트`}
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                <span className={tournament.type === 'team' ? 'badge badge-blue' : tournament.type === 'fixed_pair' ? 'badge badge-green' : 'badge badge-purple'}>
                  {tournament.type === 'team' ? '👥 팀전' : tournament.type === 'fixed_pair' ? '👫 개인전(고정페어)' : '👤 개인전(순환)'}
                </span>
                <span className={
                  tournament.status === 'draft' ? 'badge badge-gold' :
                  tournament.status === 'picking' ? 'badge badge-blue' :
                  tournament.status === 'playing' ? 'badge badge-green' : 'badge'
                } style={tournament.status === 'completed' ? { background: '#f1f5f9', color: '#475569' } : {}}>
                  {tournament.type === 'team' ? (
                    tournament.status === 'draft' ? '📝 1~2단계. 일정/참석자 및 코트 설정' :
                    tournament.status === 'picking' ? '🤝 3단계. 팀원 배정 및 라인업 구성' :
                    tournament.status === 'playing' ? '🎾 4단계. 실시간 순위 및 경기 진행' : '✅ 5단계. 대회 종료'
                  ) : tournament.type === 'fixed_pair' ? (
                    tournament.status === 'draft' ? '📝 1~2단계. 페어 매칭 및 코트/경기수 설정' :
                    tournament.status === 'playing' ? '🎾 4단계. 페어별 실시간 대진표 및 경기 진행' : '✅ 5단계. 대회 종료'
                  ) : (
                    tournament.status === 'draft' ? '📝 1~2단계. 일정/참석자 및 코트/경기수 설정' :
                    tournament.status === 'playing' ? '🎾 4단계. 실시간 대진표 및 경기 진행' : '✅ 5단계. 대회 종료'
                  )}
                </span>
              </div>
            </div>
          </div>
          <button className="btn btn-secondary" onClick={() => router.push('/tournaments')}>목록으로</button>
        </div>

        {tournament.status === 'draft' && (
          isAdmin ? (
            <DraftPhase tournament={tournament} members={members} onUpdate={handleUpdate} isAdmin={isAdmin} />
          ) : (
            <div className="card" style={{ padding: '40px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📝</div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--txt)', marginBottom: '8px' }}>
                대회 준비 중입니다
              </h2>
              <p style={{ color: 'var(--txt2)', fontSize: '0.92rem', lineHeight: 1.6, maxWidth: '480px', margin: '0 auto' }}>
                현재 운영진이 참가자 명단 및 환경 설정을 진행하고 있습니다.<br />
                조 편성 및 선수 구성(3단계)이 완료되면 <strong>4단계 실시간 대진표와 순위</strong>를 확인하실 수 있습니다.
              </p>
            </div>
          )
        )}
        {tournament.status === 'picking' && (
          isAdmin ? (
            <PickingPhase tournament={tournament} members={members} onUpdate={handleUpdate} isAdmin={isAdmin} />
          ) : (
            <div className="card" style={{ padding: '40px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🤝</div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--txt)', marginBottom: '8px' }}>
                조 편성 및 팀원 배정 진행 중입니다
              </h2>
              <p style={{ color: 'var(--txt2)', fontSize: '0.92rem', lineHeight: 1.6, maxWidth: '480px', margin: '0 auto' }}>
                현재 운영진이 팀원 배정 및 출전 명단을 구성하고 있습니다.<br />
                3단계 구성이 완료되면 <strong>4단계 실시간 대진표 및 실시간 순위</strong>가 자동으로 공개됩니다.
              </p>
            </div>
          )
        )}
        {tournament.status === 'playing' && (
          <PlayingPhase tournament={tournament} members={members} onUpdate={handleUpdate} isAdmin={isAdmin} />
        )}
        {tournament.status === 'completed' && (
          <CompletedPhase tournament={tournament} members={members} onUpdate={handleUpdate} isAdmin={isAdmin} />
        )}
      </main>
    </div>
  );
}

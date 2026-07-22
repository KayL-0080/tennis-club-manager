'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  getMembers, addMember, updateMember, deleteMember, initDefaultMembers,
  getPendingJoinRequestsByClub, updateJoinRequestStatus
} from '@/lib/firestore';
import Navbar from '@/components/Navbar';
import MembersTab from '@/components/tabs/MembersTab';
import styles from '../editor/[id]/editor.module.css';

export default function MembersPage() {
  const { isAdmin, currentClubId, loading } = useAuth();
  const router = useRouter();
  const [members, setMembers] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !fetching && !currentClubId) {
      router.replace('/');
    }
  }, [loading, fetching, currentClubId, router]);

  useEffect(() => {
    if (!currentClubId) return;
    const loadData = async () => {
      try {
        if (isAdmin) {
          try {
            await initDefaultMembers(currentClubId);
          } catch (e) {
            console.warn('initDefaultMembers failed', e);
          }
        }
        try {
          const mbrs = await getMembers(currentClubId);
          setMembers(mbrs);
        } catch(e) {
          console.warn('getMembers failed', e);
        }

        if (isAdmin) {
          try {
            const reqs = await getPendingJoinRequestsByClub(currentClubId);
            setPendingRequests(reqs);
          } catch (e) {
            console.warn('getPendingJoinRequestsByClub failed', e);
          }
        }
      } catch (err) {
        console.error('Failed to load members data:', err);
      } finally {
        setFetching(false);
      }
    };
    loadData();
  }, [currentClubId, isAdmin]);

  const handleLocalUpdateMember = (memberId, data) => {
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, ...data } : m));
  };

  const handleSaveMember = async (memberId, data) => {
    if (!isAdmin || !currentClubId) return;
    await updateMember(currentClubId, memberId, data);
  };

  const handleAddMember = async () => {
    if (!isAdmin || !currentClubId) return;
    const newMember = { name: `회원${members.length + 1}`, role: '정회원', gender: 'M', ntrp: 2.0 };
    const fid = await addMember(currentClubId, newMember);
    setMembers(prev => [...prev, { id: fid, ...newMember }]);
  };

  const handleDeleteMember = async (memberId) => {
    if (!isAdmin || !currentClubId) return;
    if (!confirm('이 회원을 삭제할까요?')) return;
    await deleteMember(currentClubId, memberId);
    setMembers(prev => prev.filter(m => m.id !== memberId));
  };

  const handleApproveRequest = async (req) => {
    if (!isAdmin || !currentClubId) return;
    if (!confirm(`'${req.userName}'님의 가입을 승인하시겠습니까?`)) return;
    try {
      await updateJoinRequestStatus(req.id, 'approved');
      const newMember = { 
        name: req.userName, 
        email: req.userEmail, 
        role: '정회원', 
        gender: 'M', 
        ntrp: 2.0 
      };
      const fid = await addMember(currentClubId, newMember);
      setMembers(prev => [...prev, { id: fid, ...newMember }]);
      setPendingRequests(prev => prev.filter(r => r.id !== req.id));
      alert('승인되었습니다. 회원 목록에 추가되었습니다.');
    } catch (e) {
      console.error(e);
      alert('승인 처리 중 오류가 발생했습니다.');
    }
  };

  const handleRejectRequest = async (req) => {
    if (!isAdmin || !currentClubId) return;
    if (!confirm(`'${req.userName}'님의 가입을 거절하시겠습니까?`)) return;
    try {
      await updateJoinRequestStatus(req.id, 'rejected');
      setPendingRequests(prev => prev.filter(r => r.id !== req.id));
    } catch (e) {
      console.error(e);
      alert('거절 처리 중 오류가 발생했습니다.');
    }
  };

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

  const totalCount = members.length;
  const maleCount = members.filter(m => m.gender === 'M').length;
  const femaleCount = members.filter(m => m.gender === 'F').length;

  return (
    <div className={styles.page}>
      <Navbar />
      <main className={styles.main}>
        <div className={`${styles.editorHeader} no-print`}>
          <div className={styles.titleRow}>
            <button className="btn btn-secondary btn-sm" onClick={() => router.push('/dashboard')}>← 목록</button>
            <h2 style={{ margin: 0, fontSize: '1.2rem', paddingLeft: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              👥 회원 관리
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                (총 {totalCount}명, 남 {maleCount}명, 여 {femaleCount}명)
              </span>
            </h2>
          </div>
        </div>
        <div style={{ marginTop: '1rem' }}>
          {isAdmin && pendingRequests.length > 0 && (
            <div style={{ marginBottom: '24px', padding: '16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', color: '#1a3d7c' }}>
                🔔 가입 대기 ({pendingRequests.length}명)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {pendingRequests.map(req => (
                  <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{req.userName}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{req.userEmail}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleRejectRequest(req)}>거절</button>
                      <button className="btn btn-primary btn-sm" onClick={() => handleApproveRequest(req)}>승인</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <MembersTab
            members={members}
            onUpdateLocal={handleLocalUpdateMember}
            onSave={handleSaveMember}
            onAdd={handleAddMember}
            onDelete={handleDeleteMember}
            isAdmin={isAdmin}
          />
        </div>
      </main>
    </div>
  );
}

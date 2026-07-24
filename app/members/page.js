'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  getMembers, addMember, updateMember, deleteMember,
  getPendingJoinRequestsByClub, updateJoinRequestStatus,
  updateClub
} from '@/lib/firestore';
import Navbar from '@/components/Navbar';
import MembersTab from '@/components/tabs/MembersTab';
import styles from '../editor/[id]/editor.module.css';

export default function MembersPage() {
  const { isAdmin, currentClubId, loading, clubs, setClubs } = useAuth();
  const router = useRouter();
  const [members, setMembers] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !fetching && !currentClubId) {
      router.replace('/');
    }
  }, [loading, fetching, currentClubId, router]);

  const currentClub = clubs.find(c => c.id === currentClubId);
  const [feeCycle, setFeeCycle] = useState('월납');
  const [feeAmount, setFeeAmount] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [accountHolder, setAccountHolder] = useState('');

  useEffect(() => {
    if (currentClub) {
      setFeeCycle(currentClub.feeCycle || '월납');
      setFeeAmount(currentClub.feeAmount || '');
      setBankAccount(currentClub.bankAccount || '');
      setAccountHolder(currentClub.accountHolder || '');
    }
  }, [currentClub]);

  const handleBulkFeeUpdate = async (status) => {
    if (!isAdmin || !currentClubId) return;
    if (!confirm(`전체 회원의 회비 납부 상태를 '${status ? '납부완료' : '미납'}'으로 일괄 변경하시겠습니까?`)) return;
    
    setMembers(prev => prev.map(m => ({ ...m, feePaid: status })));
    
    try {
      await Promise.all(members.map(m => updateMember(currentClubId, m.id, { feePaid: status })));
      alert('일괄 변경되었습니다.');
    } catch (e) {
      console.error(e);
      alert('일괄 변경 중 일부 실패가 발생했을 수 있습니다.');
    }
  };

  const handleSaveFinanceInfo = async () => {
    if (!isAdmin || !currentClubId) return;
    try {
      await updateClub(currentClubId, { feeCycle, feeAmount, bankAccount, accountHolder });
      if (setClubs) {
        setClubs(prev => prev.map(c => c.id === currentClubId ? { ...c, feeCycle, feeAmount, bankAccount, accountHolder } : c));
      }
      alert('클럽 재무 정보가 저장되었습니다.');
    } catch (e) {
      console.error(e);
      alert('재무 정보 저장에 실패했습니다.');
    }
  };

  useEffect(() => {
    if (!currentClubId) return;
    const loadData = async () => {
      try {
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

  const handleAddMember = async (memberData) => {
    if (!isAdmin || !currentClubId) return;
    const fid = await addMember(currentClubId, memberData);
    setMembers(prev => [...prev, { id: fid, ...memberData }]);
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

  const handleCopyInviteLink = () => {
    const link = `${window.location.origin}/?invite=${currentClubId}`;
    navigator.clipboard.writeText(link)
      .then(() => alert('초대 링크가 복사되었습니다. 회원들에게 공유해보세요!\n' + link))
      .catch(() => alert('복사에 실패했습니다. 다음 링크를 복사해주세요:\n' + link));
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
          <div className={styles.titleRow} style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => router.push('/dashboard')}>← 목록</button>
              <h2 style={{ margin: 0, fontSize: '1.2rem', paddingLeft: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                👥 회원 관리
                <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                  (총 {totalCount}명, 남 {maleCount}명, 여 {femaleCount}명)
                </span>
              </h2>
            </div>
            {isAdmin && (
              <button className="btn btn-primary btn-sm" onClick={handleCopyInviteLink}>
                🔗 초대 링크 복사
              </button>
            )}
          </div>
        </div>
        <div style={{ marginTop: '1rem' }}>
          {isAdmin && (
            <div style={{ marginBottom: '24px', padding: '16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1a3d7c', margin: 0 }}>💰 클럽 회비 / 계좌 설정</h3>
                <button className="btn btn-primary btn-sm" onClick={handleSaveFinanceInfo}>저장</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '15px', marginBottom: '4px', color: 'var(--text-muted)' }}>납부 주기</label>
                  <select className="select" value={feeCycle} onChange={e => setFeeCycle(e.target.value)}>
                    <option value="월납">월납</option>
                    <option value="분기납">분기납</option>
                    <option value="연납">연납</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '15px', marginBottom: '4px', color: 'var(--text-muted)' }}>회비 금액</label>
                  <input className="input" type="text" placeholder="예: 30,000" value={feeAmount} onChange={e => setFeeAmount(e.target.value)} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '15px', marginBottom: '4px', color: 'var(--text-muted)' }}>회비 통장 (은행 및 계좌번호)</label>
                  <input className="input" type="text" placeholder="예: 국민 1234-5678" value={bankAccount} onChange={e => setBankAccount(e.target.value)} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '15px', marginBottom: '4px', color: 'var(--text-muted)' }}>예금주</label>
                  <input className="input" type="text" placeholder="예: 홍길동" value={accountHolder} onChange={e => setAccountHolder(e.target.value)} />
                </div>
              </div>
            </div>
          )}

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
                      <div style={{ fontSize: '16px', color: 'var(--text-muted)' }}>{req.userEmail}</div>
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
            currentClub={currentClub}
            onBulkUpdateFeeStatus={handleBulkFeeUpdate}
          />
        </div>
      </main>
    </div>
  );
}

'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  getMembers, addMember, updateMember, deleteMember, initDefaultMembers,
  getClubSettings, updateClubSettings
} from '@/lib/firestore';
import Navbar from '@/components/Navbar';
import MembersTab from '@/components/tabs/MembersTab';
import styles from '../editor/[id]/editor.module.css';

export default function MembersPage() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const [members, setMembers] = useState([]);
  const [currentClub, setCurrentClub] = useState(null);
  const [fetching, setFetching] = useState(true);

  const [feeCycle, setFeeCycle] = useState('월납');
  const [feeAmount, setFeeAmount] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [accountHolder, setAccountHolder] = useState('');

  useEffect(() => {
    (async () => {
      try {
        await initDefaultMembers('shared');
        const [mbrs, settings] = await Promise.all([
          getMembers('shared'),
          getClubSettings()
        ]);
        setMembers(mbrs);
        
        if (settings) {
          setCurrentClub(settings);
          setFeeCycle(settings.feeCycle || '월납');
          setFeeAmount(settings.feeAmount || '');
          setBankAccount(settings.bankAccount || '');
          setAccountHolder(settings.accountHolder || '');
        } else {
          setCurrentClub({});
        }
      } catch (err) {
        console.error('Failed to load members data:', err);
        alert('데이터를 불러오지 못했습니다. Firestore 권한 설정을 확인해주세요.');
      } finally {
        setFetching(false);
      }
    })();
  }, []);

  const handleBulkFeeUpdate = async (status) => {
    if (!isAdmin) return;
    if (!confirm(`전체 회원의 회비 납부 상태를 '${status ? '납부완료' : '미납'}'으로 일괄 변경하시겠습니까?`)) return;
    
    setMembers(prev => prev.map(m => ({ ...m, feePaid: status })));
    
    try {
      await Promise.all(members.map(m => updateMember('shared', m.id, { feePaid: status })));
      alert('일괄 변경되었습니다.');
    } catch (e) {
      console.error(e);
      alert('일괄 변경 중 일부 실패가 발생했을 수 있습니다.');
    }
  };

  const handleSaveFinanceInfo = async () => {
    if (!isAdmin) return;
    try {
      const data = { feeCycle, feeAmount, bankAccount, accountHolder };
      await updateClubSettings(data);
      setCurrentClub(prev => ({ ...prev, ...data }));
      alert('클럽 재무 정보가 저장되었습니다.');
    } catch (e) {
      console.error(e);
      alert('재무 정보 저장에 실패했습니다.');
    }
  };

  const handleLocalUpdateMember = (memberId, data) => {
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, ...data } : m));
  };

  const handleSaveMember = async (memberId, data) => {
    if (!isAdmin) return;
    await updateMember('shared', memberId, data);
  };

  const handleAddMember = async (memberData) => {
    if (!isAdmin) return;
    // memberData is passed from the Add Member modal in MembersTab
    const fid = await addMember('shared', memberData);
    setMembers(prev => [...prev, { id: fid, ...memberData }]);
  };

  const handleDeleteMember = async (memberId) => {
    if (!isAdmin) return;
    if (!confirm('이 회원을 삭제할까요?')) return;
    await deleteMember('shared', memberId);
    setMembers(prev => prev.filter(m => m.id !== memberId));
  };

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
          {isAdmin && (
            <div className="card" style={{ marginBottom: '24px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--txt)', margin: 0, letterSpacing: '-0.02em' }}>💰 클럽 회비 / 계좌 설정</h3>
                <button className="btn btn-primary btn-sm" onClick={handleSaveFinanceInfo}>저장</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--txt2)' }}>납부 주기</label>
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

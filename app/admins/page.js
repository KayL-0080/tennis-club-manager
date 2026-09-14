'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getAdmins, addAdmin, deleteAdmin } from '@/lib/firestore';
import Navbar from '@/components/Navbar';

import styles from '../dashboard/dashboard.module.css';

export default function AdminsPage() {
  const { user, isSuperAdmin, loading } = useAuth();
  const router = useRouter();
  
  const [admins, setAdmins] = useState([]);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !isSuperAdmin) {
      router.replace('/');
    } else if (isSuperAdmin) {
      loadAdmins();
    }
  }, [loading, isSuperAdmin, router]);

  const loadAdmins = async () => {
    setBusy(true);
    try {
      const data = await getAdmins();
      setAdmins(data);
    } catch (e) {
      console.error(e);
      alert('목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      await addAdmin(email.trim());
      setEmail('');
      await loadAdmins();
    } catch (e) {
      console.error(e);
      alert('추가 실패');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('이 관리자 권한을 삭제하시겠습니까?')) return;
    setBusy(true);
    try {
      await deleteAdmin(id);
      await loadAdmins();
    } catch (e) {
      console.error(e);
      alert('삭제 실패');
    } finally {
      setBusy(false);
    }
  };

  if (loading || (!loading && !isSuperAdmin)) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span className="spinner" />
    </div>
  );

  return (
    <div className={styles.page}>
      <Navbar />
      <main className={styles.main} style={{ maxWidth: '680px' }}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>🛡️ 운영진 권한 관리</h1>
            <p className={styles.sub}>최고 관리자(Super Admin) 전용 클럽 운영자 권한 부여 및 관리</p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => router.push('/dashboard')}>대시보드</button>
        </div>
        
        <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 12px 0', color: 'var(--txt)' }}>
            ➕ 새 운영진 권한 추가
          </h2>
          <form onSubmit={handleAdd} style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="email" 
              className="input" 
              placeholder="추가할 운영진 이메일 주소 입력" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn btn-primary" disabled={busy}>추가하기</button>
          </form>
        </div>

        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--txt)' }}>
              👥 등록된 운영진 목록
            </h2>
            <span className="badge badge-blue" style={{ fontSize: '11px', padding: '3px 8px' }}>
              총 {admins.length}명
            </span>
          </div>

          {admins.length === 0 ? (
            <p style={{ color: 'var(--txt3)', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>
              등록된 운영진이 없습니다.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {admins.map(admin => (
                <li key={admin.id} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '12px 16px', 
                  borderRadius: '12px',
                  backgroundColor: 'rgba(0, 0, 0, 0.02)',
                  border: '1px solid var(--border)' 
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>👑</span>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{admin.email}</span>
                  </div>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(admin.id)} disabled={busy}>삭제</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}

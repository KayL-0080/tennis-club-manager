'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getAdmins, addAdmin, deleteAdmin } from '@/lib/firestore';
import Navbar from '@/components/Navbar';

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

  if (loading || (!loading && !isSuperAdmin)) return <div className="p-4">확인 중...</div>;

  return (
    <div>
      <Navbar />
      <main className="container" style={{ padding: '24px', maxWidth: '600px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>운영진 관리 (Super Admin 전용)</h1>
        
        <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
          <form onSubmit={handleAdd} style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="email" 
              className="input" 
              placeholder="추가할 운영진 이메일 주소" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn btn-primary" disabled={busy}>추가</button>
          </form>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>현재 운영진 목록</h2>
          {admins.length === 0 ? (
            <p className="text-muted">등록된 운영진이 없습니다.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {admins.map(admin => (
                <li key={admin.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderBottom: '1px solid var(--border)' }}>
                  <span>{admin.email}</span>
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

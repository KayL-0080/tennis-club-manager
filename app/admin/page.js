'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getClubs, createClub, deleteClub, getAdmins, addAdmin, deleteAdmin } from '@/lib/firestore';
import { auth } from '@/lib/firebase';
import Navbar from '@/components/Navbar';

export default function AdminDashboardPage() {
  const { user, isSuperAdmin, loading, clubs, setClubs, setCurrentClubId } = useAuth();
  const router = useRouter();
  
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState('clubs');
  
  const [newClubName, setNewClubName] = useState('');
  const [newClubDesc, setNewClubDesc] = useState('');

  const [selectedClubForAdmin, setSelectedClubForAdmin] = useState(null);
  const [clubAdmins, setClubAdmins] = useState([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');

  const [allUsers, setAllUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    if (!loading && !isSuperAdmin) {
      router.replace('/');
    }
  }, [loading, isSuperAdmin, router]);

  const loadAllUsers = async () => {
    setLoadingUsers(true);
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setAllUsers(data.users || []);
      } else {
        alert('유저 목록을 불러오지 못했습니다: ' + (data.error || '알 수 없는 오류'));
      }
    } catch (e) {
      console.error(e);
      alert(`유저 목록 로딩 중 에러 발생: ${e.message}`);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'users' && isSuperAdmin) {
      loadAllUsers();
    }
  }, [activeTab, isSuperAdmin]);

  const handleCreateClub = async (e) => {
    e.preventDefault();
    if (!newClubName.trim()) return;
    setBusy(true);
    try {
      const id = await createClub({ name: newClubName.trim(), description: newClubDesc.trim() });
      if (user && user.email) {
        await addAdmin(id, user.email);
      }
      const newClub = { id, name: newClubName.trim(), description: newClubDesc.trim() };
      setClubs(prev => [...prev, newClub]);
      setNewClubName('');
      setNewClubDesc('');
      alert('클럽이 생성되었습니다. (슈퍼관리자 권한 자동 부여됨)');
      setCurrentClubId(id);
    } catch (e) {
      console.error(e);
      alert('클럽 생성 실패: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteClub = async (id) => {
    if (!confirm('이 클럽과 관련된 모든 데이터가 고아 데이터가 될 수 있습니다. 정말 삭제하시겠습니까?')) return;
    setBusy(true);
    try {
      await deleteClub(id);
      setClubs(prev => prev.filter(c => c.id !== id));
      if (selectedClubForAdmin === id) setSelectedClubForAdmin(null);
    } catch (e) {
      console.error(e);
      alert('클럽 삭제 실패: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSelectClubForAdmin = async (clubId) => {
    setSelectedClubForAdmin(clubId);
    setBusy(true);
    try {
      const data = await getAdmins(clubId);
      setClubAdmins(data);
    } catch (e) {
      console.error(e);
      alert('운영진 목록을 불러오지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleAddAdmin = async (e) => {
    e.preventDefault();
    if (!newAdminEmail.trim() || !selectedClubForAdmin) return;
    setBusy(true);
    try {
      await addAdmin(selectedClubForAdmin, newAdminEmail.trim());
      setNewAdminEmail('');
      const data = await getAdmins(selectedClubForAdmin);
      setClubAdmins(data);
    } catch (e) {
      console.error(e);
      alert('운영진 추가 실패');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteAdmin = async (adminId) => {
    if (!confirm('이 관리자 권한을 삭제하시겠습니까?')) return;
    setBusy(true);
    try {
      await deleteAdmin(selectedClubForAdmin, adminId);
      setClubAdmins(prev => prev.filter(a => a.id !== adminId));
    } catch (e) {
      console.error(e);
      alert('운영진 삭제 실패');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteUser = async (uid) => {
    if (!confirm('이 유저 계정을 완전히 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
    setBusy(true);
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ uid })
      });
      const data = await res.json();
      if (res.ok) {
        alert('유저가 성공적으로 삭제되었습니다.');
        setAllUsers(prev => prev.filter(u => u.uid !== uid));
      } else {
        alert('삭제 실패: ' + (data.error || '알 수 없는 오류'));
      }
    } catch (e) {
      console.error(e);
      alert('유저 삭제 중 에러 발생');
    } finally {
      setBusy(false);
    }
  };

  if (loading || (!loading && !isSuperAdmin)) return <div className="p-4">권한 확인 중...</div>;

  const filteredUsers = allUsers.filter(u => 
    (u.displayName || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (u.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <Navbar />
      <main className="container" style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px', color: '#1e293b' }}>
          👑 슈퍼 관리자 대시보드
        </h1>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          <button 
            className={`btn ${activeTab === 'clubs' ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={() => setActiveTab('clubs')}
          >
            클럽 목록 관리
          </button>
          <button 
            className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={() => setActiveTab('users')}
          >
            전체 회원 관리
          </button>
        </div>
        
        {activeTab === 'clubs' && (
          <>
            <div className="card" style={{ padding: '20px', marginBottom: '24px', borderLeft: '4px solid #3b82f6' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>새 클럽 생성</h2>
              <form onSubmit={handleCreateClub} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input type="text" className="input" placeholder="클럽 이름" value={newClubName} onChange={e => setNewClubName(e.target.value)} required style={{ flex: 1, minWidth: '200px' }} />
                <input type="text" className="input" placeholder="클럽 설명 (선택)" value={newClubDesc} onChange={e => setNewClubDesc(e.target.value)} style={{ flex: 2, minWidth: '200px' }} />
                <button type="submit" className="btn btn-primary" disabled={busy}>클럽 생성</button>
              </form>
            </div>

            <div className="card" style={{ padding: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>등록된 클럽 목록</h2>
              {clubs.length === 0 ? (
                <p style={{ color: '#64748b' }}>등록된 클럽이 없습니다.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {clubs.map(club => (
                    <div key={club.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', background: '#fff' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>{club.name}</h3>
                          {club.description && <p style={{ margin: '4px 0 0 0', fontSize: '15px', color: '#64748b' }}>{club.description}</p>}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className={`btn btn-sm ${selectedClubForAdmin === club.id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => handleSelectClubForAdmin(club.id)}>운영진 관리</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDeleteClub(club.id)} disabled={busy}>삭제</button>
                        </div>
                      </div>
                      {selectedClubForAdmin === club.id && (
                        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed #cbd5e1' }}>
                          <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>운영진 목록 (클럽 ID: {club.id})</h4>
                          <form onSubmit={handleAddAdmin} style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                            <input type="email" className="input input-sm" placeholder="추가할 운영진 이메일" value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} required style={{ flex: 1 }} />
                            <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>추가</button>
                          </form>
                          {clubAdmins.length === 0 ? (
                            <p style={{ fontSize: '15px', color: '#64748b', margin: 0 }}>등록된 운영진이 없습니다.</p>
                          ) : (
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {clubAdmins.map(admin => (
                                <li key={admin.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f1f5f9', padding: '8px 12px', borderRadius: '4px' }}>
                                  <span style={{ fontSize: '16px' }}>{admin.email}</span>
                                  <button className="btn btn-danger btn-sm" style={{ padding: '2px 8px', fontSize: '16px' }} onClick={() => handleDeleteAdmin(admin.id)} disabled={busy}>삭제</button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'users' && (
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>가입된 전체 회원 명단</h2>
              <button className="btn btn-secondary btn-sm" onClick={loadAllUsers} disabled={loadingUsers}>
                {loadingUsers ? '로딩 중...' : '새로고침'}
              </button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <input 
                type="text" 
                className="input" 
                placeholder="이름 또는 이메일로 검색..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '100%', maxWidth: '400px' }}
              />
            </div>

            {loadingUsers && allUsers.length === 0 ? (
              <p style={{ color: '#64748b' }}>유저 목록을 불러오는 중입니다 (이 작업은 Vercel 환경 변수가 설정되어야 작동합니다)...</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>이름</th>
                      <th>이메일</th>
                      <th>가입일</th>
                      <th>소속 클럽</th>
                      <th>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(u => (
                      <tr key={u.uid}>
                        <td style={{ fontWeight: '500' }}>{u.displayName}</td>
                        <td style={{ color: '#475569' }}>{u.email}</td>
                        <td style={{ fontSize: '15px' }}>{new Date(u.creationTime).toLocaleDateString()}</td>
                        <td style={{ fontSize: '15px', color: '#3b82f6' }}>
                          {u.clubs && u.clubs.length > 0 ? u.clubs.join(', ') : <span style={{ color: '#94a3b8' }}>없음</span>}
                        </td>
                        <td>
                          <button 
                            className="btn btn-danger btn-sm" 
                            onClick={() => handleDeleteUser(u.uid)} 
                            disabled={busy || u.email === 'leeky1537@gmail.com'}
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
                          검색 결과가 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}

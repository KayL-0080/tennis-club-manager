import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

// Middleware or explicit check to ensure the caller is leeky1537@gmail.com
// Usually, we'd pass a Firebase Auth token in the Authorization header.
async function verifySuperAdmin(req) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    if (decodedToken.email !== 'leeky1537@gmail.com') {
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error verifying auth token', error);
    return false;
  }
}

export async function GET(req) {
  try {
    if (!adminAuth || !adminDb) {
      return NextResponse.json({ error: 'Firebase Admin not initialized. Missing FIREBASE_SERVICE_ACCOUNT_KEY.' }, { status: 500 });
    }

    const isAuthorized = await verifySuperAdmin(req);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Fetch all users from Firebase Auth
    let allUsers = [];
    let pageToken;
    do {
      const listUsersResult = await adminAuth.listUsers(1000, pageToken);
      allUsers = allUsers.concat(listUsersResult.users);
      pageToken = listUsersResult.pageToken;
    } while (pageToken);

    // 2. Fetch all clubs and their members/admins
    const clubsSnapshot = await adminDb.collection('clubs').get();
    const clubs = [];
    clubsSnapshot.forEach(doc => clubs.push({ id: doc.id, ...doc.data() }));

    const userClubsMap = {}; // email -> [clubName1, clubName2]

    // Use Promise.all to fetch all club data concurrently to prevent Vercel timeout
    await Promise.all(clubs.map(async (club) => {
      // Admins
      const adminsSnapshot = await adminDb.collection(`clubs/${club.id}/admins`).get();
      adminsSnapshot.forEach(doc => {
        const email = doc.data().email;
        if (email) {
          if (!userClubsMap[email]) userClubsMap[email] = new Set();
          userClubsMap[email].add(club.name);
        }
      });

      // Members (Real club members, not just join requests)
      const membersSnapshot = await adminDb.collection(`clubs/${club.id}/members`).get();
      membersSnapshot.forEach(doc => {
        const email = doc.data().email;
        if (email) {
          if (!userClubsMap[email]) userClubsMap[email] = new Set();
          userClubsMap[email].add(club.name);
        }
      });
    }));

    // Format output
    const usersData = allUsers.map(u => ({
      uid: u.uid,
      email: u.email,
      displayName: u.displayName || '이름 없음',
      creationTime: u.metadata.creationTime,
      lastSignInTime: u.metadata.lastSignInTime,
      clubs: userClubsMap[u.email] ? Array.from(userClubsMap[u.email]) : []
    }));

    // Sort by newest first
    usersData.sort((a, b) => new Date(b.creationTime).getTime() - new Date(a.creationTime).getTime());

    return NextResponse.json({ users: usersData }, { status: 200 });

  } catch (error) {
    console.error('Error in GET /api/admin/users:', error);
    return NextResponse.json({ error: 'Top-level Error: ' + (error.message || String(error)) }, { status: 500 });
  }
}

export async function DELETE(req) {
  if (!adminAuth) {
    return NextResponse.json({ error: 'Firebase Admin not initialized.' }, { status: 500 });
  }

  const isAuthorized = await verifySuperAdmin(req);
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { uid } = body;
    if (!uid) {
      return NextResponse.json({ error: 'UID is required' }, { status: 400 });
    }

    await adminAuth.deleteUser(uid);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const oldConfig = {
  apiKey: "AIzaSyBkDZxSs2_WlGK4nXwbmnE2B9SdImdCFSk",
  projectId: "tennismatch-83355"
};

const app = initializeApp(oldConfig);
const db = getFirestore(app);

async function check() {
  const sharedSnap = await getDocs(collection(db, 'shared', 'tennis-club', 'members'));
  console.log("shared/tennis-club/members count:", sharedSnap.docs.length);
  
  const schedulesSnap = await getDocs(collection(db, 'shared', 'tennis-club', 'schedules'));
  console.log("shared/tennis-club/schedules count:", schedulesSnap.docs.length);
  
  const eventsSnap = await getDocs(collection(db, 'shared', 'tennis-club', 'events'));
  console.log("shared/tennis-club/events count:", eventsSnap.docs.length);

  const adminsSnap = await getDocs(collection(db, 'shared', 'tennis-club', 'admins'));
  console.log("shared/tennis-club/admins count:", adminsSnap.docs.length);

  const clubsSnap = await getDocs(collection(db, 'clubs'));
  console.log("clubs count:", clubsSnap.docs.length);
  for (const c of clubsSnap.docs) {
    console.log("Club ID:", c.id, c.data());
    const m = await getDocs(collection(db, 'clubs', c.id, 'members'));
    console.log(" - members:", m.docs.length);
  }
}

check().then(() => process.exit(0)).catch(console.error);

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const navbarPath = path.join(__dirname, 'components', 'Navbar.js');

function padZero(num) {
  return num.toString().padStart(2, '0');
}

function getTodayStr() {
  const now = new Date();
  const year = now.getFullYear();
  const month = padZero(now.getMonth() + 1);
  const day = padZero(now.getDate());
  return `${year}${month}${day}`;
}

function deploy() {
  console.log('🚀 Starting deployment process...');

  // 1. Read Navbar.js
  let content = fs.readFileSync(navbarPath, 'utf8');

  // 2. Find and update version
  // Existing version format in code might be like Ver.1.260723-02 or Ver.20260724-01
  const todayStr = getTodayStr();
  const versionRegex = /Ver\.(?:1\.)?(\d{6,8})-(\d{2})/;
  
  let newVersion = '';
  
  content = content.replace(versionRegex, (match, datePart, serialPart) => {
    // If the existing date string matches today's YYYYMMDD
    if (datePart === todayStr) {
      const nextSerial = padZero(parseInt(serialPart, 10) + 1);
      newVersion = `Ver.${todayStr}-${nextSerial}`;
    } else {
      newVersion = `Ver.${todayStr}-01`;
    }
    return newVersion;
  });

  if (!newVersion) {
    // If regex didn't match, just fallback to string replacement if possible
    console.log('⚠️ Could not find standard version format, trying hardcoded replace...');
    newVersion = `Ver.${todayStr}-01`;
    content = content.replace(/Ver\.[^\b<]+/, newVersion);
  }

  // 3. Write back
  fs.writeFileSync(navbarPath, content, 'utf8');
  console.log(`✅ Version bumped to ${newVersion} in components/Navbar.js`);

  // 4. Git add, commit, push
  try {
    console.log('📦 Committing and pushing to git...');
    // We stage all changes, not just Navbar.js, so the user can just run this to deploy their working dir
    execSync('git add .', { stdio: 'inherit' });
    execSync(`git commit -m "Deploy ${newVersion}"`, { stdio: 'inherit' });
    execSync('git push', { stdio: 'inherit' });
    console.log('🎉 Deployment triggered successfully via Git Push!');
  } catch (err) {
    console.error('❌ Git commit/push failed:', err.message);
    process.exit(1);
  }
}

deploy();

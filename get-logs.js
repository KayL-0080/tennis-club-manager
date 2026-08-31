const { execSync } = require('child_process');

try {
  const output = execSync('npx vercel logs tennis-club-manager-zeta.vercel.app --limit 50', { encoding: 'utf8' });
  console.log(output);
} catch (e) {
  console.error(e.stderr);
}

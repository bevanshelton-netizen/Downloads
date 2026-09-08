import fs from 'node:fs';

const need=(p)=>{if(!fs.existsSync(p))throw new Error('Missing '+p);return fs.readFileSync(p,'utf8')};
const migration=need('supabase/022_music_screen_release_gate.sql');
const handoff=need('app/api/internal/allegro-video-handoff/route.ts');
const tour=need('TOUR2SCREEN.md');
const screen=need('MUSIC-SCREEN.md');
const release=need('MUSIC-SCREEN-RELEASE-GATE.md');

const checks=[
  [migration.includes('music_screen_release_ready'),'release gate function'],
  [migration.includes('captions_status'),'caption state'],
  [migration.includes('sponsor_disclosure'),'sponsor disclosure'],
  [handoff.includes("status: 'draft'"),'draft-only handoff'],
  [handoff.includes("moderation_status: 'pending'"),'moderation pending'],
  [tour.includes('venue filming permission'),'tour filming permissions'],
  [screen.includes('artist documentary'),'documentary support'],
  [release.includes('Accessibility'),'accessibility policy'],
  [release.includes('Commercial urgency never overrides'),'rights-first policy']
];
const failed=checks.filter(([ok])=>!ok).map(([,name])=>name);
if(failed.length)throw new Error('KORA music-screen validation failed: '+failed.join(', '));
console.log('KORA_MUSIC_SCREEN_SOFTWARE=PASS');
console.log('REAL_RIGHTS_MODERATION_PAYMENT_PROOF=PENDING');

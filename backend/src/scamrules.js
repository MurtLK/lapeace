// Red-flag rules for phone scams, shared by the live call check and scripts/test-scam.js.
// They look at WHAT is asked, not whose voice it is. weight 3 = never legitimate on its own.
export const FLAGS = [
  { id: 'asks_for_code', label: 'Asks for a code, PIN or password', weight: 3, keys: ['code', 'codes', 'pin', 'password', 'verification', 'otp', 'one time'] },
  { id: 'unusual_payment', label: 'Wants gift cards, crypto or a wire transfer', weight: 3, keys: ['gift card', 'gift cards', 'bitcoin', 'crypto', 'wire', 'cryptocurrency', 'e transfer', 'western union'] },
  { id: 'remote_access', label: 'Asks you to install an app or give remote access', weight: 3, keys: ['install', 'remote', 'anydesk', 'teamviewer', 'download'] },
  { id: 'card_details', label: 'Asks for card, account or SIN numbers', weight: 3, keys: ['card number', 'account number', 'social insurance', 'sin number', 'security code', 'cvv'] },
  { id: 'threat', label: 'Threatens arrest, fines or a frozen account', weight: 2, keys: ['arrest', 'arrested', 'warrant', 'police', 'frozen', 'suspended', 'lawsuit', 'deported', 'jail'] },
  { id: 'secrecy', label: 'Tells you to keep it secret or stay on the line', weight: 2, keys: ["don't tell", 'do not tell', "don't hang up", 'do not hang up', 'keep this between', 'keep this secret'] },
  { id: 'urgency', label: 'Pressures you to act right now', weight: 1, keys: ['immediately', 'right now', 'today', 'within the hour', 'urgent', 'right away', 'hurry'] },
  { id: 'authority', label: 'Claims to be a government agency or your bank’s fraud team', weight: 1, keys: ['revenue agency', 'cra', 'government', 'fraud department', 'fraud team', 'immigration', 'service canada'] },
];
const norm = (text) => ` ${text.toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ')} `;
export function check(text) {
  const t = norm(text);
  const found = [];
  for (const f of FLAGS) {
    const hits = f.keys.filter((k) => t.includes(` ${k} `));
    if (hits.length) found.push({ id: f.id, label: f.label, weight: f.weight, phrases: hits });
  }
  const score = found.reduce((a, f) => a + f.weight, 0);
  const verdict = score >= 3 ? 'likely_scam' : score >= 1 ? 'be_careful' : 'no_red_flags';
  return { flags: found, score, verdict, verdict_text: VERDICT[verdict] };
}
export const VERDICT = {
  likely_scam: 'Likely scam: hang up, and call back using the number on your card or the official website.',
  be_careful: 'Be careful: don’t share anything; verify by calling back on an official number.',
  no_red_flags: 'No red flags found. Still, never share codes or passwords on a call you didn’t make.',
};

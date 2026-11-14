// Fills in eas.json for the iPhone/iPad build in CI (.github/workflows/news-app-ios.yml), from the
// GitHub secrets and variables, so nothing account-specific is committed.
//   build.production.env  values app.config.ts reads, so Expo's build server builds the same app
//   submit.production.ios the App Store Connect app and API key used to upload to TestFlight
import { readFileSync, writeFileSync } from 'node:fs';

const eas = JSON.parse(readFileSync('eas.json', 'utf8'));
const env = {};
for (const key of ['APP_VERSION_CODE', 'CARTO_KEY', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'GOOGLE_SIGN_IN', 'EAS_PROJECT_ID'])
  if (process.env[key]) env[key] = process.env[key];
eas.build.production.env = env;

const missing = ['ASC_APP_ID', 'ASC_KEY_ID', 'APPLE_TEAM_ID'].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing GitHub variables for the iOS upload: ${missing.join(', ')} (see news-app/IOS.md).`);
  process.exit(1);
}
eas.submit.production.ios = {
  ascAppId: process.env.ASC_APP_ID,
  appleTeamId: process.env.APPLE_TEAM_ID,
  ascApiKeyPath: './asc-api-key.p8',
  ascApiKeyId: process.env.ASC_KEY_ID,
  ...(process.env.ASC_ISSUER_ID ? { ascApiKeyIssuerId: process.env.ASC_ISSUER_ID } : {}),
};
writeFileSync('eas.json', `${JSON.stringify(eas, null, 2)}\n`);
console.log(`eas.json ready: build ${env.APP_VERSION_CODE ?? '?'}, ${Object.keys(env).length} build settings, App Store Connect app ${process.env.ASC_APP_ID}.`);

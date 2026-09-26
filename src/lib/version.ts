export const APP_VERSION: string =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.1.0';

export const GITHUB_REPO_URL = 'https://github.com/ii2d/peer-box';

export function getVersionUrl(version: string = APP_VERSION): string {
  if (version.startsWith('v')) {
    const match = version.match(/^(v[0-9]+\.[0-9]+\.[0-9]+)$/);
    if (match) {
      return `${GITHUB_REPO_URL}/releases/tag/${match[1]}`;
    }
  }
  const cleanRef = version.replace(/-dirty$/, '');
  const commitMatch = cleanRef.match(/-g([a-f0-9]+)$/);
  if (commitMatch) {
    return `${GITHUB_REPO_URL}/commit/${commitMatch[1]}`;
  }
  return `${GITHUB_REPO_URL}/tree/${cleanRef}`;
}

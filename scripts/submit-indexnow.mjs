import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);

export const INDEXNOW_KEY = process.env.INDEXNOW_KEY || '';
export const INDEXNOW_HOST = 'peer-box.ii2d.com';
export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

export const INDEXNOW_URLS = [
  'https://peer-box.ii2d.com/',
  'https://peer-box.ii2d.com/about/',
  'https://peer-box.ii2d.com/faq/',
  'https://peer-box.ii2d.com/privacy/',
  'https://peer-box.ii2d.com/llms.txt',
  'https://peer-box.ii2d.com/llms-full.txt',
];

/**
 * Submits URL changes to the IndexNow protocol endpoint.
 */
export async function submitIndexNow(fetchFn = globalThis.fetch, key = INDEXNOW_KEY) {
  if (!key) {
    console.log('[IndexNow] No INDEXNOW_KEY provided. Skipping IndexNow announcement.');
    return { success: true, skipped: true };
  }

  const keyLocation = `https://${INDEXNOW_HOST}/${key}.txt`;

  const payload = {
    host: INDEXNOW_HOST,
    key,
    keyLocation,
    urlList: INDEXNOW_URLS,
  };

  try {
    const response = await fetchFn(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok || response.status === 200 || response.status === 202) {
      console.log(
        `[IndexNow] Successfully announced ${INDEXNOW_URLS.length} URLs to ${INDEXNOW_ENDPOINT}`,
      );
      return { success: true, status: response.status };
    } else {
      console.warn(
        `[IndexNow] Submission returned HTTP ${response.status}: ${response.statusText}`,
      );
      return { success: false, status: response.status };
    }
  } catch (error) {
    console.warn('[IndexNow] Submission network error:', error);
    return { success: false, error };
  }
}

// Auto-run if executed directly via node
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isMain) {
  const key = process.env.INDEXNOW_KEY || process.argv[2] || '';
  if (!key) {
    console.log('[IndexNow] No INDEXNOW_KEY provided. Skipping IndexNow announcement.');
    process.exit(0);
  }

  submitIndexNow(globalThis.fetch, key).then((result) => {
    if (!result.success) {
      // Do not fail CI if IndexNow API is temporarily offline
      console.warn('[IndexNow] Notice: Ping completed with non-fatal status.');
    }
  });
}

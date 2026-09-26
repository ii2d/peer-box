import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);

export const INDEXNOW_KEY = 'c3b4f6918d204a559e871dc962e24ab7';
export const INDEXNOW_HOST = 'peer-box.ii2d.com';
export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

export const INDEXNOW_URLS = [
  'https://peer-box.ii2d.com/',
  'https://peer-box.ii2d.com/llms.txt',
  'https://peer-box.ii2d.com/llms-full.txt',
];

/**
 * Submits URL changes to the IndexNow protocol endpoint.
 */
export async function submitIndexNow(fetchFn = globalThis.fetch) {
  const keyLocation = `https://${INDEXNOW_HOST}/${INDEXNOW_KEY}.txt`;

  const payload = {
    host: INDEXNOW_HOST,
    key: INDEXNOW_KEY,
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
  submitIndexNow().then((result) => {
    if (!result.success) {
      // Do not fail CI if IndexNow API is temporarily offline
      console.warn('[IndexNow] Notice: Ping completed with non-fatal status.');
    }
  });
}

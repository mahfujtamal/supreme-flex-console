const PHP_BASE = process.env.PHP_BASE_URL ?? 'http://localhost:8000';
const INT_KEY  = process.env.PHP_INTERNAL_KEY ?? '';

/**
 * Ask PHP to deliver an SMS via its internal route.
 * Returns true on success, false on any failure — never throws.
 */
export async function sendSms(msisdn, message) {
  try {
    const res = await fetch(`${PHP_BASE}/api/internal/sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Key': INT_KEY,
      },
      body: JSON.stringify({ msisdn, message }),
    });
    if (!res.ok) {
      console.error(`[phpBridge] sendSms failed: HTTP ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[phpBridge] sendSms error:', err.message);
    return false;
  }
}

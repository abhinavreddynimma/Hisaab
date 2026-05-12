// Single source of truth for live FX rates. Next.js fetch cache de-dupes
// requests across the request lifecycle, and the 1-hour revalidate keeps us
// under the public API's rate limits.

export async function getLiveRateToInr(currency: string = "EUR"): Promise<number | null> {
  try {
    const res = await fetch(
      `https://open.er-api.com/v6/latest/${currency}`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.rates?.INR ?? null;
  } catch {
    return null;
  }
}

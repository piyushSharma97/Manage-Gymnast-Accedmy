/**
 * YouTube oEmbed response shape
 * @see https://www.youtube.com/oembed?url=...&format=json
 */
export type YoutubeOEmbedResponse = {
  title?: string;
  thumbnail_url?: string;
  author_name?: string;
  provider_name?: string;
};

/**
 * Fetch YouTube video title and thumbnail via oEmbed API.
 * Returns null on failure (network error, invalid URL, private video, etc.)
 */
export async function fetchYoutubeMetadata(
  url: string,
): Promise<{ title: string; thumbnailUrl: string | null } | null> {
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(trimmed)}&format=json`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(oembedUrl, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const data = (await res.json()) as YoutubeOEmbedResponse;
    const title =
      typeof data?.title === 'string' && data.title.length > 0
        ? data.title.substring(0, 500)
        : null;
    const thumbnailUrl =
      typeof data?.thumbnail_url === 'string' && data.thumbnail_url.length > 0
        ? data.thumbnail_url.substring(0, 500)
        : null;
    if (!title) return null;
    return {
      title,
      thumbnailUrl,
    };
  } catch {
    return null;
  }
}

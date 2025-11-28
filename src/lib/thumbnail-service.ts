import { supabaseAdmin } from "@/lib/supabase";

const THUMBNAIL_ENDPOINT =
  process.env.THUMBNAIL_SERVICE_URL ||
  "https://raisegate.fridaydata.tech/thumbnail";

export interface ThumbnailServiceResponse {
  thumbnail_path?: string | null;
  [key: string]: unknown;
}

interface ShareThumbnailInfo {
  deckId: string | null;
  filePath: string | null;
  linkIdentifier: string | null;
  thumbnailUrl: string | null;
}

interface RequestOptions {
  regenerate?: boolean;
}

/**
 * Call the thumbnail microservice so it can generate or refresh the deck preview
 * and store the resulting path back in Supabase.
 */
export async function requestDeckThumbnail(
  filePath: string,
  options: RequestOptions = {},
): Promise<ThumbnailServiceResponse | null> {
  if (!filePath) {
    return null;
  }

  const body = JSON.stringify({
    file_path: filePath,
    regenerate: options.regenerate ?? false,
  });

  const response = await fetch(THUMBNAIL_ENDPOINT, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(
      `Thumbnail service responded with status ${response.status}`,
    );
  }

  try {
    return (await response.json()) as ThumbnailServiceResponse;
  } catch {
    return null;
  }
}

/**
 * Fetch the thumbnail URL for a given share token, triggering a refresh
 * via the thumbnail service if the deck file does not yet have one.
 */
export async function getShareThumbnailByToken(
  token: string,
): Promise<ShareThumbnailInfo | null> {
  if (!token) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("deck_share_links")
    .select(
      `
      deck_id,
      link_identifier,
      deck_files!inner (
        id,
        file_path,
        thumbnail_path
      )
    `,
    )
    .eq("token", token)
    .maybeSingle();

  if (error || !data?.deck_files) {
    return null;
  }

  const deckFileId = data.deck_files.id;
  const filePath = data.deck_files.file_path;
  let thumbnailUrl = data.deck_files.thumbnail_path ?? null;

  if (!thumbnailUrl && filePath) {
    try {
      const apiResponse = await requestDeckThumbnail(filePath, {
        regenerate: false,
      });

      if (apiResponse?.thumbnail_path) {
        thumbnailUrl = apiResponse.thumbnail_path || null;
      } else {
        const { data: refreshed } = await supabaseAdmin
          .from("deck_files")
          .select("thumbnail_path")
          .eq("id", deckFileId)
          .maybeSingle();

        thumbnailUrl = refreshed?.thumbnail_path ?? null;
      }
    } catch (err) {
      console.error("Failed to refresh thumbnail:", err);
    }
  }

  return {
    deckId: data.deck_id,
    filePath,
    linkIdentifier: data.link_identifier,
    thumbnailUrl,
  };
}

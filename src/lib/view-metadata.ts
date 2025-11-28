import type { Metadata } from "next";
import { getShareThumbnailByToken } from "@/lib/thumbnail-service";

const BASE_TITLE = "RaiseGate Deck Viewer";
const BASE_DESCRIPTION =
  "Securely view and share RaiseGate decks with access controls.";

export async function buildDeckViewMetadata(
  token?: string | null,
): Promise<Metadata> {
  const metadata: Metadata = {
    title: BASE_TITLE,
    description: BASE_DESCRIPTION,
    openGraph: {
      title: BASE_TITLE,
      description: BASE_DESCRIPTION,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: BASE_TITLE,
      description: BASE_DESCRIPTION,
    },
  };

  if (!token) {
    return metadata;
  }

  try {
    const shareInfo = await getShareThumbnailByToken(token);

    if (shareInfo?.thumbnailUrl) {
      metadata.openGraph = {
        ...metadata.openGraph,
        images: [
          {
            url: shareInfo.thumbnailUrl,
            width: 1200,
            height: 675,
            alt: "Deck preview thumbnail",
          },
        ],
      };

      metadata.twitter = {
        ...metadata.twitter,
        images: [shareInfo.thumbnailUrl],
      };
    }
  } catch (error) {
    console.error("Failed to build deck metadata:", error);
  }

  return metadata;
}

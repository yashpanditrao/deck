import type { DeckUserProfile } from "@/lib/deck-user";

export const MAX_FILE_SIZE = {
  deck: 20 * 1024 * 1024, // 20MB
  thumbnail: 5 * 1024 * 1024, // 5MB
} as const;

export const ALLOWED_FILE_TYPES = {
  deck: ["application/pdf"],
  thumbnail: ["image/jpeg", "image/png", "image/webp"],
} as const;

export const STORAGE_BUCKETS = {
  deck: "deck",
  thumbnail: "deckthumbnail",
} as const;

export const sanitizeFolderSegment = (value: string) =>
  value.replace(/[^a-zA-Z0-9_\-]/g, "_").trim() ||
  `deck_${Date.now().toString(36)}`;

export const sanitizeStorageIdentifier = (value: string) =>
  value.replace(/[^a-zA-Z0-9]/g, "_");

export const resolveFolderPath = (
  deckUser: DeckUserProfile,
  fallbackEmail: string | null,
  fallbackId: string,
) => {
  const preferred = deckUser.username || fallbackEmail || fallbackId;
  return sanitizeFolderSegment(preferred ?? fallbackId);
};

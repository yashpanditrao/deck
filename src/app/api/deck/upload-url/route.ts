import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getOrCreateDeckUser } from "@/lib/deck-user";
import {
  ALLOWED_FILE_TYPES,
  MAX_FILE_SIZE,
  resolveFolderPath,
  sanitizeStorageIdentifier,
  STORAGE_BUCKETS,
} from "@/app/api/deck/helpers";

type UploadUrlPayload = {
  type?: "deck" | "thumbnail";
  fileName?: string;
  fileType?: string;
  fileSize?: number;
};

const SIGNED_URL_EXPIRATION = 120; // seconds

const mimeFallbackExtension = (mime: string) => {
  switch (mime) {
    case "application/pdf":
      return "pdf";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/jpeg":
      return "jpg";
    default:
      return "dat";
  }
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let payload: UploadUrlPayload | null = null;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const { type, fileName, fileType, fileSize } = payload ?? {};

    if (!type || (type !== "deck" && type !== "thumbnail")) {
      return NextResponse.json(
        { error: "Invalid upload type" },
        { status: 400 },
      );
    }

    if (!fileName || !fileType || typeof fileSize !== "number") {
      return NextResponse.json(
        { error: "Missing file metadata" },
        { status: 400 },
      );
    }

    if (!ALLOWED_FILE_TYPES[type]?.includes(fileType)) {
      return NextResponse.json(
        {
          error: `Invalid file type. Allowed: ${ALLOWED_FILE_TYPES[type].join(", ")}`,
        },
        { status: 400 },
      );
    }

    if (fileSize > MAX_FILE_SIZE[type]) {
      return NextResponse.json(
        {
          error: `File too large. Max size: ${MAX_FILE_SIZE[type] / (1024 * 1024)}MB`,
        },
        { status: 400 },
      );
    }

    const deckUser = await getOrCreateDeckUser(user);
    const userEmail = deckUser.email || user.email || null;
    const sanitizedEmail = sanitizeStorageIdentifier(userEmail || user.id);
    const folderPath = resolveFolderPath(deckUser, userEmail, user.id);

    const fileExt =
      fileName.split(".").pop()?.toLowerCase() ||
      mimeFallbackExtension(fileType);
    const timestamp = Date.now();
    const generatedName =
      type === "deck"
        ? `${sanitizedEmail}_Deck_${timestamp}.${fileExt}`
        : `${sanitizedEmail}_Deck_thumbnail_${timestamp}.${fileExt}`;
    const bucket = STORAGE_BUCKETS[type];
    const storagePath =
      type === "deck" ? `${folderPath}/${generatedName}` : generatedName;

    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUploadUrl(storagePath, SIGNED_URL_EXPIRATION);

    if (error || !data?.signedUrl) {
      console.error("Failed to create signed upload URL:", error);
      return NextResponse.json(
        { error: "Failed to create signed upload URL" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
      storagePath,
      bucket,
      expiresIn: SIGNED_URL_EXPIRATION,
    });
  } catch (error: any) {
    console.error("Upload URL error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

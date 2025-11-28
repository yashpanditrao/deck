import { supabaseAdmin } from "@/lib/supabase";
import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { getOrCreateDeckUser } from "@/lib/deck-user";
import {
  resolveFolderPath,
  sanitizeStorageIdentifier,
  STORAGE_BUCKETS,
} from "@/app/api/deck/helpers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await getOrCreateDeckUser(user);

    // Get deck files for the authenticated user
    const { data: deckFiles, error: deckFilesError } = await supabaseAdmin
      .from("deck_files")
      .select("file_path, thumbnail_path")
      .eq("user_id", user.id)
      .order("uploaded_at", { ascending: false })
      .limit(1)
      .single();

    if (deckFilesError && deckFilesError.code !== "PGRST116") {
      return NextResponse.json(
        { error: "Failed to fetch deck files" },
        { status: 500 },
      );
    }

    if (!deckFiles) {
      return NextResponse.json({
        deck_url: "",
        deckth: "",
      });
    }

    // Generate signed URL if deck exists
    let signedDeckUrl = "";
    if (deckFiles?.file_path) {
      const { data: signedUrlData, error: signedUrlError } =
        await supabaseAdmin.storage
          .from("deck")
          .createSignedUrl(deckFiles.file_path, 604800);

      if (!signedUrlError && signedUrlData) {
        signedDeckUrl = signedUrlData.signedUrl;
      }
    }

    return NextResponse.json({
      deck_url: signedDeckUrl,
      deckth: deckFiles?.thumbnail_path || "",
    });
  } catch (error: any) {
    console.error("Error in deck GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const deckUser = await getOrCreateDeckUser(user);
    let payload: { type?: "deck" | "thumbnail"; storagePath?: string } | null =
      null;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const type = payload?.type;
    const storagePath = payload?.storagePath;

    if (type !== "deck" && type !== "thumbnail") {
      return NextResponse.json(
        { error: "Invalid upload type" },
        { status: 400 },
      );
    }

    if (!storagePath || typeof storagePath !== "string") {
      return NextResponse.json(
        { error: "Missing storage path" },
        { status: 400 },
      );
    }

    const userEmail = deckUser.email || user.email || null;
    const sanitizedEmail = sanitizeStorageIdentifier(userEmail || user.id);
    const folderPath = resolveFolderPath(deckUser, userEmail, user.id);

    if (type === "deck") {
      if (!storagePath.startsWith(`${folderPath}/`)) {
        return NextResponse.json(
          { error: "Invalid storage path for deck" },
          { status: 400 },
        );
      }

      const { data: newDeckFileData, error: deckFileError } =
        await supabaseAdmin
          .from("deck_files")
          .insert({
            user_id: deckUser.id,
            file_path: storagePath,
            thumbnail_path: null,
          })
          .select()
          .single();

      if (deckFileError || !newDeckFileData) {
        await supabaseAdmin.storage
          .from(STORAGE_BUCKETS.deck)
          .remove([storagePath]);
        console.error("Deck file insert error:", deckFileError);
        return NextResponse.json(
          {
            error: "DECK_FILE_RECORD_FAILED",
            message: "Failed to create deck file record",
            details: deckFileError?.message || "Unknown error",
          },
          { status: 500 },
        );
      }

      const { data: signedUrlData, error: signedUrlError } =
        await supabaseAdmin.storage
          .from(STORAGE_BUCKETS.deck)
          .createSignedUrl(storagePath, 604800);

      if (signedUrlError || !signedUrlData?.signedUrl) {
        return NextResponse.json(
          { error: "Failed to generate signed URL" },
          { status: 500 },
        );
      }

      return NextResponse.json({
        success: true,
        url: signedUrlData.signedUrl,
        deckFile: {
          id: newDeckFileData.id,
          user_id: deckUser.id,
          file_path: storagePath,
          uploaded_at: newDeckFileData.uploaded_at || new Date().toISOString(),
          thumbnail_path: newDeckFileData.thumbnail_path,
        },
      });
    }

    if (storagePath.includes("/") || !storagePath.startsWith(sanitizedEmail)) {
      return NextResponse.json(
        { error: "Invalid storage path for thumbnail" },
        { status: 400 },
      );
    }

    const { data: latestDeck, error: deckFetchError } = await supabaseAdmin
      .from("deck_files")
      .select("id")
      .eq("user_id", deckUser.id)
      .order("uploaded_at", { ascending: false })
      .limit(1)
      .single();

    let targetDeckId: string | null = null;
    let createdDeckFileId: string | null = null;

    if (!latestDeck || deckFetchError) {
      const { data: thumbnailDeckFile, error: createError } =
        await supabaseAdmin
          .from("deck_files")
          .insert({
            user_id: deckUser.id,
            file_path: null,
            thumbnail_path: null,
          })
          .select()
          .single();

      if (createError) {
        return NextResponse.json(
          {
            error: "THUMBNAIL_RECORD_FAILED",
            message: "Failed to create thumbnail record",
          },
          { status: 500 },
        );
      }

      targetDeckId = thumbnailDeckFile.id;
      createdDeckFileId = thumbnailDeckFile.id;
    } else {
      targetDeckId = latestDeck.id;
    }

    const { data: existingDeckFiles } = await supabaseAdmin
      .from("deck_files")
      .select("thumbnail_path")
      .eq("id", targetDeckId)
      .single();

    const oldThumbnailPath = existingDeckFiles?.thumbnail_path;

    const { data: publicUrlData } = supabaseAdmin.storage
      .from(STORAGE_BUCKETS.thumbnail)
      .getPublicUrl(storagePath);

    const newThumbnailUrl = publicUrlData.publicUrl;

    const { error: updateError } = await supabaseAdmin
      .from("deck_files")
      .update({
        thumbnail_path: newThumbnailUrl,
      })
      .eq("id", targetDeckId);

    if (updateError) {
      await supabaseAdmin.storage
        .from(STORAGE_BUCKETS.thumbnail)
        .remove([storagePath]);

      if (createdDeckFileId) {
        await supabaseAdmin.from("deck_files").delete().eq("id", targetDeckId);
      }

      return NextResponse.json(
        {
          error: "DECK_FILE_UPDATE_FAILED",
          message: "Failed to update deck file with thumbnail",
        },
        { status: 500 },
      );
    }

    if (oldThumbnailPath) {
      const oldThumbnailFileName = oldThumbnailPath.split("/").pop();
      if (oldThumbnailFileName) {
        await supabaseAdmin.storage
          .from(STORAGE_BUCKETS.thumbnail)
          .remove([oldThumbnailFileName]);
      }
    }

    const { data: updatedDeckFiles } = await supabaseAdmin
      .from("deck_files")
      .select("*")
      .eq("id", targetDeckId)
      .single();

    return NextResponse.json({
      success: true,
      url: newThumbnailUrl,
      deckFile: updatedDeckFiles,
    });
  } catch (error: any) {
    console.error("Critical error in deck POST:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

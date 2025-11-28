import { supabaseAdmin } from "@/lib/supabase";
import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { getOrCreateDeckUser, type DeckUserProfile } from "@/lib/deck-user";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_FILE_SIZE = {
  deck: 20 * 1024 * 1024, // 20MB
  thumbnail: 5 * 1024 * 1024, // 5MB
};

const ALLOWED_FILE_TYPES = {
  deck: ["application/pdf"],
  thumbnail: ["image/jpeg", "image/png", "image/webp"],
};

const sanitizeFolderSegment = (value: string) =>
  value.replace(/[^a-zA-Z0-9_\-]/g, "_").trim() ||
  `deck_${Date.now().toString(36)}`;

const resolveFolderPath = (
  deckUser: DeckUserProfile,
  fallbackEmail: string | null,
  fallbackId: string,
) => {
  const preferred = deckUser.username || fallbackEmail || fallbackId;
  return sanitizeFolderSegment(preferred ?? fallbackId);
};

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

    // Get form data
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const type = formData.get("type") as "deck" | "thumbnail";

    // Validate required fields
    if (!file || !type) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    if (!ALLOWED_FILE_TYPES[type]?.includes(file.type)) {
      return NextResponse.json(
        {
          error: `Invalid file type. Allowed types: ${ALLOWED_FILE_TYPES[type].join(", ")}`,
        },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE[type]) {
      return NextResponse.json(
        {
          error: `File too large. Maximum size: ${MAX_FILE_SIZE[type] / (1024 * 1024)}MB`,
        },
        { status: 400 },
      );
    }

    // Get user email for folder structure
    const userEmail = deckUser.email || user.email || null;
    const sanitizedEmail = (userEmail || user.id).replace(/[^a-zA-Z0-9]/g, "_");
    const folderPath = resolveFolderPath(deckUser, userEmail, user.id);
    const fileExt = file.name.split(".").pop();
    const fileName =
      type === "deck"
        ? `${sanitizedEmail}_Deck_${Date.now()}.${fileExt}`
        : `${sanitizedEmail}_Deck_thumbnail_${Date.now()}.${fileExt}`;
    const fullPath = `${folderPath}/${fileName}`;

    if (type === "deck") {
      // Upload deck file to storage
      const { error: uploadError } = await supabaseAdmin.storage
        .from("deck")
        .upload(fullPath, file);

      if (uploadError) {
        console.error("Deck storage upload error:", uploadError);
        return NextResponse.json(
          {
            error: "DECK_UPLOAD_FAILED",
            message: "Failed to upload deck file",
            details: uploadError.message || "Unknown error",
          },
          { status: 500 },
        );
      }

      console.log("Deck file uploaded to storage:", fullPath);

      // Create new deck_files record
      const { data: newDeckFileData, error: deckFileError } =
        await supabaseAdmin
          .from("deck_files")
          .insert({
            user_id: deckUser.id,
            file_path: fullPath,
            thumbnail_path: null,
          })
          .select()
          .single();

      if (deckFileError) {
        console.error("Deck file insert error:", deckFileError);
        // Rollback: delete uploaded file
        await supabaseAdmin.storage.from("deck").remove([fullPath]);
        return NextResponse.json(
          {
            error: "DECK_FILE_RECORD_FAILED",
            message: "Failed to create deck file record",
            details: deckFileError.message || "Unknown error",
          },
          { status: 500 },
        );
      }

      console.log("Successfully created deck_files record:", newDeckFileData);

      // Generate signed URL
      const { data: signedUrlData, error: signedUrlError } =
        await supabaseAdmin.storage
          .from("deck")
          .createSignedUrl(fullPath, 604800);

      if (signedUrlError || !signedUrlData) {
        return NextResponse.json(
          { error: "Failed to generate signed URL" },
          { status: 500 },
        );
      }

      console.log("Deck upload successful, returning deck data");
      return NextResponse.json({
        success: true,
        url: signedUrlData.signedUrl,
        deckFile: {
          id: newDeckFileData.id,
          user_id: deckUser.id,
          file_path: fullPath,
          uploaded_at: newDeckFileData.uploaded_at || new Date().toISOString(),
          thumbnail_path: newDeckFileData.thumbnail_path,
        },
      });
    } else {
      // Handle thumbnail upload
      // Get the latest deck for this user
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
        // Create a minimal deck_files record just for the thumbnail
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

      // Get existing thumbnail path to delete old file
      const { data: existingDeckFiles } = await supabaseAdmin
        .from("deck_files")
        .select("thumbnail_path")
        .eq("id", targetDeckId)
        .single();

      const oldThumbnailPath = existingDeckFiles?.thumbnail_path;

      // Upload thumbnail file (flat storage, no folders)
      const { error: uploadError } = await supabaseAdmin.storage
        .from("deckthumbnail")
        .upload(fileName, file);

      if (uploadError) {
        // Rollback: delete created deck_files record if we created one
        if (createdDeckFileId) {
          await supabaseAdmin
            .from("deck_files")
            .delete()
            .eq("id", createdDeckFileId);
        }
        return NextResponse.json(
          { error: "Failed to upload thumbnail" },
          { status: 500 },
        );
      }

      // Get public URL for thumbnail
      const { data: publicUrlData } = supabaseAdmin.storage
        .from("deckthumbnail")
        .getPublicUrl(fileName);

      // Update deck_files record with thumbnail path
      const { error: updateError } = await supabaseAdmin
        .from("deck_files")
        .update({
          thumbnail_path: publicUrlData.publicUrl,
        })
        .eq("id", targetDeckId);

      if (updateError) {
        // Rollback: delete uploaded thumbnail and created records
        await supabaseAdmin.storage.from("deckthumbnail").remove([fileName]);
        if (createdDeckFileId) {
          await supabaseAdmin
            .from("deck_files")
            .delete()
            .eq("id", targetDeckId);
        }
        return NextResponse.json(
          {
            error: "DECK_FILE_UPDATE_FAILED",
            message: "Failed to update deck file with thumbnail",
          },
          { status: 500 },
        );
      }

      // Delete old thumbnail only after successful update
      if (oldThumbnailPath) {
        const oldThumbnailFileName = oldThumbnailPath.split("/").pop();
        if (oldThumbnailFileName) {
          await supabaseAdmin.storage
            .from("deckthumbnail")
            .remove([oldThumbnailFileName]);
        }
      }

      // Fetch the updated deck_files record
      const { data: updatedDeckFiles } = await supabaseAdmin
        .from("deck_files")
        .select("*")
        .eq("id", targetDeckId)
        .single();

      console.log("Thumbnail upload successful");
      return NextResponse.json({
        success: true,
        url: publicUrlData.publicUrl,
        deckFile: updatedDeckFiles,
      });
    }
  } catch (error: any) {
    console.error("Critical error in deck POST:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

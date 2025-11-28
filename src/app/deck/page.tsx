"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Copy,
  Loader2,
  LogOut,
  PenSquare,
  ShieldCheck,
  Trash2,
  UploadCloud,
  Link2,
  Sparkles,
  Shield,
  Clock4,
  Share2,
  Eye,
  BarChart3,
  Users,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from "recharts";

interface DeckFile {
  id: string;
  user_id: string;
  file_path: string;
  uploaded_at: string;
  thumbnail_path: string | null;
}

interface DeckShareLink {
  id: string;
  deck_id: string;
  token: string;
  access_level: "public" | "restricted" | "whitelisted";
  recipient_email: string | null;
  allowed_emails: string[] | null;
  allowed_domains: string[] | null;
  is_downloadable: boolean;
  expires_at: string | null;
  created_at: string;
}

interface DeckAnalyticsResponse {
  summary: {
    totalViews: number;
    uniqueViewers: number;
    avgDuration: number;
    completionRate: number;
  };
  pageEngagement: { page: number; views: number }[];
  recentViewers: {
    id: string;
    viewer: string;
    startedAt: string;
    duration: number | null;
    pagesViewed: number;
    completed: boolean | null;
    location: string;
  }[];
  viewsByDay: { date: string; count: number }[];
  viewerDetails: {
    viewerKey: string;
    viewer: string;
    sessions: number;
    totalDuration: number;
    avgSessionDuration: number;
    completionRate: number;
    lastViewedAt: string;
    location: string;
  }[];
  pageTiming: { page: number; avgDuration: number; views: number }[];
  locationStats: { location: string; count: number; percentage: number }[];
}

const ACCESS_LEVEL_LABELS: Record<DeckShareLink["access_level"], string> = {
  public: "Public",
  restricted: "Restricted",
  whitelisted: "Whitelisted",
};

const EXPIRATION_OPTIONS = ["7", "30", "90", "180", "365"];

export default function DeckPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [decks, setDecks] = useState<DeckFile[]>([]);
  const [shareLinks, setShareLinks] = useState<DeckShareLink[]>([]);
  const [analyticsToken, setAnalyticsToken] = useState<string>("");
  const [analyticsData, setAnalyticsData] =
    useState<DeckAnalyticsResponse | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [selectedDeckId, setSelectedDeckId] = useState<string>("");
  const [creatingLink, setCreatingLink] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [revokingToken, setRevokingToken] = useState<string | null>(null);
  const [appOrigin, setAppOrigin] = useState("");
  const [linkForm, setLinkForm] = useState({
    accessLevel: "restricted",
    expirationDays: "30",
    recipientEmail: "",
    allowedEmails: "",
    allowedDomains: "",
    isDownloadable: false,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setAppOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const verifyAuth = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user: currentUser },
          error,
        } = await supabase.auth.getUser();

        if (!mounted) return;

        if (error || !currentUser) {
          router.push("/auth/login");
          return;
        }

        setUser(currentUser);
      } catch (error) {
        console.error("Auth error:", error);
        router.push("/auth/login");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    verifyAuth();
    return () => {
      mounted = false;
    };
  }, [router]);

  const getDeckName = useCallback((filePath: string) => {
    const fileName = filePath.split("/").pop() || "";
    return (
      fileName.replace(/_\d+\.pdf$/i, "").replace(/_/g, " ") || "Untitled Deck"
    );
  }, []);

  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    if (Number.isNaN(date.valueOf())) return "Unknown";
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  const loadDecks = useCallback(async () => {
    if (!user) return;

    try {
      const response = await fetch("/api/deck/list");
      const data = await response.json();

      if (response.ok) {
        const fetchedDecks: DeckFile[] = data.deckFiles || [];
        setDecks(fetchedDecks);
        setSelectedDeckId((prev) => {
          if (prev && fetchedDecks.some((deck) => deck.id === prev)) {
            return prev;
          }
          return fetchedDecks[0]?.id || "";
        });
      } else {
        toast.error(data.error || "Failed to load decks");
      }
    } catch (error) {
      console.error("Error loading decks:", error);
      toast.error("Failed to load decks");
    }
  }, [user]);

  const loadShareLinks = useCallback(
    async (deckId?: string) => {
      if (!user) return;

      try {
        setShareLoading(true);
        const search = deckId ? `?deckId=${deckId}` : "";
        const response = await fetch(`/api/deck/share${search}`);
        const data = await response.json();

        if (response.ok) {
          setShareLinks(data.shareLinks || []);
        } else {
          toast.error(data.error || "Failed to load share links");
        }
      } catch (error) {
        console.error("Error loading share links:", error);
      } finally {
        setShareLoading(false);
      }
    },
    [user],
  );

  const loadAnalytics = useCallback(async (token: string) => {
    if (!token) return;
    setAnalyticsLoading(true);
    setAnalyticsError("");
    try {
      const response = await fetch(`/api/analytics/deck?token=${token}`);
      const data = await response.json();
      if (response.ok) {
        setAnalyticsData(data as DeckAnalyticsResponse);
      } else {
        setAnalyticsError(data.error || "Failed to load analytics");
        setAnalyticsData(null);
      }
    } catch (error) {
      console.error("Analytics error:", error);
      setAnalyticsError("Failed to load analytics");
      setAnalyticsData(null);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    loadDecks();
    loadShareLinks();
  }, [user, loadDecks, loadShareLinks]);

  const uploadDeckFile = async (file: File) => {
    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF file");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error("File size must be less than 20MB");
      return;
    }

    setUploading(true);
    try {
      const prepareResponse = await fetch("/api/deck/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "deck",
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        }),
      });

      const prepareData = await prepareResponse.json();

      if (!prepareResponse.ok) {
        toast.error(prepareData.error || "Failed to prepare upload");
        return;
      }

      const { signedUrl, storagePath } = prepareData as {
        signedUrl?: string;
        storagePath?: string;
      };

      if (!signedUrl || !storagePath) {
        toast.error("Invalid upload URL response");
        return;
      }

      const uploadResponse = await fetch(signedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        toast.error("Failed to upload deck to storage");
        return;
      }

      const finalizeResponse = await fetch("/api/deck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "deck", storagePath }),
      });

      const finalizeData = await finalizeResponse.json();

      if (finalizeResponse.ok) {
        toast.success("Deck uploaded successfully!");
        await loadDecks();
      } else {
        toast.error(finalizeData.error || "Failed to finalize deck upload");
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload deck");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadDeckFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      uploadDeckFile(file);
    }
  };

  const handleDelete = async (deckId: string) => {
    if (
      !confirm(
        "Delete this deck? All associated share links will also be removed.",
      )
    ) {
      return;
    }

    setDeleting(deckId);
    try {
      const response = await fetch(`/api/deck/delete?deckId=${deckId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Deck deleted successfully");
        await loadDecks();
        await loadShareLinks();
      } else {
        toast.error(data.error || "Failed to delete deck");
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete deck");
    } finally {
      setDeleting(null);
    }
  };

  const handleRename = async (deckId: string) => {
    if (!renameValue.trim()) {
      toast.error("Please enter a name");
      return;
    }

    setRenaming(deckId);
    try {
      const response = await fetch("/api/deck/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckId, newName: renameValue }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Deck renamed successfully");
        setRenaming(null);
        setRenameValue("");
        await loadDecks();
      } else {
        toast.error(data.error || "Failed to rename deck");
      }
    } catch (error) {
      console.error("Rename error:", error);
      toast.error("Failed to rename deck");
    } finally {
      setRenaming(null);
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  const handleGenerateLink = async () => {
    if (!selectedDeckId) {
      toast.error("Select a deck to share");
      return;
    }
    if (
      linkForm.accessLevel === "whitelisted" &&
      !linkForm.recipientEmail.trim()
    ) {
      toast.error("Recipient email is required for whitelisted links");
      return;
    }

    setCreatingLink(true);
    try {
      const allowedEmails = linkForm.allowedEmails
        .split(",")
        .map((email) => email.trim())
        .filter(Boolean);
      const allowedDomains = linkForm.allowedDomains
        .split(",")
        .map((domain) => domain.trim())
        .filter(Boolean);

      const response = await fetch("/api/deck/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deckId: selectedDeckId,
          access_level: linkForm.accessLevel,
          recipient_email: linkForm.recipientEmail.trim() || null,
          allowed_emails: allowedEmails.length ? allowedEmails : null,
          allowed_domains: allowedDomains.length ? allowedDomains : null,
          expiration_days: linkForm.expirationDays,
          is_downloadable: linkForm.isDownloadable,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Share link created");
        await loadShareLinks(selectedDeckId);
        setLinkForm((prev) => ({
          ...prev,
          allowedDomains: "",
          allowedEmails: "",
          recipientEmail: "",
        }));
      } else {
        toast.error(data.error || "Failed to create share link");
      }
    } catch (error) {
      console.error("Share link error:", error);
      toast.error("Failed to create share link");
    } finally {
      setCreatingLink(false);
    }
  };

  const handleCopyLink = async (token: string) => {
    try {
      const shareUrl = appOrigin
        ? `${appOrigin}/view?token=${token}`
        : `${window.location.origin}/view?token=${token}`;
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleRevokeLink = async (token: string) => {
    setRevokingToken(token);
    try {
      const response = await fetch(`/api/deck/share?token=${token}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (response.ok) {
        toast.success("Share link revoked");
        await loadShareLinks(selectedDeckId);
      } else {
        toast.error(data.error || "Failed to revoke share link");
      }
    } catch (error) {
      console.error("Revoke error:", error);
      toast.error("Failed to revoke share link");
    } finally {
      setRevokingToken(null);
    }
  };

  const handleViewAnalytics = (token: string) => {
    setAnalyticsToken(token);
    loadAnalytics(token);
  };

  const deckNameMap = useMemo(() => {
    const map = new Map<string, string>();
    decks.forEach((deck) => map.set(deck.id, getDeckName(deck.file_path)));
    return map;
  }, [decks, getDeckName]);

  const stats = useMemo(() => {
    const latestDeck = decks[0];
    const upcomingExpiry = shareLinks.reduce<string | null>((soonest, link) => {
      if (!link.expires_at) return soonest;
      if (!soonest) return link.expires_at;
      return new Date(link.expires_at) < new Date(soonest)
        ? link.expires_at
        : soonest;
    }, null);

    return [
      {
        label: "Decks",
        value: decks.length,
        icon: UploadCloud,
      },
      {
        label: "Share Links",
        value: shareLinks.length,
        icon: Share2,
      },
      {
        label: "Last Upload",
        value: latestDeck ? formatDate(latestDeck.uploaded_at) : "N/A",
        icon: Sparkles,
      },
      {
        label: "Next Expiry",
        value: upcomingExpiry ? formatDate(upcomingExpiry) : "None",
        icon: Clock4,
      },
    ];
  }, [decks, shareLinks, formatDate]);

  const formatDurationSeconds = (seconds: number) => {
    if (!seconds) return "0s";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="relative isolate bg-slate-950 border-b border-slate-900/50">
        <div className="container mx-auto px-4 py-12">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-slate-400">
                RaiseGate Deck Studio
              </p>
              <h1 className="mt-4 text-3xl font-semibold sm:text-4xl">
                Share-ready decks, crafted for wow moments
              </h1>
              <p className="mt-3 text-slate-300 max-w-2xl">
                Upload polished decks, generate tamper-proof sharing links, and
                control your narrative with download and verification controls.
              </p>
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-300">
              <span>{user?.email}</span>
              <Button
                variant="outline"
                size="sm"
                className="border-slate-700 text-slate-200 hover:bg-slate-800"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg shadow-black/20"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-400">{stat.label}</p>
                  <stat.icon className="w-5 h-5 text-slate-500" />
                </div>
                <p className="mt-4 text-xl font-semibold">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10 space-y-10">
        <div className="grid gap-8 lg:grid-cols-2">
          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-slate-200" />
                Upload Deck
              </CardTitle>
              <CardDescription>
                Drop a PDF to deploy it directly into RaiseGate (max 20MB)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className="border-2 border-dashed border-slate-700 rounded-2xl p-8 text-center transition hover:border-slate-400 hover:bg-slate-900/50 cursor-pointer"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="flex flex-col items-center gap-4">
                  <div className="p-4 rounded-full bg-slate-800/60">
                    {uploading ? (
                      <Loader2 className="w-6 h-6 animate-spin text-white" />
                    ) : (
                      <UploadCloud className="w-6 h-6 text-slate-200" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">
                      {uploading
                        ? "Uploading your deck..."
                        : "Click or drop a PDF"}
                    </p>
                    <p className="text-sm text-slate-400">
                      {uploading
                        ? "Hang tight while we secure your file"
                        : "AES encrypted upload • unlimited revisions"}
                    </p>
                  </div>
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={handleFileInputChange}
                    disabled={uploading}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Shield className="w-5 h-5 text-slate-200" />
                Generate Secure Link
              </CardTitle>
              <CardDescription>
                Choose your deck, tailor access, and issue a branded share link
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-slate-300 flex flex-col gap-2">
                <label htmlFor="deckSelect">Deck to share</label>
                <select
                  id="deckSelect"
                  value={selectedDeckId}
                  onChange={(e) => setSelectedDeckId(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-100"
                >
                  <option value="">Select deck</option>
                  {decks.map((deck) => (
                    <option key={deck.id} value={deck.id}>
                      {getDeckName(deck.file_path)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="text-sm text-slate-300 flex flex-col gap-2">
                  <label htmlFor="accessLevel">Access level</label>
                  <select
                    id="accessLevel"
                    value={linkForm.accessLevel}
                    onChange={(e) =>
                      setLinkForm((prev) => ({
                        ...prev,
                        accessLevel: e.target.value,
                      }))
                    }
                    className="bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-100"
                  >
                    <option value="restricted">Restricted (magic link)</option>
                    <option value="public">Public</option>
                    <option value="whitelisted">Whitelisted email</option>
                  </select>
                </div>
                <div className="text-sm text-slate-300 flex flex-col gap-2">
                  <label htmlFor="expiration">Expires in</label>
                  <select
                    id="expiration"
                    value={linkForm.expirationDays}
                    onChange={(e) =>
                      setLinkForm((prev) => ({
                        ...prev,
                        expirationDays: e.target.value,
                      }))
                    }
                    className="bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-100"
                  >
                    {EXPIRATION_OPTIONS.map((day) => (
                      <option key={day} value={day}>
                        {day} days
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {linkForm.accessLevel === "whitelisted" && (
                <div className="space-y-3">
                  <Input
                    placeholder="Recipient email"
                    value={linkForm.recipientEmail}
                    onChange={(e) =>
                      setLinkForm((prev) => ({
                        ...prev,
                        recipientEmail: e.target.value,
                      }))
                    }
                    className="bg-slate-900 border-slate-700 text-slate-100"
                  />
                  <Input
                    placeholder="Allowed emails (comma separated)"
                    value={linkForm.allowedEmails}
                    onChange={(e) =>
                      setLinkForm((prev) => ({
                        ...prev,
                        allowedEmails: e.target.value,
                      }))
                    }
                    className="bg-slate-900 border-slate-700 text-slate-100"
                  />
                  <Input
                    placeholder="Allowed domains (comma separated)"
                    value={linkForm.allowedDomains}
                    onChange={(e) =>
                      setLinkForm((prev) => ({
                        ...prev,
                        allowedDomains: e.target.value,
                      }))
                    }
                    className="bg-slate-900 border-slate-700 text-slate-100"
                  />
                </div>
              )}

              <label className="flex items-center gap-3 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={linkForm.isDownloadable}
                  onChange={(e) =>
                    setLinkForm((prev) => ({
                      ...prev,
                      isDownloadable: e.target.checked,
                    }))
                  }
                  className="form-checkbox h-4 w-4 rounded border-slate-600 bg-slate-900 text-white focus:ring-slate-500"
                />
                Allow download access
              </label>

              <Button
                className="w-full gap-2 bg-white text-slate-900 hover:bg-slate-200"
                onClick={handleGenerateLink}
                disabled={creatingLink}
              >
                {creatingLink ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Generate secure link
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <Card className="bg-slate-900/70 border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="w-5 h-5 text-slate-200" />
                Active Share Links
              </CardTitle>
              <CardDescription>
                Rotate, revoke, or copy trackable links
              </CardDescription>
            </CardHeader>
            <CardContent>
              {shareLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-white" />
                </div>
              ) : shareLinks.length === 0 ? (
                <div className="border border-dashed border-slate-700 rounded-2xl p-8 text-center text-slate-400">
                  No share links yet. Generate one to get started.
                </div>
              ) : (
                <div className="space-y-4">
                  {shareLinks.map((link) => (
                    <div
                      key={link.id}
                      className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-start gap-3 justify-between">
                        <div>
                          <p className="text-sm uppercase tracking-widest text-slate-500">
                            {deckNameMap.get(link.deck_id) || "Deck"}
                          </p>
                          <p className="text-base font-semibold">
                            {ACCESS_LEVEL_LABELS[link.access_level]}
                          </p>
                          <p className="text-xs text-slate-400">
                            Created {formatDate(link.created_at)} •{" "}
                            {link.expires_at
                              ? `Expires ${formatDate(link.expires_at)}`
                              : "No expiry"}
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-2 rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-200">
                          <ShieldCheck className="w-3 h-3" />
                          {link.is_downloadable ? "Downloadable" : "View only"}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-slate-700 text-slate-200 hover:bg-slate-800"
                          onClick={() => handleViewAnalytics(link.token)}
                        >
                          {analyticsToken === link.token && analyticsLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <BarChart3 className="w-4 h-4 mr-2" />
                          )}
                          Analytics
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-slate-700 text-slate-200 hover:bg-slate-800"
                          onClick={() => handleCopyLink(link.token)}
                        >
                          <Copy className="w-4 h-4 mr-2" />
                          Copy Link
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-rose-400 hover:bg-rose-500/10"
                          onClick={() => handleRevokeLink(link.token)}
                          disabled={revokingToken === link.token}
                        >
                          {revokingToken === link.token ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                          <span className="ml-2">Revoke</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PenSquare className="w-5 h-5 text-slate-200" />
                Deck Library
              </CardTitle>
              <CardDescription>
                Rename, delete, or spotlight decks for linking
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {decks.length === 0 ? (
                <div className="border border-dashed border-slate-700 rounded-2xl p-8 text-center text-slate-400">
                  You haven&apos;t uploaded a deck yet.
                </div>
              ) : (
                decks.map((deck) => (
                  <div
                    key={deck.id}
                    className={`rounded-2xl border ${
                      selectedDeckId === deck.id
                        ? "border-slate-200 bg-slate-200/10"
                        : "border-slate-800 bg-slate-900/50"
                    } p-4`}
                  >
                    <div className="flex flex-wrap items-start gap-4 justify-between">
                      <div>
                        {renaming === deck.id ? (
                          <div className="flex flex-wrap gap-2">
                            <Input
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              className="bg-slate-900 border-slate-700 text-slate-100"
                              placeholder="Enter new name"
                              autoFocus
                            />
                            <Button
                              size="sm"
                              onClick={() => handleRename(deck.id)}
                              className="bg-white text-slate-900 hover:bg-slate-200"
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-slate-700 text-slate-200"
                              onClick={() => {
                                setRenaming(null);
                                setRenameValue("");
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <div>
                            <p className="text-lg font-semibold">
                              {getDeckName(deck.file_path)}
                            </p>
                            <p className="text-xs text-slate-400">
                              Uploaded {formatDate(deck.uploaded_at)}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-slate-700 text-slate-200"
                          onClick={() => {
                            setSelectedDeckId(deck.id);
                            toast.success("Deck selected for sharing");
                          }}
                        >
                          <Share2 className="w-4 h-4 mr-1" />
                          Use for link
                        </Button>
                        {renaming !== deck.id && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-slate-200 hover:bg-slate-800"
                              onClick={() => {
                                setRenameValue(getDeckName(deck.file_path));
                                setRenaming(deck.id);
                              }}
                            >
                              <PenSquare className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-rose-400 hover:bg-rose-500/10"
                              onClick={() => handleDelete(deck.id)}
                              disabled={deleting === deck.id}
                            >
                              {deleting === deck.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="bg-slate-900/70 border-slate-800">
          <CardHeader className="space-y-2">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-slate-200" />
              Deck Analytics
            </CardTitle>
            <CardDescription>
              Select any share link to visualize verified viewer engagement.
            </CardDescription>
            {analyticsToken && (
              <p className="text-xs text-slate-500">
                Viewing analytics for token{" "}
                <span className="font-mono">
                  {analyticsToken.slice(0, 10)}…
                </span>
              </p>
            )}
          </CardHeader>
          <CardContent>
            {analyticsError && (
              <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {analyticsError}
              </div>
            )}
            {analyticsLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-white" />
              </div>
            ) : !analyticsToken ? (
              <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-slate-400">
                Tap “Analytics” on any share link to populate this panel.
              </div>
            ) : analyticsData ? (
              <div className="space-y-8">
                <div className="grid gap-4 md:grid-cols-4">
                  {[
                    {
                      label: "Total Views",
                      value: analyticsData.summary.totalViews,
                      icon: Eye,
                    },
                    {
                      label: "Unique Viewers",
                      value: analyticsData.summary.uniqueViewers,
                      icon: Users,
                    },
                    {
                      label: "Avg. Duration",
                      value: formatDurationSeconds(
                        analyticsData.summary.avgDuration,
                      ),
                      icon: Clock4,
                    },
                    {
                      label: "Completion Rate",
                      value: `${analyticsData.summary.completionRate}%`,
                      icon: ShieldCheck,
                    },
                  ].map((metric) => (
                    <div
                      key={metric.label}
                      className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
                    >
                      <div className="flex items-center justify-between text-xs uppercase tracking-widest text-slate-500">
                        <span>{metric.label}</span>
                        <metric.icon className="w-4 h-4 text-slate-400" />
                      </div>
                      <p className="mt-3 text-xl font-semibold">
                        {metric.value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                    <p className="text-sm font-semibold text-slate-200 mb-3">
                      Views Over Time
                    </p>
                    {analyticsData.viewsByDay.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        No timeline data yet.
                      </p>
                    ) : (
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={analyticsData.viewsByDay}>
                            <defs>
                              <linearGradient
                                id="viewsGradient"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="5%"
                                  stopColor="#ffffff"
                                  stopOpacity={0.3}
                                />
                                <stop
                                  offset="95%"
                                  stopColor="#ffffff"
                                  stopOpacity={0}
                                />
                              </linearGradient>
                            </defs>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="rgba(255,255,255,0.08)"
                            />
                            <XAxis
                              dataKey="date"
                              stroke="#94a3b8"
                              fontSize={12}
                            />
                            <YAxis stroke="#94a3b8" fontSize={12} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "rgba(15,23,42,0.9)",
                                border: "1px solid rgba(148,163,184,0.2)",
                                borderRadius: "0.75rem",
                                color: "white",
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey="count"
                              stroke="#ffffff"
                              fillOpacity={1}
                              fill="url(#viewsGradient)"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                    <p className="text-sm font-semibold text-slate-200 mb-3">
                      Hot Pages
                    </p>
                    {analyticsData.pageEngagement.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        Waiting for viewers to flip through.
                      </p>
                    ) : (
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={analyticsData.pageEngagement.slice(0, 6)}
                            layout="vertical"
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="rgba(255,255,255,0.08)"
                            />
                            <XAxis
                              type="number"
                              stroke="#94a3b8"
                              fontSize={12}
                            />
                            <YAxis
                              type="category"
                              dataKey={(entry) => `Page ${entry.page}`}
                              width={70}
                              stroke="#94a3b8"
                              fontSize={12}
                            />
                            <Tooltip
                              cursor={{ fill: "rgba(255,255,255,0.05)" }}
                              contentStyle={{
                                backgroundColor: "rgba(15,23,42,0.9)",
                                border: "1px solid rgba(148,163,184,0.2)",
                                borderRadius: "0.75rem",
                                color: "white",
                              }}
                            />
                            <Bar dataKey="views" radius={[0, 10, 10, 0]}>
                              {analyticsData.pageEngagement
                                .slice(0, 6)
                                .map((entry, index) => (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={`rgba(255,255,255,${0.7 - index * 0.1})`}
                                  />
                                ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                  <p className="text-sm font-semibold text-slate-200 mb-3">
                    Recent Sessions
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-slate-200">
                      <thead>
                        <tr className="text-xs uppercase tracking-wide text-slate-500">
                          <th className="py-2 text-left">Viewer</th>
                          <th className="py-2 text-left">Location</th>
                          <th className="py-2 text-left">Duration</th>
                          <th className="py-2 text-left">Pages</th>
                          <th className="py-2 text-left">Completed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analyticsData.recentViewers
                          .slice(0, 6)
                          .map((viewer) => (
                            <tr
                              key={viewer.id}
                              className="border-t border-slate-800/70"
                            >
                              <td className="py-2">{viewer.viewer}</td>
                              <td className="py-2 text-slate-400">
                                {viewer.location}
                              </td>
                              <td className="py-2">
                                {formatDurationSeconds(viewer.duration || 0)}
                              </td>
                              <td className="py-2 text-slate-400">
                                {viewer.pagesViewed}
                              </td>
                              <td className="py-2">
                                {viewer.completed ? (
                                  <span className="text-emerald-400">Yes</span>
                                ) : (
                                  <span className="text-slate-500">No</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        {analyticsData.recentViewers.length === 0 && (
                          <tr>
                            <td
                              className="py-4 text-center text-slate-500"
                              colSpan={5}
                            >
                              No sessions recorded yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-slate-400">
                Analytics unavailable. Try loading a different link.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

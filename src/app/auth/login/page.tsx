"use client";

import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, ShieldCheck, Sparkles, UploadCloud } from "lucide-react";
import { useState } from "react";

const benefits = [
  {
    title: "Tamper proof links",
    description: "Launch verified viewing sessions with one tap.",
    icon: ShieldCheck,
  },
  {
    title: "Bulk uploads",
    description: "Drop in updated decks without breaking share links.",
    icon: UploadCloud,
  },
  {
    title: "Magic analytics",
    description: "Track attention spans and completion rates.",
    icon: Sparkles,
  },
];

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
      }
    } catch (err) {
      setError("An unexpected error occurred");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f9f5fb] text-slate-900">
      <header
        className="relative overflow-hidden text-white"
        style={{
          backgroundColor: "#771144",
          backgroundImage:
            "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.08) 25%, transparent 25%, transparent 50%), linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.08) 75%, transparent 75%)",
          backgroundSize: "50px 50px",
        }}
      >
        <div className="container mx-auto px-6 py-14 lg:py-20 grid gap-12 lg:grid-cols-[1.1fr_0.9fr] items-center">
          <div className="space-y-6">
            <p className="text-xs uppercase tracking-[0.4em] text-white/70">
              RaiseGate Deck Sharing
            </p>
            <div className="space-y-4">
              <h1 className="text-3xl font-semibold sm:text-4xl">
                Sign in to secure every deck interaction.
              </h1>
              <p className="text-base text-white/80">
                Upload, customize, and monitor your investor-facing decks from a
                single branded workspace. Use your RaiseGate account to
                continue.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {benefits.map((benefit) => (
                <div
                  key={benefit.title}
                  className="rounded-2xl border border-white/30 bg-white/10 p-4"
                >
                  <div className="flex items-center gap-3 text-white">
                    <benefit.icon className="w-4 h-4" />
                    <p className="text-sm font-semibold">{benefit.title}</p>
                  </div>
                  <p className="mt-2 text-xs text-white/70">
                    {benefit.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <Card className="w-full border-white/15 bg-white text-slate-900 shadow-2xl">
            <CardHeader className="space-y-2 text-center">
              <div className="inline-flex items-center justify-center rounded-full border border-slate-200 p-3">
                <ShieldCheck className="w-5 h-5 text-[#771144]" />
              </div>
              <CardTitle className="text-2xl">Secure sign in</CardTitle>
              <CardDescription>
                Use your Google account to unlock RaiseGate
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {error && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  {error}
                </div>
              )}
              <Button
                onClick={handleLogin}
                disabled={loading}
                className="w-full gap-2 bg-[#771144] text-white hover:bg-[#5d0d36]"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Continue with Google"
                )}
              </Button>
              <p className="text-xs text-slate-500 text-center">
                RaiseGate only stores the metadata needed to verify your access.
                We never touch your deck content.
              </p>
            </CardContent>
          </Card>
        </div>
      </header>
    </div>
  );
}

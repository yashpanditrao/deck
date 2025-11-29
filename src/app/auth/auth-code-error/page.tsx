"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function AuthCodeError() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#f9f5fb] text-slate-900 flex items-center justify-center px-6">
      <div className="max-w-md w-full space-y-6 rounded-2xl border border-rose-100 bg-white p-8 text-center shadow-lg">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-600">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Sign-in failed
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            We couldn&apos;t verify your OAuth session. Please close this tab
            and try again, or return to the homepage to restart the login flow.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => router.back()}
          >
            Go back
          </Button>
          <Button className="w-full sm:w-auto" asChild>
            <Link href="/">Return home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

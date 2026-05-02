"use client";

/**
 * @module AgentDisconnectedPage
 * @description Pairing-first page shown when no agent is connected.
 * Composes the pairing code card, discovered agents list, feature grid,
 * and requirements footer.
 * @license GPL-3.0-only
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { useMutation } from "convex/react";
import { useConvexAvailable } from "@/app/ConvexClientProvider";
import { cmdPairingApi } from "@/lib/community-api-drones";
import { usePairingStore } from "@/stores/pairing-store";
import { useAuthStore } from "@/stores/auth-store";
import { SignInModal } from "@/components/auth/SignInModal";
import {
  PairingCodeCard,
  getInstallCommand,
} from "./disconnected/PairingCodeCard";
import { DiscoveredAgentsList } from "./disconnected/DiscoveredAgentsList";
import { FeatureGrid } from "./disconnected/FeatureGrid";
import { RequirementsFooter } from "./disconnected/RequirementsFooter";

const CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes

interface AgentDisconnectedPageProps {
  onOpenPairing?: () => void;
}

type PreGenerateMutation = ((args: Record<string, never>) => Promise<{
  code: string;
}>) | null;

export function AgentDisconnectedPage({
  onOpenPairing,
}: AgentDisconnectedPageProps) {
  const convexAvailable = useConvexAvailable();
  if (convexAvailable) {
    return <AgentDisconnectedPageWithConvex onOpenPairing={onOpenPairing} />;
  }
  return (
    <AgentDisconnectedPageBase
      onOpenPairing={onOpenPairing}
      preGenerate={null}
      requiresSignIn={false}
    />
  );
}

function AgentDisconnectedPageWithConvex({
  onOpenPairing,
}: AgentDisconnectedPageProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const preGenerate = useMutation(cmdPairingApi.preGenerateCode);
  return (
    <AgentDisconnectedPageBase
      onOpenPairing={onOpenPairing}
      preGenerate={isAuthenticated ? (preGenerate as PreGenerateMutation) : null}
      requiresSignIn={!isAuthenticated && !isAuthLoading}
    />
  );
}

function AgentDisconnectedPageBase({
  onOpenPairing,
  preGenerate,
  requiresSignIn,
}: AgentDisconnectedPageProps & {
  preGenerate: PreGenerateMutation;
  requiresSignIn: boolean;
}) {
  const t = useTranslations("disconnectedPage");

  const [code, setCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedInstall, setCopiedInstall] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(CODE_TTL_MS / 1000);
  const [expired, setExpired] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [signInOpen, setSignInOpen] = useState(false);

  const expiryRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const codeGeneratedAt = useRef<number>(0);

  const discoveredAgents = usePairingStore((s) => s.discoveredAgents);

  const generateCode = useCallback(async () => {
    setExpired(false);
    setCopiedCode(false);
    setCopiedInstall(false);
    setCodeError(null);

    const fallback = () =>
      Array.from(
        { length: 6 },
        () =>
          "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]
      ).join("");

    let generated: string;
    if (preGenerate) {
      try {
        const result = await preGenerate({});
        generated = result.code;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setCodeError(msg);
        setCode(null);
        return;
      }
    } else {
      generated = fallback();
    }

    setCode(generated);
    codeGeneratedAt.current = Date.now();
    setSecondsLeft(CODE_TTL_MS / 1000);

    // Start countdown
    if (expiryRef.current) clearInterval(expiryRef.current);
    expiryRef.current = setInterval(() => {
      const elapsed = Date.now() - codeGeneratedAt.current;
      const remaining = Math.max(
        0,
        Math.ceil((CODE_TTL_MS - elapsed) / 1000)
      );
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        setExpired(true);
        if (expiryRef.current) clearInterval(expiryRef.current);
      }
    }, 1000);
  }, [preGenerate]);

  // Generate code on mount, but only when pairing is actually possible.
  // When `requiresSignIn` is true, we show a sign-in CTA instead and never
  // fire the mutation that would throw "Not authenticated" server-side.
  useEffect(() => {
    if (requiresSignIn) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) void generateCode();
    });
    return () => {
      cancelled = true;
      if (expiryRef.current) clearInterval(expiryRef.current);
    };
  }, [generateCode, requiresSignIn]);

  function handleCopyCode() {
    if (!code) return;
    navigator.clipboard
      .writeText(code)
      .then(() => {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      })
      .catch(() => {});
  }

  function handleCopyInstall() {
    if (!code) return;
    navigator.clipboard
      .writeText(getInstallCommand(code))
      .then(() => {
        setCopiedInstall(true);
        setTimeout(() => setCopiedInstall(false), 2000);
      })
      .catch(() => {});
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-10">
        {/* Hero */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 text-sm font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded-full">
            <AlertTriangle size={12} />
            {t("alpha")}
          </div>
          <h1 className="text-3xl font-display font-bold text-text-primary">
            {t("pairYourDrone")}
          </h1>
          <p className="text-text-secondary text-base max-w-lg mx-auto">
            {t("installAndConnect")}
          </p>
        </div>

        {/* Pairing code hero */}
        <div className="max-w-md mx-auto">
          <PairingCodeCard
            requiresSignIn={requiresSignIn}
            codeError={codeError}
            code={code}
            expired={expired}
            secondsLeft={secondsLeft}
            copiedCode={copiedCode}
            copiedInstall={copiedInstall}
            onSignIn={() => setSignInOpen(true)}
            onRegenerate={generateCode}
            onCopyCode={handleCopyCode}
            onCopyInstall={handleCopyInstall}
          />
        </div>

        <DiscoveredAgentsList
          agents={discoveredAgents}
          onSelect={onOpenPairing}
        />

        <FeatureGrid />

        <RequirementsFooter />
      </div>
      <SignInModal
        open={signInOpen}
        onClose={() => setSignInOpen(false)}
      />
    </div>
  );
}

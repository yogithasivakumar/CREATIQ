"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import { GenerateCaptionPanel } from "@/components/instagram/GenerateCaptionPanel";
import { PreviewPublishPanel } from "@/components/instagram/PreviewPublishPanel";
import { SelectImagePanel } from "@/components/instagram/SelectImagePanel";
import type { InstagramStatus } from "@/components/instagram/types";
import type { Asset } from "@/components/library/types";

function InstagramPublishingContent() {
  const searchParams = useSearchParams();

  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [instagramStatus, setInstagramStatus] = useState<InstagramStatus | null>(null);
  const [statusError, setStatusError] = useState("");
  const [connectError, setConnectError] = useState("");
  const [oauthNotice, setOauthNotice] = useState("");

  function loadStatus() {
    apiFetch<InstagramStatus>("/api/instagram/status")
      .then(setInstagramStatus)
      .catch((err) => {
        setStatusError(err instanceof ApiError ? err.message : "Could not load Instagram status.");
      });
  }

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    function handleOauthRedirect() {
      const result = searchParams.get("instagram");
      if (result === "connected") {
        setOauthNotice("Instagram account connected.");
        loadStatus();
      } else if (result === "error") {
        const reason = searchParams.get("reason") ?? "unknown error";
        setOauthNotice(`Could not connect Instagram: ${reason}`);
      }
    }

    handleOauthRedirect();
  }, [searchParams]);

  async function handleConnect() {
    setConnectError("");
    try {
      const data = await apiFetch<{ url: string }>("/api/instagram/connect");
      window.location.href = data.url;
    } catch (err) {
      setConnectError(err instanceof ApiError ? err.message : "Could not start the Instagram connection.");
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-aubergine">Instagram Publishing</h1>
          <p className="mt-1 text-sm text-aubergine/70">
            Create engaging captions with AI and publish to Instagram directly.
          </p>
        </div>
      </header>

      {oauthNotice && (
        <p
          role="status"
          className={`mb-4 rounded-xl px-4 py-3 text-sm ${
            oauthNotice.startsWith("Could not")
              ? "bg-red-50 text-red-600"
              : "bg-green-50 text-green-700"
          }`}
        >
          {oauthNotice}
        </p>
      )}

      {statusError && (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {statusError}
        </p>
      )}

      {connectError && (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {connectError}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:h-[calc(100vh-14rem)]">
          <SelectImagePanel selectedAsset={selectedAsset} onSelect={setSelectedAsset} />
        </div>
        <div className="lg:h-[calc(100vh-14rem)]">
          <GenerateCaptionPanel
            selectedAsset={selectedAsset}
            caption={caption}
            hashtags={hashtags}
            onCaptionChange={setCaption}
            onHashtagsChange={setHashtags}
          />
        </div>
        <div className="lg:h-[calc(100vh-14rem)]">
          <PreviewPublishPanel
            selectedAsset={selectedAsset}
            caption={caption}
            hashtags={hashtags}
            instagramStatus={instagramStatus}
            onConnect={handleConnect}
            onPublished={() => {
              setCaption("");
              setHashtags([]);
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default function InstagramPublishingPage() {
  return (
    <Suspense fallback={null}>
      <InstagramPublishingContent />
    </Suspense>
  );
}

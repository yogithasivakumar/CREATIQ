"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { apiFetch, ApiError } from "@/lib/api";
import { NavIcon } from "@/components/dashboard/NavIcon";
import type { Project } from "@/components/library/types";

const MIN_PROMPT_LENGTH = 1;
const MAX_PROMPT_LENGTH = 1000;

// Staged loading copy, shown by elapsed time only — not a fabricated
// progress percentage, since the backend gives no real progress
// signal for a single-shot generation request.
const LOADING_STAGES = [
  { afterMs: 0, text: "Preparing your prompt..." },
  { afterMs: 2000, text: "Generating your image..." },
  { afterMs: 8000, text: "Still working — this can take a little longer..." },
];

export default function GenerateImagePage() {
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState("");
  const [imageBase64, setImageBase64] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadingText, setLoadingText] = useState(LOADING_STAGES[0].text);
  const loadingTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [projects, setProjects] = useState<Project[]>([]);
  const [saveProjectId, setSaveProjectId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    return () => {
      for (const timer of loadingTimers.current) {
        clearTimeout(timer);
      }
    };
  }, []);

  useEffect(() => {
    apiFetch<{ projects: Project[] }>("/api/projects")
      .then((data) => setProjects(data.projects))
      .catch(() => {
        // Non-fatal: the project picker just stays empty; the user
        // can still save without a project.
      });
  }, []);

  function startLoadingStages() {
    setLoadingText(LOADING_STAGES[0].text);
    loadingTimers.current = LOADING_STAGES.slice(1).map((stage) =>
      setTimeout(() => setLoadingText(stage.text), stage.afterMs)
    );
  }

  function stopLoadingStages() {
    for (const timer of loadingTimers.current) {
      clearTimeout(timer);
    }
    loadingTimers.current = [];
  }

  async function generateImage() {
    const trimmedPrompt = prompt.trim();

    if (trimmedPrompt.length < MIN_PROMPT_LENGTH) {
      setError("Please describe the image you want to create.");
      return;
    }

    if (trimmedPrompt.length > MAX_PROMPT_LENGTH) {
      setError(`Please shorten your prompt to ${MAX_PROMPT_LENGTH} characters or fewer.`);
      return;
    }

    setLoading(true);
    setError("");
    setSaved(false);
    setSaveError("");
    startLoadingStages();

    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error("Please sign in to generate images.");
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ prompt: trimmedPrompt }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.ok || !data.image) {
        throw new Error(data.error || "Image generation failed. Please try again.");
      }

      setImage(`data:${data.contentType};base64,${data.image}`);
      setImageBase64(data.image);
    } catch (err) {
      setImage("");
      setImageBase64("");
      setError(
        err instanceof Error
          ? err.message
          : "Could not connect to the image-generation API."
      );
    } finally {
      stopLoadingStages();
      setLoading(false);
    }
  }

  async function saveToLibrary() {
    if (!imageBase64) return;

    setSaving(true);
    setSaveError("");

    try {
      await apiFetch("/api/assets", {
        method: "POST",
        body: JSON.stringify({
          image: imageBase64,
          prompt: prompt.trim(),
          projectId: saveProjectId || undefined,
        }),
      });
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Could not save this image.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-aubergine">Generate Image</h1>
        <p className="mt-1 text-sm text-aubergine/70">
          Describe your vision and let AI bring it to life.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-aubergine/10 bg-white p-6">
          <label
            htmlFor="prompt"
            className="mb-2 block text-sm font-medium text-aubergine"
          >
            Describe your image
          </label>

          <textarea
            id="prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            maxLength={MAX_PROMPT_LENGTH}
            disabled={loading}
            placeholder="A futuristic city floating above the clouds at sunset..."
            className="min-h-36 w-full resize-y rounded-xl border border-aubergine/20 p-4 outline-none transition focus:border-marigold disabled:cursor-not-allowed disabled:opacity-60"
          />

          <p className="mt-2 text-right text-xs text-aubergine/50">
            {prompt.length}/{MAX_PROMPT_LENGTH}
          </p>

          <button
            onClick={generateImage}
            disabled={loading}
            className="mt-4 w-full rounded-xl bg-aubergine px-5 py-3 font-semibold text-white transition hover:bg-aubergine/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? loadingText : error ? "Try again" : "Generate image"}
          </button>

          {error && (
            <p role="alert" className="mt-4 text-sm text-red-600">
              {error}
            </p>
          )}

          <p className="mt-4 text-xs text-aubergine/40">
            Your prompt is automatically structured for better results before
            generation. This improves clarity but does not guarantee a
            perfect image every time.
          </p>
        </div>

        <div>
          <div className="flex min-h-80 items-center justify-center overflow-hidden rounded-2xl border border-aubergine/10 bg-silver p-5">
            {loading ? (
              <div className="max-w-xs text-center">
                <div className="mb-4 animate-pulse text-5xl">✦</div>
                <p className="text-sm leading-6 text-aubergine/60">
                  {loadingText}
                </p>
              </div>
            ) : image ? (
              <img
                src={image}
                alt={prompt}
                className="max-h-[520px] w-full rounded-xl object-contain"
              />
            ) : (
              <div className="max-w-xs text-center">
                <div className="mb-4 text-5xl">✦</div>
                <h3 className="mb-2 text-lg font-semibold text-aubergine">
                  Your canvas awaits
                </h3>
                <p className="text-sm leading-6 text-aubergine/60">
                  Your generated image will appear here.
                </p>
              </div>
            )}
          </div>

          {image && !loading && (
            <div className="mt-4 rounded-2xl border border-aubergine/10 bg-white p-4">
              {saved ? (
                <p className="flex items-center gap-2 text-sm font-medium text-green-700">
                  <NavIcon name="save" className="h-4 w-4" />
                  Saved to your library.
                </p>
              ) : (
                <>
                  <label
                    htmlFor="save-project"
                    className="mb-2 block text-xs font-medium text-aubergine/70"
                  >
                    Save to a project (optional)
                  </label>
                  <div className="flex gap-3">
                    <select
                      id="save-project"
                      value={saveProjectId}
                      onChange={(e) => setSaveProjectId(e.target.value)}
                      disabled={saving}
                      className="flex-1 rounded-xl border border-aubergine/15 px-3 py-2 text-sm text-aubergine outline-none focus:border-marigold"
                    >
                      <option value="">No project</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={saveToLibrary}
                      disabled={saving}
                      className="flex items-center gap-2 rounded-xl bg-marigold px-4 py-2 text-sm font-semibold text-aubergine transition hover:bg-marigold/90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <NavIcon name="save" className="h-4 w-4" />
                      {saving ? "Saving..." : "Save to Library"}
                    </button>
                  </div>
                  {saveError && (
                    <p role="alert" className="mt-2 text-sm text-red-600">
                      {saveError}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


"use client";

import { useState } from "react";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generateImage() {
    if (!prompt.trim()) {
      setError("Please describe the image you want to create.");
      return;
    }

    setLoading(true);
    setError("");
    setImage("");

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: prompt.trim() }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.ok || !data.image) {
        throw new Error(data.error || "Image generation failed.");
      }

      setImage(`data:${data.contentType};base64,${data.image}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not connect to the image-generation API."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0b0b10] px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <header className="mb-16 flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">
            CREATIQ<span className="text-violet-400">.</span>
          </h1>
          <span className="rounded-full border border-white/15 px-4 py-2 text-sm text-gray-300">
            AI Creative Studio
          </span>
        </header>

        <section className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.25em] text-violet-400">
              Imagine. Create. Inspire.
            </p>

            <h2 className="mb-5 text-5xl font-bold leading-tight">
              Turn your ideas into <span className="text-violet-400">art.</span>
            </h2>

            <p className="mb-8 text-gray-400">
              Describe your vision and let AI help bring your creativity to life.
            </p>

            <label
              htmlFor="prompt"
              className="mb-2 block text-sm font-medium"
            >
              Describe your image
            </label>

            <textarea
              id="prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              maxLength={1000}
              placeholder="A futuristic city floating above the clouds at sunset..."
              className="min-h-36 w-full resize-y rounded-2xl border border-white/15 bg-white/5 p-4 outline-none transition focus:border-violet-400"
            />

            <p className="mt-2 text-right text-xs text-gray-500">
              {prompt.length}/1000
            </p>

            <button
              onClick={generateImage}
              disabled={loading}
              className="mt-4 w-full rounded-xl bg-violet-600 px-5 py-4 font-semibold transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Creating your image..." : "Generate image"}
            </button>

            {error && (
              <p role="alert" className="mt-4 text-sm text-red-400">
                {error}
              </p>
            )}
          </div>

          <div className="flex min-h-96 items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-violet-950/50 to-gray-900 p-5">
            {image ? (
              <img
                src={image}
                alt={prompt}
                className="max-h-[600px] w-full rounded-2xl object-contain"
              />
            ) : (
              <div className="max-w-xs text-center">
                <div className="mb-5 text-6xl">✦</div>
                <h3 className="mb-2 text-xl font-semibold">
                  Your canvas awaits
                </h3>
                <p className="text-sm leading-6 text-gray-400">
                  Your generated image will appear here.
                </p>
              </div>
            )}
          </div>
        </section>

        <footer className="mt-20 border-t border-white/10 pt-6 text-center text-sm text-gray-500">
          CREATIQ · Your ideas, reimagined.
        </footer>
      </div>
    </main>
  );
}

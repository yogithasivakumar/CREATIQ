export type CaptionStyle =
  | "product_highlight"
  | "storytelling"
  | "promotional"
  | "lifestyle"
  | "educational";

export type CaptionTone = "engaging_friendly" | "professional" | "playful" | "luxurious" | "minimal";

export type CaptionLength = "short" | "medium" | "long";

export const CAPTION_STYLES: { value: CaptionStyle; label: string }[] = [
  { value: "product_highlight", label: "Product Highlight" },
  { value: "storytelling", label: "Storytelling" },
  { value: "promotional", label: "Promotional" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "educational", label: "Educational" },
];

export const CAPTION_TONES: { value: CaptionTone; label: string }[] = [
  { value: "engaging_friendly", label: "Engaging & Friendly" },
  { value: "professional", label: "Professional" },
  { value: "playful", label: "Playful" },
  { value: "luxurious", label: "Luxurious" },
  { value: "minimal", label: "Minimal" },
];

export const CAPTION_LENGTHS: { value: CaptionLength; label: string }[] = [
  { value: "short", label: "Short" },
  { value: "medium", label: "Medium (2-4 lines)" },
  { value: "long", label: "Long" },
];

export interface InstagramStatus {
  connected: boolean;
  username: string | null;
  status: "connected" | "expired" | "revoked" | null;
}

export interface ScheduledPost {
  id: string;
  assetId: string;
  caption: string;
  hashtags: string[];
  scheduledFor: string;
  status: "pending" | "processing" | "published" | "failed" | "cancelled";
  publishedPostId: string | null;
  errorMessage: string | null;
  createdAt: string;
}

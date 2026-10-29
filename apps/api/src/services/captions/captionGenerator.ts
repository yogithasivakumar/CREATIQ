// Deterministic, template-based Instagram caption generation. No LLM
// call, no network request, no paid API — this is a pure string
// transform over the asset's own stored prompt and the caller's
// chosen style/tone/length/instructions, in the same spirit as
// src/services/ai/promptEnhancer.ts.
//
// It never invents product facts beyond what the prompt or the
// caller's own instructions already say, and it makes no claim about
// engagement or performance — "engaging" below describes the tone
// template's intent, not a guarantee of real engagement.
//
// "AI Generate" in the UI refers to this deterministic structuring,
// not a generative language model. Caption quality is bounded by how
// descriptive the underlying asset prompt is; a vague prompt produces
// a vague caption.

export type CaptionStyle =
  | "product_highlight"
  | "storytelling"
  | "promotional"
  | "lifestyle"
  | "educational";

export type CaptionTone =
  | "engaging_friendly"
  | "professional"
  | "playful"
  | "luxurious"
  | "minimal";

export type CaptionLength = "short" | "medium" | "long";

export interface GenerateCaptionInput {
  /** The asset's own stored prompt — the only source of "facts" used. */
  subject: string;
  style: CaptionStyle;
  tone: CaptionTone;
  length: CaptionLength;
  instructions?: string;
  hashtagCount: number;
  /**
   * Bumped by the caller (e.g. "Regenerate") to deterministically
   * select a different phrasing variant for the same inputs. This is
   * NOT randomness — the same (input, variant) pair always produces
   * the same output, which keeps generation testable and honest about
   * being template-based rather than a creative model.
   */
  variant?: number;
}

export interface GeneratedCaption {
  caption: string;
  hashtags: string[];
}

const STYLE_OPENERS: Record<CaptionStyle, string[]> = {
  product_highlight: [
    "Meet your new favorite: {subject}.",
    "Introducing {subject} — crafted to stand out.",
    "The spotlight's on {subject} today.",
  ],
  storytelling: [
    "Every story needs a moment like this: {subject}.",
    "There's a story behind {subject} worth telling.",
    "Picture this — {subject}, and the feeling it brings.",
  ],
  promotional: [
    "Don't miss out on {subject}.",
    "Limited moments like this don't last — {subject} is here.",
    "Your next favorite is waiting: {subject}.",
  ],
  lifestyle: [
    "This is what {subject} looks like in everyday life.",
    "{subject}, the way it was meant to be enjoyed.",
    "Small moments, made better by {subject}.",
  ],
  educational: [
    "Here's what makes {subject} worth knowing about.",
    "A closer look at {subject}.",
    "What you should know about {subject}.",
  ],
};

const TONE_MIDDLES: Record<CaptionTone, string[]> = {
  engaging_friendly: [
    "We think you're going to love it.",
    "Tell us what you think in the comments!",
    "This one's for you.",
  ],
  professional: [
    "Designed with quality and consistency in mind.",
    "Built to meet a higher standard.",
    "Thoughtfully made, every time.",
  ],
  playful: [
    "Okay, we might be a little obsessed.",
    "Yes, it's as good as it looks.",
    "We couldn't resist sharing this one.",
  ],
  luxurious: [
    "An elevated experience, in every detail.",
    "Refined, considered, unmistakably premium.",
    "Indulge in something exceptional.",
  ],
  minimal: ["Simple. Considered. Done well.", "Less, but better.", "Exactly as it should be."],
};

const LENGTH_CLOSERS: Record<CaptionLength, string[]> = {
  short: [],
  medium: ["Discover more about what makes it special."],
  long: [
    "Discover more about what makes it special — from the details you notice first to the ones you appreciate over time.",
  ],
};

const DEFAULT_HASHTAGS = ["CREATIQ", "MadeWithCREATIQ", "ContentCreation"];

const STYLE_HASHTAGS: Record<CaptionStyle, string[]> = {
  product_highlight: ["ProductHighlight", "NewDrop", "MustHave"],
  storytelling: ["BrandStory", "Storytelling", "BehindTheScenes"],
  promotional: ["LimitedTime", "ShopNow", "DontMissOut"],
  lifestyle: ["LifestyleBrand", "EverydayMoments", "LivedIn"],
  educational: ["DidYouKnow", "LearnMore", "ProductTips"],
};

const MAX_INSTRUCTIONS_LENGTH = 300;
const MAX_SUBJECT_WORDS_IN_CAPTION = 40; // guards against an unusually long asset prompt dominating the caption

function pick<T>(items: T[], variant: number): T {
  return items[variant % items.length];
}

function truncateSubject(subject: string): string {
  const words = subject.trim().split(/\s+/);
  if (words.length <= MAX_SUBJECT_WORDS_IN_CAPTION) {
    return subject.trim();
  }
  return `${words.slice(0, MAX_SUBJECT_WORDS_IN_CAPTION).join(" ")}...`;
}

function sanitizeInstructions(instructions: string | undefined): string {
  if (!instructions) return "";
  return instructions.trim().slice(0, MAX_INSTRUCTIONS_LENGTH);
}

function buildHashtags(style: CaptionStyle, hashtagCount: number): string[] {
  if (hashtagCount <= 0) {
    return [];
  }

  const pool = [...STYLE_HASHTAGS[style], ...DEFAULT_HASHTAGS];
  return pool.slice(0, Math.min(hashtagCount, pool.length));
}

export function generateCaption(input: GenerateCaptionInput): GeneratedCaption {
  const subject = truncateSubject(input.subject);
  const variant = input.variant ?? 0;

  const opener = pick(STYLE_OPENERS[input.style], variant).replace("{subject}", subject);
  const middle = pick(TONE_MIDDLES[input.tone], variant);
  const closerList = LENGTH_CLOSERS[input.length];
  const closer = closerList.length > 0 ? pick(closerList, variant) : "";

  const instructionsNote = sanitizeInstructions(input.instructions);

  const parts = [opener, middle];
  if (closer) parts.push(closer);
  if (instructionsNote) parts.push(instructionsNote);

  const caption = parts.filter(Boolean).join(" ");
  const hashtags = buildHashtags(input.style, input.hashtagCount);

  return { caption, hashtags };
}

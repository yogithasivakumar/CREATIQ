import { getSupabaseAdminClient } from "./supabase.service.js";
import type { UpdateSettingsRequest } from "../validation/settings.schema.js";

export interface UserSettingsDto {
  defaultCaptionStyle: string;
  defaultTone: string;
  defaultLength: string;
  hashtagCount: number;
  customHashtags: string[];
  publishNowDefault: boolean;
  schedulingTimezone: string;
  displayName: string | null;
}

interface SettingsRow {
  default_caption_style: string;
  default_tone: string;
  default_length: string;
  hashtag_count: number;
  custom_hashtags: string[];
  publish_now_default: boolean;
  scheduling_timezone: string;
  display_name: string | null;
}

function toDto(row: SettingsRow): UserSettingsDto {
  return {
    defaultCaptionStyle: row.default_caption_style,
    defaultTone: row.default_tone,
    defaultLength: row.default_length,
    hashtagCount: row.hashtag_count,
    customHashtags: row.custom_hashtags,
    publishNowDefault: row.publish_now_default,
    schedulingTimezone: row.scheduling_timezone,
    displayName: row.display_name,
  };
}

const DEFAULT_SETTINGS: SettingsRow = {
  default_caption_style: "product_highlight",
  default_tone: "engaging_friendly",
  default_length: "medium",
  hashtag_count: 5,
  custom_hashtags: [],
  publish_now_default: true,
  scheduling_timezone: "UTC",
  display_name: null,
};

// Returns the user's settings row, creating a default one on first
// access. Settings are personal (keyed by user_id), not workspace-
// scoped, matching user_settings' schema — each person's caption/
// publishing preferences are their own, not shared with workspace
// members.
export async function getUserSettings(userId: string): Promise<UserSettingsDto> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("user_settings")
    .select(
      "default_caption_style, default_tone, default_length, hashtag_count, custom_hashtags, publish_now_default, scheduling_timezone, display_name"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load settings: ${error.message}`);
  }

  if (data) {
    return toDto(data as SettingsRow);
  }

  const { data: created, error: createError } = await supabase
    .from("user_settings")
    .insert({ user_id: userId, ...DEFAULT_SETTINGS })
    .select(
      "default_caption_style, default_tone, default_length, hashtag_count, custom_hashtags, publish_now_default, scheduling_timezone, display_name"
    )
    .single();

  if (createError || !created) {
    // A concurrent request may have already inserted the default row
    // between the SELECT above and this INSERT; that's a unique-
    // constraint violation, not a real failure, so fall back to the
    // in-memory default rather than surfacing a confusing 500 for a
    // harmless race.
    return toDto(DEFAULT_SETTINGS);
  }

  return toDto(created as SettingsRow);
}

export async function updateUserSettings(
  userId: string,
  input: UpdateSettingsRequest
): Promise<UserSettingsDto> {
  // Ensure a row exists first (same create-on-first-access behavior
  // as getUserSettings) so an UPDATE on a brand-new account doesn't
  // silently match zero rows.
  await getUserSettings(userId);

  const supabase = getSupabaseAdminClient();

  const patch: Record<string, unknown> = {};
  if (input.defaultCaptionStyle !== undefined) patch.default_caption_style = input.defaultCaptionStyle;
  if (input.defaultTone !== undefined) patch.default_tone = input.defaultTone;
  if (input.defaultLength !== undefined) patch.default_length = input.defaultLength;
  if (input.hashtagCount !== undefined) patch.hashtag_count = input.hashtagCount;
  if (input.customHashtags !== undefined) patch.custom_hashtags = input.customHashtags;
  if (input.publishNowDefault !== undefined) patch.publish_now_default = input.publishNowDefault;
  if (input.schedulingTimezone !== undefined) patch.scheduling_timezone = input.schedulingTimezone;
  if (input.displayName !== undefined) patch.display_name = input.displayName;

  const { data, error } = await supabase
    .from("user_settings")
    .update(patch)
    .eq("user_id", userId)
    .select(
      "default_caption_style, default_tone, default_length, hashtag_count, custom_hashtags, publish_now_default, scheduling_timezone, display_name"
    )
    .single();

  if (error || !data) {
    throw new Error(`Failed to update settings: ${error?.message ?? "unknown error"}`);
  }

  return toDto(data as SettingsRow);
}


import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { error } = await supabase.storage.listBuckets();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          service: "supabase",
          message: error.message,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      service: "supabase",
      message: "Supabase Storage connection successful",
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        service: "supabase",
        message: "Connection test failed",
      },
      { status: 500 }
    );
  }
}

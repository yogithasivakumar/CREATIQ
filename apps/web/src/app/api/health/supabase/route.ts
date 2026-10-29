
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
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

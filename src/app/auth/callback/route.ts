import { NextResponse, type NextRequest } from "next/server";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const authError = requestUrl.searchParams.get("error");

  if (authError) {
    return NextResponse.redirect(new URL("/login?error=callback", request.url));
  }

  if (isSupabaseConfigured() && !code) {
    return NextResponse.redirect(new URL("/login?error=callback", request.url));
  }

  if (code && isSupabaseConfigured()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(
        new URL("/login?error=callback", request.url),
      );
    }
  }

  return NextResponse.redirect(new URL("/", request.url));
}

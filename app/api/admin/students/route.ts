import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const sessionClient = await createClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Admin login required." }, { status: 401 });
  const { data: profile } = await sessionClient.from("lms_profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return NextResponse.json({ error: "Server account creation is not configured." }, { status: 503 });
  let payload: { email?: string; password?: string; fullName?: string; phone?: string };
  try { payload = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const email = payload.email?.trim().toLowerCase() || "";
  const password = payload.password || "";
  const fullName = payload.fullName?.trim() || "";
  const phone = payload.phone?.trim() || "";
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || !fullName || !phone) {
    return NextResponse.json({ error: "Enter a valid email, full name, WhatsApp number and password (8+ characters)." }, { status: 400 });
  }

  const adminClient = createSupabaseClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ id: data.user.id, email: data.user.email, message: "Student account created and email confirmed." }, { status: 201 });
}

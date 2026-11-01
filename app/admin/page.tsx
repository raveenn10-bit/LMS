import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminPortal } from "@/components/admin-portal";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const { data: profile } = await supabase.from("lms_profiles").select("*").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");

  const [{ data: profiles }, { data: courses }, { data: enrollments }, { data: payments }, { data: lessons }, { data: announcements }] = await Promise.all([
    supabase.from("lms_profiles").select("*").order("created_at", { ascending: false }),
    supabase.from("lms_courses").select("*").order("grade"),
    supabase.from("lms_enrollments").select("*, course:lms_courses(title,grade)").order("created_at", { ascending: false }),
    supabase.from("lms_payments").select("*, course:lms_courses(title,grade)").order("created_at", { ascending: false }),
    supabase.from("lms_lessons").select("*, course:lms_courses(title,grade)").order("sort_order"),
    supabase.from("lms_announcements").select("*, course:lms_courses(title)").order("created_at", { ascending: false }),
  ]);

  return <AdminPortal
    admin={{ id:user.id, fullName:profile.full_name || "Administrator", email:profile.email }}
    profiles={profiles || []}
    courses={courses || []}
    enrollments={enrollments || []}
    payments={payments || []}
    lessons={lessons || []}
    announcements={announcements || []}
  />;
}

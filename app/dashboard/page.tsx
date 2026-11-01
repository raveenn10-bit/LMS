import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StudentPortal } from "@/components/student-portal";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: courses }, { data: enrollments }, { data: payments }] = await Promise.all([
    supabase.from("lms_profiles").select("*").eq("id", user.id).single(),
    supabase.from("lms_courses").select("*").eq("is_active", true).order("grade"),
    supabase.from("lms_enrollments").select("*, course:lms_courses(*)").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("lms_payments").select("*, course:lms_courses(title, grade)").eq("user_id", user.id).order("created_at", { ascending: false }),
  ]);

  if (profile?.role === "admin") redirect("/admin");

  const approvedCourseIds = (enrollments || []).filter((item) => item.status === "approved").map((item) => item.course_id);
  const [{ data: lessons }, { data: announcements }, { data: progress }] = await Promise.all([
    approvedCourseIds.length
      ? supabase.from("lms_lessons").select("*").in("course_id", approvedCourseIds).eq("is_published", true).order("sort_order")
      : Promise.resolve({ data: [] }),
    supabase.from("lms_announcements").select("*, course:lms_courses(title)").eq("is_published", true).order("created_at", { ascending: false }),
    supabase.from("lms_lesson_progress").select("*").eq("user_id", user.id),
  ]);

  return <StudentPortal
    user={{ id: user.id, email: user.email || "", fullName: profile?.full_name || user.user_metadata.full_name || "Student" }}
    courses={courses || []}
    enrollments={enrollments || []}
    payments={payments || []}
    lessons={lessons || []}
    announcements={announcements || []}
    progress={progress || []}
  />;
}

"use client";

import { useMemo, useState } from "react";
import { BookOpen, CalendarDays, Check, Clock3, CreditCard, Download, ExternalLink, FileText, Home, LoaderCircle, Megaphone, Play, Radio, Upload, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SignOutButton } from "@/components/sign-out-button";

type Course = { id:string; title:string; grade:string; description:string; monthly_fee_lkr:number|null; cover_color:string };
type Enrollment = { id:string; course_id:string; status:string; expires_at:string|null; course:Course|null };
type Lesson = { id:string; course_id:string; title:string; description:string; lesson_type:string; video_url:string|null; meeting_url:string|null; file_path:string|null; scheduled_at:string|null; duration_minutes:number|null };
type Payment = { id:string; course_id:string; billing_month:string; amount_lkr:number; status:string; admin_note:string|null; created_at:string; course:{title:string;grade:string}|null };
type Announcement = { id:string; title:string; message:string; created_at:string; course:{title:string}|null };
type Progress = { lesson_id:string; completed:boolean };

export function StudentPortal({ user, courses, enrollments: initialEnrollments, payments: initialPayments, lessons, announcements, progress: initialProgress }:{
  user:{id:string;email:string;fullName:string}; courses:Course[]; enrollments:Enrollment[]; payments:Payment[]; lessons:Lesson[]; announcements:Announcement[]; progress:Progress[];
}) {
  const [tab, setTab] = useState<"overview"|"lessons"|"live"|"payments">("overview");
  const [payments, setPayments] = useState(initialPayments);
  const [enrollments, setEnrollments] = useState(initialEnrollments);
  const [progress, setProgress] = useState(initialProgress);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");
  const approved = enrollments.filter((item) => item.status === "approved");
  const courseMap = useMemo(() => new Map(courses.map((course) => [course.id, course])), [courses]);
  const recorded = lessons.filter((lesson) => lesson.lesson_type !== "live");
  const live = lessons.filter((lesson) => lesson.lesson_type === "live");

  async function submitPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploading(true);
    setNotice("");
    const form = new FormData(event.currentTarget);
    const file = form.get("slip") as File;
    const courseId = String(form.get("course"));
    const billingMonth = String(form.get("month")) + "-01";
    const amount = Number(form.get("amount"));
    const reference = String(form.get("reference") || "");
    const supabase = createClient();
    const existing = payments.find((item) => item.course_id === courseId && item.billing_month === billingMonth);
    if (existing) {
      setNotice("මේ class/month එකට payment එකක් දැනටමත් submit කරලා තියෙනවා.");
      setUploading(false);
      return;
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${user.id}/${courseId}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("lms-payment-slips").upload(path, file, { upsert: false });
    if (uploadError) {
      setNotice(uploadError.message);
      setUploading(false);
      return;
    }
    const { data: payment, error } = await supabase.from("lms_payments").insert({
      user_id: user.id, course_id: courseId, billing_month: billingMonth, amount_lkr: amount, reference, slip_path: path,
    }).select("*, course:lms_courses(title, grade)").single();
    if (error) {
      await supabase.storage.from("lms-payment-slips").remove([path]);
      setNotice(error.message);
      setUploading(false);
      return;
    }
    if (!enrollments.some((item) => item.course_id === courseId)) {
      const { data: enrollment } = await supabase.from("lms_enrollments").insert({ user_id:user.id, course_id:courseId }).select("*, course:lms_courses(*)").single();
      if (enrollment) setEnrollments((current) => [enrollment as Enrollment, ...current]);
    }
    setPayments((current) => [payment as Payment, ...current]);
    setNotice("Payment slip එක ලැබුණා. Admin approval pending.");
    event.currentTarget.reset();
    setUploading(false);
  }

  async function toggleComplete(lessonId:string) {
    const current = progress.find((item) => item.lesson_id === lessonId)?.completed || false;
    const { data } = await createClient().from("lms_lesson_progress").upsert({
      user_id:user.id, lesson_id:lessonId, completed:!current, updated_at:new Date().toISOString(),
    }).select().single();
    if (data) setProgress((items) => [...items.filter((item) => item.lesson_id !== lessonId), data]);
  }

  async function openLessonFile(path:string) {
    const { data, error } = await createClient().storage.from("lms-lesson-files").createSignedUrl(path, 300);
    if (error) return setNotice(error.message);
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  return <main className="portal-shell">
    <aside className="portal-sidebar">
      <a href="/" className="portal-logo"><img src="/logo.svg" alt="Lavindu Maneth Mathematics"/></a>
      <div className="portal-user"><span>{user.fullName.slice(0,2).toUpperCase()}</span><div><strong>{user.fullName}</strong><small>{user.email}</small></div></div>
      <nav>
        <button className={tab==="overview"?"active":""} onClick={()=>setTab("overview")}><Home size={18}/> Overview</button>
        <button className={tab==="lessons"?"active":""} onClick={()=>setTab("lessons")}><BookOpen size={18}/> Lessons</button>
        <button className={tab==="live"?"active":""} onClick={()=>setTab("live")}><Radio size={18}/> Live classes</button>
        <button className={tab==="payments"?"active":""} onClick={()=>setTab("payments")}><CreditCard size={18}/> Payments</button>
      </nav>
      <SignOutButton/>
    </aside>
    <section className="portal-main">
      <header className="portal-head"><div><span className="eyebrow">YOUR LEARNING SPACE</span><h1>Welcome back, {user.fullName.split(" ")[0]}.</h1><p>Keep moving forward, one clear step at a time.</p></div><div className="portal-date"><CalendarDays size={18}/>{new Intl.DateTimeFormat("en-LK",{dateStyle:"medium"}).format(new Date())}</div></header>
      {notice && <div className="portal-notice">{notice}<button onClick={()=>setNotice("")}>×</button></div>}

      {tab==="overview" && <div className="portal-stack">
        <div className="stat-grid">
          <article><BookOpen/><span>Approved classes</span><strong>{approved.length}</strong></article>
          <article><Play/><span>Available lessons</span><strong>{recorded.length}</strong></article>
          <article><Check/><span>Lessons completed</span><strong>{progress.filter((item)=>item.completed).length}</strong></article>
          <article><Clock3/><span>Pending payments</span><strong>{payments.filter((item)=>item.status==="pending").length}</strong></article>
        </div>
        <section className="portal-card"><div className="card-title"><div><span className="eyebrow">MY CLASSES</span><h2>Your active learning.</h2></div><button onClick={()=>setTab("payments")}>Join a class</button></div>
          {enrollments.length ? <div className="enrollment-grid">{enrollments.map((item)=><article key={item.id} className={"enrollment "+(item.course?.cover_color||"sage")}><span>{item.course?.grade}</span><h3>{item.course?.title}</h3><p>{item.course?.description}</p><div><b className={"status "+item.status}>{item.status}</b><small>{item.expires_at ? `Access until ${new Date(item.expires_at).toLocaleDateString("en-LK")}` : "Awaiting admin approval"}</small></div></article>)}</div> : <Empty icon={<BookOpen/>} title="No classes yet." text="Submit a payment slip to request access to your first class."/>}
        </section>
        {announcements.length>0 && <section className="portal-card"><div className="card-title"><div><span className="eyebrow">LATEST UPDATES</span><h2>Announcements.</h2></div><Megaphone/></div><div className="announcement-list">{announcements.map((item)=><article key={item.id}><span>{item.course?.title||"All students"}</span><h3>{item.title}</h3><p>{item.message}</p><small>{new Date(item.created_at).toLocaleDateString("en-LK")}</small></article>)}</div></section>}
      </div>}

      {tab==="lessons" && <section className="portal-card"><div className="card-title"><div><span className="eyebrow">RECORDED LESSONS & NOTES</span><h2>Learn at your pace.</h2></div><BookOpen/></div>
        {recorded.length ? <div className="lesson-list">{recorded.map((lesson)=>{const done=progress.find((item)=>item.lesson_id===lesson.id)?.completed;return <article key={lesson.id}><div className="lesson-type">{lesson.lesson_type==="note"?<FileText/>:<Play/>}</div><div><span>{courseMap.get(lesson.course_id)?.title}</span><h3>{lesson.title}</h3><p>{lesson.description}</p><small>{lesson.duration_minutes ? `${lesson.duration_minutes} minutes` : "Lesson resource"}</small></div><div className="lesson-actions">{lesson.video_url&&<a href={lesson.video_url} target="_blank" rel="noreferrer">Watch <ExternalLink size={15}/></a>}{lesson.file_path&&<button onClick={()=>openLessonFile(lesson.file_path!)}>Download <Download size={15}/></button>}<button className={done?"done":""} onClick={()=>toggleComplete(lesson.id)}><Check size={15}/>{done?"Completed":"Mark complete"}</button></div></article>})}</div>:<Empty icon={<BookOpen/>} title="Lessons appear after approval." text="Once your payment is approved, recordings and notes for that class will unlock here."/>}
      </section>}

      {tab==="live" && <section className="portal-card"><div className="card-title"><div><span className="eyebrow">LIVE CLASSROOM</span><h2>Join your next class.</h2></div><Radio/></div>
        {live.length ? <div className="live-grid">{live.map((lesson)=><article key={lesson.id}><span className="live-badge">LIVE CLASS</span><h3>{lesson.title}</h3><p>{courseMap.get(lesson.course_id)?.title}</p><div><CalendarDays size={16}/>{lesson.scheduled_at?new Date(lesson.scheduled_at).toLocaleString("en-LK"):"Schedule will be announced"}</div>{lesson.meeting_url&&<a href={lesson.meeting_url} target="_blank" rel="noreferrer">Join Live Class <ExternalLink size={16}/></a>}</article>)}</div>:<Empty icon={<Radio/>} title="No live class scheduled." text="Approved live links will appear here. The link is visible only while your access is active."/>}
      </section>}

      {tab==="payments" && <div className="payment-layout"><section className="portal-card"><div className="card-title"><div><span className="eyebrow">CLASS ACCESS</span><h2>Submit payment.</h2></div><Upload/></div><form className="payment-form" onSubmit={submitPayment}>
        <label>Class<select name="course" required defaultValue=""><option value="" disabled>Select class</option>{courses.map((course)=><option key={course.id} value={course.id}>{course.title}</option>)}</select></label>
        <div className="form-row"><label>Billing month<input name="month" type="month" required/></label><label>Amount (LKR)<input name="amount" type="number" min="0" step="0.01" required/></label></div>
        <label>Bank reference (optional)<input name="reference" placeholder="Transaction or deposit reference"/></label>
        <label className="file-drop"><Upload/><strong>Choose payment slip</strong><span>JPG, PNG, WEBP or PDF · Max 5 MB</span><input name="slip" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required/></label>
        <button disabled={uploading}>{uploading?<><LoaderCircle className="spin"/> Uploading…</>:<>Submit for approval <Upload size={17}/></>}</button>
      </form></section>
      <section className="portal-card"><div className="card-title"><div><span className="eyebrow">PAYMENT HISTORY</span><h2>Your submissions.</h2></div><CreditCard/></div>{payments.length?<div className="payment-list">{payments.map((item)=><article key={item.id}><div><strong>{item.course?.title}</strong><small>{new Date(item.billing_month).toLocaleDateString("en-LK",{month:"long",year:"numeric"})}</small></div><span>Rs. {Number(item.amount_lkr).toLocaleString()}</span><b className={"status "+item.status}>{item.status}</b>{item.admin_note&&<p>{item.admin_note}</p>}</article>)}</div>:<Empty icon={<CreditCard/>} title="No payments submitted." text="Your payment history and approval status will appear here."/>}</section></div>}
    </section>
  </main>;
}

function Empty({icon,title,text}:{icon:React.ReactNode;title:string;text:string}) {
  return <div className="portal-empty">{icon}<h3>{title}</h3><p>{text}</p></div>;
}

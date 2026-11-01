"use client";

import { useMemo, useState } from "react";
import { BookOpen, Check, CircleDollarSign, Clock3, FileText, GraduationCap, KeyRound, LayoutDashboard, LoaderCircle, Megaphone, Pencil, Plus, Radio, Search, ShieldCheck, Trash2, UserPlus, Users, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SignOutButton } from "@/components/sign-out-button";
import type { Database, Json } from "@/lib/database.types";

type Profile={id:string;email:string;full_name:string;phone:string|null;role:string;created_at:string};
type Course={id:string;code:string;title:string;grade:string;description:string;medium:string;monthly_fee_lkr:number|null;cover_color:string;is_active:boolean};
type Enrollment={id:string;user_id:string;course_id:string;status:string;starts_at:string|null;expires_at:string|null;course:{title:string;grade:string}|null};
type Payment={id:string;user_id:string;course_id:string;billing_month:string;amount_lkr:number;slip_path:string;reference:string|null;status:string;admin_note:string|null;created_at:string;course:{title:string;grade:string}|null};
type Lesson={id:string;course_id:string;title:string;description:string;lesson_type:string;video_url:string|null;meeting_url:string|null;file_path:string|null;scheduled_at:string|null;duration_minutes:number|null;sort_order:number;is_published:boolean;course:{title:string;grade:string}|null};
type Announcement={id:string;course_id:string|null;title:string;message:string;is_published:boolean;created_at:string;course:{title:string}|null};

export function AdminPortal({admin,profiles:initialProfiles,courses:initialCourses,enrollments:initialEnrollments,payments:initialPayments,lessons:initialLessons,announcements:initialAnnouncements}:{
  admin:{id:string;fullName:string;email:string};profiles:Profile[];courses:Course[];enrollments:Enrollment[];payments:Payment[];lessons:Lesson[];announcements:Announcement[];
}) {
  const [tab,setTab]=useState<"overview"|"students"|"payments"|"content">("overview");
  const [profiles,setProfiles]=useState(initialProfiles);
  const [courses,setCourses]=useState(initialCourses);
  const [enrollments,setEnrollments]=useState(initialEnrollments);
  const [payments,setPayments]=useState(initialPayments);
  const [lessons,setLessons]=useState(initialLessons);
  const [announcements,setAnnouncements]=useState(initialAnnouncements);
  const [modal,setModal]=useState<""|"course"|"lesson"|"announcement"|"editStudent"|"resetPassword"|"grantAccess"|"editCourse"|"editLesson"|"editAnnouncement">("");
  const [selectedProfile,setSelectedProfile]=useState<Profile|null>(null);
  const [selectedCourse,setSelectedCourse]=useState<Course|null>(null);
  const [selectedLesson,setSelectedLesson]=useState<Lesson|null>(null);
  const [selectedAnnouncement,setSelectedAnnouncement]=useState<Announcement|null>(null);
  const [busy,setBusy]=useState("");
  const [notice,setNotice]=useState("");
  const [search,setSearch]=useState("");
  const [newStudent,setNewStudent]=useState(false);
  const profileMap=useMemo(()=>new Map(profiles.map((profile)=>[profile.id,profile])),[profiles]);
  const pendingPayments=payments.filter((payment)=>payment.status==="pending");
  const approvedStudents=new Set(enrollments.filter((item)=>item.status==="approved").map((item)=>item.user_id)).size;

  async function log(action:string,entityType:string,entityId?:string,details:Json={}) {
    await createClient().from("lms_audit_logs").insert({admin_id:admin.id,action,entity_type:entityType,entity_id:entityId,details});
  }

  async function reviewPayment(payment:Payment,status:"approved"|"rejected",note="") {
    setBusy(payment.id+status);setNotice("");
    const supabase=createClient();
    const {data,error}=await supabase.from("lms_payments").update({status,admin_note:note||null,reviewed_by:admin.id,reviewed_at:new Date().toISOString()}).eq("id",payment.id).select("*, course:lms_courses(title,grade)").single();
    if(error){setNotice(error.message);setBusy("");return}
    if(status==="approved"){
      const start=new Date();
      const expiry=new Date(start);expiry.setMonth(expiry.getMonth()+1);
      const {data:enrollment,error:enrollmentError}=await supabase.from("lms_enrollments").upsert({
        user_id:payment.user_id,course_id:payment.course_id,status:"approved",starts_at:start.toISOString(),expires_at:expiry.toISOString(),approved_by:admin.id,approved_at:start.toISOString(),
      },{onConflict:"user_id,course_id"}).select("*, course:lms_courses(title,grade)").single();
      if(enrollmentError){setNotice("Payment updated, but access failed: "+enrollmentError.message)}
      else if(enrollment)setEnrollments((items)=>[enrollment as Enrollment,...items.filter((item)=>item.id!==enrollment.id)]);
    }
    setPayments((items)=>items.map((item)=>item.id===payment.id?data as Payment:item));
    await log("payment_"+status,"payment",payment.id,{course_id:payment.course_id,user_id:payment.user_id});
    setBusy("");setNotice(status==="approved"?"Payment approved and class access activated.":"Payment rejected.");
  }

  async function setEnrollmentStatus(enrollment:Enrollment,status:string) {
    setBusy(enrollment.id+status);
    const update:Database["public"]["Tables"]["lms_enrollments"]["Update"]={status};
    if(status==="approved"){const start=new Date();const expiry=new Date(start);expiry.setMonth(expiry.getMonth()+1);Object.assign(update,{starts_at:start.toISOString(),expires_at:expiry.toISOString(),approved_by:admin.id,approved_at:start.toISOString()})}
    const {data,error}=await createClient().from("lms_enrollments").update(update).eq("id",enrollment.id).select("*, course:lms_courses(title,grade)").single();
    if(error)setNotice(error.message);else{setEnrollments((items)=>items.map((item)=>item.id===enrollment.id?data as Enrollment:item));await log("enrollment_"+status,"enrollment",enrollment.id)}
    setBusy("");
  }

  async function updateStudent(form:FormData) {
    if(!selectedProfile)return;
    setBusy("student");setNotice("");
    const payload={full_name:String(form.get("fullName")||"").trim(),phone:String(form.get("phone")||"").trim()||null};
    const {data,error}=await createClient().from("lms_profiles").update(payload).eq("id",selectedProfile.id).select().single();
    if(error)setNotice(error.message);else{setProfiles((items)=>items.map((item)=>item.id===data.id?data:item));setModal("");await log("student_profile_updated","profile",data.id)}
    setBusy("");
  }

  async function grantStudentAccess(form:FormData) {
    if(!selectedProfile)return;
    setBusy("access");setNotice("");
    const courseId=String(form.get("course"));
    const days=Math.max(1,Number(form.get("days")||30));
    const start=new Date();const expiry=new Date(start);expiry.setDate(expiry.getDate()+days);
    const {data,error}=await createClient().from("lms_enrollments").upsert({user_id:selectedProfile.id,course_id:courseId,status:"approved",starts_at:start.toISOString(),expires_at:expiry.toISOString(),approved_by:admin.id,approved_at:start.toISOString()},{onConflict:"user_id,course_id"}).select("*, course:lms_courses(title,grade)").single();
    if(error)setNotice(error.message);else{setEnrollments((items)=>[data as Enrollment,...items.filter((item)=>item.id!==data.id)]);setModal("");await log("student_access_granted","enrollment",data.id,{student_id:selectedProfile.id,course_id:courseId,days})}
    setBusy("");
  }

  async function createCourse(form:FormData) {
    setBusy("course");
    const payload={code:String(form.get("code")).trim().toUpperCase(),title:String(form.get("title")).trim(),grade:String(form.get("grade")).trim(),description:String(form.get("description")).trim(),medium:String(form.get("medium")||"Sinhala"),monthly_fee_lkr:Number(form.get("fee")||0),cover_color:String(form.get("color")||"sage"),is_active:true};
    const {data,error}=await createClient().from("lms_courses").insert(payload).select().single();
    if(error)setNotice(error.message);else{setCourses((items)=>[...items,data]);setModal("");await log("course_created","course",data.id)}
    setBusy("");
  }

  async function updateCourse(form:FormData) {
    if(!selectedCourse)return;
    setBusy("courseEdit");setNotice("");
    const payload={code:String(form.get("code")).trim().toUpperCase(),title:String(form.get("title")).trim(),grade:String(form.get("grade")).trim(),description:String(form.get("description")).trim(),medium:String(form.get("medium")||"Sinhala"),monthly_fee_lkr:Number(form.get("fee")||0),cover_color:String(form.get("color")||"sage")};
    const {data,error}=await createClient().from("lms_courses").update(payload).eq("id",selectedCourse.id).select().single();
    if(error)setNotice(error.message);else{setCourses((items)=>items.map((item)=>item.id===data.id?data:item));setModal("");await log("course_updated","course",data.id)}
    setBusy("");
  }

  async function toggleCourse(course:Course) {
    const {data,error}=await createClient().from("lms_courses").update({is_active:!course.is_active}).eq("id",course.id).select().single();
    if(error)setNotice(error.message);else{setCourses((items)=>items.map((item)=>item.id===course.id?data:item));await log("course_status_changed","course",course.id,{active:data.is_active})}
  }

  async function createLesson(form:FormData) {
    setBusy("lesson");setNotice("");
    const supabase=createClient();
    const courseId=String(form.get("course"));
    const file=form.get("file") as File;
    let filePath:string|null=null;
    if(file?.size){
      const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"-");
      filePath=`${courseId}/${Date.now()}-${safe}`;
      const {error:uploadError}=await supabase.storage.from("lms-lesson-files").upload(filePath,file);
      if(uploadError){setNotice(uploadError.message);setBusy("");return}
    }
    const payload={course_id:courseId,title:String(form.get("title")),description:String(form.get("description")||""),lesson_type:String(form.get("type")),video_url:String(form.get("video")||"")||null,meeting_url:String(form.get("meeting")||"")||null,file_path:filePath,scheduled_at:String(form.get("scheduled")||"")?new Date(String(form.get("scheduled"))).toISOString():null,duration_minutes:Number(form.get("duration")||0)||null,sort_order:Number(form.get("order")||0),is_published:form.get("published")==="on"};
    const {data,error}=await supabase.from("lms_lessons").insert(payload).select("*, course:lms_courses(title,grade)").single();
    if(error){if(filePath)await supabase.storage.from("lms-lesson-files").remove([filePath]);setNotice(error.message)}else{setLessons((items)=>[...items,data as Lesson]);setModal("");await log("lesson_created","lesson",data.id)}
    setBusy("");
  }

  async function updateLesson(form:FormData) {
    if(!selectedLesson)return;
    setBusy("lessonEdit");setNotice("");
    const payload={course_id:String(form.get("course")),title:String(form.get("title")),description:String(form.get("description")||""),lesson_type:String(form.get("type")),video_url:String(form.get("video")||"")||null,meeting_url:String(form.get("meeting")||"")||null,scheduled_at:String(form.get("scheduled")||"")?new Date(String(form.get("scheduled"))).toISOString():null,duration_minutes:Number(form.get("duration")||0)||null,sort_order:Number(form.get("order")||0),is_published:form.get("published")==="on"};
    const {data,error}=await createClient().from("lms_lessons").update(payload).eq("id",selectedLesson.id).select("*, course:lms_courses(title,grade)").single();
    if(error)setNotice(error.message);else{setLessons((items)=>items.map((item)=>item.id===data.id?data as Lesson:item));setModal("");await log("lesson_updated","lesson",data.id)}
    setBusy("");
  }

  async function deleteLesson(lesson:Lesson) {
    if(!window.confirm(`Delete “${lesson.title}”? This cannot be undone.`))return;
    setBusy(lesson.id+"delete");
    const supabase=createClient();
    const {error}=await supabase.from("lms_lessons").delete().eq("id",lesson.id);
    if(error)setNotice(error.message);else{if(lesson.file_path)await supabase.storage.from("lms-lesson-files").remove([lesson.file_path]);setLessons((items)=>items.filter((item)=>item.id!==lesson.id));await log("lesson_deleted","lesson",lesson.id)}
    setBusy("");
  }

  async function toggleLesson(lesson:Lesson) {
    const {data,error}=await createClient().from("lms_lessons").update({is_published:!lesson.is_published}).eq("id",lesson.id).select("*, course:lms_courses(title,grade)").single();
    if(error)setNotice(error.message);else{setLessons((items)=>items.map((item)=>item.id===lesson.id?data as Lesson:item));await log("lesson_publish_changed","lesson",lesson.id,{published:data.is_published})}
  }

  async function createAnnouncement(form:FormData) {
    setBusy("announcement");
    const course=String(form.get("course")||"");
    const {data,error}=await createClient().from("lms_announcements").insert({course_id:course||null,title:String(form.get("title")),message:String(form.get("message")),created_by:admin.id,is_published:true}).select("*, course:lms_courses(title)").single();
    if(error)setNotice(error.message);else{setAnnouncements((items)=>[data as Announcement,...items]);setModal("");await log("announcement_created","announcement",data.id)}
    setBusy("");
  }

  async function updateAnnouncement(form:FormData) {
    if(!selectedAnnouncement)return;
    setBusy("announcementEdit");setNotice("");
    const course=String(form.get("course")||"");
    const {data,error}=await createClient().from("lms_announcements").update({course_id:course||null,title:String(form.get("title")),message:String(form.get("message")),is_published:form.get("published")==="on"}).eq("id",selectedAnnouncement.id).select("*, course:lms_courses(title)").single();
    if(error)setNotice(error.message);else{setAnnouncements((items)=>items.map((item)=>item.id===data.id?data as Announcement:item));setModal("");await log("announcement_updated","announcement",data.id)}
    setBusy("");
  }

  async function deleteAnnouncement(item:Announcement) {
    if(!window.confirm(`Delete announcement “${item.title}”?`))return;
    const {error}=await createClient().from("lms_announcements").delete().eq("id",item.id);
    if(error)setNotice(error.message);else{setAnnouncements((items)=>items.filter((entry)=>entry.id!==item.id));await log("announcement_deleted","announcement",item.id)}
  }

  async function viewSlip(path:string) {
    const {data,error}=await createClient().storage.from("lms-payment-slips").createSignedUrl(path,300);
    if(error)setNotice(error.message);else window.open(data.signedUrl,"_blank","noopener,noreferrer");
  }

  const filteredProfiles=profiles.filter((profile)=>(profile.full_name+" "+profile.email+" "+(profile.phone||"")).toLowerCase().includes(search.toLowerCase()));

  async function createStudent(form:FormData) {
    setBusy("newStudent");setNotice("");
    const response=await fetch("/api/admin/students",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({fullName:String(form.get("fullName")||""),email:String(form.get("email")||""),phone:String(form.get("phone")||""),password:String(form.get("password")||"")})});
    const result=await response.json();
    if(!response.ok){setNotice(result.error||"Could not create student account.");setBusy("");return}
    setNewStudent(false);setNotice(`Student account created and email confirmed: ${result.email}. Share the password securely with the student.`);window.location.reload();
  }

  async function resetStudentPassword(form:FormData) {
    if(!selectedProfile)return;
    setBusy("resetPassword");setNotice("");
    const response=await fetch("/api/admin/students",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({studentId:selectedProfile.id,password:String(form.get("password")||"")})});
    const result=await response.json();
    if(!response.ok){setNotice(result.error||"Could not update student password.");setBusy("");return}
    setModal("");setBusy("");setNotice(`Password updated for ${selectedProfile.email}. The student can log in immediately.`);
  }

  return <main className="admin-shell">
    <aside className="admin-sidebar"><a href="/" className="portal-logo"><img src="/logo.svg" alt="Lavindu Maneth Mathematics"/></a><div className="admin-mark"><ShieldCheck/><div><strong>Admin Console</strong><small>{admin.email}</small></div></div><nav>
      <button className={tab==="overview"?"active":""} onClick={()=>setTab("overview")}><LayoutDashboard/> Overview</button>
      <button className={tab==="students"?"active":""} onClick={()=>setTab("students")}><Users/> Students</button>
      <button className={tab==="payments"?"active":""} onClick={()=>setTab("payments")}><CircleDollarSign/> Payments {pendingPayments.length>0&&<b>{pendingPayments.length}</b>}</button>
      <button className={tab==="content"?"active":""} onClick={()=>setTab("content")}><BookOpen/> Content</button>
    </nav><SignOutButton/></aside>
    <section className="admin-main"><header className="admin-head"><div><span className="eyebrow">LMS ADMINISTRATION</span><h1>{tab[0].toUpperCase()+tab.slice(1)}</h1><p>Manage students, approvals and learning content from one place.</p></div><div className="admin-avatar">{admin.fullName.slice(0,2).toUpperCase()}</div></header>
      {notice&&<div className="portal-notice">{notice}<button onClick={()=>setNotice("")}>×</button></div>}
      {tab==="overview"&&<><div className="admin-stats"><article><Users/><span>Total students</span><strong>{profiles.filter((p)=>p.role==="student").length}</strong></article><article><GraduationCap/><span>Active students</span><strong>{approvedStudents}</strong></article><article><Clock3/><span>Pending payments</span><strong>{pendingPayments.length}</strong></article><article><BookOpen/><span>Published lessons</span><strong>{lessons.filter((l)=>l.is_published).length}</strong></article></div>
        <div className="admin-columns"><section className="admin-card"><div className="admin-card-head"><div><span>PRIORITY</span><h2>Payments to review</h2></div><button onClick={()=>setTab("payments")}>View all</button></div>{pendingPayments.slice(0,5).map((payment)=><PaymentRow key={payment.id} payment={payment} profile={profileMap.get(payment.user_id)} busy={busy} viewSlip={viewSlip} review={reviewPayment}/>) }{pendingPayments.length===0&&<AdminEmpty text="No payments waiting for review."/>}</section>
        <section className="admin-card"><div className="admin-card-head"><div><span>RECENT</span><h2>New students</h2></div></div>{profiles.filter((p)=>p.role==="student").slice(0,6).map((profile)=><article className="mini-student" key={profile.id}><span>{profile.full_name.slice(0,2).toUpperCase()}</span><div><strong>{profile.full_name||"New student"}</strong><small>{profile.email}</small></div><time>{new Date(profile.created_at).toLocaleDateString("en-LK")}</time></article>)}</section></div></>}

      {tab==="students"&&<section className="admin-card"><div className="admin-toolbar"><div className="search-field"><Search/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search students…"/></div><div className="student-toolbar-actions"><span>{filteredProfiles.filter((p)=>p.role==="student").length} students</span><button className="admin-primary" onClick={()=>setNewStudent(true)}><UserPlus/> Create student</button></div></div><div className="admin-table"><div className="table-head"><span>Student</span><span>Contact</span><span>Class access</span><span>Status</span><span>Manage</span></div>{filteredProfiles.filter((p)=>p.role==="student").map((profile)=>{const studentEnrollments=enrollments.filter((e)=>e.user_id===profile.id);return <div className="table-row" key={profile.id}><span><b>{profile.full_name||"Unnamed student"}</b><small>{profile.email}</small></span><span>{profile.phone||"—"}</span><span className="enrollment-chips">{studentEnrollments.length?studentEnrollments.map((e)=><small key={e.id}>{e.course?.grade} · {e.status}</small>):"No class"}</span><span>{studentEnrollments.some((e)=>e.status==="approved")?<b className="status approved">active</b>:<b className="status pending">pending</b>}</span><span className="manage-actions"><button title="Edit student" onClick={()=>{setSelectedProfile(profile);setModal("editStudent")}}><Pencil/></button><button title="Reset student password" onClick={()=>{setSelectedProfile(profile);setModal("resetPassword")}}><KeyRound/></button><button title="Grant class access" onClick={()=>{setSelectedProfile(profile);setModal("grantAccess")}}><UserPlus/></button>{studentEnrollments[0]&&<select aria-label="Change latest class status" value={studentEnrollments[0].status} disabled={busy.startsWith(studentEnrollments[0].id)} onChange={(event)=>setEnrollmentStatus(studentEnrollments[0],event.target.value)}><option value="pending">Pending</option><option value="approved">Approve 30 days</option><option value="suspended">Suspend</option><option value="expired">Expire</option></select>}</span></div>})}</div></section>}

      {tab==="payments"&&<section className="admin-card"><div className="admin-card-head"><div><span>PAYMENT VERIFICATION</span><h2>Student submissions</h2></div></div><div className="payment-admin-list">{payments.map((payment)=><PaymentRow key={payment.id} payment={payment} profile={profileMap.get(payment.user_id)} busy={busy} viewSlip={viewSlip} review={reviewPayment}/>) }{payments.length===0&&<AdminEmpty text="No payments submitted yet."/>}</div></section>}

      {tab==="content"&&<div className="content-stack"><section className="admin-card"><div className="admin-card-head"><div><span>CLASSES</span><h2>Course catalogue</h2></div><button className="admin-primary" onClick={()=>setModal("course")}><Plus/> Add class</button></div><div className="course-admin-grid">{courses.map((course)=><article key={course.id}><span>{course.grade}</span><h3>{course.title}</h3><p>{course.description}</p><div><small>{course.medium} · {course.monthly_fee_lkr? `Rs. ${Number(course.monthly_fee_lkr).toLocaleString()}`:"Fee not set"}</small><span className="card-actions"><button title="Edit class" onClick={()=>{setSelectedCourse(course);setModal("editCourse")}}><Pencil/></button><button onClick={()=>toggleCourse(course)} className={course.is_active?"on":"off"}>{course.is_active?"Active":"Hidden"}</button></span></div></article>)}</div></section>
        <section className="admin-card"><div className="admin-card-head"><div><span>LESSONS & LIVE CLASSES</span><h2>Learning content</h2></div><button className="admin-primary" onClick={()=>setModal("lesson")}><Plus/> Add lesson</button></div><div className="lesson-admin-list">{lessons.map((lesson)=><article key={lesson.id}><span className={"lesson-kind "+lesson.lesson_type}>{lesson.lesson_type==="live"?<Radio/>:lesson.lesson_type==="note"?<FileText/>:<BookOpen/>}</span><div><small>{lesson.course?.title}</small><h3>{lesson.title}</h3><p>{lesson.scheduled_at?new Date(lesson.scheduled_at).toLocaleString("en-LK"):lesson.description}</p></div><span className="manage-actions"><button title="Edit lesson" onClick={()=>{setSelectedLesson(lesson);setModal("editLesson")}}><Pencil/></button><button onClick={()=>toggleLesson(lesson)} className={lesson.is_published?"publish-on":"publish-off"}>{lesson.is_published?"Published":"Draft"}</button><button className="danger-action" title="Delete lesson" disabled={busy.startsWith(lesson.id)} onClick={()=>deleteLesson(lesson)}><Trash2/></button></span></article>)}</div></section>
        <section className="admin-card"><div className="admin-card-head"><div><span>COMMUNICATION</span><h2>Announcements</h2></div><button className="admin-primary" onClick={()=>setModal("announcement")}><Megaphone/> New update</button></div><div className="announcement-admin-list">{announcements.map((item)=><article key={item.id}><div><span>{item.course?.title||"All students"}</span><h3>{item.title}</h3><p>{item.message}</p><small>{new Date(item.created_at).toLocaleDateString("en-LK")}</small></div><span className="manage-actions"><button title="Edit announcement" onClick={()=>{setSelectedAnnouncement(item);setModal("editAnnouncement")}}><Pencil/></button><button className="danger-action" title="Delete announcement" onClick={()=>deleteAnnouncement(item)}><Trash2/></button></span></article>)}{announcements.length===0&&<AdminEmpty text="No announcements published yet."/>}</div></section></div>}
    </section>
    {(modal==="course"||modal==="lesson"||modal==="announcement")&&<AdminModal title={modal==="course"?"Add a new class":modal==="lesson"?"Add lesson or live class":"Publish announcement"} close={()=>setModal("")}>{modal==="course"?<form action={createCourse} className="admin-form"><label>Course code<input name="code" required placeholder="MATH-G08"/></label><label>Title<input name="title" required placeholder="Grade 08 Mathematics"/></label><div className="form-row"><label>Grade<input name="grade" required placeholder="Grade 08"/></label><label>Medium<select name="medium"><option>Sinhala</option><option>English</option><option>Tamil</option></select></label></div><label>Description<textarea name="description" required/></label><div className="form-row"><label>Monthly fee (LKR)<input name="fee" type="number" min="0"/></label><label>Card colour<select name="color"><option value="sage">Sage</option><option value="peach">Peach</option><option value="lavender">Lavender</option></select></label></div><Submit busy={busy==="course"}/></form>:modal==="lesson"?<form action={createLesson} className="admin-form"><label>Class<select name="course" required>{courses.map((course)=><option key={course.id} value={course.id}>{course.title}</option>)}</select></label><div className="form-row"><label>Type<select name="type"><option value="recorded">Recorded lesson</option><option value="live">Live class</option><option value="note">Note / PDF</option></select></label><label>Order<input name="order" type="number" defaultValue="0"/></label></div><label>Title<input name="title" required/></label><label>Description<textarea name="description"/></label><label>Video URL<input name="video" type="url" placeholder="YouTube, Vimeo or protected video URL"/></label><label>Live meeting URL<input name="meeting" type="url" placeholder="Zoom / Google Meet"/></label><div className="form-row"><label>Schedule<input name="scheduled" type="datetime-local"/></label><label>Duration (min)<input name="duration" type="number" min="1"/></label></div><label>Lesson file<input name="file" type="file" accept="application/pdf,image/jpeg,image/png,video/mp4"/></label><label className="check-label"><input name="published" type="checkbox"/> Publish immediately</label><Submit busy={busy==="lesson"}/></form>:<form action={createAnnouncement} className="admin-form"><label>Audience<select name="course"><option value="">All approved students</option>{courses.map((course)=><option key={course.id} value={course.id}>{course.title}</option>)}</select></label><label>Title<input name="title" required/></label><label>Message<textarea name="message" required rows={5}/></label><Submit busy={busy==="announcement"}/></form>}</AdminModal>}
    {modal==="editStudent"&&selectedProfile&&<AdminModal title="Edit student details" close={()=>setModal("")}><form action={updateStudent} className="admin-form"><label>Email<input value={selectedProfile.email} disabled/></label><label>Full name<input name="fullName" required defaultValue={selectedProfile.full_name}/></label><label>WhatsApp number<input name="phone" defaultValue={selectedProfile.phone||""}/></label><Submit busy={busy==="student"}/></form></AdminModal>}
    {modal==="resetPassword"&&selectedProfile&&<AdminModal title={`Reset password · ${selectedProfile.full_name||selectedProfile.email}`} close={()=>setModal("")}><form action={resetStudentPassword} className="admin-form"><p className="form-help">Set a new temporary password and share it privately with the student. The account is already email-confirmed.</p><label>New password<input name="password" type="password" minLength={8} required autoComplete="new-password" placeholder="Minimum 8 characters"/></label><Submit busy={busy==="resetPassword"}/></form></AdminModal>}
    {modal==="grantAccess"&&selectedProfile&&<AdminModal title={`Grant access · ${selectedProfile.full_name||selectedProfile.email}`} close={()=>setModal("")}><form action={grantStudentAccess} className="admin-form"><label>Class<select name="course" required>{courses.filter((course)=>course.is_active).map((course)=><option key={course.id} value={course.id}>{course.grade} · {course.title}</option>)}</select></label><label>Access duration (days)<input name="days" type="number" min="1" defaultValue="30" required/></label><p className="form-help">Existing access for this class will be renewed from today.</p><Submit busy={busy==="access"}/></form></AdminModal>}
    {modal==="editCourse"&&selectedCourse&&<AdminModal title="Edit class" close={()=>setModal("")}><form action={updateCourse} className="admin-form"><label>Course code<input name="code" required defaultValue={selectedCourse.code}/></label><label>Title<input name="title" required defaultValue={selectedCourse.title}/></label><div className="form-row"><label>Grade<input name="grade" required defaultValue={selectedCourse.grade}/></label><label>Medium<select name="medium" defaultValue={selectedCourse.medium}><option>Sinhala</option><option>English</option><option>Tamil</option></select></label></div><label>Description<textarea name="description" required defaultValue={selectedCourse.description}/></label><div className="form-row"><label>Monthly fee (LKR)<input name="fee" type="number" min="0" defaultValue={selectedCourse.monthly_fee_lkr||0}/></label><label>Card colour<select name="color" defaultValue={selectedCourse.cover_color}><option value="sage">Sage</option><option value="peach">Peach</option><option value="lavender">Lavender</option></select></label></div><Submit busy={busy==="courseEdit"}/></form></AdminModal>}
    {modal==="editLesson"&&selectedLesson&&<AdminModal title="Edit lesson" close={()=>setModal("")}><form action={updateLesson} className="admin-form"><label>Class<select name="course" defaultValue={selectedLesson.course_id} required>{courses.map((course)=><option key={course.id} value={course.id}>{course.title}</option>)}</select></label><div className="form-row"><label>Type<select name="type" defaultValue={selectedLesson.lesson_type}><option value="recorded">Recorded lesson</option><option value="live">Live class</option><option value="note">Note / PDF</option></select></label><label>Order<input name="order" type="number" defaultValue={selectedLesson.sort_order}/></label></div><label>Title<input name="title" required defaultValue={selectedLesson.title}/></label><label>Description<textarea name="description" defaultValue={selectedLesson.description}/></label><label>Video URL<input name="video" type="url" defaultValue={selectedLesson.video_url||""}/></label><label>Live meeting URL<input name="meeting" type="url" defaultValue={selectedLesson.meeting_url||""}/></label><div className="form-row"><label>Schedule<input name="scheduled" type="datetime-local" defaultValue={selectedLesson.scheduled_at?new Date(selectedLesson.scheduled_at).toISOString().slice(0,16):""}/></label><label>Duration (min)<input name="duration" type="number" min="1" defaultValue={selectedLesson.duration_minutes||""}/></label></div><label className="check-label"><input name="published" type="checkbox" defaultChecked={selectedLesson.is_published}/> Published</label><Submit busy={busy==="lessonEdit"}/></form></AdminModal>}
    {modal==="editAnnouncement"&&selectedAnnouncement&&<AdminModal title="Edit announcement" close={()=>setModal("")}><form action={updateAnnouncement} className="admin-form"><label>Audience<select name="course" defaultValue={selectedAnnouncement.course_id||""}><option value="">All approved students</option>{courses.map((course)=><option key={course.id} value={course.id}>{course.title}</option>)}</select></label><label>Title<input name="title" required defaultValue={selectedAnnouncement.title}/></label><label>Message<textarea name="message" required rows={5} defaultValue={selectedAnnouncement.message}/></label><label className="check-label"><input name="published" type="checkbox" defaultChecked={selectedAnnouncement.is_published}/> Published</label><Submit busy={busy==="announcementEdit"}/></form></AdminModal>}
    {newStudent&&<AdminModal title="Create confirmed student account" close={()=>setNewStudent(false)}><form action={createStudent} className="admin-form"><p className="form-help">Create the account here when student signup emails are rate limited. The student can log in immediately with these credentials.</p><label>Student full name<input name="fullName" required autoComplete="name"/></label><label>WhatsApp number<input name="phone" required autoComplete="tel" placeholder="+94 77 123 4567"/></label><label>Email address<input name="email" type="email" required autoComplete="email"/></label><label>Temporary password<input name="password" type="password" minLength={8} required autoComplete="new-password"/></label><Submit busy={busy==="newStudent"}/></form></AdminModal>}
  </main>;
}

function PaymentRow({payment,profile,busy,viewSlip,review}:{payment:Payment;profile?:Profile;busy:string;viewSlip:(path:string)=>void;review:(payment:Payment,status:"approved"|"rejected")=>void}){return <article className="payment-review"><div className="payment-person"><span>{(profile?.full_name||"ST").slice(0,2).toUpperCase()}</span><div><strong>{profile?.full_name||"Student"}</strong><small>{profile?.email}</small></div></div><div><small>CLASS</small><strong>{payment.course?.title}</strong></div><div><small>AMOUNT</small><strong>Rs. {Number(payment.amount_lkr).toLocaleString()}</strong></div><b className={"status "+payment.status}>{payment.status}</b><div className="review-actions"><button onClick={()=>viewSlip(payment.slip_path)}>View slip</button>{payment.status==="pending"&&<><button className="reject" disabled={busy.startsWith(payment.id)} onClick={()=>review(payment,"rejected")}><X/></button><button className="approve" disabled={busy.startsWith(payment.id)} onClick={()=>review(payment,"approved")}>{busy?<LoaderCircle className="spin"/>:<Check/>}</button></>}</div></article>}
function AdminModal({title,close,children}:{title:string;close:()=>void;children:React.ReactNode}){return <div className="admin-modal-backdrop" onClick={close}><div className="admin-modal" onClick={(e)=>e.stopPropagation()}><header><h2>{title}</h2><button onClick={close}><X/></button></header>{children}</div></div>}
function Submit({busy}:{busy:boolean}){return <button className="admin-submit" disabled={busy}>{busy?<LoaderCircle className="spin"/>:<Check/>}{busy?"Saving…":"Save"}</button>}
function AdminEmpty({text}:{text:string}){return <div className="admin-empty"><ShieldCheck/><p>{text}</p></div>}

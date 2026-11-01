insert into public.lms_courses (code, title, grade, description, cover_color)
values
  ('MATH-G06', 'Grade 06 Mathematics', 'Grade 06', 'Core number skills, shapes and clear problem-solving for a confident start.', 'sage'),
  ('MATH-G07', 'Grade 07 Mathematics', 'Grade 07', 'Fractions, measurement and stronger mathematical thinking through guided practice.', 'lavender'),
  ('MATH-G08', 'Grade 08 Mathematics', 'Grade 08', 'Ratios, algebra basics and the key connections needed for advanced maths.', 'peach')
on conflict (code) do update set
  title = excluded.title,
  grade = excluded.grade,
  description = excluded.description,
  cover_color = excluded.cover_color;

insert into public.lms_lessons (course_id, title, description, lesson_type, duration_minutes, sort_order, is_published)
select id, 'Welcome & Course Guide', 'How to use your learning space and prepare for class.', 'recorded', 8, 1, true
from public.lms_courses c
where c.code in ('MATH-G06', 'MATH-G07', 'MATH-G08')
  and not exists (
    select 1 from public.lms_lessons l
    where l.course_id = c.id and l.title = 'Welcome & Course Guide'
  );

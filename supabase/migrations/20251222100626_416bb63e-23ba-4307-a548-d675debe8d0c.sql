-- Update Hero Content for Professional mode
UPDATE public.hero_content 
SET 
  name = 'Pravin Raj Muralitharan',
  title = 'Software Engineer',
  greeting = 'Hi, I''m',
  description = 'AI graduate from Universiti Malaya specializing in Python automation, Salesforce configurations, and DevOps deployments. Strong foundation in ML/DL with hands-on experience in PyTorch, Keras, and TensorFlow.',
  cta_text = 'View My Work',
  animated_titles = ARRAY['Software Engineer', 'AI Specialist', 'Full Stack Developer', 'DevOps Engineer'],
  updated_at = NOW()
WHERE id = 'b19089ec-92c5-4055-949a-95938ed07f1b';

-- Update Hero Content for Creative mode
UPDATE public.hero_content 
SET 
  name = 'Pravin Raj Muralitharan',
  title = 'Creative Technologist',
  greeting = 'Hi, I''m',
  description = 'A dynamic and creative professional who brings ideas to life through design, video editing, and multimedia content creation. Passionate about UI/UX design and brand identity.',
  cta_text = 'See My Work',
  animated_titles = ARRAY['UI/UX Designer', 'Video Editor', 'Graphic Designer', 'Content Creator'],
  updated_at = NOW()
WHERE id = 'a4c6c181-0e86-41e9-b7e0-dfc6814f8285';

-- Update About Content for Professional mode
UPDATE public.about_content 
SET 
  content = 'I am an Artificial Intelligence graduate from Universiti Malaya (CGPA: 3.83, Pass with Honours with Distinction), currently working as a Software Engineer at Dell Technologies. I specialize in Python automation, Salesforce configurations, and DevOps deployments. With a strong foundation in machine learning and deep learning using PyTorch, Keras, and TensorFlow, I drive AI/ML research and deploy scalable, secure systems for mission-critical decision-making and large-scale data analysis. I am proficient in English, Mandarin, Malay, and Tamil.',
  updated_at = NOW()
WHERE id = '14051f78-976f-437a-b84e-954b47985e01';

-- Update About Content for Creative mode
UPDATE public.about_content 
SET 
  content = 'A dynamic, proactive and methodical professional with a passion for creative design and multimedia production. As a Microsoft Certified Power BI Data Analyst Associate and UI/UX enthusiast, I bring data visualization and design thinking to every project. With experience as a guest speaker, design competition judge, and active PEKOM member, I combine technical expertise with creative storytelling to deliver compelling visual experiences.',
  updated_at = NOW()
WHERE id = 'e8a0cdf2-3388-4e46-8bae-040727e5ea66';

-- Update Contact Content for Professional mode
UPDATE public.contact_content 
SET 
  email = 'pravinrajggb@gmail.com',
  phone = '+60 16 719 7767',
  location = '81750 Masai, Malaysia',
  title = 'Get In Touch',
  subtitle = 'Let''s discuss your next project or potential collaboration opportunities in AI/ML, software development, or DevOps.',
  services = ARRAY['AI/ML Development', 'Full-Stack Development', 'DevOps & Deployment', 'Salesforce Development', 'Technical Consulting'],
  updated_at = NOW()
WHERE id = '4f54f47e-86da-4697-904c-7918ce59c466';

-- Update Contact Content for Creative mode
UPDATE public.contact_content 
SET 
  email = 'pravinrajggb@gmail.com',
  phone = '+60 16 719 7767',
  location = '81750 Masai, Malaysia',
  title = 'Get In Touch',
  subtitle = 'Ready to bring your creative vision to life? Let''s chat about design, video editing, or multimedia projects.',
  services = ARRAY['UI/UX Design', 'Video Editing', 'Graphic Design', 'Brand Identity', 'Content Creation'],
  updated_at = NOW()
WHERE id = 'ab222b6f-bede-4b07-9647-d123c96a37e5';

-- Delete existing experiences and add new ones from resume
DELETE FROM public.experiences;

INSERT INTO public.experiences (title, company, location, period, description, achievements, mode, order_index) VALUES
('Software Engineer I', 'Dell Technologies', 'Malaysia', 'Mar 2025 - Present', 'Working in the Salesforce development team, delivering user stories and handling production deployments as part of the DevOps team.', 
 ARRAY['Deliver at least three Salesforce user stories per sprint, tracked through Jira', 'Execute production deployments as part of the Build Team with deployment quality score above 80%', 'Implement Apex configurations to enhance, modify, or remove Salesforce platform functionality'], 
 'professional', 0),
('IT Intern', 'Dell Technologies', 'Cyberjaya, Malaysia', 'Aug 2023 - Jan 2024', 'Selected through the Hack2Hire competition for a six-month IT internship aligned with undergraduate program requirements.', 
 ARRAY['Assisted the Customer Engagement and Data Transformation (CEDT) team', 'Executed operational workflows and project deliverables', 'Collaborated closely with other product teams'], 
 'professional', 1),
('Software Engineer I', 'Dell Technologies', 'Malaysia', 'Mar 2025 - Present', 'Handling Salesforce-related user stories and sandbox/production deployments under the DevOps Team.', 
 ARRAY['Complete Salesforce-related user stories via apex configurations', 'Handle sandbox and production deployments'], 
 'creative', 0);

-- Delete existing education and add new ones from resume
DELETE FROM public.education;

INSERT INTO public.education (degree, institution, location, period, description, achievements, order_index) VALUES
('Bachelor of Computer Science (Artificial Intelligence)', 'Universiti Malaya (UM)', 'Kuala Lumpur, Malaysia', 'Aug 2021 - Dec 2025', 'Specialized in Artificial Intelligence with a strong focus on machine learning, deep learning, and computer vision.', 
 ARRAY['CGPA: 3.83', 'Pass with Honours (with Distinction)', 'Dean''s Award Receiver for 4 Semesters'], 
 0),
('Foundation in Science (Module 1)', 'Pahang Matriculation College (KMPh)', 'Pahang, Malaysia', 'Aug 2020 - May 2021', 'Pre-university foundation program in science stream.', 
 ARRAY['CGPA: 4.00', 'Perfect Score'], 
 1),
('Sijil Pelajaran Malaysia (SPM)', 'SMK Taman Desa Skudai', 'Johor, Malaysia', 'Jan 2015 - Dec 2019', 'Malaysian Certificate of Education - Secondary school education.', 
 ARRAY['Straight As (6A+ 3A)', 'Idol of Students Award Recipient 2019'], 
 2);

-- Delete existing certifications and add new ones from resume
DELETE FROM public.certifications;

INSERT INTO public.certifications (name, issuer, date, credential_id, description, order_index) VALUES
('Power BI Data Analyst Associate', 'Microsoft', 'Mar 2024', 'PL-300', 'Completed PL-300T00 - Microsoft Power BI Data Analyst course through Trainocate Malaysia. Demonstrated methods and best practices for modeling, visualizing, and analyzing data with Microsoft Power BI.', 0),
('Design Duel 2024 Judge', 'PEKOM - Faculty of Computer Science & IT', 'Apr 2024', 'DD-2024-JUDGE', 'Invited as a judge for the Design Duel 2024 UI/UX designing competition conducted by PEKOM at FCSIT. Evaluated participants'' designs alongside judges from reputable companies.', 1),
('Faculty Student Representative', 'Universiti Malaya Student Union', 'Jun 2023 - May 2024', 'UMSU-2023-FSR', 'Won the general election of Universiti Malaya by earning majority votes as faculty candidate for the Faculty of Computer Science & Information Technology (FCSIT).', 2),
('Guest Speaker - Media & Technology Workshop', 'SRM UM', 'Apr 2023', 'SRM-2023-GS', 'Conducted a session focused on graphic designing during the Media & Technology Workshop organized by Sekretariat Rakan Muda Universiti Malaya.', 3),
('Silver Award - Software Engineering Innovation Day', 'SEID', 'Dec 2022', 'SEID-2022-SILVER', 'Received Silver Award at the Software Engineering Innovation Day competition.', 4);

-- Update skills for professional mode
DELETE FROM public.skills WHERE mode = 'professional';

INSERT INTO public.skills (category, icon, skills, color, mode, order_index) VALUES
('AI & Machine Learning', 'Brain', ARRAY['Machine Learning', 'Deep Learning', 'Computer Vision', 'Natural Language Processing', 'PyTorch', 'Keras', 'TensorFlow'], 'from-purple-500 to-indigo-500', 'professional', 0),
('Programming Languages', 'Code', ARRAY['Python', 'TypeScript', 'Java', 'C#', 'PHP', 'R Programming'], 'from-blue-500 to-cyan-500', 'professional', 1),
('Web Development', 'Globe', ARRAY['React', 'Angular', 'Node.js', 'Django', 'ASP.Net Core', 'HTML/CSS'], 'from-green-500 to-emerald-500', 'professional', 2),
('DevOps & Tools', 'Settings', ARRAY['DevOps', 'Salesforce', 'Power BI', 'Jira', 'Git'], 'from-orange-500 to-amber-500', 'professional', 3);

-- Update skills for creative mode
DELETE FROM public.skills WHERE mode = 'creative';

INSERT INTO public.skills (category, icon, skills, color, mode, order_index) VALUES
('Design & UI/UX', 'Palette', ARRAY['UI/UX Design', 'Figma', 'Adobe XD', 'Canva', 'Brand Identity'], 'from-pink-500 to-rose-500', 'creative', 0),
('Video & Multimedia', 'Video', ARRAY['Adobe Premiere Pro', 'DaVinci Resolve', 'Motion Graphics', 'Video Editing', 'Content Creation'], 'from-purple-500 to-violet-500', 'creative', 1),
('Data Visualization', 'BarChart3', ARRAY['Power BI', 'Data Storytelling', 'Dashboard Design', 'Analytics'], 'from-blue-500 to-indigo-500', 'creative', 2);

-- Update site settings with site name
UPDATE public.site_settings 
SET 
  site_name = 'Pravin Raj',
  updated_at = NOW()
WHERE id IS NOT NULL;
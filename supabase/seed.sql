-- Insert a School
INSERT INTO schools (id, name, domain, subscription_status) 
VALUES ('11111111-1111-1111-1111-111111111111', 'Zanzibar Smart Academy', 'zsa.ac.tz', 'active');

-- Insert a Super Admin
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at) 
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin@zeis.co.tz', 'password_hash_here', NOW());
INSERT INTO profiles (id, school_id, full_name, role) 
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'System Admin', 'super_admin');

-- Insert a Teacher
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at) 
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'teacher@zsa.ac.tz', 'password_hash_here', NOW());
INSERT INTO profiles (id, school_id, full_name, role) 
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'Ali Hassan', 'teacher');
INSERT INTO teachers (id, employee_id, qualification) 
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'TCH-001', 'BSc Mathematics');

-- Insert a Student
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at) 
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'student@zsa.ac.tz', 'password_hash_here', NOW());
INSERT INTO profiles (id, school_id, full_name, role) 
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'Fatma Ali', 'student');
INSERT INTO students (id, admission_number, class_id) 
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'STU-001', NULL);

-- Insert an Academic Year
INSERT INTO academic_years (id, school_id, name, start_date, end_date, is_current) 
VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', '2025-2026', '2025-01-15', '2026-12-15', TRUE);

-- Insert a Class
INSERT INTO classes (id, school_id, name, academic_year_id) 
VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', 'Form 1A', 'dddddddd-dddd-dddd-dddd-dddddddddddd');
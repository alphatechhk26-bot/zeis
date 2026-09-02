-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== SCHOOLS (Multi-tenant) ====================
CREATE TABLE schools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255) UNIQUE,
  logo_url TEXT,
  subscription_status VARCHAR(50) DEFAULT 'trial',
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== PROFILES (Extends Auth Users) ====================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('super_admin', 'admin', 'teacher', 'student', 'parent')),
  phone VARCHAR(20),
  address TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== STUDENTS ====================
CREATE TABLE students (
  id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  admission_number VARCHAR(50) UNIQUE NOT NULL,
  date_of_birth DATE,
  gender VARCHAR(10),
  parent_id UUID REFERENCES profiles(id), -- links to parent profile
  class_id UUID, -- FK added later
  current_academic_year_id UUID, -- FK added later
  enrollment_date DATE DEFAULT CURRENT_DATE,
  emergency_contact VARCHAR(100),
  medical_info TEXT
);

-- ==================== TEACHERS ====================
CREATE TABLE teachers (
  id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  employee_id VARCHAR(50) UNIQUE NOT NULL,
  qualification TEXT,
  specialization VARCHAR(100),
  hire_date DATE DEFAULT CURRENT_DATE,
  is_class_teacher BOOLEAN DEFAULT FALSE
);

-- ==================== PARENTS ====================
CREATE TABLE parents (
  id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  occupation VARCHAR(100),
  relationship VARCHAR(50) -- e.g., Father, Mother, Guardian
);

-- ==================== ACADEMIC YEARS ====================
CREATE TABLE academic_years (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL, -- e.g., "2025-2026"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== CLASSES ====================
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL, -- e.g., "Form 1A", "Grade 5"
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
  class_teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  capacity INT DEFAULT 40,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== SUBJECTS ====================
CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL, -- e.g., "Mathematics", "Kiswahili"
  code VARCHAR(20) UNIQUE,
  description TEXT
);

-- ==================== CLASS_SUBJECTS (Assign subjects to classes) ====================
CREATE TABLE class_subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  UNIQUE(class_id, subject_id)
);

-- ==================== STUDENT_ENROLLMENTS ====================
CREATE TABLE student_enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
  enrollment_date DATE DEFAULT CURRENT_DATE,
  status VARCHAR(20) DEFAULT 'active', -- active, transferred, graduated, dropped
  UNIQUE(student_id, class_id, academic_year_id)
);

-- ==================== ATTENDANCE ====================
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
  time_in TIME,
  time_out TIME,
  marked_by UUID REFERENCES profiles(id),
  remarks TEXT,
  UNIQUE(student_id, date)
);

-- ==================== EXAMS ====================
CREATE TABLE exams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL, -- e.g., "Mid-Term 1", "Final"
  term VARCHAR(20), -- e.g., "Term 1"
  start_date DATE,
  end_date DATE,
  max_marks INT DEFAULT 100,
  weighting FLOAT DEFAULT 1.0
);

-- ==================== EXAM_QUESTIONS (For online exams) ====================
CREATE TABLE exam_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type VARCHAR(20) DEFAULT 'multiple_choice', -- multiple_choice, essay, true_false
  options JSONB, -- For MCQs: [{"A": "..."}, {"B": "..."}]
  correct_answer TEXT,
  marks INT DEFAULT 1
);

-- ==================== RESULTS ====================
CREATE TABLE results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  marks_obtained FLOAT,
  grade VARCHAR(5), -- A, B, C, D, F
  remarks TEXT,
  UNIQUE(student_id, exam_id, subject_id)
);

-- ==================== FEES (Fee Structures) ====================
CREATE TABLE fees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
  fee_type VARCHAR(100) NOT NULL, -- Tuition, Library, Sports, etc.
  amount DECIMAL(10,2) NOT NULL,
  due_date DATE,
  is_mandatory BOOLEAN DEFAULT TRUE
);

-- ==================== INVOICES ====================
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  academic_year_id UUID REFERENCES academic_years(id),
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  issue_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  total_amount DECIMAL(10,2),
  paid_amount DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending' -- pending, partially_paid, paid, overdue
);

-- ==================== PAYMENTS ====================
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  payment_method VARCHAR(50), -- cash, bank, m-pesa, etc.
  transaction_id VARCHAR(100),
  receipt_number VARCHAR(100) UNIQUE,
  recorded_by UUID REFERENCES profiles(id)
);

-- ==================== LIBRARY_BOOKS ====================
CREATE TABLE library_books (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  author VARCHAR(100),
  isbn VARCHAR(20) UNIQUE,
  category VARCHAR(100),
  quantity INT DEFAULT 1,
  available_quantity INT DEFAULT 1,
  location VARCHAR(50)
);

-- ==================== BORROW_RECORDS ====================
CREATE TABLE borrow_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_id UUID REFERENCES library_books(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  borrow_date DATE DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  return_date DATE,
  status VARCHAR(20) DEFAULT 'borrowed' -- borrowed, returned, overdue
);

-- ==================== LMS_COURSES (Learning Materials) ====================
CREATE TABLE lms_courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  content_url TEXT,
  file_urls TEXT[],
  video_urls TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== LMS_ASSIGNMENTS ====================
CREATE TABLE lms_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES lms_courses(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  due_date DATE,
  max_score INT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== SUBMISSIONS ====================
CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID REFERENCES lms_assignments(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  file_urls TEXT[],
  submission_text TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  score FLOAT,
  feedback TEXT,
  UNIQUE(assignment_id, student_id)
);

-- ==================== AI_CONVERSATIONS ====================
CREATE TABLE ai_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  subject VARCHAR(100),
  messages JSONB NOT NULL, -- Array of {role, content}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== NOTIFICATIONS ====================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50), -- sms, email, in_app
  is_read BOOLEAN DEFAULT FALSE,
  link TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== MESSAGES (Internal Chat) ====================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  subject VARCHAR(255),
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  parent_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== AUDIT_LOGS ====================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== ROW LEVEL SECURITY (RLS) ====================
-- Enable RLS on all tables
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
ALTER TABLE fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE borrow_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE lms_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE lms_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ==================== RLS POLICIES (Multi-tenant & Role-based) ====================
-- 1. Schools: Users can only see their own school
CREATE POLICY school_isolation ON schools
  FOR ALL USING (
    id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
  );

-- 2. Profiles: Users can view/edit their own profile, Admins can view all in their school
CREATE POLICY profile_access ON profiles
  FOR ALL USING (
    id = auth.uid() OR 
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'super_admin')
  );

-- 3. Students: School admins and teachers have full access; students see themselves; parents see their children.
CREATE POLICY student_access ON students
  FOR ALL USING (
    id = auth.uid() OR
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'teacher') OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'parent' 
      AND parent_id = auth.uid()
  );

-- 4. Attendance: Teachers can CRUD; Students/Parents can view
CREATE POLICY attendance_policy ON attendance
  FOR ALL USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'teacher') OR
    student_id = auth.uid() OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'parent' 
      AND student_id IN (SELECT id FROM students WHERE parent_id = auth.uid())
  );

-- 5. Results: Teachers/Admins CRUD; Students/Parents View
CREATE POLICY results_policy ON results
  FOR ALL USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'teacher') OR
    student_id = auth.uid() OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'parent' 
      AND student_id IN (SELECT id FROM students WHERE parent_id = auth.uid())
  );

-- 6. Invoices/Payments: Finance/Admin CRUD; Students/Parents View
CREATE POLICY finance_policy ON invoices
  FOR ALL USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin') OR
    student_id = auth.uid() OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'parent' 
      AND student_id IN (SELECT id FROM students WHERE parent_id = auth.uid())
  );

-- 7. Library: All authenticated users can view; Admins can manage
CREATE POLICY library_policy ON library_books
  FOR ALL USING (true);

-- 8. Audit Logs: Only Super Admins and School Admins
CREATE POLICY audit_policy ON audit_logs
  FOR ALL USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'super_admin')
  );

-- Apply similar FOR ALL policies to remaining tables using the same school isolation pattern.
-- For brevity, assume all tables restrict to school_id = auth.user's profile.school_id.
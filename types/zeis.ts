// types/zeis.ts
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      schools: {
        Row: {
          id: string;
          name: string;
          slug: string;
          branding: Json;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          branding?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          branding?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          school_id: string | null;
          role: Database['public']['Enums']['user_role'];
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          school_id?: string | null;
          role?: Database['public']['Enums']['user_role'];
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string | null;
          role?: Database['public']['Enums']['user_role'];
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      academic_years: {
        Row: {
          id: string;
          school_id: string;
          name: string;
          code: string | null;
          start_date: string;
          end_date: string;
          is_active: boolean;
          status: Database['public']['Enums']['academic_status'];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          name: string;
          code?: string | null;
          start_date: string;
          end_date: string;
          is_active?: boolean;
          status?: Database['public']['Enums']['academic_status'];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          name?: string;
          code?: string | null;
          start_date?: string;
          end_date?: string;
          is_active?: boolean;
          status?: Database['public']['Enums']['academic_status'];
          created_at?: string;
          updated_at?: string;
        };
      };
      terms: {
        Row: {
          id: string;
          academic_year_id: string;
          name: string;
          term_number: number;
          start_date: string;
          end_date: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          academic_year_id: string;
          name: string;
          term_number: number;
          start_date: string;
          end_date: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          academic_year_id?: string;
          name?: string;
          term_number?: number;
          start_date?: string;
          end_date?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      classes: {
        Row: {
          id: string;
          school_id: string;
          name: string;
          code: string | null;
          description: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          name: string;
          code?: string | null;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          name?: string;
          code?: string | null;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      streams: {
        Row: {
          id: string;
          school_id: string;
          name: string;
          code: string | null;
          description: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          name: string;
          code?: string | null;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          name?: string;
          code?: string | null;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      subjects: {
        Row: {
          id: string;
          school_id: string;
          name: string;
          code: string | null;
          description: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          name: string;
          code?: string | null;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          name?: string;
          code?: string | null;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      class_subjects: {
        Row: {
          id: string;
          class_id: string;
          subject_id: string;
          academic_year_id: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          class_id: string;
          subject_id: string;
          academic_year_id: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          class_id?: string;
          subject_id?: string;
          academic_year_id?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      students: {
        Row: {
          id: string;
          school_id: string;
          admission_number: string | null;
          enrollment_date: string;
          status: Database['public']['Enums']['enrollment_status'];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          school_id: string;
          admission_number?: string | null;
          enrollment_date?: string;
          status?: Database['public']['Enums']['enrollment_status'];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          admission_number?: string | null;
          enrollment_date?: string;
          status?: Database['public']['Enums']['enrollment_status'];
          created_at?: string;
          updated_at?: string;
        };
      };
      teachers: {
        Row: {
          id: string;
          school_id: string;
          employee_id: string | null;
          hire_date: string | null;
          status: Database['public']['Enums']['academic_status'];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          school_id: string;
          employee_id?: string | null;
          hire_date?: string | null;
          status?: Database['public']['Enums']['academic_status'];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          employee_id?: string | null;
          hire_date?: string | null;
          status?: Database['public']['Enums']['academic_status'];
          created_at?: string;
          updated_at?: string;
        };
      };
      parents: {
        Row: {
          id: string;
          school_id: string;
          phone: string | null;
          occupation: string | null;
          address: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          school_id: string;
          phone?: string | null;
          occupation?: string | null;
          address?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          phone?: string | null;
          occupation?: string | null;
          address?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      student_enrollments: {
        Row: {
          id: string;
          student_id: string;
          academic_year_id: string;
          class_id: string;
          stream_id: string | null;
          term_id: string | null;
          enrollment_date: string;
          status: Database['public']['Enums']['enrollment_status'];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          academic_year_id: string;
          class_id: string;
          stream_id?: string | null;
          term_id?: string | null;
          enrollment_date?: string;
          status?: Database['public']['Enums']['enrollment_status'];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          academic_year_id?: string;
          class_id?: string;
          stream_id?: string | null;
          term_id?: string | null;
          enrollment_date?: string;
          status?: Database['public']['Enums']['enrollment_status'];
          created_at?: string;
          updated_at?: string;
        };
      };
      attendance: {
        Row: {
          id: string;
          school_id: string;
          student_id: string;
          class_id: string;
          academic_year_id: string;
          term_id: string | null;
          attendance_date: string;
          status: Database['public']['Enums']['attendance_status'];
          check_in_time: string | null;
          check_out_time: string | null;
          remarks: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          student_id: string;
          class_id: string;
          academic_year_id: string;
          term_id?: string | null;
          attendance_date: string;
          status: Database['public']['Enums']['attendance_status'];
          check_in_time?: string | null;
          check_out_time?: string | null;
          remarks?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          student_id?: string;
          class_id?: string;
          academic_year_id?: string;
          term_id?: string | null;
          attendance_date?: string;
          status?: Database['public']['Enums']['attendance_status'];
          check_in_time?: string | null;
          check_out_time?: string | null;
          remarks?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      exams: {
        Row: {
          id: string;
          school_id: string;
          academic_year_id: string;
          term_id: string | null;
          class_id: string;
          subject_id: string;
          name: string;
          exam_type: Database['public']['Enums']['exam_type'];
          max_marks: number;
          passing_marks: number | null;
          exam_date: string | null;
          duration_minutes: number | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          academic_year_id: string;
          term_id?: string | null;
          class_id: string;
          subject_id: string;
          name: string;
          exam_type?: Database['public']['Enums']['exam_type'];
          max_marks: number;
          passing_marks?: number | null;
          exam_date?: string | null;
          duration_minutes?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          academic_year_id?: string;
          term_id?: string | null;
          class_id?: string;
          subject_id?: string;
          name?: string;
          exam_type?: Database['public']['Enums']['exam_type'];
          max_marks?: number;
          passing_marks?: number | null;
          exam_date?: string | null;
          duration_minutes?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      exam_questions: {
        Row: {
          id: string;
          exam_id: string;
          question_text: string;
          question_type: string | null;
          options: Json | null;
          correct_answer: string | null;
          marks: number;
          order_index: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          exam_id: string;
          question_text: string;
          question_type?: string | null;
          options?: Json | null;
          correct_answer?: string | null;
          marks: number;
          order_index?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          exam_id?: string;
          question_text?: string;
          question_type?: string | null;
          options?: Json | null;
          correct_answer?: string | null;
          marks?: number;
          order_index?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      results: {
        Row: {
          id: string;
          school_id: string;
          exam_id: string;
          student_id: string;
          marks_obtained: number | null;
          grade: string | null;
          remarks: string | null;
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          exam_id: string;
          student_id: string;
          marks_obtained?: number | null;
          grade?: string | null;
          remarks?: string | null;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          exam_id?: string;
          student_id?: string;
          marks_obtained?: number | null;
          grade?: string | null;
          remarks?: string | null;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      fee_structures: {
        Row: {
          id: string;
          school_id: string;
          academic_year_id: string;
          class_id: string | null;
          term_id: string | null;
          fee_name: string;
          amount: number;
          is_mandatory: boolean;
          due_date: string | null;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          academic_year_id: string;
          class_id?: string | null;
          term_id?: string | null;
          fee_name: string;
          amount: number;
          is_mandatory?: boolean;
          due_date?: string | null;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          academic_year_id?: string;
          class_id?: string | null;
          term_id?: string | null;
          fee_name?: string;
          amount?: number;
          is_mandatory?: boolean;
          due_date?: string | null;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      invoices: {
        Row: {
          id: string;
          school_id: string;
          student_id: string;
          invoice_number: string;
          academic_year_id: string;
          term_id: string | null;
          issue_date: string;
          due_date: string | null;
          total_amount: number;
          amount_paid: number;
          status: Database['public']['Enums']['invoice_status'];
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          student_id: string;
          invoice_number: string;
          academic_year_id: string;
          term_id?: string | null;
          issue_date?: string;
          due_date?: string | null;
          total_amount: number;
          amount_paid?: number;
          status?: Database['public']['Enums']['invoice_status'];
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          student_id?: string;
          invoice_number?: string;
          academic_year_id?: string;
          term_id?: string | null;
          issue_date?: string;
          due_date?: string | null;
          total_amount?: number;
          amount_paid?: number;
          status?: Database['public']['Enums']['invoice_status'];
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      payments: {
        Row: {
          id: string;
          school_id: string;
          invoice_id: string | null;
          student_id: string;
          amount: number;
          payment_date: string;
          payment_method: Database['public']['Enums']['payment_method'];
          transaction_id: string | null;
          reference: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          invoice_id?: string | null;
          student_id: string;
          amount: number;
          payment_date?: string;
          payment_method: Database['public']['Enums']['payment_method'];
          transaction_id?: string | null;
          reference?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          invoice_id?: string | null;
          student_id?: string;
          amount?: number;
          payment_date?: string;
          payment_method?: Database['public']['Enums']['payment_method'];
          transaction_id?: string | null;
          reference?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      library_books: {
        Row: {
          id: string;
          school_id: string;
          title: string;
          author: string | null;
          isbn: string | null;
          publisher: string | null;
          publication_year: number | null;
          genre: string | null;
          copy_number: number;
          total_copies: number;
          available_copies: number;
          location: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          title: string;
          author?: string | null;
          isbn?: string | null;
          publisher?: string | null;
          publication_year?: number | null;
          genre?: string | null;
          copy_number?: number;
          total_copies: number;
          available_copies: number;
          location?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          title?: string;
          author?: string | null;
          isbn?: string | null;
          publisher?: string | null;
          publication_year?: number | null;
          genre?: string | null;
          copy_number?: number;
          total_copies?: number;
          available_copies?: number;
          location?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      borrow_records: {
        Row: {
          id: string;
          school_id: string;
          book_id: string;
          student_id: string;
          borrow_date: string;
          due_date: string;
          return_date: string | null;
          status: Database['public']['Enums']['borrow_status'];
          fine_amount: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          book_id: string;
          student_id: string;
          borrow_date?: string;
          due_date: string;
          return_date?: string | null;
          status?: Database['public']['Enums']['borrow_status'];
          fine_amount?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          book_id?: string;
          student_id?: string;
          borrow_date?: string;
          due_date?: string;
          return_date?: string | null;
          status?: Database['public']['Enums']['borrow_status'];
          fine_amount?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      lms_courses: {
        Row: {
          id: string;
          school_id: string;
          name: string;
          description: string | null;
          created_by: string | null;
          is_published: boolean;
          start_date: string | null;
          end_date: string | null;
          thumbnail_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          name: string;
          description?: string | null;
          created_by?: string | null;
          is_published?: boolean;
          start_date?: string | null;
          end_date?: string | null;
          thumbnail_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          name?: string;
          description?: string | null;
          created_by?: string | null;
          is_published?: boolean;
          start_date?: string | null;
          end_date?: string | null;
          thumbnail_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      lessons: {
        Row: {
          id: string;
          course_id: string;
          title: string;
          content: string | null;
          video_url: string | null;
          order_index: number;
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          course_id: string;
          title: string;
          content?: string | null;
          video_url?: string | null;
          order_index: number;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          course_id?: string;
          title?: string;
          content?: string | null;
          video_url?: string | null;
          order_index?: number;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      assignments: {
        Row: {
          id: string;
          lesson_id: string | null;
          course_id: string | null;
          title: string;
          description: string | null;
          max_score: number;
          due_date: string | null;
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lesson_id?: string | null;
          course_id?: string | null;
          title: string;
          description?: string | null;
          max_score: number;
          due_date?: string | null;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          lesson_id?: string | null;
          course_id?: string | null;
          title?: string;
          description?: string | null;
          max_score?: number;
          due_date?: string | null;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      submissions: {
        Row: {
          id: string;
          assignment_id: string;
          student_id: string;
          submission_text: string | null;
          file_urls: string[] | null;
          submitted_at: string;
          status: Database['public']['Enums']['submission_status'];
          grade: number | null;
          feedback: string | null;
          graded_by: string | null;
          graded_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          assignment_id: string;
          student_id: string;
          submission_text?: string | null;
          file_urls?: string[] | null;
          submitted_at?: string;
          status?: Database['public']['Enums']['submission_status'];
          grade?: number | null;
          feedback?: string | null;
          graded_by?: string | null;
          graded_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          assignment_id?: string;
          student_id?: string;
          submission_text?: string | null;
          file_urls?: string[] | null;
          submitted_at?: string;
          status?: Database['public']['Enums']['submission_status'];
          grade?: number | null;
          feedback?: string | null;
          graded_by?: string | null;
          graded_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      quizzes: {
        Row: {
          id: string;
          course_id: string;
          lesson_id: string | null;
          title: string;
          description: string | null;
          time_limit_minutes: number | null;
          passing_score: number | null;
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          course_id: string;
          lesson_id?: string | null;
          title: string;
          description?: string | null;
          time_limit_minutes?: number | null;
          passing_score?: number | null;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          course_id?: string;
          lesson_id?: string | null;
          title?: string;
          description?: string | null;
          time_limit_minutes?: number | null;
          passing_score?: number | null;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      quiz_questions: {
        Row: {
          id: string;
          quiz_id: string;
          question_text: string;
          question_type: string | null;
          options: Json | null;
          correct_answer: string | null;
          marks: number;
          order_index: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          quiz_id: string;
          question_text: string;
          question_type?: string | null;
          options?: Json | null;
          correct_answer?: string | null;
          marks: number;
          order_index?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          quiz_id?: string;
          question_text?: string;
          question_type?: string | null;
          options?: Json | null;
          correct_answer?: string | null;
          marks?: number;
          order_index?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      quiz_attempts: {
        Row: {
          id: string;
          quiz_id: string;
          student_id: string;
          start_time: string;
          end_time: string | null;
          score: number | null;
          status: Database['public']['Enums']['quiz_attempt_status'];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          quiz_id: string;
          student_id: string;
          start_time?: string;
          end_time?: string | null;
          score?: number | null;
          status?: Database['public']['Enums']['quiz_attempt_status'];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          quiz_id?: string;
          student_id?: string;
          start_time?: string;
          end_time?: string | null;
          score?: number | null;
          status?: Database['public']['Enums']['quiz_attempt_status'];
          created_at?: string;
          updated_at?: string;
        };
      };
      quiz_responses: {
        Row: {
          id: string;
          attempt_id: string;
          question_id: string;
          selected_option: string | null;
          text_response: string | null;
          is_correct: boolean | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          attempt_id: string;
          question_id: string;
          selected_option?: string | null;
          text_response?: string | null;
          is_correct?: boolean | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          attempt_id?: string;
          question_id?: string;
          selected_option?: string | null;
          text_response?: string | null;
          is_correct?: boolean | null;
          created_at?: string;
        };
      };
      computer_courses: {
        Row: {
          id: string;
          school_id: string;
          name: string;
          code: string | null;
          description: string | null;
          level: Database['public']['Enums']['computer_course_level'];
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          name: string;
          code?: string | null;
          description?: string | null;
          level?: Database['public']['Enums']['computer_course_level'];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          name?: string;
          code?: string | null;
          description?: string | null;
          level?: Database['public']['Enums']['computer_course_level'];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      computer_lessons: {
        Row: {
          id: string;
          computer_course_id: string;
          title: string;
          content: string | null;
          video_url: string | null;
          order_index: number;
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          computer_course_id: string;
          title: string;
          content?: string | null;
          video_url?: string | null;
          order_index: number;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          computer_course_id?: string;
          title?: string;
          content?: string | null;
          video_url?: string | null;
          order_index?: number;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      certificates: {
        Row: {
          id: string;
          school_id: string;
          student_id: string;
          course_id: string | null;
          computer_course_id: string | null;
          certificate_number: string;
          issue_date: string;
          expiry_date: string | null;
          file_url: string | null;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          student_id: string;
          course_id?: string | null;
          computer_course_id?: string | null;
          certificate_number: string;
          issue_date?: string;
          expiry_date?: string | null;
          file_url?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          student_id?: string;
          course_id?: string | null;
          computer_course_id?: string | null;
          certificate_number?: string;
          issue_date?: string;
          expiry_date?: string | null;
          file_url?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      ai_conversations: {
        Row: {
          id: string;
          school_id: string;
          student_id: string;
          title: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          student_id: string;
          title?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          student_id?: string;
          title?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      ai_messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: Database['public']['Enums']['conversation_role'];
          content: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          role: Database['public']['Enums']['conversation_role'];
          content: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          role?: Database['public']['Enums']['conversation_role'];
          content?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Enums: {
      user_role: 'super_admin' | 'admin' | 'teacher' | 'student' | 'parent';
      enrollment_status: 'active' | 'transferred' | 'graduated' | 'withdrawn' | 'suspended';
      academic_status: 'active' | 'inactive' | 'archived';
      attendance_status: 'present' | 'absent' | 'late' | 'excused';
      exam_type: 'quiz' | 'midterm' | 'final' | 'assignment' | 'practical';
      invoice_status: 'draft' | 'issued' | 'paid' | 'overdue' | 'cancelled';
      payment_method: 'cash' | 'bank_transfer' | 'card' | 'mobile_money' | 'cheque';
      borrow_status: 'borrowed' | 'returned' | 'overdue' | 'lost';
      computer_course_level: 'beginner' | 'intermediate' | 'advanced' | 'professional';
      quiz_attempt_status: 'in_progress' | 'completed' | 'abandoned';
      conversation_role: 'user' | 'assistant' | 'system';
      submission_status: 'draft' | 'submitted' | 'graded';
    };
  };
}
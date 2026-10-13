export type TrackingType = 'reps' | 'duration';
export type LoadMode = 'none' | 'optional' | 'required';
export type LoadBasis = 'total' | 'per_hand';
export type SetStatus = 'pending' | 'completed' | 'skipped';
export type SessionStatus = 'in_progress' | 'completed' | 'cancelled';
export type GoalType = 'max_reps' | 'max_duration' | 'external_load' | 'body_weight' | 'workout_frequency';
export type GoalStatus = 'active' | 'paused' | 'achieved' | 'cancelled';

export interface Exercise {
  id: string;
  name: string;
  category: string;
  tracking_type: TrackingType;
  load_mode: LoadMode;
  load_basis: LoadBasis;
  instructions: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemplateExercise {
  id: string;
  template_id: string;
  exercise_id: string;
  exercise_name?: string;
  tracking_type?: TrackingType;
  load_mode?: LoadMode;
  load_basis?: LoadBasis;
  position: number;
  target_sets: number;
  target_reps_min: number | null;
  target_reps_max: number | null;
  target_duration_seconds: number | null;
  target_load_kg: number | null;
  rest_seconds: number;
  notes: string | null;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  description: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  exercises?: TemplateExercise[];
}

export interface WeeklyScheduleEntry {
  id: string;
  weekday: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  template_id: string | null;
  template_name?: string | null;
  position: number;
  active: number;
}

export interface WeeklyScheduleConfig {
  entries: WeeklyScheduleEntry[];
  target_frequency: number; // Target workouts per week
}

export interface SetLog {
  id: string;
  session_exercise_id: string;
  set_number: number;
  target_reps_min: number | null;
  target_reps_max: number | null;
  target_duration_seconds: number | null;
  target_load_kg: number | null;
  actual_reps: number | null;
  actual_duration_seconds: number | null;
  actual_load_kg: number | null;
  status: SetStatus;
  notes: string | null;
  completed_at: string | null;
}

export interface SessionExercise {
  id: string;
  session_id: string;
  exercise_id: string | null;
  exercise_name_snapshot: string;
  tracking_type_snapshot: TrackingType;
  load_mode_snapshot: LoadMode;
  load_basis_snapshot: LoadBasis;
  position: number;
  target_sets: number;
  rest_seconds: number;
  notes: string | null;
  sets: SetLog[];
}

export interface WorkoutSession {
  id: string;
  template_id: string | null;
  template_name_snapshot: string;
  status: SessionStatus;
  started_at: string;
  finished_at: string | null;
  notes: string | null;
  created_at: string;
  duration_seconds?: number;
  exercises?: SessionExercise[];
  completed_sets_count?: number;
  planned_sets_count?: number;
}

export interface BodyWeightEntry {
  id: string;
  measured_at: string;
  weight_kg: number;
  notes: string | null;
  created_at: string;
}

export interface Goal {
  id: string;
  title: string;
  goal_type: GoalType;
  exercise_id: string | null;
  exercise_name?: string | null;
  target_value: number;
  baseline_value: number;
  start_date: string;
  deadline: string | null;
  status: GoalStatus;
  notes: string | null;
  created_at: string;
  achieved_at: string | null;
  current_value?: number;
  progress_percent?: number;
  is_achieved?: boolean;
}

export interface DashboardData {
  today_workout: {
    scheduled_template: WorkoutTemplate | null;
    active_session: WorkoutSession | null;
  };
  weekly_stats: {
    completed_workouts: number;
    target_frequency: number;
    completion_rate: number;
    planned_sets: number;
    completed_sets: number;
  };
  latest_weight: {
    current: number | null;
    change_from_first: number | null;
    change_last_30d: number | null;
    trend: 'up' | 'down' | 'steady' | 'insufficient_data';
  };
  active_goals: Goal[];
  recent_personal_records: {
    exercise_id: string;
    exercise_name: string;
    record_type: 'reps' | 'load' | 'duration';
    value: number;
    load_kg?: number;
    achieved_at: string;
  }[];
  recent_activity_chart: {
    date: string;
    completed_sets: number;
    duration_minutes: number;
    workout_name?: string;
  }[];
}

export interface AnalyticsData {
  summary: {
    total_workouts: number;
    total_completed_sets: number;
    total_duration_minutes: number;
    avg_workout_duration_minutes: number;
  };
  weekly_consistency: {
    week_start: string;
    completed_workouts: number;
    target_frequency: number;
  }[];
  volume_over_time: {
    date: string;
    planned_sets: number;
    completed_sets: number;
    total_reps: number;
  }[];
  body_weight_trend: {
    date: string;
    weight_kg: number;
    rolling_7d_avg: number | null;
  }[];
  exercise_progress?: {
    exercise_id: string;
    exercise_name: string;
    tracking_type: TrackingType;
    data: {
      date: string;
      best_reps?: number;
      best_load_kg?: number;
      best_duration_seconds?: number;
      total_volume_kg?: number;
    }[];
  };
}

export interface UserProfile {
  id: string;
  username: string;
  created_at: string;
}

export interface AuthStatus {
  isConfigured: boolean;
  isAuthenticated: boolean;
  user: UserProfile | null;
}

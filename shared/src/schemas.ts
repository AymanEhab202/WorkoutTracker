import { z } from 'zod';

export const TrackingTypeEnum = z.enum(['reps', 'duration']);
export const LoadModeEnum = z.enum(['none', 'optional', 'required']);
export const LoadBasisEnum = z.enum(['total', 'per_hand']);
export const SetStatusEnum = z.enum(['pending', 'completed', 'skipped']);
export const SessionStatusEnum = z.enum(['in_progress', 'completed', 'cancelled']);
export const GoalTypeEnum = z.enum(['max_reps', 'max_duration', 'external_load', 'body_weight', 'workout_frequency']);
export const GoalStatusEnum = z.enum(['active', 'paused', 'achieved', 'cancelled']);

export const ExerciseSchema = z.object({
  name: z.string().trim().min(1, 'Exercise name is required').max(100),
  category: z.string().trim().min(1, 'Category is required').max(50),
  tracking_type: TrackingTypeEnum,
  load_mode: LoadModeEnum,
  load_basis: LoadBasisEnum,
  instructions: z.string().trim().max(1000).nullable().optional(),
});

export const TemplateExerciseInputSchema = z.object({
  exercise_id: z.string().uuid(),
  position: z.number().int().min(0).default(0),
  target_sets: z.number().int().min(1, 'Target sets must be at least 1').max(20),
  target_reps_min: z.number().int().min(0).nullable().optional(),
  target_reps_max: z.number().int().min(0).nullable().optional(),
  target_duration_seconds: z.number().int().min(0).nullable().optional(),
  target_load_kg: z.number().min(0).nullable().optional(),
  rest_seconds: z.number().int().min(0).default(60),
  notes: z.string().trim().max(500).nullable().optional(),
}).refine((data) => {
  if (data.target_reps_min != null && data.target_reps_max != null) {
    return data.target_reps_min <= data.target_reps_max;
  }
  return true;
}, {
  message: 'Minimum target reps cannot be greater than maximum target reps',
  path: ['target_reps_min'],
});

export const WorkoutTemplateSchema = z.object({
  name: z.string().trim().min(1, 'Template name is required').max(100),
  description: z.string().trim().max(500).nullable().optional(),
  exercises: z.array(TemplateExerciseInputSchema).default([]),
});

export const WeeklyScheduleUpdateSchema = z.object({
  entries: z.array(
    z.object({
      weekday: z.number().int().min(0).max(6),
      template_id: z.string().uuid().nullable(),
      position: z.number().int().min(0).default(0),
      active: z.number().int().min(0).max(1).default(1),
    })
  ),
  target_frequency: z.number().int().min(1).max(7).default(4),
});

export const StartSessionSchema = z.object({
  template_id: z.string().uuid().nullable().optional(),
  name: z.string().trim().max(100).optional(),
});

export const UpdateSetSchema = z.object({
  status: SetStatusEnum,
  actual_reps: z.number().int().min(0, 'Reps cannot be negative').nullable().optional(),
  actual_duration_seconds: z.number().int().min(0, 'Duration cannot be negative').nullable().optional(),
  actual_load_kg: z.number().min(0, 'Load cannot be negative').nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
}).refine((data) => {
  if (data.status === 'completed') {
    // A completed set must have either valid reps or valid duration
    const hasReps = data.actual_reps != null && data.actual_reps >= 0;
    const hasDuration = data.actual_duration_seconds != null && data.actual_duration_seconds >= 0;
    return hasReps || hasDuration;
  }
  return true;
}, {
  message: 'A completed set must record actual repetitions or duration',
  path: ['status'],
});

export const AddExtraSetSchema = z.object({
  session_exercise_id: z.string().uuid(),
  target_reps_min: z.number().int().min(0).nullable().optional(),
  target_reps_max: z.number().int().min(0).nullable().optional(),
  target_duration_seconds: z.number().int().min(0).nullable().optional(),
  target_load_kg: z.number().min(0).nullable().optional(),
});

export const AddSessionExerciseSchema = z.object({
  exercise_id: z.string().uuid(),
  target_sets: z.number().int().min(1).max(20).default(3),
  target_reps_min: z.number().int().min(0).nullable().optional(),
  target_reps_max: z.number().int().min(0).nullable().optional(),
  target_duration_seconds: z.number().int().min(0).nullable().optional(),
  target_load_kg: z.number().min(0).nullable().optional(),
  rest_seconds: z.number().int().min(0).default(60),
});

export const FinishSessionSchema = z.object({
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const BodyWeightSchema = z.object({
  measured_at: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Valid measurement date and time is required',
  }),
  weight_kg: z.number().positive('Body weight must be greater than 0').max(500, 'Weight value is too high'),
  notes: z.string().trim().max(500).nullable().optional(),
});

export const GoalSchema = z.object({
  title: z.string().trim().min(1, 'Goal title is required').max(100),
  goal_type: GoalTypeEnum,
  exercise_id: z.string().uuid().nullable().optional(),
  baseline_value: z.number().min(0, 'Baseline value cannot be negative'),
  target_value: z.number().min(0, 'Target value cannot be negative'),
  start_date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Valid start date is required',
  }),
  deadline: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Valid deadline date is required',
  }).nullable().optional(),
  status: GoalStatusEnum.default('active'),
  notes: z.string().trim().max(1000).nullable().optional(),
}).refine((data) => {
  if (['max_reps', 'max_duration', 'external_load'].includes(data.goal_type) && !data.exercise_id) {
    return false;
  }
  return true;
}, {
  message: 'An exercise must be selected for this goal type',
  path: ['exercise_id'],
});

export const OwnerSetupSchema = z.object({
  username: z.string().trim().min(3, 'Username must be at least 3 characters').max(50),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100),
});

export const LoginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const ChangePasswordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z.string().min(6, 'New password must be at least 6 characters').max(100),
});

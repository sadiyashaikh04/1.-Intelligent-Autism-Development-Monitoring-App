-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('SUPER_ADMIN', 'CSC', 'JR_PSYCHOLOGIST', 'MDT_HEAD', 'PSS', 'PARENT');

-- CreateEnum
CREATE TYPE "clinical_domain" AS ENUM ('PSYCHOLOGY', 'OCCUPATIONAL_THERAPY', 'SPEECH_THERAPY', 'SPECIAL_EDUCATION');

-- CreateEnum
CREATE TYPE "gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "program_type" AS ENUM ('COMMUNITY', 'FAMILY_LIVING');

-- CreateEnum
CREATE TYPE "resident_status" AS ENUM ('IMPORTED', 'ENROLLED', 'CSC_ASSIGNED', 'MDT_ASSIGNED', 'ASSESSMENTS_SCHEDULED', 'ASSESSMENTS_IN_PROGRESS', 'ASSESSMENTS_COMPLETED', 'IEP_IN_PROGRESS', 'IEP_APPROVED', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "staff_assignment_role" AS ENUM ('CSC', 'PSS', 'JR_PSYCHOLOGIST', 'MDT_HEAD');

-- CreateEnum
CREATE TYPE "assessment_status" AS ENUM ('PENDING', 'SCHEDULED', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REVISION_REQUESTED');

-- CreateEnum
CREATE TYPE "iep_status" AS ENUM ('DRAFT_IEP', 'SUBMITTED_IEP', 'APPROVED_IEP', 'ACTIVE_IEP', 'COMPLETED_IEP', 'REJECTED_IEP');

-- CreateEnum
CREATE TYPE "iep_goal_approval_status" AS ENUM ('NOT_SUBMITTED', 'PENDING_MDT_APPROVAL', 'APPROVED_MDT', 'REJECTED_MDT');

-- CreateEnum
CREATE TYPE "iep_assigned_role" AS ENUM ('PSS', 'CLINICIAN');

-- CreateEnum
CREATE TYPE "goal_frequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "goal_status" AS ENUM ('NOT_STARTED', 'IN_PROGRESS_GOAL', 'ACHIEVED', 'PARTIALLY_ACHIEVED', 'DISCONTINUED_GOAL');

-- CreateEnum
CREATE TYPE "iep_log_outcome" AS ENUM ('ACHIEVED_LOG', 'PARTIALLY_ACHIEVED_LOG', 'NOT_ACHIEVED_LOG');

-- CreateEnum
CREATE TYPE "prompt_level" AS ENUM ('INDEPENDENT', 'VERBAL', 'GESTURAL', 'PARTIAL_PHYSICAL', 'FULL_PHYSICAL');

-- CreateEnum
CREATE TYPE "shift" AS ENUM ('MORNING', 'EVENING', 'NIGHT');

-- CreateEnum
CREATE TYPE "adl_category" AS ENUM ('ADL', 'IADL');

-- CreateEnum
CREATE TYPE "adl_log_status" AS ENUM ('TODO', 'IN_PROGRESS_ADL', 'DONE');

-- CreateEnum
CREATE TYPE "adl_approval_status" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "adl_mood" AS ENUM ('CALM', 'ANXIOUS', 'ESCALATED', 'MELTDOWN');

-- CreateEnum
CREATE TYPE "room_type" AS ENUM ('THERAPY', 'ASSESSMENT_ROOM', 'CONSULTATION', 'CLASSROOM', 'GENERAL');

-- CreateEnum
CREATE TYPE "slot_type" AS ENUM ('ASSESSMENT_SLOT', 'THERAPY_SESSION', 'IPP_ACTIVITY', 'IPP_MEETING_SLOT', 'GENERAL_SLOT');

-- CreateEnum
CREATE TYPE "slot_status" AS ENUM ('SCHEDULED_SLOT', 'CONFIRMED', 'IN_PROGRESS_SLOT', 'COMPLETED_SLOT', 'CANCELLED_SLOT');

-- CreateEnum
CREATE TYPE "incident_type" AS ENUM ('INJURY', 'AGGRESSION', 'MELTDOWN', 'SELF_HARM', 'FALL', 'ELOPEMENT', 'OTHER_INCIDENT');

-- CreateEnum
CREATE TYPE "incident_status" AS ENUM ('REPORTED', 'UNDER_REVIEW', 'ESCALATED', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "trajectory_direction" AS ENUM ('IMPROVING', 'STABLE', 'DECLINING', 'INSUFFICIENT_DATA');

-- CreateEnum
CREATE TYPE "risk_band" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('CARE_TEAM_ASSIGNED', 'ASSESSMENT_SCHEDULED', 'ASSESSMENT_COMPLETED', 'ASSESSMENT_APPROVED', 'ASSESSMENT_REVISION_REQUESTED', 'IEP_SUBMITTED', 'IEP_APPROVED', 'IPP_FINALIZED', 'ADL_LOG_REJECTED', 'INCIDENT_REPORTED', 'INCIDENT_ESCALATED', 'INCIDENT_RESOLVED', 'SESSION_REMINDER', 'PERFORMANCE_DECLINE_DETECTED', 'ELEVATED_RISK_FLAGGED');

-- CreateEnum
CREATE TYPE "notification_severity" AS ENUM ('NORMAL', 'HIGH', 'CRITICAL_INTERRUPT');

-- CreateTable
CREATE TABLE "users" (
    "user_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "role" "user_role" NOT NULL,
    "clinical_domain" "clinical_domain",
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "session_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "refresh_token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("session_id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "audit_log_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_user_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" UUID NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("audit_log_id")
);

-- CreateTable
CREATE TABLE "residents" (
    "resident_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(20) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "date_of_birth" DATE NOT NULL,
    "gender" "gender" NOT NULL,
    "program_type" "program_type" NOT NULL,
    "status" "resident_status" NOT NULL DEFAULT 'IMPORTED',
    "admission_date" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "residents_pkey" PRIMARY KEY ("resident_id")
);

-- CreateTable
CREATE TABLE "resident_status_history" (
    "status_history_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "resident_id" UUID NOT NULL,
    "from_status" "resident_status",
    "to_status" "resident_status" NOT NULL,
    "changed_by_user_id" UUID NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resident_status_history_pkey" PRIMARY KEY ("status_history_id")
);

-- CreateTable
CREATE TABLE "resident_staff_assignments" (
    "assignment_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "resident_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "staff_assignment_role" NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassigned_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "resident_staff_assignments_pkey" PRIMARY KEY ("assignment_id")
);

-- CreateTable
CREATE TABLE "resident_parents" (
    "resident_parent_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "resident_id" UUID NOT NULL,
    "parent_user_id" UUID NOT NULL,
    "relationship" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "resident_parents_pkey" PRIMARY KEY ("resident_parent_id")
);

-- CreateTable
CREATE TABLE "assessment_types" (
    "assessment_type_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(200) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "domain" "clinical_domain" NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "assessment_types_pkey" PRIMARY KEY ("assessment_type_id")
);

-- CreateTable
CREATE TABLE "assessments" (
    "assessment_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "resident_id" UUID NOT NULL,
    "assessment_type_id" UUID NOT NULL,
    "assigned_to_user_id" UUID NOT NULL,
    "status" "assessment_status" NOT NULL DEFAULT 'PENDING',
    "scheduled_at" TIMESTAMPTZ(6),
    "calendar_slot_id" UUID,
    "findings" JSONB,
    "score" DOUBLE PRECISION,
    "submitted_at" TIMESTAMPTZ(6),
    "reviewed_by_user_id" UUID,
    "review_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("assessment_id")
);

-- CreateTable
CREATE TABLE "iep_plans" (
    "iep_plan_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "resident_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "iep_status" NOT NULL DEFAULT 'DRAFT_IEP',
    "authored_by_user_id" UUID NOT NULL,
    "submitted_at" TIMESTAMPTZ(6),
    "approved_by_user_id" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "start_date" DATE,
    "end_date" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "iep_plans_pkey" PRIMARY KEY ("iep_plan_id")
);

-- CreateTable
CREATE TABLE "iep_goals" (
    "iep_goal_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "iep_plan_id" UUID NOT NULL,
    "domain" "clinical_domain" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "frequency" "goal_frequency" NOT NULL,
    "target_count" INTEGER NOT NULL,
    "status" "goal_status" NOT NULL DEFAULT 'NOT_STARTED',
    "approval_status" "iep_goal_approval_status" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "rejection_reason" TEXT,
    "assigned_role" "iep_assigned_role" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "iep_goals_pkey" PRIMARY KEY ("iep_goal_id")
);

-- CreateTable
CREATE TABLE "goal_progress_logs" (
    "goal_progress_log_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "iep_goal_id" UUID NOT NULL,
    "logged_by_user_id" UUID NOT NULL,
    "log_date" DATE NOT NULL,
    "outcome" "iep_log_outcome" NOT NULL,
    "prompt_level" "prompt_level",
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goal_progress_logs_pkey" PRIMARY KEY ("goal_progress_log_id")
);

-- CreateTable
CREATE TABLE "adl_activities" (
    "adl_activity_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(200) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "category" "adl_category" NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "adl_activities_pkey" PRIMARY KEY ("adl_activity_id")
);

-- CreateTable
CREATE TABLE "adl_assignments" (
    "adl_assignment_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "resident_id" UUID NOT NULL,
    "adl_activity_id" UUID NOT NULL,
    "assigned_by_user_id" UUID NOT NULL,
    "frequency" "goal_frequency" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "adl_assignments_pkey" PRIMARY KEY ("adl_assignment_id")
);

-- CreateTable
CREATE TABLE "adl_logs" (
    "adl_log_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "adl_assignment_id" UUID NOT NULL,
    "logged_by_user_id" UUID NOT NULL,
    "log_date" DATE NOT NULL,
    "shift" "shift" NOT NULL,
    "status" "adl_log_status" NOT NULL DEFAULT 'TODO',
    "prompt_level" "prompt_level",
    "mood" "adl_mood",
    "notes" TEXT,
    "approval_status" "adl_approval_status" NOT NULL DEFAULT 'DRAFT',
    "approved_by_user_id" UUID,
    "rejection_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "adl_logs_pkey" PRIMARY KEY ("adl_log_id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "room_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(200) NOT NULL,
    "type" "room_type" NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("room_id")
);

-- CreateTable
CREATE TABLE "calendar_slots" (
    "calendar_slot_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "slot_type" NOT NULL,
    "status" "slot_status" NOT NULL DEFAULT 'SCHEDULED_SLOT',
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "room_id" UUID,
    "resident_id" UUID,
    "staff_user_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "notes" TEXT,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "calendar_slots_pkey" PRIMARY KEY ("calendar_slot_id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "incident_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "resident_id" UUID NOT NULL,
    "reported_by_user_id" UUID NOT NULL,
    "type" "incident_type" NOT NULL,
    "status" "incident_status" NOT NULL DEFAULT 'REPORTED',
    "severity" "notification_severity" NOT NULL DEFAULT 'NORMAL',
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "location" VARCHAR(255),
    "description" TEXT NOT NULL,
    "notify_parent" BOOLEAN NOT NULL DEFAULT false,
    "reviewed_by_user_id" UUID,
    "resolution" TEXT,
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("incident_id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "notification_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" "notification_type" NOT NULL,
    "severity" "notification_severity" NOT NULL DEFAULT 'NORMAL',
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "entity_type" VARCHAR(100),
    "entity_id" UUID,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("notification_id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "notification_preference_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" "notification_type" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("notification_preference_id")
);

-- CreateTable
CREATE TABLE "development_snapshots" (
    "development_snapshot_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "resident_id" UUID NOT NULL,
    "domain" "clinical_domain" NOT NULL,
    "week_start" DATE NOT NULL,
    "independence_index" DOUBLE PRECISION NOT NULL,
    "goal_achievement_rate" DOUBLE PRECISION NOT NULL,
    "adl_completion_rate" DOUBLE PRECISION NOT NULL,
    "trajectory" "trajectory_direction" NOT NULL DEFAULT 'INSUFFICIENT_DATA',
    "slope" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "baseline_deviation" DOUBLE PRECISION,
    "computed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "development_snapshots_pkey" PRIMARY KEY ("development_snapshot_id")
);

-- CreateTable
CREATE TABLE "risk_assessments" (
    "risk_assessment_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "resident_id" UUID NOT NULL,
    "assessed_for" DATE NOT NULL,
    "band" "risk_band" NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "top_factors" JSONB NOT NULL,
    "model_version" VARCHAR(50) NOT NULL,
    "computed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_assessments_pkey" PRIMARY KEY ("risk_assessment_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_user_role" ON "users"("role");

-- CreateIndex
CREATE INDEX "idx_user_active" ON "users"("is_active");

-- CreateIndex
CREATE INDEX "idx_user_deleted_at" ON "users"("deleted_at");

-- CreateIndex
CREATE INDEX "idx_session_user" ON "user_sessions"("user_id");

-- CreateIndex
CREATE INDEX "idx_session_expires" ON "user_sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_session_refresh_hash" ON "user_sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "idx_audit_entity" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "idx_audit_actor" ON "audit_logs"("actor_user_id");

-- CreateIndex
CREATE INDEX "idx_audit_created_at" ON "audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "residents_code_key" ON "residents"("code");

-- CreateIndex
CREATE INDEX "idx_resident_status" ON "residents"("status");

-- CreateIndex
CREATE INDEX "idx_resident_name" ON "residents"("last_name", "first_name");

-- CreateIndex
CREATE INDEX "idx_resident_deleted_at" ON "residents"("deleted_at");

-- CreateIndex
CREATE INDEX "idx_status_history_resident" ON "resident_status_history"("resident_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_staff_assignment_resident_role" ON "resident_staff_assignments"("resident_id", "role");

-- CreateIndex
CREATE INDEX "idx_staff_assignment_user" ON "resident_staff_assignments"("user_id");

-- CreateIndex
CREATE INDEX "idx_resident_parent_user" ON "resident_parents"("parent_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_resident_parent" ON "resident_parents"("resident_id", "parent_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_types_code_key" ON "assessment_types"("code");

-- CreateIndex
CREATE INDEX "idx_assessment_type_domain" ON "assessment_types"("domain");

-- CreateIndex
CREATE INDEX "idx_assessment_resident_status" ON "assessments"("resident_id", "status");

-- CreateIndex
CREATE INDEX "idx_assessment_assignee_status" ON "assessments"("assigned_to_user_id", "status");

-- CreateIndex
CREATE INDEX "idx_assessment_calendar_slot" ON "assessments"("calendar_slot_id");

-- CreateIndex
CREATE INDEX "idx_iep_resident_status" ON "iep_plans"("resident_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_iep_resident_version" ON "iep_plans"("resident_id", "version");

-- CreateIndex
CREATE INDEX "idx_iep_goal_plan" ON "iep_goals"("iep_plan_id");

-- CreateIndex
CREATE INDEX "idx_iep_goal_domain_status" ON "iep_goals"("domain", "status");

-- CreateIndex
CREATE INDEX "idx_goal_progress_goal_date" ON "goal_progress_logs"("iep_goal_id", "log_date");

-- CreateIndex
CREATE INDEX "idx_goal_progress_date" ON "goal_progress_logs"("log_date");

-- CreateIndex
CREATE UNIQUE INDEX "adl_activities_code_key" ON "adl_activities"("code");

-- CreateIndex
CREATE INDEX "idx_adl_activity_category" ON "adl_activities"("category");

-- CreateIndex
CREATE INDEX "idx_adl_assignment_resident_active" ON "adl_assignments"("resident_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "uq_adl_assignment_resident_activity" ON "adl_assignments"("resident_id", "adl_activity_id");

-- CreateIndex
CREATE INDEX "idx_adl_log_date_approval" ON "adl_logs"("log_date", "approval_status");

-- CreateIndex
CREATE INDEX "idx_adl_log_approval" ON "adl_logs"("approval_status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_adl_log_assignment_date_shift" ON "adl_logs"("adl_assignment_id", "log_date", "shift");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_name_key" ON "rooms"("name");

-- CreateIndex
CREATE INDEX "idx_room_active" ON "rooms"("is_active");

-- CreateIndex
CREATE INDEX "idx_slot_room_range" ON "calendar_slots"("room_id", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "idx_slot_staff_range" ON "calendar_slots"("staff_user_id", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "idx_slot_resident_start" ON "calendar_slots"("resident_id", "starts_at");

-- CreateIndex
CREATE INDEX "idx_incident_resident_occurred" ON "incidents"("resident_id", "occurred_at");

-- CreateIndex
CREATE INDEX "idx_incident_status" ON "incidents"("status");

-- CreateIndex
CREATE INDEX "idx_incident_occurred" ON "incidents"("occurred_at");

-- CreateIndex
CREATE INDEX "idx_notification_user_read" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "idx_notification_user_created" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_notification_pref_user_type" ON "notification_preferences"("user_id", "type");

-- CreateIndex
CREATE INDEX "idx_dev_snapshot_resident_week" ON "development_snapshots"("resident_id", "week_start");

-- CreateIndex
CREATE INDEX "idx_dev_snapshot_trajectory" ON "development_snapshots"("trajectory");

-- CreateIndex
CREATE UNIQUE INDEX "uq_dev_snapshot_resident_domain_week" ON "development_snapshots"("resident_id", "domain", "week_start");

-- CreateIndex
CREATE INDEX "idx_risk_resident_date" ON "risk_assessments"("resident_id", "assessed_for");

-- CreateIndex
CREATE INDEX "idx_risk_band_date" ON "risk_assessments"("band", "assessed_for");

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resident_status_history" ADD CONSTRAINT "resident_status_history_resident_id_fkey" FOREIGN KEY ("resident_id") REFERENCES "residents"("resident_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resident_status_history" ADD CONSTRAINT "resident_status_history_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resident_staff_assignments" ADD CONSTRAINT "resident_staff_assignments_resident_id_fkey" FOREIGN KEY ("resident_id") REFERENCES "residents"("resident_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resident_staff_assignments" ADD CONSTRAINT "resident_staff_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resident_parents" ADD CONSTRAINT "resident_parents_resident_id_fkey" FOREIGN KEY ("resident_id") REFERENCES "residents"("resident_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resident_parents" ADD CONSTRAINT "resident_parents_parent_user_id_fkey" FOREIGN KEY ("parent_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_resident_id_fkey" FOREIGN KEY ("resident_id") REFERENCES "residents"("resident_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_assessment_type_id_fkey" FOREIGN KEY ("assessment_type_id") REFERENCES "assessment_types"("assessment_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_calendar_slot_id_fkey" FOREIGN KEY ("calendar_slot_id") REFERENCES "calendar_slots"("calendar_slot_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iep_plans" ADD CONSTRAINT "iep_plans_resident_id_fkey" FOREIGN KEY ("resident_id") REFERENCES "residents"("resident_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iep_plans" ADD CONSTRAINT "iep_plans_authored_by_user_id_fkey" FOREIGN KEY ("authored_by_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iep_plans" ADD CONSTRAINT "iep_plans_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iep_goals" ADD CONSTRAINT "iep_goals_iep_plan_id_fkey" FOREIGN KEY ("iep_plan_id") REFERENCES "iep_plans"("iep_plan_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_progress_logs" ADD CONSTRAINT "goal_progress_logs_iep_goal_id_fkey" FOREIGN KEY ("iep_goal_id") REFERENCES "iep_goals"("iep_goal_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_progress_logs" ADD CONSTRAINT "goal_progress_logs_logged_by_user_id_fkey" FOREIGN KEY ("logged_by_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adl_assignments" ADD CONSTRAINT "adl_assignments_resident_id_fkey" FOREIGN KEY ("resident_id") REFERENCES "residents"("resident_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adl_assignments" ADD CONSTRAINT "adl_assignments_adl_activity_id_fkey" FOREIGN KEY ("adl_activity_id") REFERENCES "adl_activities"("adl_activity_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adl_assignments" ADD CONSTRAINT "adl_assignments_assigned_by_user_id_fkey" FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adl_logs" ADD CONSTRAINT "adl_logs_adl_assignment_id_fkey" FOREIGN KEY ("adl_assignment_id") REFERENCES "adl_assignments"("adl_assignment_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adl_logs" ADD CONSTRAINT "adl_logs_logged_by_user_id_fkey" FOREIGN KEY ("logged_by_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adl_logs" ADD CONSTRAINT "adl_logs_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_slots" ADD CONSTRAINT "calendar_slots_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("room_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_slots" ADD CONSTRAINT "calendar_slots_resident_id_fkey" FOREIGN KEY ("resident_id") REFERENCES "residents"("resident_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_slots" ADD CONSTRAINT "calendar_slots_staff_user_id_fkey" FOREIGN KEY ("staff_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_slots" ADD CONSTRAINT "calendar_slots_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_resident_id_fkey" FOREIGN KEY ("resident_id") REFERENCES "residents"("resident_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_reported_by_user_id_fkey" FOREIGN KEY ("reported_by_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "development_snapshots" ADD CONSTRAINT "development_snapshots_resident_id_fkey" FOREIGN KEY ("resident_id") REFERENCES "residents"("resident_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_resident_id_fkey" FOREIGN KEY ("resident_id") REFERENCES "residents"("resident_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- At most one ACTIVE assignment per (resident, user, role). Ended
-- assignments (unassigned_at set) are history and may repeat.
-- Hand-written: Prisma's schema language cannot express a partial index.
CREATE UNIQUE INDEX "uq_staff_assignment_active"
  ON "resident_staff_assignments" ("resident_id", "user_id", "role")
  WHERE "unassigned_at" IS NULL;

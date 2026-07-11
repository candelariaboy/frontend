export type PracticeDimension = {
  id?: string
  label: string
  confidence: number
  evidence: string[]
}

export type CareerSuggestion = {
  id?: string
  title: string
  confidence: number
  reasoning: string
}

export type Badge = {
  id?: string
  label: string
  description: string
  criteria: string
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary"
  achieved?: boolean
  claimed?: boolean
  reward_xp?: number
  medal_tier?: "bronze" | "silver" | "gold" | string
  medal_icon?: string
  category?: string
  category_icon?: string
  icon?: string
  target?: number
}

export type RepoSummary = {
  id?: string
  name: string
  description: string
  language: string
  languages?: string[]
  languageBytes?: Record<string, number>
  htmlUrl?: string
  stars: number
  lastUpdated?: string
  last_push?: string | null
  commitCount?: number
}

export type UserProfile = {
  username: string
  displayName: string
  bio: string
  avatarUrl: string
  level: number
  xp: number
  nextLevelXp: number
  streakDays: number
  hasRecommendationAction?: boolean
  studentId?: string
  program?: string
  yearLevel?: string
  careerInterest?: string
  preferredLearningStyle?: string
  targetRole?: string
  targetCertifications?: string[]
  portfolioCompleteness?: number
  isVerified?: boolean
  verifiedAt?: string | null
}

export type LeaderboardEntry = {
  id: string
  username: string
  avatarUrl: string
  program?: string | null
  yearLevel?: string | null
  level: number
  xp: number
  runwayXp: number
  runwayRemainingXp: number
  delta: string
  badgeCount: number
  badgeStack: Array<{
    label: string
    rarity: string
    medalIcon?: string | null
    achieved: boolean
    claimed: boolean
  }>
}

export type LearningPathStep = {
  title: string
  description?: string
  reason: string
  type?: "Project" | "Skill" | "Certification" | "Course" | string
  tag?: string
  dimension_key?: string
  evidence?: string[]
  difficulty?: string
  reward_xp?: number
  estimated_xp?: number
  tags?: string[]
  resources?: {
    courses?: Array<{ name: string; url?: string | null }>
    tools?: Array<{ name: string; url?: string | null }>
    documentation?: Array<{ name: string; url?: string | null }>
  }
  adaptive?: {
    on_reject?: { title: string; description: string }
    on_complete?: { next_step: string; next_focus: string }
  }
  ai_explanation?: string
  progression_logic?: string
  status?: "done" | "todo" | "in_progress"
  priority?: "High" | "Medium" | "Low" | string
  dimension?: string
  competency_level?: "Beginner" | "Intermediate" | "Advanced" | string
  progression_step?: number
}

export type CompetencyDimension = {
  dimension_key: string
  dimension: string
  description: string
  score_percent: number
  level: "Beginner" | "Intermediate" | "Advanced" | string
  evidence: string[]
}

export type SkillGap = {
  dimension_key: string
  dimension: string
  score_percent: number
  current_level: "Beginner" | "Intermediate" | "Advanced" | string
  target_level: "Advanced" | string
  priority: "High" | "Medium" | "Low" | string
  gap_summary: string
}

export type LearningPathResponse = {
  username: string
  steps: LearningPathStep[]
  progress_percent?: number
  competency_levels?: CompetencyDimension[]
  skill_gaps?: SkillGap[]
}

export type ProjectLearningPath = {
  repo_name: string
  steps: LearningPathStep[]
  progress_percent?: number
  path_level?: number
  repo_completed?: boolean
  repo_completed_at?: string | null
  stage_status_overrides?: Record<string, string>
  stage_checks?: Record<string, boolean[]>
  stage_proof_counts?: Record<string, number>
  stage_progress_updates?: Record<
    string,
    {
      progress_entries?: Array<{
        entry_id: string
        comment?: string
        proof_items?: Array<{ name: string; url: string; kind?: string }>
        updated_at?: string
      }>
      comment?: string
      proof_items?: Array<{ name: string; url: string; kind?: string }>
      final_proof_items?: Array<{ name: string; url: string; kind?: string }>
      review_status?: "pending" | "accepted" | "rejected" | string
      review_status_updated_at?: string | null
      updated_at?: string
      admin_feedback?: string
      admin_feedback_by?: string
      admin_feedback_updated_at?: string
      admin_feedback_thread?: Array<{ feedback: string; by?: string; role?: string; updated_at?: string }>
      admin_feedback_by_proof?: Record<
        string,
        {
          proof_url?: string
          proof_name?: string
          latest_feedback?: string
          feedback_by?: string
          updated_at?: string
          thread?: Array<{ feedback: string; by?: string; role?: string; updated_at?: string; proof_url?: string; proof_name?: string }>
        }
      >
    }
  >
}

export type ProjectLearningPathResponse = {
  username: string
  projects: ProjectLearningPath[]
}

export type CertificateSuggestion = {
  id: string
  title: string
  provider: string
  url: string
  rewardXp: number
  completed?: boolean
  locked?: boolean
  claimedRewardXp?: number
  providerAliases: string[]
  matchTokens: string[]
  groups: string[]
  reasoning?: string
}

export type AdminStudentSummary = {
  id: number
  username: string
  display_name?: string | null
  avatar_url: string
  level: number
  xp: number
  repo_count: number
  badges_claimed: number
  online: boolean
  last_seen?: string | null
  program?: string | null
  year_level?: string | null
  is_verified?: boolean
  verified_at?: string | null
}

export type AdminStudentRecommendationAction = {
  id: number
  dimension_key?: string | null
  module_title: string
  module_url: string
  action: string
  rating?: number | null
  feedback?: string | null
  created_at: string
}

export type AdminStudentActivityItem = {
  id: number
  event: string
  meta: Record<string, unknown>
  created_at: string
}

export type AdminStudentDetailProfile = {
  bio?: string | null
  student_id?: string | null
  career_interest?: string | null
  preferred_learning_style?: string | null
  target_role?: string | null
  target_certifications: string[]
  email?: string | null
  linkedin?: string | null
  phone?: string | null
  tech_stack?: string[]
  education_history?: Array<Record<string, unknown>>
  job_experience?: Array<Record<string, unknown>>
  profile_image?: string | null
  created_at?: string | null
}

export type AdminStudentDetailOverview = {
  total_commits: number
  total_stars: number
  repo_count: number
  badges_claimed: number
  certificates_total: number
  certificates_verified: number
  recommendation_actions_total: number
  recommendation_acceptance_rate: number
  recommendation_relevance_rate: number
  portfolio_completeness: number
  days_since_last_seen?: number | null
}

export type AdminStudentDetail = {
  student: AdminStudentSummary
  profile: AdminStudentDetailProfile
  overview: AdminStudentDetailOverview
  top_repos: Array<{
    name: string
    description?: string | null
    language?: string | null
    stars: number
    commit_count: number
    last_push?: string | null
  }>
  practice_dimensions: PracticeDimension[]
  career_suggestions: CareerSuggestion[]
  recent_recommendations: AdminStudentRecommendationAction[]
  recent_activity: AdminStudentActivityItem[]
  fcc_progress_summary?: FccModuleProgressSummary | null
  fcc_progress: FccModuleProgress[]
  certificates: CertificateRecord[]
  validations: ProjectValidation[]
  notes: AdminNote[]
  reviews: PortfolioReview[]
}

export type AdminAnalytics = {
  total_students: number
  total_repos: number
  avg_xp: number
  avg_level: number
  pending_validations: number
  adoption_users?: number
  adoption_total_users?: number
  adoption_rate?: number
}

export type AdminAnalyticsDay = {
  date: string
  logins: number
  profile_updates: number
  recomputes: number
  learning_path_views: number
}

export type AdminAnalyticsLabel = {
  label: string
  count: number
}

export type AdminDeepAnalytics = {
  days: AdminAnalyticsDay[]
  top_languages: AdminAnalyticsLabel[]
  total_events: number
}

export type EngagementCommit = {
  week_start: string
  commit_count: number
}

export type XpGrowthPoint = {
  week_start: string
  xp_gained: number
}

export type LearningProgressPoint = {
  learning_step: string
  status: string
  completed_at?: string | null
}

export type EngagementAnalytics = {
  weekly_commits: EngagementCommit[]
  xp_growth: XpGrowthPoint[]
  learning_progress: LearningProgressPoint[]
  engagement_score: number
}

export type ActivityTimelineItem = {
  date: string
  event: string
}

export type LoginTrendPoint = {
  date: string
  count: number
}

export type PeakHourPoint = {
  hour: number
  count: number
}

export type WeeklyActivePoint = {
  week_start: string
  active_users: number
}

export type LoginStreak = {
  user_id?: number
  username?: string
  current_streak: number
}

export type LoginGroupCount = {
  label: string
  count: number
}

export type LoginActivity = {
  daily_counts: LoginTrendPoint[]
  peak_hours: PeakHourPoint[]
  weekly_active: WeeklyActivePoint[]
  streak: LoginStreak
  recent_logins: Array<{
    login_timestamp: string
    device?: string | null
  }>
}

export type LoginActivityTrends = {
  daily_counts: LoginTrendPoint[]
  peak_hours: PeakHourPoint[]
  weekly_active: WeeklyActivePoint[]
  streaks: LoginStreak[]
  program_logins: LoginGroupCount[]
  year_level_logins: LoginGroupCount[]
}

export type LoginLivePoint = {
  time: string
  count: number
}

export type LoginLive = {
  window_hours: number
  bucket_minutes: number
  points: LoginLivePoint[]
}

export type AdminNote = {
  id: number
  admin_id: number
  student_id: number
  note: string
  created_at: string
}

export type ProjectValidation = {
  id: number
  admin_id: number
  student_id: number
  repo_name: string
  status: string
  comment?: string | null
  created_at: string
}

export type PortfolioReview = {
  id: number
  admin_id: number
  student_id: number
  status: string
  summary: string
  created_at: string
}

export type UserResponse = {
  profile: UserProfile
  practice_dimensions: PracticeDimension[]
  career_suggestions: CareerSuggestion[]
  skill_domains?: SkillDomain[]
  focus_domain?: SkillDomain | null
  frequency?: FrequencySummary | null
  badges: Badge[]
  repos: RepoSummary[]
}

export type SkillDomain = {
  dimension_key: string
  domain: string
  description: string
  score_percent: number
  level: string
  evidence: string[]
}

export type WeeklyCommitSummary = {
  week_start: string
  commit_count: number
}

export type FrequencySummary = {
  total_commits: number
  repo_count: number
  active_repos_30d: number
  weekly_commits: WeeklyCommitSummary[]
  weekly_commit_average: number
  streak_days: number
}

export type PortfolioResponse = UserResponse & {
  settings: {
    theme?: string
    theme_light?: string
    theme_dark?: string
    section_order?: string[]
    show_sections?: Record<string, boolean>
    featured_repos?: string[]
    featured_badges?: string[]
    social_links?: Record<string, unknown>
    bio?: string
    cover_image?: string
    is_public?: boolean
  }
}

export type CurriculumSubject = {
  code: string
  title: string
  program: string
  year_level: number
  focus_dimension_key: string
  focus_dimension: string
  coverage_percent: number
  status: string
  recommended_module: string
}

export type SkillHeatmapCell = {
  subject_code: string
  dimension_key: string
  dimension: string
  score_percent: number
  band: "strong" | "developing" | "gap" | string
}

export type CurriculumMapResponse = {
  username: string
  subjects: CurriculumSubject[]
  heatmap: SkillHeatmapCell[]
}

export type RuleRecommendation = {
  dimension_key: string
  dimension: string
  reason: string
  module_title: string
  module_url: string
  certificate_hint: string
  acted?: boolean
}

export type RuleRecommendationResponse = {
  username: string
  items: RuleRecommendation[]
  peer_recommendations?: Array<{
    title: string
    description: string
    module_url: string
    dimension_key?: string
    similar_students_count: number
  }>
}

export type WeeklyDigest = {
  username: string
  week_start: string
  commits: number
  xp_gained: number
  completed_steps: number
  active_days: number
  summary: string
}

export type CertificateRecord = {
  id: number
  user_id: number
  username?: string | null
  title: string
  provider: string
  proof_type?: string | null
  certificate_url: string
  certificate_page_url?: string | null
  student_note?: string | null
  suggestion_track_id?: string | null
  suggestion_module_url?: string | null
  completion_locked?: boolean
  completion_reward_xp?: number | null
  rewarded_at?: string | null
  hidden_from_student?: boolean
  status: "pending" | "verified" | "rejected" | string
  reviewer_note?: string | null
  submitted_at: string
  verified_at?: string | null
  comment_thread?: Array<{
    comment: string
    by: string
    role: string
    updated_at?: string | null
  }>
  latest_admin_comment_at?: string | null
  latest_student_reply_at?: string | null
}

export type FccModuleProgress = {
  id: number
  user_id: number
  module_key: string
  module_title: string
  status: "not_started" | "in_progress" | "done" | string
  progress_percent: number
  notes?: string | null
  certificate_url?: string | null
  completed_at?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export type FccModuleProgressSummary = {
  overall_progress_percent: number
  modules_started: number
  modules_completed: number
  total_modules: number
  last_updated_at?: string | null
}

export type FccModuleProgressResponse = {
  summary: FccModuleProgressSummary
  items: FccModuleProgress[]
}

export type StudentGoal = {
  id: number
  user_id: number
  title: string
  target_value?: number | null
  current_value: number
  unit?: string | null
  status: "active" | "completed" | "paused" | string
  target_date?: string | null
  notes?: string | null
  created_at: string
  updated_at?: string | null
}

export type LearningAccounts = {
  username: string
  freecodecamp_username?: string | null
  last_cert_sync_at?: string | null
}

export type LearningAccountStats = {
  provider: string
  username?: string | null
  configured: boolean
  checked: number
  found_public: number
  public_completion_percent: number
  local_total: number
  local_pending: number
  local_verified: number
  local_rejected: number
  last_cert_sync_at?: string | null
  items: Array<{ title: string; raw_title?: string; slug?: string; url: string }>
}

export type AutoSyncResult = {
  provider: string
  username?: string | null
  checked: number
  found: number
  newly_verified: number
  items: Array<{ title: string; url: string; status: string }>
}

export type Quest = {
  key: string
  title: string
  description: string
  reward_xp: number
  completed: boolean
  claimed: boolean
}

export type DailyQuestPayload = {
  username: string
  date: string
  quests: Quest[]
}

export type WeeklyChallengePayload = {
  username: string
  week_start: string
  challenges: Quest[]
}

export type AdminEvaluationMetrics = {
  total_students: number
  ai_model_provider: string
  ai_model_name: string
  ai_fallback_strategy: string
  recommendation_actions_total: number
  recommendation_acceptance_rate: number
  recommendation_ratings_total: number
  recommendation_relevance_rate: number
  tracked_portfolios_total: number
  portfolio_completeness_rate: number
  ai_eval_model?: string | null
  ai_eval_dataset_rows?: number | null
  ai_eval_train_rows?: number | null
  ai_eval_validation_rows?: number | null
  ai_eval_test_rows?: number | null
  rouge1?: number | null
  rouge2?: number | null
  rougeL?: number | null
  bleu?: number | null
  bertscore_precision?: number | null
  bertscore_recall?: number | null
  bertscore_f1?: number | null
}

export type AdminEvaluationPredictionSample = {
  row_number: number
  input: string
  output?: string | null
  prediction?: string | null
  reference?: string | null
}

export type AdminEvaluationPredictions = {
  total_rows: number
  sample_count: number
  samples: AdminEvaluationPredictionSample[]
}

export type ResearchAnalytics = {
  recommendation_acceptance_rate: number
  recommendation_ratings_total: number
  recommendation_relevance_rate: number
  weekly_login_frequency: number
  weekly_portfolio_update_frequency: number
  active_students_14d: number
}

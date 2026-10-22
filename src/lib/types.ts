// Hand-maintained to match supabase/migrations/*_stage_1_4_database.sql.
// Docs: https://supabase.com/docs/guides/api/rest/generating-types
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export type TrackMode = "vocal_first" | "beat_first" | "reference";
export type GenerationTier = "draft" | "release";
export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export type Track = {
  id: string;
  user_id: string;
  title: string;
  mode: TrackMode;
  bpm: number | null;
  musical_key: string | null;
  genre: string | null;
  mood: string | null;
  energy: string | null;
  instrumentation: string[];
  prompt_text: string | null;
  provider: string | null;
  tier: GenerationTier;
  release_ready: boolean;
  ai_assisted: boolean;
  vocal_path: string | null;
  instrumental_path: string | null;
  mix_path: string | null;
  offset_ms: number;
  vocal_gain: number;
  instrumental_gain: number;
  vocal_fx: Json;
  parent_track_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type GenerationJob = {
  id: string;
  user_id: string;
  track_id: string | null;
  provider: string;
  tier: GenerationTier;
  prompt_text: string;
  duration_sec: number;
  status: JobStatus;
  provider_request_id: string | null;
  result_path: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
};

export type TrackInsert = Pick<Track, "user_id"> & Partial<Omit<Track, "user_id">>;
export type GenerationJobInsert = Pick<GenerationJob, "user_id" | "provider" | "prompt_text" | "duration_sec"> & Partial<Omit<GenerationJob, "user_id" | "provider" | "prompt_text" | "duration_sec">>;

export type Database = {
  public: {
    Tables: {
      tracks: {
        Row: Track;
        Insert: TrackInsert;
        Update: Partial<Track>;
        Relationships: [{
          foreignKeyName: "tracks_parent_owner_fkey";
          columns: ["parent_track_id", "user_id"];
          isOneToOne: false;
          referencedRelation: "tracks";
          referencedColumns: ["id", "user_id"];
        }];
      };
      generation_jobs: {
        Row: GenerationJob;
        Insert: GenerationJobInsert;
        Update: Partial<GenerationJob>;
        Relationships: [{
          foreignKeyName: "generation_jobs_track_owner_fkey";
          columns: ["track_id", "user_id"];
          isOneToOne: false;
          referencedRelation: "tracks";
          referencedColumns: ["id", "user_id"];
        }];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

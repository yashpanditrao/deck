export interface DeckShareLink {
  id: string;
  deck_id: string | null;
  company_id: string;
  shared_by_user_id: string;
  recipient_email: string;
  token: string;
  verification_code: string | null;
  verification_code_expires: string | null;
  is_verified: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeckFile {
  id: string;
  company_id: string;
  file_path: string;
  uploaded_at: string;
  thumbnail_path: string;
}

export type DeckFileInsert = Omit<DeckFile, 'id' | 'uploaded_at'>;
export type DeckFileUpdate = Partial<DeckFileInsert>;

export interface VerificationSession {
  token: string;
  email: string;
  verified: boolean;
  expires_at: string;
}

export interface Database {
  public: {
    Tables: {
      deck_share_links: {
        Row: DeckShareLink;
        Insert: Omit<DeckShareLink, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<DeckShareLink, 'id'>> & {
          updated_at?: string;
        };
      };
      deck_files: {
        Row: DeckFile;
        Insert: Omit<DeckFile, 'id' | 'uploaded_at'>;
        Update: Partial<Omit<DeckFile, 'id'>> & {
          uploaded_at?: string;
        };
      };
    };
  };
}
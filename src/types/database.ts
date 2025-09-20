export interface DeckShareLink {
  id: string;
  deck_url: string;
  company_id: string;
  recipient_email: string;
  token: string;
  verification_code: string | null;
  verification_code_expires: string | null;
  is_verified: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export type DeckShareLinkInsert = Omit<DeckShareLink, 'id' | 'created_at' | 'updated_at'>;
export type DeckShareLinkUpdate = Partial<DeckShareLinkInsert>;

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
    };
  };
}
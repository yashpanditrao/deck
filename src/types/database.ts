export interface DeckShareLink {
  id: string;
  deck_id: string | null;
  user_id: string;
  shared_by_user_id: string;
  recipient_email: string;
  token: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  is_downloadable: boolean;

  // New access control fields
  allowed_domains?: string[] | null;
  allowed_emails?: string[] | null;
  allow_anonymous?: boolean;
  require_verification?: boolean;

  // For backward compatibility
  access_level?: 'public' | 'restricted' | 'whitelisted';
}

export interface DeckFile {
  id: string;
  user_id: string;
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

export interface DeckView {
  id: string;
  deck_id: string;
  share_link_id: string;
  viewer_email: string | null;
  viewer_id: string | null; // Session ID for anonymous users
  started_at: string;
  last_active_at: string;
  ended_at: string | null;
  total_duration: number; // in seconds
  pages_viewed: number[];
  completed: boolean;
  total_pages: number; // Total pages in the deck
  user_agent: string | null;
  ip_address: string | null;
  country: string | null;
  city: string | null;
}

export interface PageView {
  id: string;
  view_id: string;
  page_number: number;
  duration: number; // in seconds
  viewed_at: string; // when the page session started
  exited_at: string | null; // when the reader left the page
}

export type DeckViewInsert = Omit<DeckView, 'id'>;
export type PageViewInsert = Omit<PageView, 'id'>;

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
      deck_views: {
        Row: DeckView;
        Insert: DeckViewInsert;
        Update: Partial<DeckViewInsert>;
      };
      page_views: {
        Row: PageView;
        Insert: PageViewInsert;
        Update: Partial<PageViewInsert>;
      };
    };
  };
}

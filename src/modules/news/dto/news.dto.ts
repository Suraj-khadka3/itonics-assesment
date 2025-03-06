export interface WebzApiResponse {
  posts: any[];
  next: string | null;
  moreResultsAvailable: number;
  totalResults?: number;
}

export interface ProgressTracker {
  totalFetched: number;
  totalSaved: number;
  batches: number;
  errors: number;
}

export interface SaveStats {
  saved: number;
  duplicates: number;
  errors: number;
}

export interface SaveResult {
  status: "saved" | "duplicate" | "error";
  id?: string;
  error?: any;
}

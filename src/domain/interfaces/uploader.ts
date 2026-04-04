/**
 * Metadata passed to any upload platform.
 * Built from the script + channel profile branding.
 */
export interface UploadMetadata {
  title: string;
  description: string;
  tags: string[];
  hashtags: string[];
  categoryId: string;
  disclosureRequired: boolean;
}

/**
 * Result returned by any upload platform.
 */
export interface UploadResult {
  platform: string;
  id: string;
  url: string;
  title: string;
}

/**
 * Abstract uploader — any publishing platform (YouTube, TikTok, Instagram, etc.)
 * must implement this interface.
 */
export interface Uploader {
  readonly platform: string;
  isConfigured(): boolean;
  upload(videoPath: string, metadata: UploadMetadata): Promise<UploadResult>;
}

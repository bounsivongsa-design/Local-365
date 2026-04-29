import type { Express } from "express";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { isAuthenticated } from "../auth";

/**
 * Register object storage routes for file uploads.
 *
 * This provides example routes for the presigned URL upload flow:
 * 1. POST /api/uploads/request-url - Get a presigned URL for uploading
 * 2. The client then uploads directly to the presigned URL
 *
 * IMPORTANT: These are example routes. Customize based on your use case:
 * - Add authentication middleware for protected uploads
 * - Add file metadata storage (save to database after upload)
 * - Add ACL policies for access control
 */
export function registerObjectStorageRoutes(app: Express): void {
  const objectStorageService = new ObjectStorageService();

  /**
   * Request a presigned URL for file upload.
   *
   * Request body (JSON):
   * {
   *   "name": "filename.jpg",
   *   "size": 12345,
   *   "contentType": "image/jpeg"
   * }
   *
   * Response:
   * {
   *   "uploadURL": "https://storage.googleapis.com/...",
   *   "objectPath": "/objects/uploads/uuid"
   * }
   *
   * IMPORTANT: The client should NOT send the file to this endpoint.
   * Send JSON metadata only, then upload the file directly to uploadURL.
   */
  app.post("/api/uploads/request-url", isAuthenticated, async (req, res) => {
    try {
      const { name, size, contentType } = req.body;

      if (!name) {
        return res.status(400).json({
          error: "Missing required field: name",
        });
      }

      // Allowed types are bucketed by family so each family can carry its
      // own size cap. Images and PDFs are capped at 10 MB; video ad uploads
      // are capped at 50 MB to match the in-app "Upload video (MP4, max
      // 50MB, 30s limit)" hint on the Advertising page. We accept the
      // common video MIME types browsers report for MP4/WebM/QuickTime —
      // some browsers report MP4 as "video/mp4" and others as
      // "video/quicktime" depending on codec, so both are allowed.
      const imageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
      const videoTypes = ["video/mp4", "video/webm", "video/quicktime"];
      const allowedTypes = [...imageTypes, ...videoTypes];
      if (contentType && !allowedTypes.includes(contentType)) {
        return res.status(400).json({
          error: "File type not allowed. Supported: JPG, PNG, WebP, GIF, PDF, MP4, WebM, MOV.",
        });
      }

      const isVideo = !!contentType && videoTypes.includes(contentType);
      const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
      if (size && size > maxSize) {
        const maxLabel = isVideo ? "50MB" : "10MB";
        return res.status(400).json({ error: `File too large. Maximum size is ${maxLabel}.` });
      }

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();

      // Extract object path from the presigned URL for later reference
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      res.json({
        uploadURL,
        objectPath,
        // Echo back the metadata for client convenience
        metadata: { name, size, contentType },
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  /**
   * Serve uploaded objects.
   *
   * GET /objects/...
   *
   * This serves files from object storage. For public files, no auth needed.
   * For protected files, add authentication middleware and ACL checks.
   */
  app.get(/^\/objects\/(.+)$/, async (req, res) => {
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      return res.status(500).json({ error: "Failed to serve object" });
    }
  });
}


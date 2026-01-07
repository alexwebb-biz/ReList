import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// S3/R2 configuration
// Works with AWS S3, Cloudflare R2, or any S3-compatible storage
const s3Config = {
  region: process.env.S3_REGION || 'auto',
  endpoint: process.env.S3_ENDPOINT, // For R2: https://<account_id>.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
  },
};

export const s3Client = new S3Client(s3Config);
export const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'relist-images';

// Generate a presigned URL for uploading
export const getUploadUrl = async (key: string, contentType: string, expiresIn = 3600): Promise<string> => {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
};

// Generate a presigned URL for downloading/viewing
export const getDownloadUrl = async (key: string, expiresIn = 3600): Promise<string> => {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
};

// Upload a file directly
export const uploadFile = async (
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> => {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
  });

  await s3Client.send(command);
};

// Delete a file
export const deleteFile = async (key: string): Promise<void> => {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
};

// Get public URL (if bucket is public)
export const getPublicUrl = (key: string): string => {
  if (process.env.S3_PUBLIC_URL) {
    return `${process.env.S3_PUBLIC_URL}/${key}`;
  }
  return `https://${BUCKET_NAME}.s3.${process.env.S3_REGION || 'us-east-1'}.amazonaws.com/${key}`;
};

export default s3Client;

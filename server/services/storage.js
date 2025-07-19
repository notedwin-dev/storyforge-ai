const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const fs = require('fs').promises;
const path = require('path');

// Determine storage mode based on environment variables
const hasS3Config = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.S3_BUCKET_NAME;
const storageMode = hasS3Config ? 'S3' : 'LOCAL';

console.log(`Storage mode: ${storageMode}`);

// Configure S3 client only if we have credentials
let s3Client;
if (hasS3Config) {
  s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
}

const bucketName = process.env.S3_BUCKET_NAME;
const localStoragePath = path.join(__dirname, '..', 'uploads');

// Ensure local storage directory exists
async function ensureLocalStorageDir() {
  try {
    await fs.mkdir(localStoragePath, { recursive: true });
  } catch (error) {
    console.error('Failed to create local storage directory:', error);
  }
}

// S3 functions (only used when S3 is configured)
async function uploadToS3(buffer, key, contentType) {
  try {
    console.log(`Uploading to S3: ${key}`);
    
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=86400', // 24 hours cache
    });

    await s3Client.send(command);
    
    // Generate public URL
    const publicUrl = `https://${bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
    console.log(`Upload successful: ${publicUrl}`);
    
    return publicUrl;
  } catch (error) {
    console.error('S3 upload error:', error);
    throw new Error(`Failed to upload to S3: ${error.message}`);
  }
}

async function deleteFromS3(key) {
  try {
    console.log(`Deleting from S3: ${key}`);
    
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    await s3Client.send(command);
    console.log(`Delete successful: ${key}`);
  } catch (error) {
    console.error('S3 delete error:', error);
    throw new Error(`Failed to delete from S3: ${error.message}`);
  }
}

// Local storage functions
async function uploadToLocal(buffer, key, contentType) {
  try {
    await ensureLocalStorageDir();
    
    const filePath = path.join(localStoragePath, key);
    const dir = path.dirname(filePath);
    
    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });
    
    // Write file
    await fs.writeFile(filePath, buffer);
    
    // Generate local URL
    const localUrl = `/uploads/${key}`;
    console.log(`Local upload successful: ${localUrl}`);
    
    return localUrl;
  } catch (error) {
    console.error('Local upload error:', error);
    throw new Error(`Failed to upload locally: ${error.message}`);
  }
}

async function deleteFromLocal(key) {
  try {
    const filePath = path.join(localStoragePath, key);
    await fs.unlink(filePath);
    console.log(`Local delete successful: ${key}`);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Local delete error:', error);
      throw new Error(`Failed to delete locally: ${error.message}`);
    }
  }
}

// Unified storage interface
async function uploadToStorage(buffer, key, contentType) {
  if (storageMode === 'S3') {
    return await uploadToS3(buffer, key, contentType);
  } else {
    return await uploadToLocal(buffer, key, contentType);
  }
}

async function deleteFromStorage(key) {
  if (storageMode === 'S3') {
    await deleteFromS3(key);
  } else {
    await deleteFromLocal(key);
  }
}

async function getSignedDownloadUrl(key, expiresIn = 3600) {
  if (storageMode === 'S3') {
    try {
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      const url = await getSignedUrl(s3Client, command, { expiresIn });
      return url;
    } catch (error) {
      console.error('S3 signed URL error:', error);
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }
  } else {
    // For local storage, return the static file URL
    return `/uploads/${key}`;
  }
}

// Helper function to extract key from URL
function extractKeyFromUrl(url) {
  try {
    if (url.startsWith('/uploads/')) {
      // Local storage URL format
      return url.replace('/uploads/', '');
    } else {
      // S3 URL format
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      // Remove empty string and bucket name
      return pathParts.slice(1).join('/');
    }
  } catch (error) {
    throw new Error(`Invalid URL format: ${url}`);
  }
}

module.exports = {
  uploadToStorage,
  deleteFromStorage,
  uploadToS3,
  deleteFromS3,
  getSignedDownloadUrl,
  extractKeyFromUrl,
  storageMode
};

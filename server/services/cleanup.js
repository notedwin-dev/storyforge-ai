const fs = require('fs').promises;
const path = require('path');
const { deleteFromStorage, extractKeyFromUrl } = require('./storage');

// Cleanup temporary files and expired data
async function cleanupTempFiles() {
  try {
    console.log('Starting cleanup process...');
    
    const now = Date.now();
    const CLEANUP_AGE = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    
    // Cleanup results older than 24 hours
    await cleanupDirectory(
      path.join(__dirname, '../storage/results'),
      CLEANUP_AGE,
      'results'
    );
    
    // Cleanup shares older than 7 days
    await cleanupDirectory(
      path.join(__dirname, '../storage/shares'),
      7 * 24 * 60 * 60 * 1000,
      'shares'
    );
    
    // Cleanup old character data (keep for longer - 30 days)
    await cleanupDirectory(
      path.join(__dirname, '../storage/characters'),
      30 * 24 * 60 * 60 * 1000,
      'characters'
    );
    
    console.log('Cleanup process completed');
    
  } catch (error) {
    console.error('Cleanup process failed:', error);
  }
}

async function cleanupDirectory(dirPath, maxAge, type) {
  try {
    const files = await fs.readdir(dirPath);
    let cleanedCount = 0;
    
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      
      const filePath = path.join(dirPath, file);
      const stats = await fs.stat(filePath);
      const age = Date.now() - stats.mtime.getTime();
      
      if (age > maxAge) {
        try {
          // Read file to get any URLs that need cleanup from R2
          const data = await fs.readFile(filePath, 'utf8');
          const jsonData = JSON.parse(data);
          
          // Cleanup associated R2 files
          await cleanupAssociatedFiles(jsonData);
          
          // Delete local file
          await fs.unlink(filePath);
          cleanedCount++;
          
          console.log(`Cleaned up ${type} file: ${file}`);
        } catch (fileError) {
          console.warn(`Failed to cleanup file ${file}:`, fileError.message);
        }
      }
    }
    
    console.log(`Cleaned up ${cleanedCount} ${type} files`);
    
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(`Failed to cleanup ${type} directory:`, error);
    }
  }
}

async function cleanupAssociatedFiles(jsonData) {
  const urlFields = [
    'imageUrl', 'thumbnailUrl', 'videoUrl', 'audioUrl', 'pdf_url'
  ];
  
  // Find all URLs in the data
  const urls = [];
  
  function findUrls(obj, currentPath = '') {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' && urlFields.includes(key)) {
        urls.push(value);
      } else if (typeof value === 'object' && value !== null) {
        findUrls(value, `${currentPath}.${key}`);
      } else if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (typeof item === 'object' && item !== null) {
            findUrls(item, `${currentPath}.${key}[${index}]`);
          }
        });
      }
    }
  }
  
  findUrls(jsonData);
  
  // Delete files from S3
  for (const url of urls) {
    try {
      if (url.includes('.s3.') && url.includes('.amazonaws.com')) {
        const key = extractKeyFromUrl(url);
        await deleteFromStorage(key);
        console.log(`Deleted S3 file: ${key}`);
      }
    } catch (s3Error) {
      console.warn(`Failed to delete S3 file ${url}:`, s3Error.message);
    }
  }
}

// Monitor storage usage
async function getStorageStats() {
  try {
    const stats = {
      characters: await getDirectoryStats(path.join(__dirname, '../storage/characters')),
      results: await getDirectoryStats(path.join(__dirname, '../storage/results')),
      shares: await getDirectoryStats(path.join(__dirname, '../storage/shares')),
      total_files: 0,
      total_size_mb: 0
    };
    
    stats.total_files = stats.characters.file_count + stats.results.file_count + stats.shares.file_count;
    stats.total_size_mb = Math.round((stats.characters.size_bytes + stats.results.size_bytes + stats.shares.size_bytes) / (1024 * 1024) * 100) / 100;
    
    return stats;
    
  } catch (error) {
    console.error('Failed to get storage stats:', error);
    return null;
  }
}

async function getDirectoryStats(dirPath) {
  try {
    const files = await fs.readdir(dirPath);
    let totalSize = 0;
    let fileCount = 0;
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = await fs.stat(filePath);
      if (stats.isFile()) {
        totalSize += stats.size;
        fileCount++;
      }
    }
    
    return {
      file_count: fileCount,
      size_bytes: totalSize,
      size_mb: Math.round(totalSize / (1024 * 1024) * 100) / 100
    };
    
  } catch (error) {
    return {
      file_count: 0,
      size_bytes: 0,
      size_mb: 0
    };
  }
}

// Emergency cleanup - remove all temporary data
async function emergencyCleanup() {
  try {
    console.log('Starting emergency cleanup...');
    
    const directories = [
      path.join(__dirname, '../storage/results'),
      path.join(__dirname, '../storage/shares')
    ];
    
    for (const dir of directories) {
      try {
        const files = await fs.readdir(dir);
        for (const file of files) {
          await fs.unlink(path.join(dir, file));
        }
        console.log(`Emergency cleanup completed for: ${path.basename(dir)}`);
      } catch (dirError) {
        console.warn(`Emergency cleanup failed for ${dir}:`, dirError.message);
      }
    }
    
    console.log('Emergency cleanup completed');
    
  } catch (error) {
    console.error('Emergency cleanup failed:', error);
  }
}

// Validate data integrity
async function validateDataIntegrity() {
  try {
    console.log('Validating data integrity...');
    
    const issues = [];
    
    // Check character files
    const characterDir = path.join(__dirname, '../storage/characters');
    const characterFiles = await fs.readdir(characterDir).catch(() => []);
    
    for (const file of characterFiles) {
      if (!file.endsWith('.json')) continue;
      
      try {
        const filePath = path.join(characterDir, file);
        const data = await fs.readFile(filePath, 'utf8');
        const character = JSON.parse(data);
        
        // Validate required fields
        if (!character.id || !character.name || !character.embedding) {
          issues.push(`Character file ${file} missing required fields`);
        }
        
        // Validate embedding
        if (!Array.isArray(character.embedding) || character.embedding.length !== 512) {
          issues.push(`Character file ${file} has invalid embedding`);
        }
        
      } catch (fileError) {
        issues.push(`Character file ${file} is corrupted: ${fileError.message}`);
      }
    }
    
    console.log(`Data integrity check completed. Found ${issues.length} issues.`);
    
    if (issues.length > 0) {
      console.warn('Data integrity issues found:');
      issues.forEach(issue => console.warn(`- ${issue}`));
    }
    
    return {
      valid: issues.length === 0,
      issues: issues,
      checked_files: characterFiles.length
    };
    
  } catch (error) {
    console.error('Data integrity validation failed:', error);
    return {
      valid: false,
      issues: [`Validation failed: ${error.message}`],
      checked_files: 0
    };
  }
}

module.exports = {
  cleanupTempFiles,
  cleanupDirectory,
  cleanupAssociatedFiles,
  getStorageStats,
  emergencyCleanup,
  validateDataIntegrity
};

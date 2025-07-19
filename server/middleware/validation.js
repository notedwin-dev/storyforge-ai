const Joi = require('joi');

// Validation schemas
const schemas = {
  imageUpload: Joi.object({
    name: Joi.string().max(100).optional(),
    tags: Joi.string().max(500).optional()
  }),

  generateStory: Joi.object({
    prompt: Joi.string().min(10).max(1000).required(),
    dna_id: Joi.string().uuid().required(),
    style: Joi.string().valid('cartoon', 'watercolor', 'cinematic', 'anime', 'storybook').default('cartoon'),
    genre: Joi.string().valid('fantasy', 'sci-fi', 'adventure', 'mystery').default('adventure'),
    options: Joi.object({
      duration: Joi.number().min(15).max(60).default(30),
      fps: Joi.number().min(8).max(30).default(16),
      resolution: Joi.object({
        width: Joi.number().min(320).max(1920).default(640),
        height: Joi.number().min(240).max(1080).default(360)
      }).default({ width: 640, height: 360 }),
      includeAudio: Joi.boolean().default(false),
      includeVoice: Joi.boolean().default(false),
      includeVideo: Joi.boolean().default(false),
      motionIntensity: Joi.string().valid('subtle', 'moderate', 'dynamic').default('subtle'),
      tone: Joi.string().valid('lighthearted', 'serious', 'humorous', 'dramatic', 'mysterious', 'romantic').default('lighthearted'),
      length: Joi.string().valid('short', 'medium', 'long').default('medium'),
      storyType: Joi.string().valid('adventure', 'fantasy', 'scifi', 'drama').optional(),
      
    }).default({})
  }),

  voiceNarration: Joi.object({
    text: Joi.string().min(1).max(5000).required(),
    voice_id: Joi.string().required(),
    emotion: Joi.string().valid('neutral', 'happy', 'sad', 'excited', 'calm', 'dramatic').default('neutral'),
    language: Joi.string().length(2).default('en'),
    options: Joi.object({
      voice_settings: Joi.object({
        stability: Joi.number().min(0).max(1).optional(),
        similarity_boost: Joi.number().min(0).max(1).optional()
      }).optional(),
      model_id: Joi.string().optional()
    }).default({})
  }),

  exportPdf: Joi.object({
    job_id: Joi.string().uuid().required(),
    title: Joi.string().max(200).optional(),
    include_images: Joi.boolean().default(true)
  }),

  createShare: Joi.object({
    job_id: Joi.string().uuid().required(),
    title: Joi.string().max(200).optional(),
    description: Joi.string().max(500).optional()
  })
};

// Middleware functions
function validateImageUpload(req, res, next) {
  const { error } = schemas.imageUpload.validate(req.body);
  
  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      message: error.details[0].message,
      field: error.details[0].path.join('.')
    });
  }

  // Additional file validation
  if (req.file) {
    const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024; // 10MB
    if (req.file.size > maxSize) {
      return res.status(400).json({
        error: 'File too large',
        message: `Maximum file size is ${Math.round(maxSize / (1024 * 1024))}MB`
      });
    }

    const allowedTypes = (process.env.ALLOWED_MIME_TYPES || 'image/jpeg,image/png,image/webp').split(',');
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        error: 'Invalid file type',
        message: `Allowed types: ${allowedTypes.join(', ')}`
      });
    }
  }

  next();
}

function validateGenerationRequest(req, res, next) {
  const { error, value } = schemas.generateStory.validate(req.body);
  
  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      message: error.details[0].message,
      field: error.details[0].path.join('.')
    });
  }

  // Replace req.body with validated and default values
  req.body = value;
  next();
}

function validateVoiceRequest(req, res, next) {
  const { error, value } = schemas.voiceNarration.validate(req.body);
  
  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      message: error.details[0].message,
      field: error.details[0].path.join('.')
    });
  }

  req.body = value;
  next();
}

function validateExportRequest(req, res, next) {
  const { error, value } = schemas.exportPdf.validate(req.body);
  
  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      message: error.details[0].message,
      field: error.details[0].path.join('.')
    });
  }

  req.body = value;
  next();
}

function validateShareRequest(req, res, next) {
  const { error, value } = schemas.createShare.validate(req.body);
  
  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      message: error.details[0].message,
      field: error.details[0].path.join('.')
    });
  }

  req.body = value;
  next();
}

// Generic validation middleware factory
function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        message: error.details[0].message,
        field: error.details[0].path.join('.'),
        details: error.details
      });
    }

    req.body = value;
    next();
  };
}

// Query parameter validation
function validateQueryParams(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query);
    
    if (error) {
      return res.status(400).json({
        error: 'Query validation failed',
        message: error.details[0].message,
        parameter: error.details[0].path.join('.')
      });
    }

    req.query = value;
    next();
  };
}

// Request sanitization
function sanitizeInput(req, res, next) {
  function sanitizeObject(obj) {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        // Remove potentially dangerous characters
        obj[key] = obj[key]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
          .replace(/javascript:/gi, '') // Remove javascript: URLs
          .replace(/on\w+\s*=/gi, '') // Remove event handlers
          .trim();
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObject(obj[key]);
      }
    }
  }

  if (req.body) {
    sanitizeObject(req.body);
  }
  
  if (req.query) {
    sanitizeObject(req.query);
  }

  next();
}

// Content type validation
function validateContentType(allowedTypes) {
  return (req, res, next) => {
    const contentType = req.get('Content-Type');
    
    if (!contentType || !allowedTypes.some(type => contentType.includes(type))) {
      return res.status(415).json({
        error: 'Unsupported content type',
        message: `Expected one of: ${allowedTypes.join(', ')}`,
        received: contentType
      });
    }

    next();
  };
}

module.exports = {
  validateImageUpload,
  validateGenerationRequest,
  validateVoiceRequest,
  validateExportRequest,
  validateShareRequest,
  validate,
  validateQueryParams,
  sanitizeInput,
  validateContentType,
  schemas
};

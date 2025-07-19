const sharp = require('sharp');
const axios = require('axios');

// Remove background from images using AI
async function removeBackground(imageBuffer) {
  try {
    console.log('Removing background from image...');
    
    if (process.env.DEMO_MODE === 'true') {
      // For demo, just return the original image
      return imageBuffer;
    }

    // Use remove.bg API or similar service
    const response = await axios.post(
      'https://api.remove.bg/v1.0/removebg',
      {
        image_file_b64: imageBuffer.toString('base64'),
        size: 'auto'
      },
      {
        headers: {
          'X-Api-Key': process.env.REMOVEBG_API_KEY,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer',
        timeout: 30000
      }
    );

    return Buffer.from(response.data);

  } catch (error) {
    console.warn('Background removal failed:', error.message);
    // Return original image if background removal fails
    return imageBuffer;
  }
}

// Auto-crop images to focus on main subject
async function autoCropImage(imageBuffer, options = {}) {
  try {
    const {
      targetWidth = 512,
      targetHeight = 512,
      smartCrop = true
    } = options;

    if (!smartCrop) {
      // Simple center crop
      return await sharp(imageBuffer)
        .resize(targetWidth, targetHeight, { 
          fit: 'cover',
          position: 'center'
        })
        .png()
        .toBuffer();
    }

    // Get image metadata for smart cropping
    const metadata = await sharp(imageBuffer).metadata();
    const { width, height } = metadata;

    // Calculate crop area (focus on center with some smart adjustments)
    const aspectRatio = targetWidth / targetHeight;
    const currentAspectRatio = width / height;

    let cropWidth, cropHeight, left, top;

    if (currentAspectRatio > aspectRatio) {
      // Image is wider than target
      cropHeight = height;
      cropWidth = Math.round(height * aspectRatio);
      left = Math.round((width - cropWidth) / 2);
      top = 0;
    } else {
      // Image is taller than target
      cropWidth = width;
      cropHeight = Math.round(width / aspectRatio);
      left = 0;
      top = Math.round((height - cropHeight) / 4); // Slightly above center for faces
    }

    return await sharp(imageBuffer)
      .extract({ 
        left: Math.max(0, left), 
        top: Math.max(0, top), 
        width: Math.min(cropWidth, width), 
        height: Math.min(cropHeight, height) 
      })
      .resize(targetWidth, targetHeight)
      .png()
      .toBuffer();

  } catch (error) {
    console.error('Auto-crop failed:', error);
    // Fallback to simple resize
    return await sharp(imageBuffer)
      .resize(targetWidth, targetHeight, { fit: 'cover' })
      .png()
      .toBuffer();
  }
}

// Enhance image quality
async function enhanceImage(imageBuffer, options = {}) {
  try {
    const {
      brightness = 1.0,
      contrast = 1.0,
      saturation = 1.0,
      sharpen = false
    } = options;

    let pipeline = sharp(imageBuffer);

    // Apply enhancements
    if (brightness !== 1.0 || contrast !== 1.0 || saturation !== 1.0) {
      pipeline = pipeline.modulate({
        brightness: brightness,
        saturation: saturation
      });
    }

    if (sharpen) {
      pipeline = pipeline.sharpen();
    }

    return await pipeline.png().toBuffer();

  } catch (error) {
    console.error('Image enhancement failed:', error);
    return imageBuffer;
  }
}

// Detect faces in image
async function detectFaces(imageBuffer) {
  try {
    if (process.env.DEMO_MODE === 'true') {
      // Return mock face detection for demo
      return [{
        x: 128,
        y: 96,
        width: 256,
        height: 320,
        confidence: 0.95
      }];
    }

    // In production, use face detection API
    const response = await axios.post(
      `${process.env.HUGGING_FACE_SPACES_URL}/models/face-detection`,
      {
        image: imageBuffer.toString('base64')
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.HUGGING_FACE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    return response.data.faces || [];

  } catch (error) {
    console.warn('Face detection failed:', error.message);
    return [];
  }
}

// Create image collage
async function createCollage(imageBuffers, layout = 'grid') {
  try {
    console.log(`Creating collage with ${imageBuffers.length} images in ${layout} layout`);

    if (imageBuffers.length === 0) {
      throw new Error('No images provided for collage');
    }

    const imageSize = 256;
    let canvas, width, height;

    switch (layout) {
      case 'horizontal':
        width = imageSize * imageBuffers.length;
        height = imageSize;
        canvas = sharp({
          create: {
            width,
            height,
            channels: 3,
            background: { r: 255, g: 255, b: 255 }
          }
        });
        
        const horizontalComposite = imageBuffers.map((buffer, index) => ({
          input: buffer,
          left: index * imageSize,
          top: 0
        }));
        
        canvas = canvas.composite(horizontalComposite);
        break;

      case 'grid':
      default:
        const cols = Math.ceil(Math.sqrt(imageBuffers.length));
        const rows = Math.ceil(imageBuffers.length / cols);
        width = imageSize * cols;
        height = imageSize * rows;
        
        canvas = sharp({
          create: {
            width,
            height,
            channels: 3,
            background: { r: 255, g: 255, b: 255 }
          }
        });

        const gridComposite = imageBuffers.map((buffer, index) => {
          const col = index % cols;
          const row = Math.floor(index / cols);
          return {
            input: buffer,
            left: col * imageSize,
            top: row * imageSize
          };
        });

        canvas = canvas.composite(gridComposite);
        break;
    }

    return await canvas.png().toBuffer();

  } catch (error) {
    console.error('Collage creation failed:', error);
    throw new Error(`Failed to create collage: ${error.message}`);
  }
}

// Add watermark to image
async function addWatermark(imageBuffer, watermarkText = 'StoryForge AI') {
  try {
    const { width, height } = await sharp(imageBuffer).metadata();
    
    // Create SVG watermark
    const watermarkSvg = `
      <svg width="${width}" height="${height}">
        <text x="${width - 150}" y="${height - 20}" 
              font-family="Arial" font-size="14" 
              fill="rgba(255,255,255,0.8)" 
              text-anchor="end">
          ${watermarkText}
        </text>
      </svg>
    `;

    return await sharp(imageBuffer)
      .composite([{
        input: Buffer.from(watermarkSvg),
        top: 0,
        left: 0
      }])
      .png()
      .toBuffer();

  } catch (error) {
    console.error('Watermark addition failed:', error);
    return imageBuffer;
  }
}

module.exports = {
  removeBackground,
  autoCropImage,
  enhanceImage,
  detectFaces,
  createCollage,
  addWatermark
};

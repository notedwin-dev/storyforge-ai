const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { FreeHybridStableDiffusionService } = require('../services/freeHybridStableDiffusion');

const router = express.Router();

// Get service status
router.get('/services', async (req, res) => {
  try {
    const stableDiffusion = new FreeHybridStableDiffusionService();
    const serviceStatus = await stableDiffusion.getServiceStatus();
    
    res.json({
      success: true,
      services: serviceStatus,
      timestamp: new Date().toISOString(),
      cost_analysis: {
        python_sd: {
          cost_per_image: '$0.00',
          monthly_estimate: '$0.00',
          setup_time: '5 minutes',
          advantages: ['No ongoing costs', 'Full privacy', 'Unlimited generation', 'Customizable']
        },
        cloud_sd: {
          cost_per_image: '$0.003-0.01',
          monthly_estimate: '$12-40 (1000 images)',
          setup_time: '1 minute',
          advantages: ['Quick setup', 'No hardware requirements', 'Always available']
        }
      },
      recommendations: {
        cost_saving: serviceStatus.python?.available ? 
          '🐍 Python SD is running - you\'re saving money!' : 
          '💰 Set up Python SD to eliminate API costs',
        performance: serviceStatus.python?.available ? 
          '⚡ Local generation active - faster and free!' : 
          '☁️ Using cloud generation - consider local setup',
        next_steps: serviceStatus.python?.available ? 
          '✅ Perfect setup! Enjoy free image generation' : 
          '🚀 Run: cd python-sd-service && python app.py'
      }
    });
  } catch (error) {
    console.error('Service status check error:', error);
    res.status(500).json({
      error: 'Failed to check service status',
      message: error.message
    });
  }
});

// Get job status
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if result exists
    const resultPath = path.join(__dirname, '../storage/results', `${id}.json`);
    
    try {
      const resultData = await fs.readFile(resultPath, 'utf8');
      const result = JSON.parse(resultData);
      
      res.json({
        success: true,
        job_id: id,
        status: 'completed',
        progress: 100,
        result: result,
        message: 'Generation completed successfully'
      });
    } catch (fileError) {
      // Result not found, job might still be processing
      res.status(404).json({
        error: 'Job not found or still processing',
        message: `No completed result found for job ${id}`
      });
    }
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      error: 'Failed to check status',
      message: error.message
    });
  }
});

module.exports = router;

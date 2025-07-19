const express = require('express');
const { 
  signUpUser, 
  signInUser, 
  signOutUser, 
  createUserProfile,
  getUserProfile,
  updateUserProfile,
  supabase
} = require('../services/supabase');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Sign up new user
router.post('/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Email and password are required'
      });
    }

    const result = await signUpUser(email, password);
    
    if (result.error) {
      return res.status(400).json({
        error: 'Signup failed',
        message: result.error.message
      });
    }

    // Create user profile if name provided
    if (name && result.data.user) {
      try {
        await createUserProfile(result.data.user.id, { name });
      } catch (profileError) {
        console.warn('Failed to create user profile:', profileError.message);
      }
    }

    res.json({
      success: true,
      message: 'User created successfully. Please check your email to confirm your account.',
      user: {
        id: result.data.user.id,
        email: result.data.user.email,
        emailConfirmed: result.data.user.email_confirmed_at !== null
      }
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create user account'
    });
  }
});

// Sign in user
router.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        error: 'Missing credentials',
        message: 'Email and password are required'
      });
    }

    const result = await signInUser(email, password);
    
    if (result.error) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: result.error.message
      });
    }

    // Get user profile
    let profile = null;
    try {
      profile = await getUserProfile(result.data.user.id);
    } catch (profileError) {
      console.warn('Failed to fetch user profile:', profileError.message);
    }

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: result.data.user.id,
        email: result.data.user.email,
        name: profile?.name || null,
        emailConfirmed: result.data.user.email_confirmed_at !== null
      },
      session: {
        access_token: result.data.session.access_token,
        refresh_token: result.data.session.refresh_token,
        expires_at: result.data.session.expires_at
      }
    });

  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to authenticate user'
    });
  }
});

// Sign out user
router.post('/signout', requireAuth, async (req, res) => {
  try {
    const result = await signOutUser();
    
    if (result.error) {
      return res.status(400).json({
        error: 'Signout failed',
        message: result.error.message
      });
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('Signout error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to log out user'
    });
  }
});

// Get current user profile
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const profile = await getUserProfile(req.user.id);
    
    res.json({
      success: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        name: profile?.name || null,
        avatar_url: profile?.avatar_url || null,
        created_at: profile?.created_at,
        emailConfirmed: req.user.email_confirmed_at !== null
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      error: 'Failed to fetch profile',
      message: error.message
    });
  }
});

// Update user profile
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { name, avatar_url } = req.body;
    
    const updatedProfile = await updateUserProfile(req.user.id, {
      name,
      avatar_url
    });
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: req.user.id,
        email: req.user.email,
        name: updatedProfile.name,
        avatar_url: updatedProfile.avatar_url,
        updated_at: updatedProfile.updated_at
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      error: 'Failed to update profile',
      message: error.message
    });
  }
});

// Verify authentication status
router.get('/verify', requireAuth, (req, res) => {
  res.json({
    success: true,
    authenticated: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      emailConfirmed: req.user.email_confirmed_at !== null
    }
  });
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    
    if (!refresh_token) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Refresh token is required'
      });
    }

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refresh_token
    });

    if (error) {
      return res.status(401).json({
        error: 'Token refresh failed',
        message: error.message
      });
    }

    // Get user profile
    const profile = await getUserProfile(data.user.id);

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      user: {
        id: data.user.id,
        email: data.user.email,
        name: profile?.name || null,
        emailConfirmed: data.user.email_confirmed_at !== null
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at
      }
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to refresh token'
    });
  }
});

module.exports = router;

import { Router, Request, Response } from 'express';
import { success, error } from '../utils/response.js';
import crypto from 'crypto';
import { authenticateToken } from '../middleware/auth.js';
import { scrapeEbay } from '../scrapers/ebayScraper.js';

const router = Router();

// Test endpoint to check eBay API integration
router.get('/test-search', authenticateToken, async (req: Request, res: Response) => {
  try {
    const keyword = (req.query.keyword as string) || 'nike shoes';

    console.log(`Testing eBay search for: ${keyword}`);

    const results = await scrapeEbay({
      keywords: [keyword],
      price_min: null,
      price_max: null,
      platforms: ['ebay'],
      radius_miles: 0,
      location_postcode: null,
    });

    res.json(success({
      keyword,
      count: results.length,
      results: results.slice(0, 5), // Return first 5 results
    }));
  } catch (err) {
    console.error('eBay test search error:', err);
    res.status(500).json(error('TEST_ERROR', 'Failed to test eBay search'));
  }
});

/**
 * eBay Marketplace Account Deletion/Closure Notification Endpoint
 * Required by eBay to comply with GDPR/privacy regulations
 *
 * This endpoint receives notifications when eBay users delete their accounts.
 * You must delete any user data associated with that eBay user ID.
 *
 * Documentation: https://developer.ebay.com/marketplace-account-deletion
 */

// Verification endpoint (GET)
// eBay will call this endpoint with a challenge_code to verify your server
router.get('/marketplace-account-deletion', (req: Request, res: Response) => {
  const challengeCode = req.query.challenge_code as string;

  if (!challengeCode) {
    return res.status(400).json(error('MISSING_CHALLENGE', 'challenge_code parameter is required'));
  }

  // eBay requires you to:
  // 1. URL decode the challenge_code
  // 2. Hash it with SHA256
  // 3. Encode to hex
  // 4. Return in JSON with challengeResponse field

  const verificationToken = process.env.EBAY_VERIFICATION_TOKEN || '';
  const endpoint = process.env.EBAY_MARKETPLACE_DELETION_ENDPOINT || '';

  // Construct the hash input: challengeCode + verificationToken + endpoint
  const hashInput = challengeCode + verificationToken + endpoint;

  // Create SHA256 hash
  const hash = crypto.createHash('sha256').update(hashInput).digest('hex');

  // Return the response eBay expects
  res.json({
    challengeResponse: hash
  });

  console.log('eBay verification challenge processed');
});

// Notification endpoint (POST)
// eBay will POST here when a user deletes their account
router.post('/marketplace-account-deletion', async (req: Request, res: Response) => {
  try {
    const notification = req.body;

    console.log('eBay account deletion notification received:', JSON.stringify(notification, null, 2));

    // Notification structure:
    // {
    //   "metadata": {
    //     "topic": "MARKETPLACE_ACCOUNT_DELETION",
    //     "schemaVersion": "1.0",
    //     "deprecated": false
    //   },
    //   "notification": {
    //     "notificationId": "...",
    //     "eventDate": "2024-01-15T10:30:00.000Z",
    //     "publishDate": "2024-01-15T10:30:01.000Z",
    //     "publishAttemptCount": 1,
    //     "data": {
    //       "username": "testuser123",
    //       "userId": "U1234567",
    //       "eiasToken": "nY+sHZ2PrBmdj6wVnY+sEZ2PrA2dj6wFk4GhAZSEqg6dj6x9nY+seQ=="
    //     }
    //   }
    // }

    if (notification?.metadata?.topic === 'MARKETPLACE_ACCOUNT_DELETION') {
      const userData = notification.notification?.data;

      if (userData) {
        const { username, userId, eiasToken } = userData;

        console.log(`eBay user deletion requested - Username: ${username}, UserID: ${userId}`);

        // TODO: Implement data deletion logic here
        // 1. Find any users in your database linked to this eBay username/userId
        // 2. Delete or anonymize their data according to GDPR
        // 3. Log the deletion for compliance records

        // For now, just log it
        // In production, you would:
        // await supabase.from('users').delete().eq('ebay_user_id', userId);
        // or similar deletion logic

        console.log('User data deletion processed (placeholder - implement actual deletion)');
      }
    }

    // eBay expects a 200 OK response
    res.status(200).json(success({ received: true }));
  } catch (err) {
    console.error('Error processing eBay account deletion notification:', err);
    // Still return 200 to prevent eBay from retrying
    res.status(200).json(success({ received: true, error: 'processing_error' }));
  }
});

export default router;

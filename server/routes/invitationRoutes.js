// src/routes/invitationRoutes.js
const express = require('express');
const invitationController = require('../controllers/invitationController');
const authController = require('../controllers/authController');

const router = express.Router();

// All invitation routes must be accessed by a logged-in user.
router.use(authController.protect);

// Route to get all of the current user's pending invitations
router.route('/').get(invitationController.getMyInvitations);

// Routes to accept or decline a specific invitation
router.route('/:id/accept').post(invitationController.acceptInvitation);
router.route('/:id/decline').post(invitationController.declineInvitation);

module.exports = router;
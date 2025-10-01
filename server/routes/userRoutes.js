const express= require('express');
const authController = require('../controllers/authController')
const rateLimit = require('express-rate-limit'); // <<< 1. IMPORT

const router= express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login/signup requests per window
  message: 'Too many authentication attempts from this IP, please try again after 15 minutes.',
});
router.post('/register', authLimiter,authController.register)
router.post('/login',authLimiter,authController.login)

router.get('/me',authController.protect,authController.getMe)
router.post('/refresh', authController.refreshToken);

module.exports=router
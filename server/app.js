// server/app.js

const express = require('express');
const cookieParser = require('cookie-parser');
const globalErrorHandler = require('./controllers/errorController')
const AppError = require('./utils/appError')
const userRouter =require('./routes/userRoutes');
const documentRouter = require('./routes/documentRoutes')
const invitationRouter = require('./routes/invitationRoutes'); // <<< IMPORT THIS
const rateLimit = require('express-rate-limit'); // <<< 1. IMPORT
const helmet = require('helmet');
const cors = require('cors')
const mongoSanitize = require('express-mongo-sanitize'); 
const app = express();


app.use(helmet());
app.use(cors());
// --- Middleware ---
app.use(cookieParser());
app.use(express.json({ limit: '10kb' }));

app.use(mongoSanitize());


const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again in an hour!',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply the limiter to all routes that start with /api
app.use('/api', limiter);

// --- API Routes ---
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is healthy' });
});

app.use('/api/auth', userRouter);
app.use('/api/documents',documentRouter)
app.use('/api/invitations', invitationRouter); // <<< ADD THIS LINE

app.use((req, res, next) => {
    console.log('--- 404 HANDLER TRIGGERED ---'); // <-- ADD THIS LINE
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});


app.use(globalErrorHandler);


// This is the most important part! We export the configured app.
module.exports = app;
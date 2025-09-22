// server/app.js

const express = require('express');
const cookieParser = require('cookie-parser');
const globalErrorHandler = require('./controllers/errorController')
const AppError = require('./utils/appError')
const userRouter =require('./routes/userRoutes');


const app = express();

// --- Middleware ---
app.use(cookieParser());
app.use(express.json());

// --- API Routes ---
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is healthy' });
});

app.use('/api/auth', userRouter);

app.use((req, res, next) => {
    console.log('--- 404 HANDLER TRIGGERED ---'); // <-- ADD THIS LINE
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});


app.use(globalErrorHandler);


// This is the most important part! We export the configured app.
module.exports = app;
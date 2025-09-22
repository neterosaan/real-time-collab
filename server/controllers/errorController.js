const AppError = require('../utils/appError');

/**
 * Handles 'ER_DUP_ENTRY' from the mysql2 driver.
 * Creates a user-friendly error message.
 */
const handleDuplicateFieldsDB = (err) => {
    // A typical MySQL error message is: "Duplicate entry 'test@example.com' for key 'users.email_UNIQUE'"
    // This regex extracts the duplicated value from within the quotes.
    const value = err.sqlMessage.match(/(["'])(\\?.)*?\1/)[0];
    const message = `Duplicate field value: ${value}. An account with this value already exists.`;
    return new AppError(message, 409); // 409 Conflict is more specific than 400
};

/**
 * Handles JWT verification errors from the 'jsonwebtoken' library.
 */
const handleJWTError = () => new AppError('Invalid token. Please log in again!', 401);

/**
 * Handles expired JWT errors from the 'jsonwebtoken' library.
 */
const handleJWTExpiredError = () => new AppError('Your token has expired! Please log in again.', 401);

/**
 * Sends detailed error information in the development environment.
 */
const sendErrorDev = (err, res) => {
    // For an API, we always send JSON.
    return res.status(err.statusCode).json({
        status: err.status,
        error: err,
        message: err.message,
        stack: err.stack
    });
};

/**
 * Sends clean, user-friendly errors in the production environment.
 */
const sendErrorProd = (err, res) => {
    // A) Operational, trusted error that we created: send message to client
    if (err.isOperational) {
        return res.status(err.statusCode).json({
            status: err.status,
            message: err.message
        });
    }
    
    // B) Programming or other unknown error: don't leak error details
    // 1) Log the error for developers to see
    console.error('ERROR 💥', err);
    // 2) Send a generic, safe message to the client
    return res.status(500).json({
        status: 'error',
        message: 'Something went very wrong!'
    });
};


// The main global error handling middleware
module.exports = (err, req, res, next) => {
        console.log('--- GLOBAL ERROR HANDLER TRIGGERED ---'); // <-- ADD THIS LINE

    // Set default values if not already present
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    if (process.env.NODE_ENV === 'development') {
        sendErrorDev(err, res);
    } else if (process.env.NODE_ENV === 'production') {
        // We create a hard copy of the error object to avoid modifying the original.
        let error = { ...err };
        error.name = err.name; // Copy name explicitly
        error.message = err.message; // Copy message explicitly
        error.code = err.code; // Copy the MySQL-specific error code
        error.sqlMessage = err.sqlMessage; // Copy the MySQL-specific message

        // Handle specific, known errors by converting them into operational AppErrors
        if (error.code === 'ER_DUP_ENTRY') error = handleDuplicateFieldsDB(error);
        if (error.name === 'JsonWebTokenError') error = handleJWTError();
        if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();
        
        sendErrorProd(error, res);
    }
};
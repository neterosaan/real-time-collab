const bcrypt = require('bcryptjs');
const Jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const {promisify}= require('util')
const crypto = require('crypto');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const db = require('../db/mysql');



const signToken = (id)=>{
    return Jwt.sign({ id }, process.env.JWT_SECRET,{
        expiresIn: process.env.JWT_EXPIRES_IN,
    })
};


const createAndStoreRefreshToken= async(userId)=>{
        // 1. Generate a long, cryptographically random string for the refresh token.
    const refreshToken = crypto.randomBytes(32).toString('hex');

    // 2. Hash the token using SHA-256. This is fast and secure for high-entropy tokens.
    const hashedToken = crypto
        .createHash('sha256')
        .update(refreshToken)
        .digest('hex');

            // 3. Calculate the expiration date from the .env setting.
    const expiresInDays = parseInt(process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const [rows]= await db.execute(`INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)`,[userId, hashedToken, expiresAt])

        return refreshToken;
}


const createSendTokens = async (user, statusCode, res) => {
    // Generate both tokens
    const accessToken = signToken(user.id);
    const refreshToken = await createAndStoreRefreshToken(user.id);

    // Configure the secure cookie for the refresh token
    const expiresInDays = parseInt(process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS, 10);
    const cookieOptions = {
        expires: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
        httpOnly: true, // Prevents client-side JavaScript from accessing the cookie
        secure: process.env.NODE_ENV === 'production', // Only send over HTTPS in production
    };
    
    // Set the cookie on the response
    res.cookie('refreshToken', refreshToken, cookieOptions);

    // Remove sensitive data from the user object before sending it in the response
    user.password_hash = undefined;

    // Send the final response containing the short-lived access token
    res.status(statusCode).json({
        status: 'success',
        accessToken,
        data: {
            user,
        },
    });
};


exports.refreshToken= catchAsync(async(req,res,next)=>{
    const refreshToken = req.cookies.refreshToken

      if (!refreshToken) {
        return next(new AppError('No refresh token found. Please log in again.', 401));
    }

        const hashedToken = crypto
        .createHash('sha256')
        .update(refreshToken)
        .digest('hex');


        const [rows]= await db.execute(`select * from refresh_tokens where token_hash =? AND expires_at > NOW()`,[hashedToken])

        const tokenData = rows[0]

        if (!tokenData) {
        // This could mean the token is invalid OR it has expired.
        // For security, we should clear the cookie if it exists.
        res.cookie('refreshToken', 'loggedout', {
            expires: new Date(Date.now() + 10 * 1000), // expire in 10 seconds
            httpOnly: true,
        });
        return next(new AppError('Invalid or expired refresh token. Please log in again.', 401));
    }

    
    // 4. The refresh token is valid. Find the associated user.
    const userSql = 'SELECT * FROM users WHERE id = ?';
    const [userRows] = await db.execute(userSql, [tokenData.user_id]);
    const user = userRows[0];

    if (!user) {
        return next(new AppError('User belonging to this token not found.', 401));
    }

    // 5. Issue a new access token and send it back
    const newAccessToken = signToken(user.id);

    res.status(200).json({
        status: 'success',
        accessToken: newAccessToken,
    });
})

exports.register=catchAsync(async(req,res,next)=>{
    const {username,email,password} = req.body;

    if(!username || !email || !password){
      return next(new AppError('Please provide username, email, and password.', 400));
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password,salt)

    const userId = uuidv4()

    const newUser={
        id: userId,
        username,
        email,
        password_hash: hashedPassword
    }

    const sql = `INSERT INTO users(id,username,email,password_hash) VALUES (?,?,?,?)`;
    const values= [newUser.id, newUser.username, newUser.email, newUser.password_hash]

    await db.execute(sql, values); // Now call .query() on the connection object

      createSendTokens(newUser, 201, res); 
})


exports.login= catchAsync(async(req,res,next)=>{
    const {email,password}= req.body

        if(!email || !password){
        return next (new AppError('Please provide email and password',400))
    }

    const [rows]= await db.execute(
        `SELECT * FROM users WHERE email=?`,
    [email]
    );

    if (rows.length===0){
        return next(new AppError('Invalid email or password', 401));
    }

    const user = rows[0];

    const isMatch = await bcrypt.compare(password,user.password_hash);
    if (!isMatch) {
    return next(new AppError('Invalid email or password', 401));
  }

      createSendTokens(user, 200, res); 
})



exports.protect=catchAsync(async(req,res,next)=>{
    let token
    if(
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ){
        token = req.headers.authorization.split(' ')[1];
    }
   console.log(token);
    
    if(!token){
        return next(
            new AppError ('You are not logged in! please log in to get acess',401)
        )
    }
        const decoded = await promisify(Jwt.verify)(token, process.env.JWT_SECRET);

        const [rows]=await db.execute( `select * from users where id=?`,[decoded.id])

            const currentUser = rows[0];

    if (!currentUser) {
        return next(
            new AppError(
                'The user belonging to this token does no longer exist.',
                401
            )
        );
    }

    req.user = currentUser;
    next();
    
})


exports.getMe=catchAsync(async(req,res,next)=>{
    req.user.password_hash=undefined

     res.status(200).json({
        status: 'success',
        data: {
            user: req.user
        }
    });
})

exports.restrictTo = (...roles) => {
  return catchAsync(async (req, res, next) => {

    
    const documentId = req.params.documentId || req.body.documentId;

    if (!documentId) {
      return next(new AppError('Document ID not found in request.', 400));
    }

    const userId = req.user.id;

    const [rows]= await db.execute(`select r.name
        from user_document_permissions As udp
        JOIN roles AS r ON udp.role_id = r.id
        where udp.user_id = ? AND udp.document_id=?`,[userId,documentId])
       // 4. Check if a role was found and if it's one of the allowed roles
    if (rows.length === 0) {
      // The user has NO role for this document
      return next(new AppError('You do not have permission to access this document.', 403));
    }

    const userRole = rows[0].name;
    if(!roles.includes(userRole)){
        return next(new AppError('You do not have the required permissions to perform this action.', 403));
    }
    next();
  }
)
}
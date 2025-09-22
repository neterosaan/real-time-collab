const mysql = require('mysql2/promise');

// 1. Create a connection pool instead of a single connection.
// A pool is a cache of database connections that can be reused, which is much more
// efficient for a web server handling multiple requests at once.
const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: 'root', // For production, a dedicated user is better, but 'root' is fine for development.
    password: process.env.MYSQL_ROOT_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    waitForConnections: true, // If all connections are busy, wait for one to be free.
    connectionLimit: 10,      // The maximum number of connections to create at once.
    queueLimit: 0             // If the limit is reached, queue requests instead of rejecting them.
});

// 2. We can add a simple check to see if the pool is able to connect.
// This is optional but good for initial setup debugging.
pool.getConnection()
    .then(connection => {
        console.log('✅ MySQL Connection Pool created and connected successfully.');
        connection.release(); // IMPORTANT: release the connection back to the pool
    })
    .catch(error => {
        console.error('❌ Could not create MySQL Connection Pool:', error);
        process.exit(1); // Exit if the database connection fails
    });

// 3. Export the pool object directly.
// This single object will be used to run all queries throughout the application.
module.exports = pool;
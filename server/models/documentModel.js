const { v4: uuidv4 } = require('uuid');
const db = require('../db/mysql');
const AppError = require('../utils/appError');
const DocumentContent = require('./documentContentModel'); // <-- The new line


/**
 * Creates a new document and assigns ownership in a transaction.
 */
exports.create = async (title, ownerId) => {
  const newDocumentId = uuidv4();
  // Corrected variable name and default title
  const documentData = {
    id: newDocumentId,
    title: title || 'Untitled Document',
    owner_id: ownerId,
  };

  const ownerRoleId = 1; // 'owner' role

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Use .query for 'SET ?' syntax. It's cleaner for inserting objects.
    await connection.query('INSERT INTO documents SET ?', documentData);

    await connection.query(
      'INSERT INTO user_document_permissions (user_id, document_id, role_id) VALUES (?, ?, ?)',
      [ownerId, newDocumentId, ownerRoleId]
    );

    await DocumentContent.create({_id: newDocumentId, content:''})

    await connection.commit();

    // Return the full document data, which is more useful for the controller's response
    return {
      id: documentData.id,
      title: documentData.title,
      owner_id: documentData.owner_id,
    };
  } catch (error) {
    await connection.rollback();
    console.error('Failed to create document:', error); // Also log the actual error
    throw new AppError('Failed to create document in database.', 500);
  } finally {
    connection.release();
  }
};

/**
 * Finds all documents a specific user has access to.
 */
exports.findAllForUser = async (userId) => {
  // Corrected join condition from d.ud to d.id
  const [rows] = await db.execute(
    `SELECT d.id, d.title, d.owner_id, d.created_at, d.updated_at
     FROM documents d
     JOIN user_document_permissions udp ON d.id = udp.document_id
     WHERE udp.user_id = ?`,
    [userId]
  );
  return rows;
};

/**
 * Finds a single document by its ID, but only if the specified user has access.
 * Renamed from findOneForUser to findById for clarity.
 */
exports.findById = async (documentId, userId) => {
  // This new query is the heart of our permissions system.
  const sql = `
    SELECT d.*
    FROM documents d
    LEFT JOIN user_document_permissions udp ON d.id = udp.document_id
    WHERE d.id = ? AND (d.owner_id = ? OR udp.user_id = ?)
    GROUP BY d.id
  `;

  const [rows] = await db.execute(sql, [documentId, userId, userId]);

  // If this query returns a row, the user has access. Otherwise, they don't.
  return rows[0] || null;
};

/**
 * Updates a document's title.
 */
exports.updateTitle = async (documentId, title) => {
  // Added the missing parameters array
  const [result] = await db.execute(
    'UPDATE documents SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [title, documentId]
  );
  return result;
};

/**
 * Deletes a document from the database.
 */
exports.remove = async (documentId) => {
  // Corrected syntax to db.execute() and passed parameters correctly
  const [result] = await db.execute('DELETE FROM documents WHERE id = ?', [
    documentId,
  ]);
  return result;
};

/**
 * Helper function to quickly find the owner of a document.
 */
exports.findOwner = async (documentId) => {
  // Passed parameters correctly as the second argument
  const [rows] = await db.execute('SELECT owner_id FROM documents WHERE id = ?', [
    documentId,
  ]);
  return rows[0] ? rows[0].owner_id : null;
};

exports.addPermission = async (documentId, userId, roleId) => {
  // First, check if a permission already exists to avoid duplicates
  const [existing] = await db.execute(
    'SELECT * FROM user_document_permissions WHERE document_id = ? AND user_id = ?',
    [documentId, userId]
  );

  if (existing.length > 0) {
    // We can throw an error or just return the existing permission.
    // Throwing an error is more explicit.
    throw new AppError('This user already has access to the document.', 409); // 409 Conflict
  }

  const sql = 'INSERT INTO user_document_permissions (document_id, user_id, role_id) VALUES (?, ?, ?)';
  const [result] = await db.execute(sql, [documentId, userId, roleId]);

  return {
    permissionId: result.insertId,
    documentId,
    userId,
    roleId,
  };
};


exports.getPermissions = async (documentId) => {
  const sql = `
    SELECT u.id, u.username, u.email, r.name AS role_name
    FROM user_document_permissions udp
    JOIN users u ON udp.user_id = u.id
    JOIN roles r ON udp.role_id = r.id
    WHERE udp.document_id = ?
  `;
  const [rows] = await db.execute(sql, [documentId]);
  return rows;
};

exports.removePermission = async (documentId, userIdToRemove) => {
  const sql = 'DELETE FROM user_document_permissions WHERE document_id = ? AND user_id = ?';
  const [result] = await db.execute(sql, [documentId, userIdToRemove]);

  // result.affectedRows will be 1 if a row was deleted, 0 otherwise.
  return result;
};


exports.getUserRole = async (documentId, userId) => {
  // First, check if the user is the owner. The owner's role is implicit.
  const ownerId = await this.findOwner(documentId);
  if (ownerId === userId) {
    return { name: 'owner' }; // Return a role-like object for consistency
  }

  // If not the owner, look for their specific role in the permissions table.
  const sql = `
    SELECT r.name
    FROM user_document_permissions udp
    JOIN roles r ON udp.role_id = r.id
    WHERE udp.document_id = ? AND udp.user_id = ?
  `;
  const [rows] = await db.execute(sql, [documentId, userId]);

  return rows[0] || null; // Will return { name: 'editor' }, { name: 'viewer' }, or null
};


exports.setPublicStatus = async (documentId, isPublic) => {
  // The '!!' ensures the value is a true boolean (1 or 0 for MySQL)
  const sql = 'UPDATE documents SET is_public = ? WHERE id = ?';
  const [result] = await db.execute(sql, [!!isPublic, documentId]);

  return result;
};


exports.isPublic = async (documentId) => {
  const sql = 'SELECT is_public FROM documents WHERE id = ?';
  const [rows] = await db.execute(sql, [documentId]);
  
  // Return true if the document exists and is_public is true (1), otherwise false.
  return rows[0] ? !!rows[0].is_public : false;
};
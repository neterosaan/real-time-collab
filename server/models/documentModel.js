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
  // Corrected join condition from d.ud to d.id
  const [rows] = await db.execute(
    `SELECT d.id, d.title, d.owner_id, d.created_at, d.updated_at
     FROM documents d
     JOIN user_document_permissions udp ON d.id = udp.document_id
     WHERE d.id = ? AND udp.user_id = ?`,
    [documentId, userId]
  );
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
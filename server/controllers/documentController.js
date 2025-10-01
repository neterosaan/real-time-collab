const db = require('../db/mysql');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const documentModel = require('../models/documentModel')
const DocumentContent = require('../models/documentContentModel')


exports.createDocument = catchAsync(async (req, res, next) => {
  const {title} = req.body
  const ownerId = req.user.id

  const newDocument= await documentModel.create(title,ownerId)

  res.status(201).json({
    status: 'success',
    data: {
      document : newDocument,
    },
  });
});

exports.getAllDocuments = catchAsync(async (req, res, next) => {
  
  const userId = req.user.id

  const documents = await documentModel.findAllForUser(userId)

  res.status(200).json({
  status: 'success',
  results: documents.length,
  data: {
      documents,
    },
  });
});

// Placeholder function - will be implemented soon
exports.getDocument = catchAsync(async (req, res, next) => {
  const documentId = req.params.id;
  const userId = req.user.id;


  const document = await documentModel.findById(documentId, userId);

    if (!document) {
    return next(new AppError('No document found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      document,
    },
  });
});

exports.updateDocument = catchAsync(async (req, res, next) => {

  const userId = req.user.id
  const documentId = req.params.id
  const {title}= req.body

  if(!title){
    return next(new AppError('Title is required for an update.', 400));
  }

  const ownerId = await documentModel.findOwner(documentId)

    if (!ownerId || ownerId !== userId) {
    return next(
      new AppError(
        'No document found with that ID, or you do not have permission to update it.',
        404
      )
    );
  }

  await documentModel.updateTitle(documentId,title);


  // 5. As a best practice, fetch and return the updated document.
  const updatedDocument = await documentModel.findById(documentId, userId);

  res.status(200).json({
    status: 'success',
    data: {
      document: updatedDocument,
    },
  });
});



exports.deleteDocument = catchAsync(async (req, res, next) => {

  
  const userId = req.user.id
  const documentId = req.params.id

    const ownerId = await documentModel.findOwner(documentId);

  if (!ownerId || ownerId !== userId) {
    return next(
      new AppError(
        'No document found with that ID, or you do not have permission to delete it.',
        404
      )
    );
  }

  await documentModel.remove(documentId);

  // 4. The standard response for a successful DELETE is 204 No Content.
  res.status(204).json({
    status: 'success',
    data: null,
  });
});


// was testing something xd
/*exports.getDocumentContent = catchAsync(async (req, res, next) => {
  const documentId = req.params.id;
  const userId = req.user.id;

  // Step 1: AUTHORIZATION - Check if the user has access to this document in MySQL.
  const hasAccess = await documentModel.findById(documentId, userId);
  if (!hasAccess) {
    return next(new AppError('You do not have permission to access this document.', 403));
  }

  // Step 2: FETCH CONTENT - Get the content from MongoDB.
  const documentContent = await DocumentContent.findById(documentId);
  if (!documentContent) {
    // This case should not happen if your create logic is working.
    return next(new AppError('Document content not found in the database.', 404));
  }

  // Step 3: SEND RESPONSE
  res.status(200).json({
    status: 'success',
    data: {
      content: documentContent,
    },
  });
});*/

exports.shareDocument = catchAsync(async (req, res, next) => {
  // 1. Get data from the request
  const documentId = req.params.id;
  const { email} = req.body;
  const inviterId = req.user.id;

  // 2. Validate input
  if (!email) {
    return next(new AppError('Please provide an email  to share.', 400)); // 400 Bad Request
  }
  const [roles] = await db.execute('SELECT id FROM roles WHERE name = ?', ['editor']);
  const editorRole = roles[0];
  if (!editorRole) {
    // This is a server configuration error, so we send a 500
    return next(new AppError('Server configuration error: "editor" role not found.', 500));
  }
  const editorRoleId = editorRole.id;


  // 3. Find the user to invite using a direct MySQL query
  const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
  const userToInvite = users[0];

  if (!userToInvite) {
    return next(new AppError('No user found with that email address.', 404)); // 404 Not Found
  }
  
  // 4. Prevent owner from sharing with themselves
  if (userToInvite.id === inviterId) {
    return next(new AppError('You cannot share a document with yourself.', 400));
  }

  // 5. Add the permission to the database using our new model function
  const invitation = await documentModel.createInvitation(
    documentId,
    inviterId,
    userToInvite.id,
    editorRoleId // We use the 'editor' role ID we found earlier
  );

  // 6. Send success response
res.status(200).json({ // <-- Small improvement: should be 201 Created
  status: 'success',
  // You updated the message here in your head, but not in the code yet
  message: `Document successfully shared with ${userToInvite.username}.`, 
  data: {
    // THE BUG IS HERE:
    // You are trying to send a variable named 'permission',
    // but the variable you created is named 'invitation'.
    invitation, 
    },
  });
});


exports.getPermissions = catchAsync(async (req, res, next) => {
  const documentId = req.params.id;

  const permissions = await documentModel.getPermissions(documentId);

  res.status(200).json({
    status: 'success',
    results: permissions.length,
    data: {
      permissions,
    },
  });
});

exports.removePermission = catchAsync(async (req, res, next) => {
  const documentId = req.params.id;
  const { userIdToRemove } = req.body; // We get the user to remove from the body

  if (!userIdToRemove) {
    return next(new AppError('Please provide the userId of the user to remove.', 400));
  }

  // Ensure the owner cannot remove themselves.
  if (userIdToRemove === req.user.id) {
    return next(new AppError('The owner cannot remove their own access.', 400));
  }

  const result = await documentModel.removePermission(documentId, userIdToRemove);

  if (result.affectedRows === 0) {
    return next(new AppError('No permission found for this user on this document.', 404));
  }

  res.status(204).json({ // 204 No Content is standard for a successful DELETE
    status: 'success',
    data: null,
  });
});


exports.setPublicStatus = catchAsync(async (req, res, next) => {
  const documentId = req.params.id;
  const { is_public } = req.body;

  // Validate that the input exists and is a boolean
  if (typeof is_public !== 'boolean') {
    return next(new AppError('Please provide a boolean value for is_public.', 400));
  }

  await documentModel.setPublicStatus(documentId, is_public);

  res.status(200).json({
    status: 'success',
    message: `Document public status set to ${is_public}.`
  });
});



exports.viewPublicDocument = catchAsync(async (req, res, next) => {
  const documentId = req.params.id;
  const userId = req.user.id;

  // Step 1: Check if the document exists and is marked as public.
  const isPublic = await documentModel.isPublic(documentId);
  if (!isPublic) {
    return next(new AppError('This document is not public or does not exist.', 404));
  }
  
  // Step 2: Check if the user already has access (either as owner or via permissions).
  // We can use our powerful findById function for this!
  const hasAccess = await documentModel.findById(documentId, userId);

  // If the user already has access, there's nothing to do. Just send success.
  if (hasAccess) {
    return res.status(200).json({
      status: 'success',
      message: 'You already have access to this document.'
    });
  }

  // Step 3: The magic part. The document is public and the user does NOT have access.
  // Let's grant them 'viewer' permission automatically.
  
  // Find the 'viewer' role ID
  const [roles] = await db.execute('SELECT id FROM roles WHERE name = ?', ['viewer']);
  const viewerRole = roles[0];
  if (!viewerRole) {
    return next(new AppError('Server configuration error: "viewer" role not found.', 500));
  }
  
  // Add the permission. We wrap in try/catch in case of a race condition
  // where two requests come at once. addPermission will throw if a duplicate is found.
  try {
    await documentModel.addPermission(documentId, userId, viewerRole.id);
  } catch (error) {
    // If the error is '409 Conflict', it means the permission was just added.
    // We can safely ignore it and continue.
    if (error.statusCode !== 409) {
      throw error; // Re-throw any other unexpected errors.
    }
  }
  
  res.status(201).json({ // 201 Created, since a new permission resource was created
    status: 'success',
    message: 'You have been granted view access to this document.'
  });
});
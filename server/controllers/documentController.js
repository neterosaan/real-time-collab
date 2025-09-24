const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const documentModel = require('../models/documentModel')



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
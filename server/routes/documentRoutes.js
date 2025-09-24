const express= require('express');
const documentController = require('../controllers/documentController')
const authController= require('../controllers/authController')

const router= express.Router();


router.use(authController.protect)



router
 .route('/')
  .get(documentController.getAllDocuments)
  .post(documentController.createDocument);

router
  .route('/:id')
  .get(documentController.getDocument)
  .patch(documentController.updateDocument)
  .delete(documentController.deleteDocument); // We will add specific authorization for this later

module.exports = router;
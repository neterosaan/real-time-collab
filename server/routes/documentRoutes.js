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

router.route('/:id/share').post(
  authController.isOwner, // First, check if the user is the owner
  documentController.shareDocument // If they are, then run the share logic
);

router.route('/:id/permissions').get(
  authController.isOwner, // Only the owner can see the permissions
  documentController.getPermissions
)
  .delete( // <<< ADD THIS METHOD
    authController.isOwner, // Only the owner can remove permissions
    documentController.removePermission
  );


  router.route('/:id/public').put(
  authController.isOwner, // Only the owner can change the public status
  documentController.setPublicStatus
);

router.route('/:id/view').get(
  // It is already protected by router.use(authController.protect) at the top
  documentController.viewPublicDocument
);
/*router
.route('/:id/content')
.get(documentController.getDocumentContent)
*/

module.exports = router;
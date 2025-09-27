const mongoose = require('mongoose')

const documentContentSchema = new mongoose.Schema(
{
// This _id field will store the document's UUID from our PostgreSQL table.
// This is the critical link between our two databases.
    _id:{
        type:String,
        required:true,
        alias:'documentId'
    },
// The actual content of the document. 'Mixed' allows us to store anything,
// from a simple string to a complex JSON object from a rich text editor.
    content: {
      type: mongoose.Schema.Types.Mixed,
      default: '',
    },

},
 {
    // Mongoose will automatically add createdAt and updatedAt timestamps.
    timestamps: true,
    // This prevents Mongoose from creating a "version key" (__v) field,
    // which we don't need for this project.
    versionKey: false,
  }

)

const DocumentContent = mongoose.model(
  'DocumentContent',
  documentContentSchema
);

module.exports = DocumentContent;
const mongoose = require("mongoose");
const {
    v1: uuidv1,
    v4: uuidv4,
} = require('uuid');
// const uuid = require('uuid/v4');




const ProjectSchema = new mongoose.Schema(
    {
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Users",
            // required: true,
        },
        title: {
            type: String, 
            // required: true 
        },
        description: {
            type: String,
            // required: true
        },
        website: {
            type: String,
            default:""
        },
        tasks: {
            type: Array,
            default: [],
          },

    },
    {
      timestamps: true,
    }
 
)

module.exports = mongoose.model("Projects", ProjectSchema);
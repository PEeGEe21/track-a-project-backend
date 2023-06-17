const mongoose = require("mongoose");
const {
    v1: uuidv1,
    v4: uuidv4,
} = require('uuid');
// const uuid = require('uuid/v4');




const PeerSchema = new mongoose.Schema(
    {
        // user: {
        //     type: mongoose.Schema.Types.ObjectId,
        //     ref: "User",
        //     // required: true,
        // },
        // userId: {
        //     type: String,
        //     required: true,
        // },

        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Users",
        },
        peers: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Users",
            default: [],
        }],

        projects: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Projects",
            default: [],
        }],


    },
    {
      timestamps: true,
    }
 
)

module.exports = mongoose.model("Peers", PeerSchema);
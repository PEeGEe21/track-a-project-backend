const mongoose = require("mongoose");


const commentSchema = new mongoose.Schema(
    {
        task: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Tasks",
            required: true
        },
        content: {
            type: String,
            required: true,
        },
        user:{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Users",
            required: true
        }
        
    },
    { timestamps: true },
);

module.exports = mongoose.model("Comments", commentSchema)

const mongoose = require("mongoose");


// const commentSchema = new mongoose.Schema(
//     {
//         name:{
//             type: String,
//             required: true,
//         },
//         comment: {
//             type: String,
//             required: true,
//         },
//         user:{
//             type: mongoose.Schema.Types.ObjectId,
//             ref: "Users",
//             required: true
//         }
        
//     },
//     { timestamps: true },
// );



const TaskSchema = new mongoose.Schema(
    {
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Projects",
            required: true,
        },
        title:{
            type: String,
            required: true,
        },
        description: {
            type: String,
            required: true,
        },
        status: {
            type: Number,
            enum: [1, 2, 3],
            default: 1
        },
        comments:[
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Comments",
                // required: true,
            }
        ]

        
    },
    { timestamps: true },
);

module.exports = mongoose.model("Tasks", TaskSchema)




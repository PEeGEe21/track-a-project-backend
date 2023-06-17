const mongoose = require("mongoose");
const Project = require("../models/ProjectModel");
const User = require("../models/UserModel");
const Task = require("../models/TaskModel");
const Comment = require("../models/CommentModel");


// module.exports.addComment = async (req, res, next) => {


//     const { task, user, comment} = req.body;
//     try{
//         // const user = await User.findById(req.body.userId);
//         const userCheck = await User.findOne({user});
//         console.log(userCheck)
//         // const user = await User.find(_id === userId);
//         if(userCheck){
//             // if (req.body.userId === req.params.id || req.body.isAdmin) {
//             // return res.json({msg: "User exists", status: true});
//             const taskCheck = Task.findOne({task}).populate('comments')
//             console.log(taskCheck)
//             if(taskCheck){

//                 // const projectCheck = await Project.findOne({title}).populate('author').populate('tasks');
//                 // console.log(bookCheck)
//                 // if(projectCheck)
//                 //     return res.json({msg: "Project already exists", status: false});

//                 const savedComment = await Comment.create({
//                     task,
//                     comment,
//                     user
//                 });
//                 return res.json({status: true, savedComment});

//             }    
//         }
        
//     }catch(ex){
//         next(ex);
//     }
// }






module.exports.addComment = async (req, res, next) => {

    const id = req.params.id;
    const { user, content} = req.body;
    try{
        const userCheck = await User.findOne({user});

        if(userCheck){
            const taskCheck = await Task.findById(id)
            // console.log(taskCheck)

                if(taskCheck){
                    // console.log(taskCheck)
                    const comment = new Comment({
                        content,
                        task: id,
                        user
                    })

                    await comment.save();
                    

                    taskCheck.comments.push(comment);

                    await taskCheck.save(function(err) {
                        if(err) {console.log(err)}
                        // res.redirect('/')
                        return res.json({status: true, comment});
                     })
                }
                
        }
    }catch(ex){
        next(ex)
    }
}





module.exports.allComments = async (req, res, next ) => {
    try{
        const comments = await Comment.find({}).populate('task').populate('user');
        return res.json({comments})
    }catch(ex){
        next(ex)

    }

}




// module.exports.allProjects = async (req, res, next) =>{
//     try{
//         const projects = await Project.find({});
//         return res.json({status: true, projects});
//     }catch(ex){
//         next(ex)
//     }
// }
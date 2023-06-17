const mongoose = require("mongoose");
const Project = require("../models/ProjectModel");
const User = require("../models/UserModel");
const Task = require("../models/TaskModel");

//create
module.exports.addTask = async (req, res, next) => {
    id = req.params.id;
    const {title, description} = req.body;

    try{
        // const user = await User.findById({userId});
        // if(user){

            const projectCheck = await Project.findById(id);
            // console.log(projectCheck);

            if(projectCheck){

            // return res.json({msg: "User exists", status: true});
                const taskCheck = await Task.findOne({title}).sort({updatedAt: -1}).populate('project').populate('comments');
                // console.log(bookCheck)
                if(taskCheck)
                    return res.json({msg: "Task already exists, update instead?", status: false});
                    const task = await Task.create({
                        project: id,
                        title, 
                        description});
                    
                        projectCheck.tasks.push(task);

                        await projectCheck.save(function(err) {
                            if(err) {console.log(err)}
                            // res.redirect('/')
                            // return res.json({status: true, comment});
                         })
                    // if (!projectCheck.tasks.includes(task)) {
                    //         await projectCheck.updateOne({ $push: { tasks: task } });
                    //         // res.status(200).json("task has been added");
                    //     } else { 
                    //     res.json("you already have this task");
                    // }
                return res.json({status: true, task, projectCheck, msg: `${title} created`});
            }
        // }
    }catch(ex){
        next(ex);
    }
}



//single Project Tasks
module.exports.singleTask = async (req, res, next) =>{
    try{
        const projectCheck = await Project.findOne({ _id: req.params.id });
        // console.log(projectCheck, "projectCheck");
        const tasks = await Task.find({ project: projectCheck }).sort({updatedAt: -1}).populate('comments');
        // console.log(tasks, "tasks")
        return res.json({status: true, tasks});
    }catch(ex){
        next(ex)
    }
}  



//task delete
module.exports.taskDelete = async (req, res, next) =>{
    try{
        const id = req.params.id;
        const task = await Task.findByIdAndDelete(id)
        return res.json(`${task.title} has been deleted`);
    }catch(ex){
        next(ex)
    }
}

//task update
module.exports.taskUpdate = async (req, res, next) =>{
    try{
        const id = req.params.id;
        const updatedData = req.body;
        const options = { new: true };

        const task = await Task.findByIdAndUpdate(
            id, updatedData, options
        )

        return res.json({status: true, task});
    }catch(ex){
        next(ex)
    }
}





// display all allTasks
module.exports.allTasks = async (req, res, next) =>{
    try{
        const tasks = await Task.find({}).sort({updatedAt: -1}).populate('comments');
        return res.json({status: true, tasks});
    }catch(ex){
        next(ex)
    }
}




//project detail
// module.exports.projectDetail = async (req, res, next) =>{
//     try{
//         // var id = mongoose.Types.ObjectId(req.params.id);
//         const project = await Project.findById(req.params.id).populate('peers').populate('tasks').populate('author');
//         return res.json({status: true, project});
//     }catch(ex){
//         next(ex)
//     }
// }




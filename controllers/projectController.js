const mongoose = require("mongoose");
const Project = require("../models/ProjectModel");
const User = require("../models/UserModel");
const Task = require("../models/TaskModel");

// const Category = require("../models/CategoryModel");
const bcrypt = require("bcrypt");

//create
module.exports.addProject = async (req, res, next) => {


    const {author, title, description} = req.body;
    try{
        // const user = await User.findById(req.body.userId);
        const user = await User.findOne({author});
        // console.log(user)
        // const user = await User.find(_id === userId);
        
        if(user){
            // return res.json({msg: "User exists", status: true});

            const projectCheck = await Project.findOne({title}).populate('author').populate('tasks');
            // console.log(bookCheck)
            if(projectCheck)
                return res.json({msg: "Project already exists, Update instead", status: false});

            const project = await Project.create({
                author,
                title, 
                description
            });
            return res.json({status: true, project, msg: `Your Project, ${title} is ready`});
        }
    }catch(ex){
        next(ex);
    }
}



//display all Projects
module.exports.allProjects = async (req, res, next) =>{
    try{
        const projects = await Project.find({});
        return res.json({status: true, projects});
    }catch(ex){
        next(ex)
    }
}

//single Users Projects
// module.exports.usersProjects = async (req, res, next) =>{
//     try{
//         const user = await User.findOne({ id: req.params.id });
//         console.log(user, "user");
//         const projects = await Project.find({ userId: user._id }).sort({updatedAt: -1}).populate('peers').populate('tasks').populate('author');
//         // console.log(projects, "projects")
//         return res.json({status: true, projects, user});
//     }catch(ex){
//         next(ex)
//     }
// }   



//project detail
module.exports.projectDetail = async (req, res, next) =>{
    try{
        // var id = mongoose.Types.ObjectId(req.params.id);
        const project = await Project.findOne({ _id: req.params.id }).populate('tasks');
        // console.log(project);
        return res.json({status: true, project});
    }catch(ex){
        next(ex)
    }
}


//project delete
module.exports.projectDelete = async (req, res, next) =>{
    try{
        const id = req.params.id;
        const project = await Project.findByIdAndDelete(id)
        return res.json(`${project.title} has been deleted`);
    }catch(ex){
        next(ex)
    }
}

//project update
module.exports.projectUpdate = async (req, res, next) =>{
    try{
        const id = req.params.id;
        const updatedData = req.body;
        const options = { new: true };

        const project = await Project.findByIdAndUpdate(
            id, updatedData, options
        )

        return res.json({status: true, project});
    }catch(ex){
        next(ex)
    }
}


// Projects Tasks
module.exports.projectTasks = async (req, res, next) =>{
    try{
        const project = await Project.findOne({ id: req.params.id });
        const tasks = await Task.find({ project: project }).sort({updatedAt: -1});
        // console.log(tasks, "taskkssssss")
        return res.json({
            status: true, 
            tasks, 
        });
    }catch(ex){
        next(ex)
    }
}   
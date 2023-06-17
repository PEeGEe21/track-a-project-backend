const mongoose = require("mongoose");
const Project = require("../models/ProjectModel");
const User = require("../models/UserModel");
// const Category = require("../models/CategoryModel");
const bcrypt = require("bcrypt");



//single Users Projects
module.exports.usersProjects = async (req, res, next) =>{
    try{
        const user = await User.findOne({ _id: req.params.id });
        const projects = await Project.find({ author: user }).sort({updatedAt: -1}).populate('tasks').populate('author');
        const count = projects.length;
        // console.log(count)
        return res.json({
            status: true, 
            projects, 
            count
            
        });
    }catch(ex){
        next(ex)
    }
}   



//user detail
module.exports.userDetail = async (req, res, next) =>{
    try{
        // var id = mongoose.Types.ObjectId(req.params.id);
        const user = await User.findById(req.params.id);
        return res.json({status: true, user});
    }catch(ex){
        next(ex)
    }
}


//user delete
module.exports.userDelete = async (req, res, next) =>{
    if (req.body.userId === req.params.id || req.body.isAdmin) {
        try {
          await User.findByIdAndDelete(req.params.id);
          res.status(200).json("Account has been deleted");
        } catch (err) {
          return res.status(500).json(err);
        }
      } else {
        return res.status(403).json("You can delete only your account!");
      }
}

//user update
module.exports.userUpdate = async (req, res, next) =>{
    if (req.body.userId === req.params.id || req.body.isAdmin) {
        if (req.body.password) {
          try {
            
            // const hashedPassword = await bcrypt.hash(password, 10);
            // const salt = await bcrypt.genSalt(10);
            req.body.password = await bcrypt.hash(password, 10);
          } catch (err) {
            return res.status(500).json(err);
          }
        }
        try {
          const user = await User.findByIdAndUpdate(req.params.id, {
            $set: req.body,
          });
          res.status(200).json("Account has been updated");
        } catch (err) {
          return res.status(500).json(err);
        }
      } else {
        return res.status(403).json("You can update only your account!");
      }
}



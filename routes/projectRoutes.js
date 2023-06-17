
const {
    addProject, 
    allProjects,
    projectDelete, 
    projectUpdate, 
    projectDetail,
    projectTasks
} = require("../controllers/projectController");

const router = require("express").Router();


router.post("/addProject", addProject);
router.get("/", allProjects);
router.get("/:id/projectTasks", projectTasks);
router.delete("/delete/:id", projectDelete);
router.patch("/update/:id", projectUpdate);
router.get("/:id", projectDetail);


module.exports = router;
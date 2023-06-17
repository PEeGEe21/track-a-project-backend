
const {
    addTask, 
    singleTask, 
    taskDelete,
    taskUpdate,
    allTasks
} = require("../controllers/taskController");

const router = require("express").Router();

router.post("/:id/addTask", addTask);
router.get("/", allTasks);
router.delete("/delete/:id", taskDelete);
router.put("/update/:id", taskUpdate);
router.get("/:id", singleTask);

// router.get("/:id", userDetail);


module.exports = router;
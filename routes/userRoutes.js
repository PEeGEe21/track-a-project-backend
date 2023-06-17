
const {
    userDelete, 
    userUpdate, 
    userDetail,
    usersProjects
} = require("../controllers/userController");

const router = require("express").Router();

router.delete("/delete/:id", userDelete);
router.patch("/update/:id", userUpdate);
router.get("/:id/usersProjects", usersProjects);
router.get("/:id", userDetail);


module.exports = router;
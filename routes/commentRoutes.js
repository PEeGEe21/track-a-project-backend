const {
    addComment,
    allComments
} = require("../controllers/commentController");

const router = require("express").Router();




router.post("/:id/comment", addComment);
router.get("/", allComments);


module.exports = router;
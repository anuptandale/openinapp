const express = require('express');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const mongoose = require('mongoose');
const { Task, SubTask, User } = require('./models/SubTask'); // Sequelize models
const { MongoClient } = require('mongodb');
const app = express();
app.use(express.json());
const cookieParser = require('cookie-parser');
mongoose.connect(`mongodb://127.0.0.1:27017/task_database`);
app.use(cookieParser());
const db = mongoose.connection;

db.on('error', console.error.bind(console, 'error connecting to db'));

db.once('open', function () {
    console.log("connected ...........");
})

const call = ()=>{
    const accountSid = "ACcaad366f70f70673b09332407a7fb35d";
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const client = require("twilio")(accountSid, authToken);


    client.calls.create({
        url: "http://demo.twilio.com/docs/voice.xml",
        to: "+919665031364",
        from: "+15312291167",
    })
        .then(call => console.log(call.sid));
}
// Middleware for JWT authentication
const authenticateJWT = (req, res, next) => {
    const token = req.cookies.access_token;

    if (!token) {
        return next(createError(401, "You are not authenticated!"))
    }
    //if token is present it doesnt mean that it is correct one
    jwt.verify(token, process.env.JWT, (err, user) => {
        if (err) {
            return next(createError(403, "Token is not valid!"));
        }
        req.user = user;
        console.log("hello", user.user_id)
        next();
    });
    console.log("token:", token);
};

app.post('/register', async (req, res) => {
    // console.log(req.body);
    try {
        const user = await User.create(req.body);

        res.status(201).json(user);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error" });
    }
})
app.post('/login', async (req, res) => {

    try {
        const user = await User.findOne({ name: req.body.name });

        if (!user) {
            res.status(404).json({ message: "wrong data" });
        }
        const isPasswordCorrect = false;
        // console.log("object", user.password, " ",req.body.password)
        if (user) {
            if (user.password != req.body.password) {
                res.status(404).json({ message: "wrong data" });
            }

        }
        const token = jwt.sign({ ...user, user_id: user._id }, process.env.JWT);
        
        const task = await Task.find({user_id:user._id});
        task.map(item=>{
            console.log("--------------------",item.priority)
            if(item.priority<=0){
                console.log("sudfhluhfer23738893208324o7324")
                call();
            }
        })
        

        const { password, ...otherDetails } = user._doc;
        res.cookie("access_token", token, {
            httpOnly: true          //it dont allow client to reach the cookie
        }).status(200).json("login successfull");
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "wrong data" });
    }
})
// 1. Create task
app.post('/tasks', authenticateJWT, async (req, res) => {
    const { title, description, due_date } = req.body;
    const user = await User.findOne({ name: req.user.name });
    
    const user_id = req.user.user_id;
    let days=0;
    if(new Date()-new Date(due_date)<=0){
        days=0;
    }else if(new Date()-new Date(due_date)<=2){
        days=1;
    }else{
        days=new Date()-new Date(due_date);
    }
    const priority = Math.floor(days / (1000 * 60 * 60 * 24));
    // console.log("----------------",priority);
    try {
        const task = await Task.create({ title, description, due_date, user_id,priority });
        res.status(201).json(task);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error" });
    }
});

// 2. Create sub task
app.post('/tasks/:task_id/subtasks', authenticateJWT, async (req, res) => {
    const { task_id } = req.params;
    const { status } = req.body;

    try {
        const subtask = await SubTask.create({ task_id, status });
        res.status(201).json(subtask);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error" });
    }
});

// 3. Get all user tasks with filters and pagination
app.get('/tasks', authenticateJWT, async (req, res) => {
    // Implement filtering and pagination logic here
    const page = req.query.page || 1; // Default to page 1 if not specified
    const skip = (page - 1) * 2;
    const filter = req.query;
    delete filter.page;
    try {
        const tasks = await Task.find(filter).skip(skip).limit(2);

        res.json(tasks);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error" });
    }
});

// 4. Get all user subtasks with filters
app.get('/subtasks', authenticateJWT, async (req, res) => {
    // Implement filtering logic here
    const filter = req.query;
    try {
        const subtasks = await SubTask.find(filter);
        console.log(subtasks)
        res.json(subtasks);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error" });
    }
});

// 5. Update task
app.put('/tasks/:task_id', authenticateJWT, async (req, res) => {
    const { task_id } = req.params;
    const { due_date, status } = req.body;

    try {
        const task = await Task.findById(task_id);
        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }

        if (due_date) {
            task.due_date = due_date;
        }
        if (status) {
            task.status = status;
        }

        await task.save();
        res.json(task);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error" });
    }
});

// 6. Update subtask
app.put('/subtasks/:subtask_id', authenticateJWT, async (req, res) => {
    const { subtask_id } = req.params;
    const { status } = req.body;

    try {
        const subtask = await SubTask.findById(subtask_id);
        if (!subtask) {
            return res.status(404).json({ message: "Subtask not found" });
        }

        subtask.status = status;
        await subtask.save();
        res.json(subtask);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error" });
    }
});

// 7. Soft delete task
app.delete('/tasks/:task_id', authenticateJWT, async (req, res) => {
    // Implement soft deletion logic here
    const { task_id } = req.params;
    try {
        const task = await Task.findByIdAndDelete(task_id);
        if (!task) {
            return res.status(404).json({ message: "task not found" });
        }
        res.json("deleted successfully");
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error" });
    }
});

// 8. Soft delete subtask
app.delete('/subtasks/:subtask_id', authenticateJWT, async (req, res) => {
    // Implement soft deletion logic here
    const { subtask_id } = req.params;
    try {
        const subtask = await SubTask.findByIdAndDelete(subtask_id);
        if (!subtask) {
            return res.status(404).json({ message: "Subtask not found" });
        }
        res.json("deleted successfully");
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

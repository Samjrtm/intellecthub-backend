const express = require ('express');
const { MongoClient, ObjectId} = require('mongodb');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require ('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    const method = req.method;
    const url = req.url;
    const ip = req.ip;

    //Log request Details
    console.log(`[${timestamp}] ${method} ${url} - IP: ${ip}`);

    //Log request body if it exists
    if (Object.keys(req.body).length > 0){
        console.log('Request Body:', JSON.stringify(req.body,null,2));
    }

    //Capture response status
    res.on('finish', () => {
        console.log(`[${timestamp}] Response Status: ${res.statusCode}`);
        console.log('-'.repeat(50));
    });
    next();

    //Static Files middleware that checks if images exist
    app.use('/images', (req, res, next) => {
        const imagePath = path.join(__dirname, 'public/images', req.path);
    
        fs.access(imagePath, fs.constants.F_OK, (err) => {
            if (err) {
                console.log(`[${new Date().toISOString()}] Image not found:${req.path}`);
                return res.status(404).json({
                    message: 'Image not Found',
                    requestedPath: req.path
                });
            }
            next()
        })
    });

    //Serves static files from image directory
    app.use('/images', express.static(path.join(__dirname, 'public/images')));

    //MongoDB connection
    const uri = process.env.MONGODB_URI;
    const client = new MongoClient(uri);
    let db

    async function connectToDatabase(){
        try{
            await client.connect();
            db = client.db('intellecthubDB'); //This is the space for the database, don't forget to inser it
            console.log('Connected to Mongo db atlas');
        }catch(error){
            console.error('MongoDB connection error:', error)
        }
    }
    connectToDatabase();

//Lesson Routes
app.get('/api/lessons', async (req, res) => {
    try{
        const lessons = await db.collection('lessons').find({}).toArray();
        res.json(lessons);
    }catch(error){
        res.status(500).json({message:error.message});
    }
});

app.put('/api/lessons/:id', async (req, res) => {
    try {
        const lessonId = req.params.id;

        // Validate ID format
        if (!ObjectId.isValid(lessonId)) {
            return res.status(400).json({ message: "Invalid ID format" });
        }

        // Update the document
        const result = await db.collection('lessons').updateOne(
            { _id: new ObjectId(lessonId) },
            { $set: req.body } // Update any provided fields
        );

        // Check if the document exists
        if (result.matchedCount === 0) {
            return res.status(404).json({ message: "Lesson not found" });
        }

        // Fetch and return the updated document
        const updatedLesson = await db.collection('lessons').findOne(
            { _id: new ObjectId(lessonId) }
        );

        res.status(200).json(updatedLesson);
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

//Order Routes
app.post('/api/orders', async (req, res) => {
    try {
        const order = {
            name: req.body.name,
            phoneNumber: req.body.phoneNumber,
            lessonIds: req.body.lessonIds.map(id => new ObjectId(id)),
            spaces: req.body.spaces,
            orderDate: new Date()
        };

        const result = await db.collection('orders').insertOne(order);
        res.status(201).json({ ...order, _id: result.insertedId });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

//Test route for images
app.get('/test-image/:imageName', (req,res) => {
    res.redirect(`/images/${req.params.imageName}`);
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});
});
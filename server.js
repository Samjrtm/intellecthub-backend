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

    console.log(`[${timestamp}] ${method} ${url} - IP: ${ip}`);

    if (Object.keys(req.body).length > 0){
        console.log('Request Body:', JSON.stringify(req.body,null,2));
    }

    res.on('finish', () => {
        console.log(`[${timestamp}] Response Status: ${res.statusCode}`);
        console.log('-'.repeat(50));// Seperator so you can read it better
    });
    next();
});

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

app.use('/images', express.static(path.join(__dirname, 'public/images')));


//Mongodb Connection
const uri = process.env.MONGODB_URI.replace('majority=intellect-hub', 'majority');
const client = new MongoClient(uri);
let db

async function connectToDatabase(){
    try{
        await client.connect();
        db = client.db('intellecthubDB'); 
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

        
        if (!ObjectId.isValid(lessonId)) {
            return res.status(400).json({ message: "Invalid ID format" });
        }

        
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

app.get('/api/orders', async (req, res) => {
    try {
        const orders = await db.collection('orders').aggregate([
            {
                $lookup: {
                    from: 'lessons',
                    localField: 'lessonIds',
                    foreignField: '_id',
                    as: 'lessons'
                }
            }
        ]).toArray();
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

//Test route for images
app.get('/test-image/:imageName', (req,res) => {
    res.redirect(`/images/${req.params.imageName}`);
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err.stack);
    res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

// shutdown
process.on('SIGINT', async () => {
    try {
        await client.close();
        console.log('MongoDB connection closed.');
        process.exit(0);
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

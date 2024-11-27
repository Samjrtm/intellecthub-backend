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
});
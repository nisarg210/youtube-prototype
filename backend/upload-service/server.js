const express = require('express');
const mongoose = require('mongoose');
const AWS = require('aws-sdk');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const dotenv = require('dotenv');
const { sendMessage } = require('./kafka/producer');
const Video = require('./VideoModel');

// Load environment variables from .env file
dotenv.config();

// Initialize Express app
const app = express();

// Middleware setup
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Multer setup for file uploads
const upload = multer();

// MongoDB connection
mongoose.connect('mongodb://127.0.0.1:27017/yt', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('MongoDB connected!'))
  .catch(err => console.error('MongoDB connection error:', err));

// AWS S3 setup
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_BUCKET_REGION,
  useAccelerateEndpoint: true,
});

const bucketName = process.env.AWS_BUCKET_NAME;
const cloudFrontUrl = process.env.AWS_CLOUD_FRONT_URL;

// Routes

// Initiate multipart upload
app.post('/initiateUpload', async (req, res) => {
  try {
    const { fileName } = req.body;
    const params = {
      Bucket: bucketName,
      Key: fileName,
    };
    const upload = await s3.createMultipartUpload(params).promise();
    res.json({ uploadId: upload.UploadId });
  } catch (error) {
    console.error('Error initializing upload:', error);
    res.status(500).json({ success: false, message: 'Error initializing upload' });
  }
});

// Upload part
app.post('/upload/:uploadId', upload.single('file'), (req, res) => {
  const { index, fileName } = req.body;
  const file = req.file;
  const s3Params = {
    Bucket: bucketName,
    Key: fileName,
    Body: file.buffer,
    PartNumber: Number(index) + 1,
    UploadId: req.params.uploadId,
  };

  s3.uploadPart(s3Params, (err, data) => {
    if (err) {
      console.error('Error uploading chunk:', err);
      return res.status(500).json({ success: false, message: 'Error uploading chunk' });
    }
    res.json({ success: true, message: 'Chunk uploaded successfully' });
  });
});

// Complete multipart upload
app.post('/completeUpload/:fileName/:uploadId', async (req, res) => {
  const { fileName } = req.params;
  const s3Params = {
    Bucket: bucketName,
    Key: fileName,
    UploadId: req.params.uploadId,
  };

  s3.listParts(s3Params, (err, data) => {
    if (err) {
      console.error('Error listing parts:', err);
      return res.status(500).json({ success: false, message: 'Error listing parts' });
    }

    const parts = data.Parts.map(part => ({
      ETag: part.ETag,
      PartNumber: part.PartNumber,
    }));

    s3Params.MultipartUpload = { Parts: parts };

    s3.completeMultipartUpload(s3Params, async (err, data) => {
      if (err) {
        console.error('Error completing upload:', err);
        return res.status(500).json({ success: false, message: 'Error completing upload' });
      }

      const video = new Video({
        title: req.body.title,
        description: req.body.description,
        url: `${cloudFrontUrl}/${fileName}`,
      });
      await video.save();
      sendMessage('transcode', { fileName });
      res.json({ message: 'Uploaded successfully' });
    });
  });
});

// Kafka demo endpoint
app.post('/kafkademo', (req, res) => {
  const messageData = { fileName: req.body.fileName, status: 'Processed' };
  sendMessage('transcode', messageData);
  res.sendStatus(201);
});

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});

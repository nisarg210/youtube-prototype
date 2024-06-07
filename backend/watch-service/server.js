const express = require('express');
const mongoose = require('mongoose');
const Video = require('./VideoModel');
const cors = require('cors');

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3007;

// Connect to MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/yt')
   .then(() => console.log('Connected!'));

// Endpoint to fetch all videos
app.get('/videos', async (req, res) => {
  try {
    const videos = await Video.find();
    res.json(videos);
  } catch (error) {
    console.error('Error fetching videos:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

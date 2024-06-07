const express = require('express');
require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 3005;
const AWS = require('aws-sdk');
const mongoose = require('mongoose');
const kafka = require('kafka-node');
const { KafkaClient, Consumer } = kafka;

const kafkaConsumer = () => {
  const client = new KafkaClient({ kafkaHost: 'localhost:9092' });
  const consumer = new Consumer(
    client,
    [{ topic: 'transcode', partition: 0 }],
    { autoCommit: true }
  );

  consumer.on('message', async function (message) {
    console.log('Received message:', message.value);
    const res = JSON.parse(message.value);
    const fileName = res.fileName;
    await transcode(fileName)
    console.log("Done")

  });

  consumer.on('error', function (err) {
    console.error('Error:', err);
  });

  consumer.on('offsetOutOfRange', function (topic) {
    console.error('Offset out of range:', topic);
  });
};

kafkaConsumer()
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_BUCKET_REGION,
  useAccelerateEndpoint: true,
});


mongoose.connect('mongodb://127.0.0.1:27017/yt')
.then(() => console.log('Connected!'));

const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');
const Video = require('./VideoModel');
const { default: axios } = require('axios');
ffmpeg.setFfmpegPath(ffmpegStatic);
require('dotenv').config();

  
  const Bucket = process.env.AWS_BUCKET_NAME;
const cloudFrontUrl = process.env.AWS_CLOUD_FRONT_URL // Your CloudFront URL

const getObjectFromCloudFrontWithRetry = async (url, maxRetries = 5, delay = 100) => {
  let attempts = 0;

  while (attempts < maxRetries) {
    try {
      const response = await axios({
        method: 'get',
        url: url,
        responseType: 'stream'
      });

      return response.data;
    } catch (error) {
      attempts += 1;
      console.log(`Attempt ${attempts} failed. Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }

  throw new Error('Max retries reached. Could not get object from CloudFront.');
};
const transcode = async (fileName) => {
  console.log(fileName)
    const inputFilePath = path.join('/tmp', fileName);
    const outputDir = path.join('/tmp', path.basename(fileName, '.mp4'));
  
    try {
      // Ensure output directory exists
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      const videoUrl = `${cloudFrontUrl}/${fileName}`;
      const videoStream = await getObjectFromCloudFrontWithRetry(videoUrl);
    
    videoStream.pipe(fs.createWriteStream(inputFilePath))
        .on('close', () => {
          console.log('File downloaded successfully');
  
          const resolutions = [
            { suffix: '1080p', size: '1920x1080', audioBitrate: '192k' },
            { suffix: '720p', size: '1280x720', audioBitrate: '128k' },
            { suffix: '480p', size: '854x480', audioBitrate: '96k' },
            { suffix: '360p', size: '640x360', audioBitrate: '96k' },
            { suffix: '240p', size: '426x240', audioBitrate: '64k' },
            { suffix: '144p', size: '256x144', audioBitrate: '48k' }
          ];
  
          processVideo(inputFilePath, outputDir, resolutions, async() => {
            await writeAndUploadMasterPlaylist(outputDir, resolutions, Bucket, path.basename(fileName, '.mp4'), () => {
             console.log('Video processing and uploading completed');
            });
            const video = await Video.findOne({ url: `${cloudFrontUrl}/${fileName}` });
            if (video) {
              video.url = `${cloudFrontUrl}/${path.basename(fileName, '.mp4')}/master.m3u8`;
              await video.save();
              console.log('Video URL updated in database');
            } else {
              console.error('Video not found in database');
            }
          });
        });
    } catch (error) {
      console.error('Failed to process video:', error);
    }
  };
  
  function processVideo(inputFilePath, outputDir, resolutions, callback) {
    let allProcesses = resolutions.map(resolution => {
      return new Promise((resolve, reject) => {
        ffmpeg(inputFilePath)
          .outputOptions([
            '-profile:v baseline',
            `-c:v h264`,
            '-level 3.0',
            `-s ${resolution.size}`,
            `-b:a ${resolution.audioBitrate}`,
            '-c:a aac',
            '-start_number 0',
            '-hls_time 10',
            '-hls_list_size 0',
            '-f hls'
          ])
          .output(`${outputDir}/output_${resolution.suffix}.m3u8`)
          .on('end', () => {
            console.log(`Processing finished for ${resolution.suffix}!`);
            resolve();
          })
          .on('error', (err) => {
            console.error('Error processing video:', err);
            reject(err);
          })
          .run();
      });
    });
  
    Promise.all(allProcesses)
      .then(() => callback())
      .catch(error => console.error('Failed processing some of the resolutions:', error));
  }
  
  async function writeAndUploadMasterPlaylist(outputDir, resolutions, bucketName, fileName, callback) {
    const masterContent = [
      '#EXTM3U',
      '#EXT-X-VERSION:3'
    ];
  
    resolutions.forEach(res => {
      const bandwidth = calculateBandwidth(res.size, res.audioBitrate);
      masterContent.push(`#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${res.size}`);
      masterContent.push(`${cloudFrontUrl}/${fileName}/output_${res.suffix}.m3u8`);
    });
  
    const playlistContent = masterContent.join('\n');
    const localPlaylistPath = `${outputDir}/master.m3u8`;
  
    fs.writeFileSync(localPlaylistPath, playlistContent, 'utf8');
    console.log('Master playlist written locally:', localPlaylistPath);
  
    await uploadDirToS3(outputDir, `${fileName}/`, async() => {
      await uploadFileToS3(localPlaylistPath, bucketName, `${fileName}/master.m3u8`, callback);
    });
  }
  
  async function uploadDirToS3(dir, s3Path, callback) {
    fs.readdir(dir, (err, files) => {
      if (err) {
        console.error('Could not list the directory.', err);
        return;
      }
  
      let uploadPromises = files.map(file => {
        return new Promise((resolve, reject) => {
          const filePath = path.join(dir, file);
          const contentType = file.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/MP2T';
          const params = {
            Bucket,
            Key: `${s3Path}${file}`,
            Body: fs.createReadStream(filePath),
            ContentType: contentType
          };
  
          s3.upload(params, (s3Err, data) => {
            if (s3Err) {
              console.log("Error uploading data: ", s3Err);
              reject(s3Err);
            } else {
              console.log(`Successfully uploaded data to ${data.Location}`);
              resolve();
            }
          });
        });
      });
  
      Promise.all(uploadPromises)
        .then(() => {
          console.log('All files uploaded successfully.');
          callback();
        })
        .catch(error => console.error('Failed to upload some files:', error));
    });
  }
  
  async function uploadFileToS3(filePath, bucketName, key, callback) {
    const fileContent = fs.readFileSync(filePath);
    const params = {
      Bucket: bucketName,
      Key: key,
      Body: fileContent,
      ContentType: 'application/vnd.apple.mpegurl'
    };
  
    await s3.upload(params, function (err, data) {
      if (err) {
        console.log("Error uploading data: ", err);
      } else {
        console.log("Successfully uploaded data to " + data.Location);
        callback();
      }
    });
  }
  
  function calculateBandwidth(resolution, audioBitrate) {
    const videoBase = {
      '1920x1080': 5000,
      '1280x720': 2500,
      '854x480': 1000,
      '640x360': 750,
      '426x240': 400,
      '256x144': 300
    };
    const audioBase = parseInt(audioBitrate, 10) / 1000;
    return (videoBase[resolution] + audioBase) * 1000; // Return in bits per second
  }

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports.s3=s3;

// const express = require('express');
// const mongoose = require('mongoose');
// const AWS = require('aws-sdk');
// const kafka = require('kafka-node');
// const { KafkaClient, Consumer } = kafka;
// const ffmpeg = require('fluent-ffmpeg');
// const ffmpegStatic = require('ffmpeg-static');
// const fs = require('fs');
// const path = require('path');
// const Video = require('./VideoModel');
// const axios = require('axios');
// require('dotenv').config();

// ffmpeg.setFfmpegPath(ffmpegStatic);

// const app = express();
// const PORT = process.env.PORT || 3005;

// // AWS S3 setup
// const s3 = new AWS.S3({
//   accessKeyId: process.env.AWS_ACCESS_KEY,
//   secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//   region: process.env.AWS_BUCKET_REGION,
//   useAccelerateEndpoint: true,
// });

// const Bucket = process.env.AWS_BUCKET_NAME;
// const cloudFrontUrl = process.env.AWS_CLOUD_FRONT_URL; // Your CloudFront URL

// // MongoDB connection
// mongoose.connect('mongodb://127.0.0.1:27017/yt', {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// })
//   .then(() => console.log('MongoDB connected!'))
//   .catch(err => console.error('MongoDB connection error:', err));

// const getObjectFromCloudFrontWithRetry = async (url, maxRetries = 5, delay = 100) => {
//   let attempts = 0;
//   while (attempts < maxRetries) {
//     try {
//       const response = await axios({
//         method: 'get',
//         url: url,
//         responseType: 'stream'
//       });
//       return response.data;
//     } catch (error) {
//       attempts += 1;
//       console.log(`Attempt ${attempts} failed. Retrying in ${delay}ms...`);
//       await new Promise((resolve) => setTimeout(resolve, delay));
//       delay *= 2; // Exponential backoff
//     }
//   }
//   throw new Error('Max retries reached. Could not get object from CloudFront.');
// };

// const transcode = async (fileName) => {
//   console.log(fileName);
//   const inputFilePath = path.join('/tmp', fileName);
//   const outputDir = path.join('/tmp', path.basename(fileName, '.mp4'));

//   try {
//     // Ensure output directory exists
//     if (!fs.existsSync(outputDir)) {
//       fs.mkdirSync(outputDir, { recursive: true });
//     }
//     const videoUrl = `${cloudFrontUrl}/${fileName}`;
//     const videoStream = await getObjectFromCloudFrontWithRetry(videoUrl);

//     videoStream.pipe(fs.createWriteStream(inputFilePath))
//       .on('close', async () => {
//         console.log('File downloaded successfully');

//         const resolutions = [
//           { suffix: '1080p', size: '1920x1080', audioBitrate: '192k' },
//           { suffix: '720p', size: '1280x720', audioBitrate: '128k' },
//           { suffix: '480p', size: '854x480', audioBitrate: '96k' },
//           { suffix: '360p', size: '640x360', audioBitrate: '96k' },
//           { suffix: '240p', size: '426x240', audioBitrate: '64k' },
//           { suffix: '144p', size: '256x144', audioBitrate: '48k' }
//         ];

//         processVideo(inputFilePath, outputDir, resolutions, async () => {
//           await writeAndUploadMasterPlaylist(outputDir, resolutions, Bucket, path.basename(fileName, '.mp4'));
//           console.log('Video processing and uploading completed');
          
//           await Video.findOneAndUpdate(
//             { url: fileName }, // find a document by current URL
//             { url: `${cloudFrontUrl}/${fileName}/master.m3u8` },
//             { new: true, runValidators: true } // options to return updated doc and run schema validations
//           );
//         });
//       });
//   } catch (error) {
//     console.error('Failed to process video:', error);
//   }
// };

// const kafkaConsumer = () => {
//   const client = new KafkaClient({ kafkaHost: 'localhost:9092' });
//   const consumer = new Consumer(
//     client,
//     [{ topic: 'transcode', partition: 0 }],
//     { autoCommit: true }
//   );

//   consumer.on('message', async function (message) {
//     console.log('Received message:', message.value);
//     const res = JSON.parse(message.value);
//     const fileName = res.fileName;
//     await transcode(fileName);
//     console.log("Done");
//   });

//   consumer.on('error', function (err) {
//     console.error('Error:', err);
//   });

//   consumer.on('offsetOutOfRange', function (topic) {
//     console.error('Offset out of range:', topic);
//   });
// };

// kafkaConsumer();

// function processVideo(inputFilePath, outputDir, resolutions, callback) {
//   let allProcesses = resolutions.map(resolution => {
//     return new Promise((resolve, reject) => {
//       ffmpeg(inputFilePath)
//         .outputOptions([
//           '-profile:v baseline',
//           `-c:v h264`,
//           '-level 3.0',
//           `-s ${resolution.size}`,
//           `-b:a ${resolution.audioBitrate}`,
//           '-c:a aac',
//           '-start_number 0',
//           '-hls_time 10',
//           '-hls_list_size 0',
//           '-f hls'
//         ])
//         .output(`${outputDir}/output_${resolution.suffix}.m3u8`)
//         .on('end', () => {
//           console.log(`Processing finished for ${resolution.suffix}!`);
//           resolve();
//         })
//         .on('error', (err) => {
//           console.error('Error processing video:', err);
//           reject(err);
//         })
//         .run();
//     });
//   });

//   Promise.all(allProcesses)
//     .then(() => callback())
//     .catch(error => console.error('Failed processing some of the resolutions:', error));
// }

// function writeAndUploadMasterPlaylist(outputDir, resolutions, bucketName, fileName, callback) {
//   const masterContent = [
//     '#EXTM3U',
//     '#EXT-X-VERSION:3'
//   ];

//   resolutions.forEach(res => {
//     const bandwidth = calculateBandwidth(res.size, res.audioBitrate);
//     masterContent.push(`#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${res.size}`);
//     masterContent.push(`${cloudFrontUrl}/${fileName}/output_${res.suffix}.m3u8`);
//   });

//   const playlistContent = masterContent.join('\n');
//   const localPlaylistPath = `${outputDir}/master.m3u8`;

//   fs.writeFileSync(localPlaylistPath, playlistContent, 'utf8');
//   console.log('Master playlist written locally:', localPlaylistPath);

//   uploadDirToS3(outputDir, `${fileName}/`, () => {
//     uploadFileToS3(localPlaylistPath, bucketName, `${fileName}/master.m3u8`, callback);
//   });
// }

// function uploadDirToS3(dir, s3Path, callback) {
//   fs.readdir(dir, (err, files) => {
//     if (err) {
//       console.error('Could not list the directory.', err);
//       return;
//     }

//     let uploadPromises = files.map(file => {
//       return new Promise((resolve, reject) => {
//         const filePath = path.join(dir, file);
//         const contentType = file.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/MP2T';
//         const params = {
//           Bucket,
//           Key: `${s3Path}${file}`,
//           Body: fs.createReadStream(filePath),
//           ContentType: contentType
//         };

//         s3.upload(params, (s3Err, data) => {
//           if (s3Err) {
//             console.log("Error uploading data: ", s3Err);
//             reject(s3Err);
//           } else {
//             console.log(`Successfully uploaded data to ${data.Location}`);
//             resolve();
//           }
//         });
//       });
//     });

//     Promise.all(uploadPromises)
//       .then(() => {
//         console.log('All files uploaded successfully.');
//         callback();
//       })
//       .catch(error => console.error('Failed to upload some files:', error));
//   });
// }

// function uploadFileToS3(filePath, bucketName, key, callback) {
//   const fileContent = fs.readFileSync(filePath);
//   const params = {
//     Bucket: bucketName,
//     Key: key,
//     Body: fileContent,
//     ContentType: 'application/vnd.apple.mpegurl'
//   };

//   s3.upload(params, function (err, data) {
//     if (err) {
//       console.log("Error uploading data: ", err);
//     } else {
//       console.log("Successfully uploaded data to " + data.Location);
//       callback();
//     }
//   });
// }

// function calculateBandwidth(resolution, audioBitrate) {
//   const videoBase = {
//     '1920x1080': 5000,
//     '1280x720': 2500,
//     '854x480': 1000,
//     '640x360': 750,
//     '426x240': 400,
//     '256x144': 300
//   };
//   const audioBase = parseInt(audioBitrate, 10) / 1000;
//   return (videoBase[resolution] + audioBase) * 1000; // Return in bits per second
// }

// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });

// module.exports.s3 = s3;

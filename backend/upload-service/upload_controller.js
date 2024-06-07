const { PutObjectCommand, S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const dotenv = require("dotenv");
dotenv.config()
const crypto = require('crypto');
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const bucketName = process.env.AWS_BUCKET_NAME
const region = process.env.AWS_BUCKET_REGION
const accessKeyId = process.env.AWS_ACCESS_KEY
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY

const s3 = new S3Client({
  region,
  credentials: {
    accessKeyId,
    secretAccessKey
  }
})

const generateFileName = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

const upload = async (req, res, next) => {
  
    try {
        const file = req.file;
        const title = req.body.title;
        const description = req.body.description;
        const fileName = generateFileName();
        const params ={
            Bucket: bucketName,
            Key:fileName,
            ContentType: file.mimetype,
            Body: file.buffer
        }
        const command =new PutObjectCommand(params)
        const responseUpload = await s3.send(command)
       
      res.status(200).send({message: responseUpload})
    } catch(e) {
      console.log(e.message)
      res.sendStatus(500);
    }
  }
  
  const getFile = async(req, res)=>{
    try {
        console.log(req.params)
        const url = await getSignedUrl(s3, new GetObjectCommand({Bucket: bucketName,
            Key:req.params.filename,}), {expiresIn: 3600})
            res.send({url:url});
    } catch (error) {
        console.log(error.message)
      res.sendStatus(500);
    }

  }
  module.exports = {
    upload,
    getFile
  }
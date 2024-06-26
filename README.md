# Youtube

![System Design](https://github.com/nisarg210/youtube-prototype/blob/master/System%20Design.jpg)

## Introduction

-Implemented a distributed microservices architecture for a video streaming platform, leveraging React.js, Express.js, Kafka, AWS S3, and AWS CloudFront. 
-This architecture allows users to upload videos to S3, which are then transcoded into multiple formats, ranging from 240p to 1080p, for optimal viewing experience.



## Prerequisites

- Node.js
- npm
- AWS Account (if applicable)

## Getting Started

### Backend

1. Navigate to the backend directory:

   ```bash
   cd path/to/each-microservice-backend
   ```

2. Install the dependencies:

   ```bash
   npm install
   ```

3. Start the backend service:

   ```bash
   npm start
   ```

### Frontend

1. Navigate to the frontend directory:

   ```bash
   cd path/to/frontend
   ```

2. Install the dependencies:

   ```bash
   npm install
   ```

3. Start the frontend service:

   ```bash
   npm start
   ```

## Environment Variables

To configure the project, create a `.env` file in the root directory and add the following variables:

```env
# Add environment variables given in sample env file
```

## AWS Configuration

If you are deploying the application on AWS, make sure you have the AWS CLI configured. Follow the [AWS CLI configuration guide](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html) to set it up.

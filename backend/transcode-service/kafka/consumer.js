const kafka = require('kafka-node');
const { transcode } = require('../transcode');
const { KafkaClient, Consumer } = kafka;
const {s3} =require('../server.js')
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
    await transcode(s3,fileName)
    console.log("Done")

  });

  consumer.on('error', function (err) {
    console.error('Error:', err);
  });

  consumer.on('offsetOutOfRange', function (topic) {
    console.error('Offset out of range:', topic);
  });
};

module.exports = kafkaConsumer;

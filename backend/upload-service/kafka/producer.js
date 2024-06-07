const kafka = require('kafka-node');
const { KafkaClient, Producer, Consumer } = kafka;

// Configuration options
const kafkaHost = process.env.KAFKA_HOST || 'localhost:9092'; // Default to localhost if not specified

// Create a Kafka client
const client = new KafkaClient({ kafkaHost });

// Create a Producer instance
const producer = new Producer(client);

producer.on('ready', () => {
    console.log('Kafka Producer is connected and ready.');
});

producer.on('error', (error) => {
    console.error('Producer encountered an error:', error);
});

/**
 * Send a message to a Kafka topic
 * @param {String} topic - The topic to send the message to
 * @param {Object} message - The message to send
 */
function sendMessage(topic, message) {
    const payloads = [
        {
            topic: topic,
            messages: JSON.stringify(message)
        }
    ];

    producer.send(payloads, (error, data) => {
        if (error) {
            console.error('Failed to send message:', error);
            return;
        }
        console.log('Message sent:', data);
    });
}


module.exports = {
    sendMessage
};

import { Kafka } from 'kafkajs'
import { uuid } from 'uuidv4'

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const TOPIC_NAME = 'my-topic'

const kafka = new Kafka({
  brokers: ['localhost:9092'],
  clientId: 'my-first-app'
})

const producer = kafka.producer()
const consumer = kafka.consumer({ groupId: 'my-consumer' })

async function createTopics() {
  const adm = kafka.admin()

  console.log('Connecting admin to kafka')
  await adm.connect()

  const currentTopics = await adm.listTopics()

  if (!currentTopics.includes(TOPIC_NAME)) {
    console.log(`Creating topic ${TOPIC_NAME}`)
    await adm.createTopics({
      topics: [{
        topic: TOPIC_NAME,
        replicationFactor: 1,
        numPartitions: 1
      }]
    })
  } else {
    console.log(`Topic ${TOPIC_NAME} already exists`)
  }

  console.log('Disconnecting admin')
  await adm.disconnect()
}

async function produceMessage() {
  console.log('Connecting producer')
  await producer.connect()

  producer.send({
    messages: [{ key: uuid(), value: 'My message from app' }],
    topic: TOPIC_NAME
  })

  await producer.disconnect()
}

async function receiveMessages() {
  await consumer.connect()

  await consumer.subscribe({ topic: TOPIC_NAME, fromBeginning: true })

  await consumer.run({
    autoCommit: true,
    eachMessage: async ({ message, topic }) => {
      console.log(`Message received from topic ${topic}`)
      console.log(`(${message.offset})key: ${message.key} value: ${message.value}`)
    }
  })
}

async function run() {
  await createTopics()
  await produceMessage()
  await receiveMessages()
}

run()

const errorTypes = ['unhandledRejection', 'uncaughtException']
const signalTraps = ['SIGTERM', 'SIGINT', 'SIGUSR2']

errorTypes.map(type => {
  process.on(type, async e => {
    try {
      console.log(`process.on ${type}`)
      console.error(e)
      await consumer.disconnect()
      process.exit(0)
    } catch (_) {
      process.exit(1)
    }
  })
})

signalTraps.map(type => {
  process.once(type, async () => {
    try {
      await consumer.disconnect()
    } finally {
      process.kill(process.pid, type)
    }
  })
})

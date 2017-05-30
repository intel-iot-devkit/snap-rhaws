#!/usr/bin/env node

//////////////////////////////////////////////////////////////
// Periodically read RH-USB temperature & humidity sensor   //
// connected to /dev/ttyUSB0 and publish data to AWS IoT.   //
//////////////////////////////////////////////////////////////
 
var topic  = 'nuc/temperature';         // topic to publish on
var period = 3000;                      // how often to publish (ms)
var keyDir = '/home/ubuntu/aws-iot/';   // directory containing AWS IoT key files
var rhusb_dev = '/dev/ttyUSB0';         // serial device where RH-USB is connected
 
// NPM packages

var awsIot = require('aws-iot-device-sdk');
var serialport = require('serialport');

// Global variables

var device;

console.log("Node.js version: " + process.version);
console.log("Period: %d ms", period);

// Initialize serial port and set handlers

console.log("Opening RH-USB serial port " + rhusb_dev);

var port = new serialport(rhusb_dev, {
  baudRate: 9600,
  parser: serialport.parsers.readline('\n')
}, function(err) {
  if (err) {
    console.log("ERROR: Could not open " + rhusb_dev);
    process.exit(1);
  } else {
    // Serial port opened successfully, connect to AWS IoT
    connectAWSIoT();
  }
});

port.on('open', function() {
  console.log("Serial port opened");
});

port.on('error', function(err) {
  console.log("Serial port error: ", err.message);
});

// Handler for incoming data from RH-USB

port.on('data', function(data) {
  processReading(data);
});

// Process one set of sensor readings

function processReading(data) {
  var timenow = new Date();                    // current time
  var trimmed = data.trim().replace(/>/g,'');  // remove unwanted chars
  console.log("RH-USB: %s", trimmed);
  var fields = trimmed.split(',');
  var temp = fields[1];
  var humid = fields[0];
  setTimeout(readRHUSB, period);               // schedule next reading
  publish({                                    // publish sensor reading
    time: timenow.toISOString(),
    temperature: temp,
    humidity: humid
  });
}

// Send command to read temperature & humidity

function readRHUSB() {
  port.write("PA\r\n");
}

// Connect to AWS IoT

function connectAWSIoT() {
  console.log("Creating device object");
  try {
    device = awsIot.device({
      keyPath:  keyDir + "mynuc-private.pem.key",
      certPath: keyDir + "mynuc-certificate.pem.crt",
      caPath:   keyDir + "rootca.pem",
      clientId: "nuc-awspub",
      region:   "us-east-1"
    });
  } catch (err) {
    console.log("ERROR: Unable to load key files, err: ", err);
    process.exit(1);
  }
 
  console.log("Connecting to AWS IoT");
 
  // Event handlers

  device.on('connect', function() {
    console.log('Connected to AWS IoT');
    readRHUSB();
  });
 
  device.on('close', function() {
    console.log("AWS IoT connection closed");
  });
}
 
// Publish message to AWS IoT

function publish(payload) {
  var payloadStr = JSON.stringify(payload);
  console.log("Publish %s: %s", topic, payloadStr);
  device.publish(topic, payloadStr);
}

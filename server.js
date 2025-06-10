const express = require('express');
const bodyParser = require('body-parser');
const net = require('net');
const path = require('path');

const app = express();
const HTTP_PORT = 3000;
const TCP_HOST = 'localhost';
const TIME_OUT = 10000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/send', (req, res) => {
    const { header, message, port, host } = req.body;

    if (!message || !port) {
        return res.status(400).send({ status: 'error', error: 'Message and port are required.' });
    }

    const client = new net.Socket();
    let responseSent = false;               //@timeout
    let tcpResponse = '';
    let preTcpResponse = '';

    client.setTimeout(TIME_OUT);
    client.connect(port, host, () => {
        console.log(`Connected to TCP server on port ${port}`);
        client.write(header + message);
//@timeout disable client.end() due to client.setTimeout        client.end();

    });

    client.on('data', (data) => {
        preTcpResponse += data.toString().trim();

        tcpResponse = header===""? preTcpResponse: preTcpResponse.slice(45);

        if ( tcpResponse === "<EFTAcknowledgement><AcknowledgementType>0003</AcknowledgementType></EFTAcknowledgement>")
        {
            console.log("XML ACK Received");
        }
        else {
            console.log("XML Message Received");
            if (!responseSent) {
                responseSent = true;
                res.status(200).send({ status: 'sent', response: tcpResponse });
                client.end(); // Gracefully close the connection
            }
        }
    });

    client.on('end', () => {
        console.log('TCP server ended connection');
        if (!responseSent)                              
        {
            res.status(200).send({ status: 'sent', response: tcpResponse });
            responseSent = true;                        
        }
    });

    client.on('error', (err) => {
        console.error('TCP connection error:', err.message);
        if (!responseSent)                              //@timeout
        {
            res.status(500).send({ status: 'error', error: err.message });
            responseSent = true;                        //@timeout
        }
    });

    // Handle socket timeout (no data received for 30 seconds)
    client.on('timeout', () => {                                            //@timeout
        console.error(`Socket timed out ${TIME_OUT} seconds`);                 //@timeout
        if (!responseSent) {                                                //@timeout
            client.destroy(); // Force close the socket                     //@timeout
            res.status(504).send({ status: 'error', error: `TCP server response timed out after ${TIME_OUT} seconds` }); //@timeout
            responseSent = true;                                                //@timeout
        }
    });
});

app.listen(HTTP_PORT, () => {
  console.log(`HTTP server running at http://localhost:${HTTP_PORT}`);
});

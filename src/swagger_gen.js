const swaggerAutogen = require("swagger-autogen")();

const doc = {
    info: {
        title: 'TuneMate: Backend API',
        description: 'Social Network for Music',
    },
    host: 'localhost:8080',
    schemes: ['http'],
};

const outputFile = 'swagger-output.json';
const endpointsFiles = ['index.js'];

swaggerAutogen(outputFile, endpointsFiles, doc);

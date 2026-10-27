const app = require('./app');


const PORT = process.env.PORT || 3001;




const server = app.listen(PORT, () => {
  console.log(`Server is running and listening on http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the other process or set a different PORT.`);
  } else {
    console.error('Server failed to start:', err);
  }
  process.exit(1);
});
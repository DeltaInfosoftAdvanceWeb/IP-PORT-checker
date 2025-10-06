module.exports = {
    apps: [{
      name: "Grundfos",
      script: "server.js",
      env: {
        NODE_ENV: "production",
        PORT: 5000
      }
    }]
  };
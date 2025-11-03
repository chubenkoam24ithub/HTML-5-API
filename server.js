const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3000;

http.createServer((request, response) => {
    let filePath = "." + request.url;
    
    const extname = path.extname(filePath);
    if (!extname || extname === ".html") {
        filePath = "./index.html";
    }

    let contentType = "text/html; charset=utf-8";
    switch (extname) {
        case ".css": contentType = "text/css; charset=utf-8"; break;
        case ".js": contentType = "text/javascript; charset=utf-8"; break;
        case ".json": contentType = "application/json"; break;
        case ".webmanifest": contentType = "application/manifest+json"; break;
        case ".png": contentType = "image/png"; break;
    }

    fs.readFile(filePath, (error, data) => {
        if (error) {
            response.statusCode = 404;
            response.end("<h1>404: Файл не найден!</h1>");
        } else {
            response.setHeader("Content-Type", contentType);
            response.end(data);
        }
    });
}).listen(PORT, () => console.log(`Сервер запущен: http://localhost:${PORT}`));
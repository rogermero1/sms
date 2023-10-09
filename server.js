const express = require("express");
const cors = require("cors");
const multer = require("multer");
const XLSX = require("xlsx");
const db = require("./database/database");
const mysql = require("mysql2/promise");
const { Client } = require("whatsapp-web.js");
const qrcode = require("qrcode");
const qrcodeT = require("qrcode-terminal");
const { createCanvas } = require("canvas");
const path = require("path");
const app = express();
/* const bodyParser = require("body-parser"); */
/* Cors */
let isLoggedIn = false;
/*  */
/* Sockets */
const http = require('http');
const socketIo = require('socket.io');
const server = http.createServer(app);
/* const io = socketIo(server); */

const io = socketIo(server, {
  cors: {
      origin: "*", // En producción, especifica tu dominio en lugar de "*"
      methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log('Usuario Revisando QR');

  socket.on('disconnect', () => {
      console.log('Usuario Finalizo vista QR');
  });
});
const chokidar = require('chokidar');

const watcher = chokidar.watch(__dirname + "/qr.png", {
    persistent: true
});

watcher.on('change', (path, stats) => {
    console.log(`Imagen cambiada: ${path}`);
    io.emit('imageChanged'); // Informar a todos los clientes que la imagen ha cambiado
});
/*  */
/* Integrando Whatsapp */
const fs = require("fs");
/* const SESSION_FILE_PATH = "./whatsapp-session.json";
let sessionData;

if (fs.existsSync(SESSION_FILE_PATH)) {
  sessionData = require(SESSION_FILE_PATH);
}

const client = new Client({
  session: sessionData,
}); */

/* app.use(bodyParser.json()); */
 const client = new Client();

client.on("qr", (qr) => {
  if (!isLoggedIn) {
    console.log("Nueva autenticación requerida, generando QR...");

    // Aquí es donde generas y guardas el código QR como lo hacías anteriormente
    const canvas = createCanvas(200, 200);
    qrcode.toCanvas(canvas, qr, function (error) {
      if (error) console.error(error);

      const filePath = path.join(__dirname, "qr.png");
      const out = fs.createWriteStream(filePath);
      const stream = canvas.createPNGStream();

      // Manejar posibles errores al escribir y leer del stream
      out.on("error", (err) => {
        console.error("Error escribiendo el archivo:", err);
      });
      stream.on("error", (err) => {
        console.error("Error con el stream:", err);
      });
      stream.pipe(out);
      out.on("finish", () => {
        console.log("Archivo guardado en:", filePath);
      });
    });
  }
});
/* client.on("authenticated", (session) => {
  console.log("Autenticado exitosamente!");
  sessionData = session;
  fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), (err) => {
    if (err) console.error(err);
  });
}); */
client.on("ready", () => {
  console.log("Cliente Listo!");
  isLoggedIn = true;
});
client.on("disconnected", (reason) => {
  console.log("Cliente Desconectado, Razón:", reason);
  isLoggedIn = false;

  // Si la desconexión no es intencionada (no fue un logout), intentar volver a inicializar el cliente
  if (reason !== 'intentional') {
    client.initialize();
  }
});

client.on("message", (message) => {
  if (message.body === "Ping") {
    client.sendMessage(message.from, "Pong");
  }
});

client.initialize();

/*  */

const upload = multer({ dest: "uploads/" });
/* const app = express(); */

app.use(cors());
app.use(express.json());

app.get("/get-qr", (req, res) => {
  res.sendFile(__dirname + "/qr.png");
});
/*  */

/* End Point Wahtsapp */
app.post("/send-whatsapp", (req, res) => {
  const { numbers, message } = req.body;

  if (!numbers || numbers.length === 0 || !message) {
      return res.status(400).send({ success: false, message: "Número o mensaje faltante." });
  }

  const sendPromises = numbers.map(number => {
      return client.sendMessage(number + "@c.us", message);
  });

  Promise.all(sendPromises)
      .then(results => {
          res.status(200).send({ success: true, results });
      })
      .catch(err => {
          res.status(500).send({ success: false, err });
      });
});

app.get("/logout", (req, res) => {
  client.logout()
      .then(() => {
          console.log("Sesión cerrada con éxito.");
          res.status(200).send({ success: true, message: "Sesión cerrada con éxito." });
      })
      .catch(err => {
          console.error("Error cerrando sesión:", err);
          res.status(500).send({ success: false, message: "Error cerrando sesión." });
      });
});
/*  */

app.get("/usuarios", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM usuarios");
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    console.log(req.file); // Verifica que el archivo se haya subido correctamente
    const workbook = XLSX.readFile(req.file.path);
    const sheetNames = workbook.SheetNames;
    const sheet = workbook.Sheets[sheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    // Preparar la consulta SQL
    const sql = `
    INSERT INTO stencil 
    (ZONA, SECCION, EQUIPO, CODIGO, APELLIDO, NOMBRE, DIRECCION, CIUDAD, 
     TELEFON1, TELEFON2, TELEFON3, ANO, CAMPANA, REISPU, SALDO, ESTADO, 
     TOTAL, SEGMEN, LOA, ESTREL, FECFAC, Programa_actividad_C13_2017) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
`;
    // Insertar cada fila en la base de datos
    console.log(data[0]);

    for (let row of data) {
      const values = [
        row.ZONA,
        row.SECCION,
        row.EQUIPO,
        row.CODIGO,
        row.APELLIDO,
        row.NOMBRE,
        row.DIRECCION,
        row.CIUDAD,
        row.TELEFON1,
        row.TELEFON2,
        row.TELEFON3,
        row.ANO,
        row.CAMPANA,
        row.REISPU,
        row.SALDO,
        row.ESTADO,
        row.TOTAL,
        row.SEGMEN,
        row.LOA,
        row.ESTREL,
        row.FECFAC,
        row.Programa_actividad_C13_2017,
      ].map((value) => (value === undefined ? null : value)); // Convertir 'undefined' a 'null'
      console.log(row);
      await db.execute(sql, values);
    }
    // Elimina el archivo después de procesarlo
    fs.unlinkSync(req.file.path);
    res.status(200).send({ message: "Data uploaded successfully" });
  } catch (error) {
    // Si hay un error, aún queremos eliminar el archivo, así que lo ponemos aquí también
    if (req.file && req.file.path) {
      fs.unlinkSync(req.file.path);
    }
    res
      .status(500)
      .send({ error: error.message, message: "Error uploading data ssdsddas" });
  }
});

app.post("/uploadcorreteo", upload.single("file"), async (req, res) => {
  try {
    console.log(req.file); // Verifica que el archivo se haya subido correctamente
    const workbook = XLSX.readFile(req.file.path);
    const sheetNames = workbook.SheetNames;
    const sheet = workbook.Sheets[sheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    // Preparar la consulta SQL
    const sql = `
    INSERT INTO correteo 
    (ZONA, SECCION, EQUIPO, CODIGO, APELLIDO, NOMBRE, DIRECCION, 
     TELEFON1, TELEFON2, TELEFON3,DEUDA_TOT,CANAL_ING,STA_ANTER,STA_ACTUA,MOTIVO_R,FEC_FACT,PAQUETE,ESTRELLAS) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
`;
    // Insertar cada fila en la base de datos
    console.log(data[0]);

    for (let row of data) {
      const values = [
        row.ZONA,
        row.SECCION,
        row.EQUIPO,
        row.CODIGO,
        row.APELLIDO,
        row.NOMBRE,
        row.DIRECCION,
        row.TELEFON1,
        row.TELEFON2,
        row.TELEFON3,
        row.DEUDA_TOT,
        row.CANAL_ING,
        row.STA_ANTER,
        row.STA_ACTUA,
        row.MOTIVO_R,
        row.FEC_FACT,
        row.PAQUETE,
        row.ESTRELLAS,
      ].map((value) => (value === undefined ? null : value)); // Convertir 'undefined' a 'null'
      console.log(row);
      await db.execute(sql, values);
    }
    // Elimina el archivo después de procesarlo
    fs.unlinkSync(req.file.path);
    res.status(200).send({ message: "Data uploaded successfully" });
  } catch (error) {
    // Si hay un error, aún queremos eliminar el archivo, así que lo ponemos aquí también
    if (req.file && req.file.path) {
      fs.unlinkSync(req.file.path);
    }
    res
      .status(500)
      .send({ error: error.message, message: "Error uploading data ssdsddas" });
  }
});

app.get("/corroteo", async (req, res) => {
  try {
    const [rows] = await db.execute("SELECT * FROM correteo");
    res.json(rows);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

app.get("/limpiar-coroteo", async (req, res) => {
  try {
    const [rows] = await db.execute("TRUNCATE TABLE correteo");
    res.json(rows);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

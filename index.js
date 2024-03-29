import express from "express";
import bcrypt from "bcryptjs";
import cors from "cors";
import mongoose from "mongoose";
import multer from "multer";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import Imagen from "./imagenModel.js";
import Mensaje from "./mensajeModel.js";

const app = express();

const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: "pedaleaproinfo@gmail.com",
    pass: "gcvc zuud hykv nrfp",
  },
});
app.use(express.static("public"));
app.use(express.json());
app.use(
  cors({
    origin: "*",
  })
);

mongoose.connect(
  // "mongodb+srv://cacerescleber:Wc4rZXDkdVlwEB18@cluster0.eiy3izw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0",
  "mongodb://localhost:27017/usuarios",
  {
    //   useNewUrlParser: true,
    //   useUnifiedTopology: true
  }
);


const userSchema = new mongoose.Schema({
  fullName: String,
  username: {
    type: String,
    required: true,
    minLength: 7,
    trim: true,
    validate: {
      validator: function (value) {
        return !/\s/.test(value);
      },
      message: "El nombre de usuario no puede contener espacios",
    },
  },
  email: {
    type: String,
    required: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  club: String,
  avatarUrl: String,
  passwordResetToken: String,
  passwordResetExpires: Date,
  solicitudesRecibidas: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  solicitudesEnviadas: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  mensajesEnviados: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Mensaje",
    },
  ],
  mensajesRecibidos: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Mensaje",
    },
  ],
});

const User = mongoose.model("User", userSchema);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000);
}

app.post("/api/enviar-mensaje", async (req, res) => {
  console.log("Enviar mensaje", req.body);
  const { remitenteId, destinatarioId, contenido } = req.body;

  try {
    const nuevoMensaje = new Mensaje({
      remitente: remitenteId,
      destinatario: destinatarioId,
      contenido,
    });

    await nuevoMensaje.save();

    // Actualizar los mensajesEnviados del remitente
    await User.findByIdAndUpdate(remitenteId, {
      $push: { mensajesEnviados: nuevoMensaje._id },
    });

    // Actualizar los mensajesRecibidos del destinatario
    await User.findByIdAndUpdate(destinatarioId, {
      $push: { mensajesRecibidos: nuevoMensaje._id },
    });

    res
      .status(201)
      .json({ message: "Mensaje enviado exitosamente", mensaje: nuevoMensaje });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error del servidor al enviar el mensaje" });
  }
});

app.get("/api/mensajes-enviados", async (req, res) => {
  try {
    const userId = req.user._id;

    const mensajesEnviados = await Mensaje.find({ remitente: userId });

    res.status(200).json(mensajesEnviados);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error del servidor al obtener mensajes enviados" });
  }
});

// Ruta para obtener mensajes enviados por un usuario
app.get("/api/mensajes-enviados/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const usuario = await User.findById(userId).populate("mensajesEnviados");
    res.status(200).json(usuario.mensajesEnviados);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error del servidor al obtener mensajes enviados" });
  }
});

// Ruta para obtener mensajes recibidos por un usuario
app.get("/api/mensajes-recibidos/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const usuario = await User.findById(userId).populate("mensajesRecibidos");
    res.status(200).json(usuario.mensajesRecibidos);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error del servidor al obtener mensajes recibidos" });
  }
});

app.use("/upload", express.static(path.join(__dirname, "upload")));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "upload/");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage });

app.post("/api/imagenes", upload.single("imagen"), async (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .json({ error: "No se ha proporcionado ninguna imagen." });
  }

  const userId = req.body.userId;

  try {
    const nuevaImagen = new Imagen({
      nombre: req.file.originalname,
      ruta: req.file.path,
      usuario: userId,
    });
    await nuevaImagen.save();

    const imageUrl = `http://localhost:3001/${req.file.path}`;

    const user = await User.findById(userId);
    if (user) {
      user.avatarUrl = imageUrl;
      await user.save();
    }

    return res
      .status(200)
      .json({ message: "Imagen subida exitosamente.", url: imageUrl });
  } catch (error) {
    console.error("Error al guardar la imagen en la base de datos:", error);
    return res
      .status(500)
      .json({ error: "Error del servidor al guardar la imagen." });
  }
});

app.post("/api/register", async (req, res) => {
  try {
    console.log(req.body);
    const { fullName, username, email, password, confirmPassword, club } =
      req.body;

    if (
      !fullName ||
      !username ||
      !email ||
      !password ||
      !confirmPassword ||
      !club
    ) {
      return res
        .status(400)
        .json({ message: "Por favor, complete todos los campos" });
    }

    if (/\s/.test(username)) {
      return res
        .status(400)
        .json({ message: "El nombre de usuario no puede contener espacios" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Las contraseñas no coinciden" });
    }

    const existingUser = await User.findOne({ email: email });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "El correo electrónico ya está en uso" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      fullName,
      username,
      email,
      password: hashedPassword,
      club,
    });
    console.log("datos enviados por el frontend al registrar", newUser);

    await newUser.save();

    const mailOptions = {
      from: "pedaleaproinfo@gmail.com",
      to: newUser.email,
      subject: "Registro exitoso",
      html: `
         <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f0f2f5;">
           <h1 style="color: #333; text-align: center;">¡Bienvenido a nuestra plataforma!</h1>
           <p style="color: #333; text-align: center;">Tu registro ha sido exitoso. Ahora puedes iniciar sesión con tu correo electrónico y contraseña.</p>
         </div>
       `,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log(error);
        return res.status(500).json({
          message: "Error al enviar el correo electrónico de confirmación",
        });
      } else {
        console.log("Email de confirmación enviado: " + info.response);
      }
    });

    res.status(201).json({ message: "Usuario registrado exitosamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error del servidor" });
  }
});

app.post("/api/login", async (req, res) => {
  console.log("login", req.body);
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Por favor, complete todos los campos" });
    }

    const user = await User.findOne({ email: email }).populate(
      "solicitudesRecibidas"
    );
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: "Credenciales incorrectas" });
    }

    const userResponse = {
      _id: user._id,
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      club: user.club,
      avatarUrl: user.avatarUrl,
      passwordResetToken: user.passwordResetToken,
      passwordResetExpires: user.passwordResetExpires,
      solicitudesRecibidas: user.solicitudesRecibidas,
      friends: user.friends,
    };

    res
      .status(200)
      .json({ message: "Inicio de sesión exitoso", user: userResponse });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error del servidor" });
  }
});

app.post("/api/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    console.log("Datos recibidos del frontend:", req.body);

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const otp = generateOTP();
    user.passwordResetToken = otp;
    user.passwordResetExpires = Date.now() + 3 * 60 * 1000;
    await user.save();

    const mailOptions = {
      from: "pedaleaproinfo@gmail.com",
      to: user.email,
      subject: "Restablecimiento de contraseña",
      html: `
         <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f0f2f5;">
           <h1 style="color: #333; text-align: center;">Restablecimiento de contraseña</h1>
           <p style="color: #333; text-align: center;">Tu código OTP es: <strong>${otp}</strong></p>
           <p style="color: #333; text-align: center;">Por favor, ingresa este código en la aplicación para restablecer tu contraseña.</p>
           <p style="color: #333; text-align: center;">Si no solicitaste este restablecimiento, por favor ignora este mensaje.</p>
         </div>
       `,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log(error);
        return res
          .status(500)
          .json({ message: "Error al enviar el correo electrónico" });
      } else {
        console.log("Email enviado: " + info.response);
        return res.status(200).json({
          message: "Correo electrónico de recuperación enviado exitosamente",
        });
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error del servidor" });
  }
});

app.post("/api/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword, confirmPassword } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    if (user.passwordResetToken !== otp) {
      return res
        .status(400)
        .json({ message: "El código OTP proporcionado es incorrecto." });
    }

    if (Date.now() > user.passwordResetExpires) {
      return res.status(400).json({
        message:
          "El código OTP ha expirado. Por favor, solicita un nuevo código.",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Las contraseñas no coinciden." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save();

    res.status(200).json({ message: "Contraseña restablecida exitosamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error del servidor" });
  }
});

app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find({});
    console.log(users);
    res.status(200).json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener los usuarios" });
  }
});

app.get("/api/search-users", async (req, res) => {
  try {
    const { username } = req.query;

    console.log(`Nombre de usuario recibido desde el frontend: ${username}`);

    if (!username) {
      return res.status(400).json({
        message: "Por favor, proporciona un nombre de usuario para buscar.",
      });
    }

    console.log(`Buscando usuarios con el nombre de usuario: ${username}`);

    const users = await User.find({
      username: { $regex: username, $options: "i" },
    });

    console.log(users);
    res.status(200).json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error del servidor al buscar usuarios." });
  }
});

// Enviar solicitud de amistad
app.post("/api/send-friend-request", async (req, res) => {
  console.log("datos enviados por el frontend enviar solicitud", req.body);
  try {
    const { userId, friendId } = req.body;

    const sender = await User.findById(userId);
    const receiver = await User.findById(friendId);

    if (!sender || !receiver) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }
    // Verifica si ya son amigos
    if (sender.friends.includes(receiver._id)) {
      return res.status(400).json({ message: "Ya son amigos" });
    }
    // Verifica si ya se envió una solicitud de amistad
    if (sender.solicitudesEnviadas.includes(receiver._id)) {
      return res.status(400).json({
        message: "Ya se envió una solicitud de amistad a este usuario",
      });
    }
    sender.solicitudesEnviadas.push(receiver._id);
    await sender.save();
    receiver.solicitudesRecibidas.push(sender._id);
    await receiver.save();
    res
      .status(200)
      .json({ message: "Solicitud de amistad enviada correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error del servidor" });
  }
});

// Aceptar solicitud de amistad
app.post("/api/accept-friend-request", async (req, res) => {
  try {
    const { userId, friendId } = req.body;

    console.log(`userId: ${userId}, friendId: ${friendId}`);

    const user = await User.findById(userId);
    const friend = await User.findById(friendId);

    if (!user || !friend) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    if (!user.friendRequests.includes(friend._id)) {
      return res.status(400).json({
        message: "No hay solicitud de amistad pendiente de este usuario",
      });
    }

    user.friendRequests = user.friendRequests.filter(
      (request) => request.toString() !== friend._id.toString()
    );
    user.friends?.push(friend._id);
    friend.friends?.push(user._id);

    await user.save();
    await friend.save();

    res
      .status(200)
      .json({ message: "Solicitud de amistad aceptada correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error del servidor" });
  }
});

// Rechazar solicitud de amistad
app.post("/api/reject-friend-request", async (req, res) => {
  try {
    const { userId, friendId } = req.body;

    console.log(`userId: ${userId}, friendId: ${friendId}`);

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    user.friendRequests = user.friendRequests.filter(
      (request) => request.toString() !== friendId.toString()
    );
    await user.save();

    res
      .status(200)
      .json({ message: "Solicitud de amistad rechazada correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error del servidor" });
  }
});

// Obtener la información de todos los usuarios
app.get("/api/users/data", async (req, res) => {
  try {
    const users = await User.find({});
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener la información de los usuarios.",
      error,
    });
  }
});

// Obtener el perfil del usuario actual
app.get("/api/profile", async (req, res) => {
  console.log("perfil", req.body);
  try {
    const userId = req.user._id;
    const user = await User.findById(userId)
      .populate("solicitudesRecibidas")
      .populate("friends");
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado." });
    }

    res.status(200).json(user);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error al obtener el perfil del usuario.", error });
  }
});

// Obtener la información de todos los usuarios
app.get("/api/users/data", async (req, res) => {
  try {
    const users = await User.find({});
    const usersWithAvatarUrl = users.map((user) => ({
      ...user._doc,
      avatarUrl: user.avatarUrl,
    }));
    res.status(200).json(usersWithAvatarUrl);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener la información de los usuarios.",
      error,
    });
  }
});

app.listen(5000, () => {
  console.log("Servidor corriendo en el puerto 5000");
});
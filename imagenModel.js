import mongoose from "mongoose";

const imagenSchema = new mongoose.Schema({
  nombre: String,
  ruta: String,
});

const Imagen = mongoose.model("Imagen", imagenSchema);

export default Imagen;
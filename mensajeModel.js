
import mongoose from 'mongoose';

const mensajeSchema = new mongoose.Schema({
 remitente: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
 },
 destinatario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
 },
 contenido: {
    type: String,
    required: true,
 },
 fecha: {
    type: Date,
    default: Date.now,
 },
});

const Mensaje = mongoose.model('Mensaje', mensajeSchema);

export default Mensaje;
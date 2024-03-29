import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
 mensajesEnviados: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mensaje',
 }],
 mensajesRecibidos: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mensaje',
 }],
});

const User = mongoose.model('User', userSchema);

export default User;
export interface Registration {
  nombreCompleto: string;
  usuario: string;
  correo: string;
  confirmacionCorreo: string;
  contrasena: string;
  confirmacionContrasena: string;
  telefono: string;
  planInteres: string | null;
  avisoVersion: string;
  aceptaAviso: boolean;
}

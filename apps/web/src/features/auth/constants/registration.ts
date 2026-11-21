export const NOTICE_VERSION = '2026-10-15.1';
export const REGISTRATION_NOTICE =
  'Al crear tu cuenta, guardamos tus datos de registro para identificarte y gestionar tu acceso a CouchOne Fit. Elegir un plan expresa tu interés y no activa una suscripción ni genera un cargo. Puedes completar tu perfil más adelante.';

export const PRIVACY_SECTIONS: readonly { title: string; body: string }[] = [
  {
    title: '1. Responsable y alcance del sistema',
    body: 'CouchOne Fit es un proyecto demostrativo y académico de plataforma SaaS para profesionales de entrenamiento y nutrición. Antes de operar comercialmente con datos reales de terceros se requiere completar razón social, domicilio y buzón de contacto oficial; este aviso no atribuye certificación jurídica ni médica.',
  },
  {
    title: '2. Datos tratados y finalidades',
    body: 'Tratamos datos de identificación y acceso (nombre completo, usuario, correo, teléfono opcional y contraseña cifrada con Argon2id), cartera y expediente físico/antropométrico, prescripción de alimentación y entrenamiento, y seguimiento diario (peso corporal, sueño, estrés, energía, hambre y ejecución por serie).',
  },
  {
    title: '3. Visibilidad y propiedad de los registros',
    body: 'El profesional administra su cartera de clientes. El cliente siempre consulta lo que él mismo registra (sesiones, check-ins y peso diario), mientras que las evaluaciones antropométricas y la adherencia son privadas por defecto y solo se muestran si el profesional las habilita.',
  },
  {
    title: '4. Uso sin conexión y seguridad local',
    body: 'La PWA profesional y la app móvil del cliente guardan copias locales cifradas por cuenta con caducidad de 30 días para funcionar sin conexión. Al cerrar sesión o cambiar de cuenta se eliminan las lecturas en caché; los cambios pendientes de enviar se conservan cifrados hasta sincronizarse, caducar o descartarse de forma explícita. Nunca se guardan contraseñas, tokens ni códigos de invitación o recuperación en claro.',
  },
  {
    title: '5. Suscripción y pagos simulados',
    body: 'Crear una cuenta o indicar interés en un plan (Básico 299 MXN, Pro 599 MXN o Élite 999 MXN) no realiza cobros ni activa suscripciones. La contratación en esta entrega usa un checkout simulado sin pasarela bancaria real.',
  },
  {
    title: '6. Conservación, baja lógica y derechos',
    body: 'Las bajas de cuenta e inactivaciones de expediente son lógicas para preservar la integridad del historial. La persona usuaria puede solicitar corrección, revocación de visibilidad o baja de su cuenta a través de su profesional o del soporte administrativo. Confirmar esta información no implica renuncia de derechos.',
  },
];

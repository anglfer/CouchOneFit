-- ============================================================
-- COUCHONE FIT
-- ESQUEMA FINAL DE BASE DE DATOS
-- PostgreSQL / Supabase
-- ============================================================


-- ============================================================
-- 1. ELIMINAR ESTRUCTURA ANTERIOR
-- ============================================================

DROP TABLE IF EXISTS public.bitacora_auditoria CASCADE;
DROP TABLE IF EXISTS public.fotos_progreso CASCADE;
DROP TABLE IF EXISTS public.checkins_diarios CASCADE;
DROP TABLE IF EXISTS public.registros_series CASCADE;
DROP TABLE IF EXISTS public.sesiones_entrenamiento CASCADE;
DROP TABLE IF EXISTS public.ejercicios_rutina CASCADE;
DROP TABLE IF EXISTS public.dias_entrenamiento CASCADE;
DROP TABLE IF EXISTS public.rutinas_entrenamiento CASCADE;
DROP TABLE IF EXISTS public.alimentos_comida CASCADE;
DROP TABLE IF EXISTS public.comidas_plan CASCADE;
DROP TABLE IF EXISTS public.planes_alimentacion CASCADE;
DROP TABLE IF EXISTS public.evaluaciones_antropometricas CASCADE;
DROP TABLE IF EXISTS public.codigos_activacion CASCADE;
DROP TABLE IF EXISTS public.clientes CASCADE;
DROP TABLE IF EXISTS public.profesionales CASCADE;
DROP TABLE IF EXISTS public.planes_suscripcion CASCADE;
DROP TABLE IF EXISTS public.usuarios CASCADE;


-- ============================================================
-- 2. ELIMINAR TIPOS ANTERIORES
-- ============================================================

DROP TYPE IF EXISTS public.rol_usuario CASCADE;
DROP TYPE IF EXISTS public.estado_suscripcion CASCADE;
DROP TYPE IF EXISTS public.estado_plan CASCADE;
DROP TYPE IF EXISTS public.nivel_adherencia CASCADE;


-- ============================================================
-- 3. TIPOS ENUMERADOS
-- ============================================================

CREATE TYPE public.rol_usuario AS ENUM (
    'administrador',
    'profesional',
    'cliente'
);

CREATE TYPE public.estado_suscripcion AS ENUM (
    'activa',
    'suspendida',
    'cancelada'
);

CREATE TYPE public.estado_plan AS ENUM (
    'borrador',
    'activo',
    'inactivo'
);

CREATE TYPE public.nivel_adherencia AS ENUM (
    'no_realizada',
    'parcial',
    'completa'
);


-- ============================================================
-- 4. USUARIOS
-- ============================================================

CREATE TABLE public.usuarios (
    id uuid NOT NULL,

    rol public.rol_usuario NOT NULL,

    nombre_usuario text NOT NULL,

    activo boolean NOT NULL DEFAULT true,

    creado_en timestamp with time zone NOT NULL DEFAULT now(),

    CONSTRAINT usuarios_pkey
        PRIMARY KEY (id),

    CONSTRAINT usuarios_id_fkey
        FOREIGN KEY (id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE
);

-- Nombre de usuario unico sin distinguir
-- mayusculas y minusculas.
CREATE UNIQUE INDEX usuarios_nombre_usuario_unico_idx
ON public.usuarios (lower(nombre_usuario));


-- ============================================================
-- 5. PLANES DE SUSCRIPCION
-- ============================================================

CREATE TABLE public.planes_suscripcion (
    id uuid NOT NULL DEFAULT gen_random_uuid(),

    nombre text NOT NULL UNIQUE,

    max_clientes_activos integer NOT NULL,

    activo boolean NOT NULL DEFAULT true,

    creado_en timestamp with time zone NOT NULL DEFAULT now(),

    CONSTRAINT planes_suscripcion_pkey
        PRIMARY KEY (id),

    CONSTRAINT planes_suscripcion_max_clientes_check
        CHECK (max_clientes_activos > 0)
);


-- ============================================================
-- 6. PROFESIONALES
-- ============================================================

CREATE TABLE public.profesionales (
    id uuid NOT NULL DEFAULT gen_random_uuid(),

    usuario_id uuid NOT NULL UNIQUE,

    nombre_completo text NOT NULL,

    plan_id uuid NOT NULL,

    estado_suscripcion public.estado_suscripcion
        NOT NULL DEFAULT 'activa',

    creado_en timestamp with time zone
        NOT NULL DEFAULT now(),

    actualizado_en timestamp with time zone
        NOT NULL DEFAULT now(),

    CONSTRAINT profesionales_pkey
        PRIMARY KEY (id),

    CONSTRAINT profesionales_usuario_id_fkey
        FOREIGN KEY (usuario_id)
        REFERENCES public.usuarios(id)
        ON DELETE CASCADE,

    CONSTRAINT profesionales_plan_id_fkey
        FOREIGN KEY (plan_id)
        REFERENCES public.planes_suscripcion(id)
);


-- ============================================================
-- 7. CLIENTES
-- ============================================================

CREATE TABLE public.clientes (
    id uuid NOT NULL DEFAULT gen_random_uuid(),

    profesional_id uuid NOT NULL,

    usuario_id uuid UNIQUE,

    nombre_completo text NOT NULL,

    fecha_nacimiento date NOT NULL,

    estatura_cm numeric,

    peso_inicial_kg numeric,

    objetivo text,

    compartir_progreso boolean NOT NULL DEFAULT false,

    activo boolean NOT NULL DEFAULT true,

    creado_en timestamp with time zone
        NOT NULL DEFAULT now(),

    actualizado_en timestamp with time zone
        NOT NULL DEFAULT now(),

    CONSTRAINT clientes_pkey
        PRIMARY KEY (id),

    CONSTRAINT clientes_profesional_id_fkey
        FOREIGN KEY (profesional_id)
        REFERENCES public.profesionales(id),

    CONSTRAINT clientes_usuario_id_fkey
        FOREIGN KEY (usuario_id)
        REFERENCES public.usuarios(id)
        ON DELETE SET NULL,

    CONSTRAINT clientes_fecha_nacimiento_check
        CHECK (fecha_nacimiento <= CURRENT_DATE),

    CONSTRAINT clientes_estatura_check
        CHECK (
            estatura_cm IS NULL
            OR estatura_cm > 0
        ),

    CONSTRAINT clientes_peso_inicial_check
        CHECK (
            peso_inicial_kg IS NULL
            OR peso_inicial_kg > 0
        )
);


-- ============================================================
-- 8. CODIGOS DE ACTIVACION
-- ============================================================

CREATE TABLE public.codigos_activacion (
    id uuid NOT NULL DEFAULT gen_random_uuid(),

    cliente_id uuid NOT NULL,

    codigo_hash text NOT NULL UNIQUE,

    expira_en timestamp with time zone NOT NULL,

    usado_en timestamp with time zone,

    creado_en timestamp with time zone
        NOT NULL DEFAULT now(),

    CONSTRAINT codigos_activacion_pkey
        PRIMARY KEY (id),

    CONSTRAINT codigos_activacion_cliente_id_fkey
        FOREIGN KEY (cliente_id)
        REFERENCES public.clientes(id)
        ON DELETE CASCADE,

    CONSTRAINT codigos_activacion_expiracion_check
        CHECK (expira_en > creado_en),

    CONSTRAINT codigos_activacion_uso_check
        CHECK (
            usado_en IS NULL
            OR usado_en >= creado_en
        )
);


-- ============================================================
-- 9. EVALUACIONES ANTROPOMETRICAS
-- ============================================================

CREATE TABLE public.evaluaciones_antropometricas (
    id uuid NOT NULL DEFAULT gen_random_uuid(),

    cliente_id uuid NOT NULL,

    evaluado_en date NOT NULL DEFAULT CURRENT_DATE,

    peso_kg numeric,

    cintura_cm numeric,

    cadera_cm numeric,

    otras_medidas jsonb,

    pliegues_mm jsonb,

    grasa_corporal_pct numeric,

    creado_en timestamp with time zone
        NOT NULL DEFAULT now(),

    CONSTRAINT evaluaciones_antropometricas_pkey
        PRIMARY KEY (id),

    CONSTRAINT evaluaciones_antropometricas_cliente_id_fkey
        FOREIGN KEY (cliente_id)
        REFERENCES public.clientes(id)
        ON DELETE CASCADE,

    CONSTRAINT evaluaciones_peso_check
        CHECK (
            peso_kg IS NULL
            OR peso_kg > 0
        ),

    CONSTRAINT evaluaciones_cintura_check
        CHECK (
            cintura_cm IS NULL
            OR cintura_cm > 0
        ),

    CONSTRAINT evaluaciones_cadera_check
        CHECK (
            cadera_cm IS NULL
            OR cadera_cm > 0
        ),

    CONSTRAINT evaluaciones_grasa_corporal_check
        CHECK (
            grasa_corporal_pct IS NULL
            OR (
                grasa_corporal_pct >= 0
                AND grasa_corporal_pct <= 150
            )
        )
);


-- ============================================================
-- 10. PLANES DE ALIMENTACION
-- ============================================================

CREATE TABLE public.planes_alimentacion (
    id uuid NOT NULL DEFAULT gen_random_uuid(),

    cliente_id uuid NOT NULL,

    -- Todas las versiones del mismo plan
    -- comparten este identificador.
    grupo_version_id uuid NOT NULL
        DEFAULT gen_random_uuid(),

    nombre text NOT NULL,

    numero_version integer NOT NULL,

    estado public.estado_plan
        NOT NULL DEFAULT 'borrador',

    calorias_objetivo integer,

    proteina_g numeric,

    carbohidratos_g numeric,

    grasa_g numeric,

    es_sugerencia_sistema boolean
        NOT NULL DEFAULT false,

    revisado_en timestamp with time zone,

    creado_en timestamp with time zone
        NOT NULL DEFAULT now(),

    actualizado_en timestamp with time zone
        NOT NULL DEFAULT now(),

    CONSTRAINT planes_alimentacion_pkey
        PRIMARY KEY (id),

    CONSTRAINT planes_alimentacion_cliente_id_fkey
        FOREIGN KEY (cliente_id)
        REFERENCES public.clientes(id)
        ON DELETE CASCADE,

    CONSTRAINT planes_alimentacion_version_check
        CHECK (numero_version > 0),

    CONSTRAINT planes_alimentacion_calorias_check
        CHECK (
            calorias_objetivo IS NULL
            OR calorias_objetivo > 0
        ),

    CONSTRAINT planes_alimentacion_proteina_check
        CHECK (
            proteina_g IS NULL
            OR proteina_g >= 0
        ),

    CONSTRAINT planes_alimentacion_carbohidratos_check
        CHECK (
            carbohidratos_g IS NULL
            OR carbohidratos_g >= 0
        ),

    CONSTRAINT planes_alimentacion_grasa_check
        CHECK (
            grasa_g IS NULL
            OR grasa_g >= 0
        ),

    CONSTRAINT planes_alimentacion_version_unica
        UNIQUE (
            grupo_version_id,
            numero_version
        )
);


-- Solo un plan de alimentacion activo por cliente.
CREATE UNIQUE INDEX planes_alimentacion_activo_cliente_idx
ON public.planes_alimentacion (cliente_id)
WHERE estado = 'activo';


-- ============================================================
-- 11. COMIDAS DEL PLAN
-- ============================================================

CREATE TABLE public.comidas_plan (
    id uuid NOT NULL DEFAULT gen_random_uuid(),

    plan_id uuid NOT NULL,

    orden smallint NOT NULL,

    nombre text NOT NULL,

    CONSTRAINT comidas_plan_pkey
        PRIMARY KEY (id),

    CONSTRAINT comidas_plan_plan_id_fkey
        FOREIGN KEY (plan_id)
        REFERENCES public.planes_alimentacion(id)
        ON DELETE CASCADE,

    CONSTRAINT comidas_plan_orden_check
        CHECK (orden > 0),

    CONSTRAINT comidas_plan_orden_unico
        UNIQUE (plan_id, orden)
);


-- ============================================================
-- 12. ALIMENTOS DE COMIDA
-- ============================================================

CREATE TABLE public.alimentos_comida (
    id uuid NOT NULL DEFAULT gen_random_uuid(),

    comida_id uuid NOT NULL,

    orden smallint NOT NULL,

    nombre_alimento text NOT NULL,

    cantidad text,

    instrucciones text,

    CONSTRAINT alimentos_comida_pkey
        PRIMARY KEY (id),

    CONSTRAINT alimentos_comida_comida_id_fkey
        FOREIGN KEY (comida_id)
        REFERENCES public.comidas_plan(id)
        ON DELETE CASCADE,

    CONSTRAINT alimentos_comida_orden_check
        CHECK (orden > 0),

    CONSTRAINT alimentos_comida_orden_unico
        UNIQUE (comida_id, orden)
);


-- ============================================================
-- 13. RUTINAS DE ENTRENAMIENTO
-- ============================================================

CREATE TABLE public.rutinas_entrenamiento (
    id uuid NOT NULL DEFAULT gen_random_uuid(),

    cliente_id uuid NOT NULL,

    grupo_version_id uuid NOT NULL
        DEFAULT gen_random_uuid(),

    nombre text NOT NULL,

    numero_version integer NOT NULL,

    estado public.estado_plan
        NOT NULL DEFAULT 'borrador',

    creado_en timestamp with time zone
        NOT NULL DEFAULT now(),

    actualizado_en timestamp with time zone
        NOT NULL DEFAULT now(),

    CONSTRAINT rutinas_entrenamiento_pkey
        PRIMARY KEY (id),

    CONSTRAINT rutinas_entrenamiento_cliente_id_fkey
        FOREIGN KEY (cliente_id)
        REFERENCES public.clientes(id)
        ON DELETE CASCADE,

    CONSTRAINT rutinas_entrenamiento_version_check
        CHECK (numero_version > 0),

    CONSTRAINT rutinas_entrenamiento_version_unica
        UNIQUE (
            grupo_version_id,
            numero_version
        )
);


-- Solo una rutina activa por cliente.
CREATE UNIQUE INDEX rutinas_entrenamiento_activa_cliente_idx
ON public.rutinas_entrenamiento (cliente_id)
WHERE estado = 'activo';


-- ============================================================
-- 14. DIAS DE ENTRENAMIENTO
-- ============================================================

CREATE TABLE public.dias_entrenamiento (
    id uuid NOT NULL DEFAULT gen_random_uuid(),

    rutina_id uuid NOT NULL,

    dia_semana smallint NOT NULL,

    es_descanso boolean NOT NULL DEFAULT false,

    CONSTRAINT dias_entrenamiento_pkey
        PRIMARY KEY (id),

    CONSTRAINT dias_entrenamiento_rutina_id_fkey
        FOREIGN KEY (rutina_id)
        REFERENCES public.rutinas_entrenamiento(id)
        ON DELETE CASCADE,

    CONSTRAINT dias_entrenamiento_dia_check
        CHECK (
            dia_semana >= 1
            AND dia_semana <= 7
        )
);


-- IMPORTANTE:
-- No existe UNIQUE(rutina_id, dia_semana)
-- porque se aprobo permitir dias repetidos.


-- ============================================================
-- 15. EJERCICIOS DE RUTINA
-- ============================================================

CREATE TABLE public.ejercicios_rutina (
    id uuid NOT NULL DEFAULT gen_random_uuid(),

    dia_id uuid NOT NULL,

    orden smallint NOT NULL,

    nombre_ejercicio text NOT NULL,

    series smallint NOT NULL,

    repeticiones smallint,

    peso_objetivo_kg numeric,

    descanso_segundos integer,

    intensidad text,

    instrucciones text,

    CONSTRAINT ejercicios_rutina_pkey
        PRIMARY KEY (id),

    CONSTRAINT ejercicios_rutina_dia_id_fkey
        FOREIGN KEY (dia_id)
        REFERENCES public.dias_entrenamiento(id)
        ON DELETE CASCADE,

    CONSTRAINT ejercicios_rutina_orden_check
        CHECK (orden > 0),

    CONSTRAINT ejercicios_rutina_orden_unico
        UNIQUE (dia_id, orden),

    CONSTRAINT ejercicios_rutina_series_check
        CHECK (series > 0),

    CONSTRAINT ejercicios_rutina_repeticiones_check
        CHECK (
            repeticiones IS NULL
            OR repeticiones > 0
        ),

    CONSTRAINT ejercicios_rutina_peso_check
        CHECK (
            peso_objetivo_kg IS NULL
            OR peso_objetivo_kg >= 0
        ),

    CONSTRAINT ejercicios_rutina_descanso_check
        CHECK (
            descanso_segundos IS NULL
            OR descanso_segundos >= 0
        )
);


-- ============================================================
-- 16. SESIONES DE ENTRENAMIENTO
-- ============================================================

CREATE TABLE public.sesiones_entrenamiento (
    id uuid NOT NULL DEFAULT gen_random_uuid(),

    cliente_id uuid NOT NULL,

    dia_entrenamiento_id uuid NOT NULL,

    fecha_sesion date NOT NULL DEFAULT CURRENT_DATE,

    cumplimiento public.nivel_adherencia
        NOT NULL DEFAULT 'completa',

    creado_en timestamp with time zone
        NOT NULL DEFAULT now(),

    CONSTRAINT sesiones_entrenamiento_pkey
        PRIMARY KEY (id),

    CONSTRAINT sesiones_entrenamiento_cliente_id_fkey
        FOREIGN KEY (cliente_id)
        REFERENCES public.clientes(id)
        ON DELETE CASCADE,

    CONSTRAINT sesiones_entrenamiento_dia_id_fkey
        FOREIGN KEY (dia_entrenamiento_id)
        REFERENCES public.dias_entrenamiento(id)
);


-- ============================================================
-- 17. REGISTROS DE SERIES
-- ============================================================

CREATE TABLE public.registros_series (
    id uuid NOT NULL DEFAULT gen_random_uuid(),

    sesion_id uuid NOT NULL,

    ejercicio_id uuid NOT NULL,

    numero_serie smallint NOT NULL,

    peso_kg numeric,

    repeticiones_logradas smallint,

    CONSTRAINT registros_series_pkey
        PRIMARY KEY (id),

    CONSTRAINT registros_series_sesion_id_fkey
        FOREIGN KEY (sesion_id)
        REFERENCES public.sesiones_entrenamiento(id)
        ON DELETE CASCADE,

    CONSTRAINT registros_series_ejercicio_id_fkey
        FOREIGN KEY (ejercicio_id)
        REFERENCES public.ejercicios_rutina(id),

    CONSTRAINT registros_series_numero_check
        CHECK (numero_serie > 0),

    CONSTRAINT registros_series_peso_check
        CHECK (
            peso_kg IS NULL
            OR peso_kg >= 0
        ),

    CONSTRAINT registros_series_repeticiones_check
        CHECK (
            repeticiones_logradas IS NULL
            OR repeticiones_logradas >= 0
        ),

    CONSTRAINT registros_series_numero_unico
        UNIQUE (
            sesion_id,
            ejercicio_id,
            numero_serie
        )
);


-- ============================================================
-- 18. CHECKINS DIARIOS
-- ============================================================

CREATE TABLE public.checkins_diarios (
    id uuid NOT NULL DEFAULT gen_random_uuid(),

    cliente_id uuid NOT NULL,

    fecha_checkin date NOT NULL DEFAULT CURRENT_DATE,

    horas_sueno numeric,

    nivel_estres smallint,

    nivel_energia smallint,

    adherencia_alimentacion public.nivel_adherencia,

    adherencia_entrenamiento public.nivel_adherencia,

    peso_corporal_kg numeric,

    comentario text,

    creado_en timestamp with time zone
        NOT NULL DEFAULT now(),

    CONSTRAINT checkins_diarios_pkey
        PRIMARY KEY (id),

    CONSTRAINT checkins_diarios_cliente_id_fkey
        FOREIGN KEY (cliente_id)
        REFERENCES public.clientes(id)
        ON DELETE CASCADE,

    CONSTRAINT checkins_horas_sueno_check
        CHECK (
            horas_sueno IS NULL
            OR (
                horas_sueno >= 0
                AND horas_sueno <= 24
            )
        ),

    CONSTRAINT checkins_estres_check
        CHECK (
            nivel_estres IS NULL
            OR (
                nivel_estres >= 1
                AND nivel_estres <= 10
            )
        ),

    CONSTRAINT checkins_energia_check
        CHECK (
            nivel_energia IS NULL
            OR (
                nivel_energia >= 1
                AND nivel_energia <= 10
            )
        ),

    CONSTRAINT checkins_peso_check
        CHECK (
            peso_corporal_kg IS NULL
            OR peso_corporal_kg > 0
        )
);


-- IMPORTANTE:
-- No existe UNIQUE(cliente_id, fecha_checkin)
-- porque se aprobo permitir varios checkins
-- para un cliente durante el mismo dia.


-- ============================================================
-- 19. BITACORA DE AUDITORIA
-- ============================================================

CREATE TABLE public.bitacora_auditoria (
    id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,

    actor_usuario_id uuid,

    tipo_evento text NOT NULL,

    tipo_entidad text,

    entidad_id uuid,

    detalles jsonb,

    creado_en timestamp with time zone
        NOT NULL DEFAULT now(),

    CONSTRAINT bitacora_auditoria_pkey
        PRIMARY KEY (id),

    CONSTRAINT bitacora_actor_usuario_id_fkey
        FOREIGN KEY (actor_usuario_id)
        REFERENCES public.usuarios(id)
        ON DELETE SET NULL
);


-- ============================================================
-- 20. FUNCION PARA ACTUALIZAR actualizado_en
-- ============================================================

CREATE OR REPLACE FUNCTION public.actualizar_fecha_modificacion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.actualizado_en := now();
    RETURN NEW;
END;
$$;


CREATE TRIGGER profesionales_actualizar_fecha
BEFORE UPDATE ON public.profesionales
FOR EACH ROW
EXECUTE FUNCTION public.actualizar_fecha_modificacion();


CREATE TRIGGER clientes_actualizar_fecha
BEFORE UPDATE ON public.clientes
FOR EACH ROW
EXECUTE FUNCTION public.actualizar_fecha_modificacion();


CREATE TRIGGER planes_alimentacion_actualizar_fecha
BEFORE UPDATE ON public.planes_alimentacion
FOR EACH ROW
EXECUTE FUNCTION public.actualizar_fecha_modificacion();


CREATE TRIGGER rutinas_entrenamiento_actualizar_fecha
BEFORE UPDATE ON public.rutinas_entrenamiento
FOR EACH ROW
EXECUTE FUNCTION public.actualizar_fecha_modificacion();


-- ============================================================
-- 21. VALIDAR PLAN ACTIVO AL ASIGNAR PROFESIONAL
-- ============================================================

CREATE OR REPLACE FUNCTION public.validar_plan_activo_profesional()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    plan_esta_activo boolean;
BEGIN

    -- En actualizaciones donde no cambia el plan,
    -- se permite conservar un plan que posteriormente
    -- haya sido desactivado.
    IF TG_OP = 'UPDATE'
       AND NEW.plan_id = OLD.plan_id THEN
        RETURN NEW;
    END IF;

    SELECT activo
    INTO plan_esta_activo
    FROM public.planes_suscripcion
    WHERE id = NEW.plan_id;

    IF plan_esta_activo IS DISTINCT FROM true THEN
        RAISE EXCEPTION
            'No se puede asignar un plan de suscripcion inactivo.';
    END IF;

    RETURN NEW;
END;
$$;


CREATE TRIGGER profesionales_validar_plan_activo
BEFORE INSERT OR UPDATE OF plan_id
ON public.profesionales
FOR EACH ROW
EXECUTE FUNCTION public.validar_plan_activo_profesional();


-- ============================================================
-- 22. VALIDAR LIMITE DE CLIENTES ACTIVOS
-- ============================================================

CREATE OR REPLACE FUNCTION public.validar_limite_clientes_activos()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    limite_clientes integer;
    cantidad_clientes integer;
BEGIN

    IF NEW.activo = false THEN
        RETURN NEW;
    END IF;

    SELECT ps.max_clientes_activos
    INTO limite_clientes
    FROM public.profesionales p
    INNER JOIN public.planes_suscripcion ps
        ON ps.id = p.plan_id
    WHERE p.id = NEW.profesional_id;

    SELECT COUNT(*)
    INTO cantidad_clientes
    FROM public.clientes c
    WHERE c.profesional_id = NEW.profesional_id
      AND c.activo = true
      AND (
          TG_OP = 'INSERT'
          OR c.id <> NEW.id
      );

    IF cantidad_clientes >= limite_clientes THEN
        RAISE EXCEPTION
            'El profesional alcanzo el limite de clientes activos permitido por su plan.';
    END IF;

    RETURN NEW;
END;
$$;


CREATE TRIGGER clientes_validar_limite
BEFORE INSERT OR UPDATE OF activo, profesional_id
ON public.clientes
FOR EACH ROW
EXECUTE FUNCTION public.validar_limite_clientes_activos();


-- ============================================================
-- 23. INVALIDAR CODIGOS DE ACTIVACION ANTERIORES
-- ============================================================

CREATE OR REPLACE FUNCTION public.invalidar_codigos_activacion_anteriores()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN

    UPDATE public.codigos_activacion
    SET usado_en = now()
    WHERE cliente_id = NEW.cliente_id
      AND usado_en IS NULL;

    RETURN NEW;
END;
$$;


CREATE TRIGGER codigos_activacion_invalidar_anteriores
BEFORE INSERT ON public.codigos_activacion
FOR EACH ROW
EXECUTE FUNCTION public.invalidar_codigos_activacion_anteriores();


-- ============================================================
-- 24. IMPEDIR EJERCICIOS EN DIAS DE DESCANSO
-- ============================================================

CREATE OR REPLACE FUNCTION public.validar_dia_no_descanso()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    dia_es_descanso boolean;
BEGIN

    SELECT es_descanso
    INTO dia_es_descanso
    FROM public.dias_entrenamiento
    WHERE id = NEW.dia_id;

    IF dia_es_descanso = true THEN
        RAISE EXCEPTION
            'No se pueden agregar ejercicios a un dia marcado como descanso.';
    END IF;

    RETURN NEW;
END;
$$;


CREATE TRIGGER ejercicios_validar_dia_no_descanso
BEFORE INSERT OR UPDATE OF dia_id
ON public.ejercicios_rutina
FOR EACH ROW
EXECUTE FUNCTION public.validar_dia_no_descanso();


CREATE OR REPLACE FUNCTION public.validar_cambio_a_descanso()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN

    IF NEW.es_descanso = true
       AND OLD.es_descanso = false
       AND EXISTS (
           SELECT 1
           FROM public.ejercicios_rutina e
           WHERE e.dia_id = NEW.id
       )
    THEN
        RAISE EXCEPTION
            'No se puede marcar como descanso un dia que contiene ejercicios.';
    END IF;

    RETURN NEW;
END;
$$;


CREATE TRIGGER dias_entrenamiento_validar_descanso
BEFORE UPDATE OF es_descanso
ON public.dias_entrenamiento
FOR EACH ROW
EXECUTE FUNCTION public.validar_cambio_a_descanso();


-- ============================================================
-- 25. VALIDAR QUE LA SESION PERTENEZCA AL CLIENTE
-- ============================================================

CREATE OR REPLACE FUNCTION public.validar_sesion_cliente()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    cliente_rutina uuid;
BEGIN

    SELECT r.cliente_id
    INTO cliente_rutina
    FROM public.dias_entrenamiento d
    INNER JOIN public.rutinas_entrenamiento r
        ON r.id = d.rutina_id
    WHERE d.id = NEW.dia_entrenamiento_id;

    IF cliente_rutina IS NULL THEN
        RAISE EXCEPTION
            'El dia de entrenamiento no existe.';
    END IF;

    IF cliente_rutina <> NEW.cliente_id THEN
        RAISE EXCEPTION
            'El dia de entrenamiento no pertenece al cliente de la sesion.';
    END IF;

    RETURN NEW;
END;
$$;


CREATE TRIGGER sesiones_validar_cliente
BEFORE INSERT OR UPDATE OF cliente_id, dia_entrenamiento_id
ON public.sesiones_entrenamiento
FOR EACH ROW
EXECUTE FUNCTION public.validar_sesion_cliente();


-- ============================================================
-- 26. VALIDAR EJERCICIO DE REGISTRO DE SERIE
-- ============================================================

CREATE OR REPLACE FUNCTION public.validar_ejercicio_sesion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    dia_sesion uuid;
    dia_ejercicio uuid;
BEGIN

    SELECT dia_entrenamiento_id
    INTO dia_sesion
    FROM public.sesiones_entrenamiento
    WHERE id = NEW.sesion_id;

    SELECT dia_id
    INTO dia_ejercicio
    FROM public.ejercicios_rutina
    WHERE id = NEW.ejercicio_id;

    IF dia_sesion IS NULL
       OR dia_ejercicio IS NULL
       OR dia_sesion <> dia_ejercicio THEN

        RAISE EXCEPTION
            'El ejercicio no pertenece al dia correspondiente a la sesion.';
    END IF;

    RETURN NEW;
END;
$$;


CREATE TRIGGER registros_series_validar_ejercicio
BEFORE INSERT OR UPDATE OF sesion_id, ejercicio_id
ON public.registros_series
FOR EACH ROW
EXECUTE FUNCTION public.validar_ejercicio_sesion();


-- ============================================================
-- 27. INDICES
-- ============================================================

CREATE INDEX clientes_profesional_id_idx
ON public.clientes(profesional_id);

CREATE INDEX clientes_nombre_busqueda_idx
ON public.clientes(lower(nombre_completo));

CREATE INDEX profesionales_plan_id_idx
ON public.profesionales(plan_id);

CREATE INDEX evaluaciones_cliente_id_idx
ON public.evaluaciones_antropometricas(cliente_id);

CREATE INDEX codigos_activacion_cliente_id_idx
ON public.codigos_activacion(cliente_id);

CREATE INDEX planes_alimentacion_cliente_id_idx
ON public.planes_alimentacion(cliente_id);

CREATE INDEX planes_alimentacion_grupo_version_idx
ON public.planes_alimentacion(grupo_version_id);

CREATE INDEX comidas_plan_plan_id_idx
ON public.comidas_plan(plan_id);

CREATE INDEX alimentos_comida_comida_id_idx
ON public.alimentos_comida(comida_id);

CREATE INDEX rutinas_entrenamiento_cliente_id_idx
ON public.rutinas_entrenamiento(cliente_id);

CREATE INDEX rutinas_entrenamiento_grupo_version_idx
ON public.rutinas_entrenamiento(grupo_version_id);

CREATE INDEX dias_entrenamiento_rutina_id_idx
ON public.dias_entrenamiento(rutina_id);

CREATE INDEX ejercicios_rutina_dia_id_idx
ON public.ejercicios_rutina(dia_id);

CREATE INDEX sesiones_entrenamiento_cliente_id_idx
ON public.sesiones_entrenamiento(cliente_id);

CREATE INDEX sesiones_entrenamiento_dia_id_idx
ON public.sesiones_entrenamiento(dia_entrenamiento_id);

CREATE INDEX registros_series_sesion_id_idx
ON public.registros_series(sesion_id);

CREATE INDEX registros_series_ejercicio_id_idx
ON public.registros_series(ejercicio_id);

CREATE INDEX checkins_diarios_cliente_id_idx
ON public.checkins_diarios(cliente_id);


-- ============================================================
-- 28. FUNCIONES AUXILIARES PARA RLS
-- ============================================================

CREATE OR REPLACE FUNCTION public.obtener_rol_actual()
RETURNS public.rol_usuario
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT rol
    FROM public.usuarios
    WHERE id = auth.uid();
$$;


CREATE OR REPLACE FUNCTION public.obtener_profesional_actual()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id
    FROM public.profesionales
    WHERE usuario_id = auth.uid();
$$;


CREATE OR REPLACE FUNCTION public.obtener_cliente_actual()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id
    FROM public.clientes
    WHERE usuario_id = auth.uid();
$$;


-- ============================================================
-- 29. ACTIVAR RLS
-- ============================================================

ALTER TABLE public.usuarios
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.planes_suscripcion
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profesionales
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.clientes
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.codigos_activacion
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.evaluaciones_antropometricas
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.planes_alimentacion
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.comidas_plan
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.alimentos_comida
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.rutinas_entrenamiento
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.dias_entrenamiento
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ejercicios_rutina
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.sesiones_entrenamiento
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.registros_series
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.checkins_diarios
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.bitacora_auditoria
ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 30. POLITICAS RLS - USUARIOS
-- ============================================================

CREATE POLICY usuarios_administrador
ON public.usuarios
FOR ALL
TO authenticated
USING (
    public.obtener_rol_actual() = 'administrador'
)
WITH CHECK (
    public.obtener_rol_actual() = 'administrador'
);


CREATE POLICY usuarios_ver_propio
ON public.usuarios
FOR SELECT
TO authenticated
USING (
    id = auth.uid()
);


CREATE POLICY usuarios_actualizar_propio
ON public.usuarios
FOR UPDATE
TO authenticated
USING (
    id = auth.uid()
)
WITH CHECK (
    id = auth.uid()
);


-- ============================================================
-- 31. POLITICAS RLS - PLANES DE SUSCRIPCION
-- ============================================================

CREATE POLICY planes_suscripcion_consultar
ON public.planes_suscripcion
FOR SELECT
TO authenticated
USING (true);


CREATE POLICY planes_suscripcion_administrador
ON public.planes_suscripcion
FOR ALL
TO authenticated
USING (
    public.obtener_rol_actual() = 'administrador'
)
WITH CHECK (
    public.obtener_rol_actual() = 'administrador'
);


-- ============================================================
-- 32. POLITICAS RLS - PROFESIONALES
-- ============================================================

CREATE POLICY profesionales_administrador
ON public.profesionales
FOR ALL
TO authenticated
USING (
    public.obtener_rol_actual() = 'administrador'
)
WITH CHECK (
    public.obtener_rol_actual() = 'administrador'
);


CREATE POLICY profesionales_ver_propio
ON public.profesionales
FOR SELECT
TO authenticated
USING (
    usuario_id = auth.uid()
);


CREATE POLICY profesionales_actualizar_propio
ON public.profesionales
FOR UPDATE
TO authenticated
USING (
    usuario_id = auth.uid()
)
WITH CHECK (
    usuario_id = auth.uid()
);


-- ============================================================
-- 33. POLITICAS RLS - CLIENTES
-- ============================================================

CREATE POLICY clientes_administrador
ON public.clientes
FOR ALL
TO authenticated
USING (
    public.obtener_rol_actual() = 'administrador'
)
WITH CHECK (
    public.obtener_rol_actual() = 'administrador'
);


CREATE POLICY clientes_profesional
ON public.clientes
FOR ALL
TO authenticated
USING (
    profesional_id =
    public.obtener_profesional_actual()
)
WITH CHECK (
    profesional_id =
    public.obtener_profesional_actual()
);


CREATE POLICY clientes_ver_propio
ON public.clientes
FOR SELECT
TO authenticated
USING (
    usuario_id = auth.uid()
);


-- ============================================================
-- 34. POLITICAS RLS - CODIGOS DE ACTIVACION
-- ============================================================

CREATE POLICY codigos_activacion_administrador
ON public.codigos_activacion
FOR ALL
TO authenticated
USING (
    public.obtener_rol_actual() = 'administrador'
)
WITH CHECK (
    public.obtener_rol_actual() = 'administrador'
);


CREATE POLICY codigos_activacion_profesional
ON public.codigos_activacion
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.clientes c
        WHERE c.id = cliente_id
          AND c.profesional_id =
              public.obtener_profesional_actual()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.clientes c
        WHERE c.id = cliente_id
          AND c.profesional_id =
              public.obtener_profesional_actual()
    )
);


-- ============================================================
-- 35. POLITICAS RLS - EVALUACIONES
-- ============================================================

CREATE POLICY evaluaciones_administrador
ON public.evaluaciones_antropometricas
FOR ALL
TO authenticated
USING (
    public.obtener_rol_actual() = 'administrador'
)
WITH CHECK (
    public.obtener_rol_actual() = 'administrador'
);


CREATE POLICY evaluaciones_profesional
ON public.evaluaciones_antropometricas
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.clientes c
        WHERE c.id = cliente_id
          AND c.profesional_id =
              public.obtener_profesional_actual()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.clientes c
        WHERE c.id = cliente_id
          AND c.profesional_id =
              public.obtener_profesional_actual()
    )
);


CREATE POLICY evaluaciones_cliente
ON public.evaluaciones_antropometricas
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.clientes c
        WHERE c.id = cliente_id
          AND c.usuario_id = auth.uid()
          AND c.compartir_progreso = true
    )
);


-- ============================================================
-- 36. POLITICAS RLS - PLANES DE ALIMENTACION
-- ============================================================

CREATE POLICY planes_alimentacion_administrador
ON public.planes_alimentacion
FOR ALL
TO authenticated
USING (
    public.obtener_rol_actual() = 'administrador'
)
WITH CHECK (
    public.obtener_rol_actual() = 'administrador'
);


CREATE POLICY planes_alimentacion_profesional
ON public.planes_alimentacion
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.clientes c
        WHERE c.id = cliente_id
          AND c.profesional_id =
              public.obtener_profesional_actual()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.clientes c
        WHERE c.id = cliente_id
          AND c.profesional_id =
              public.obtener_profesional_actual()
    )
);


CREATE POLICY planes_alimentacion_cliente
ON public.planes_alimentacion
FOR SELECT
TO authenticated
USING (
    estado = 'activo'
    AND cliente_id =
        public.obtener_cliente_actual()
);


-- ============================================================
-- 37. POLITICAS RLS - COMIDAS
-- ============================================================

CREATE POLICY comidas_plan_administrador
ON public.comidas_plan
FOR ALL
TO authenticated
USING (
    public.obtener_rol_actual() = 'administrador'
)
WITH CHECK (
    public.obtener_rol_actual() = 'administrador'
);


CREATE POLICY comidas_plan_profesional
ON public.comidas_plan
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.planes_alimentacion pa
        INNER JOIN public.clientes c
            ON c.id = pa.cliente_id
        WHERE pa.id = plan_id
          AND c.profesional_id =
              public.obtener_profesional_actual()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.planes_alimentacion pa
        INNER JOIN public.clientes c
            ON c.id = pa.cliente_id
        WHERE pa.id = plan_id
          AND c.profesional_id =
              public.obtener_profesional_actual()
    )
);


CREATE POLICY comidas_plan_cliente
ON public.comidas_plan
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.planes_alimentacion pa
        WHERE pa.id = plan_id
          AND pa.cliente_id =
              public.obtener_cliente_actual()
          AND pa.estado = 'activo'
    )
);


-- ============================================================
-- 38. POLITICAS RLS - ALIMENTOS
-- ============================================================

CREATE POLICY alimentos_comida_administrador
ON public.alimentos_comida
FOR ALL
TO authenticated
USING (
    public.obtener_rol_actual() = 'administrador'
)
WITH CHECK (
    public.obtener_rol_actual() = 'administrador'
);


CREATE POLICY alimentos_comida_profesional
ON public.alimentos_comida
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.comidas_plan cp
        INNER JOIN public.planes_alimentacion pa
            ON pa.id = cp.plan_id
        INNER JOIN public.clientes c
            ON c.id = pa.cliente_id
        WHERE cp.id = comida_id
          AND c.profesional_id =
              public.obtener_profesional_actual()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.comidas_plan cp
        INNER JOIN public.planes_alimentacion pa
            ON pa.id = cp.plan_id
        INNER JOIN public.clientes c
            ON c.id = pa.cliente_id
        WHERE cp.id = comida_id
          AND c.profesional_id =
              public.obtener_profesional_actual()
    )
);


CREATE POLICY alimentos_comida_cliente
ON public.alimentos_comida
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.comidas_plan cp
        INNER JOIN public.planes_alimentacion pa
            ON pa.id = cp.plan_id
        WHERE cp.id = comida_id
          AND pa.cliente_id =
              public.obtener_cliente_actual()
          AND pa.estado = 'activo'
    )
);


-- ============================================================
-- 39. POLITICAS RLS - RUTINAS
-- ============================================================

CREATE POLICY rutinas_administrador
ON public.rutinas_entrenamiento
FOR ALL
TO authenticated
USING (
    public.obtener_rol_actual() = 'administrador'
)
WITH CHECK (
    public.obtener_rol_actual() = 'administrador'
);


CREATE POLICY rutinas_profesional
ON public.rutinas_entrenamiento
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.clientes c
        WHERE c.id = cliente_id
          AND c.profesional_id =
              public.obtener_profesional_actual()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.clientes c
        WHERE c.id = cliente_id
          AND c.profesional_id =
              public.obtener_profesional_actual()
    )
);


CREATE POLICY rutinas_cliente
ON public.rutinas_entrenamiento
FOR SELECT
TO authenticated
USING (
    estado = 'activo'
    AND cliente_id =
        public.obtener_cliente_actual()
);


-- ============================================================
-- 40. POLITICAS RLS - DIAS
-- ============================================================

CREATE POLICY dias_entrenamiento_administrador
ON public.dias_entrenamiento
FOR ALL
TO authenticated
USING (
    public.obtener_rol_actual() = 'administrador'
)
WITH CHECK (
    public.obtener_rol_actual() = 'administrador'
);


CREATE POLICY dias_entrenamiento_profesional
ON public.dias_entrenamiento
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.rutinas_entrenamiento r
        INNER JOIN public.clientes c
            ON c.id = r.cliente_id
        WHERE r.id = rutina_id
          AND c.profesional_id =
              public.obtener_profesional_actual()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.rutinas_entrenamiento r
        INNER JOIN public.clientes c
            ON c.id = r.cliente_id
        WHERE r.id = rutina_id
          AND c.profesional_id =
              public.obtener_profesional_actual()
    )
);


CREATE POLICY dias_entrenamiento_cliente
ON public.dias_entrenamiento
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.rutinas_entrenamiento r
        WHERE r.id = rutina_id
          AND r.cliente_id =
              public.obtener_cliente_actual()
          AND r.estado = 'activo'
    )
);


-- ============================================================
-- 41. POLITICAS RLS - EJERCICIOS
-- ============================================================

CREATE POLICY ejercicios_rutina_administrador
ON public.ejercicios_rutina
FOR ALL
TO authenticated
USING (
    public.obtener_rol_actual() = 'administrador'
)
WITH CHECK (
    public.obtener_rol_actual() = 'administrador'
);


CREATE POLICY ejercicios_rutina_profesional
ON public.ejercicios_rutina
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.dias_entrenamiento d
        INNER JOIN public.rutinas_entrenamiento r
            ON r.id = d.rutina_id
        INNER JOIN public.clientes c
            ON c.id = r.cliente_id
        WHERE d.id = dia_id
          AND c.profesional_id =
              public.obtener_profesional_actual()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.dias_entrenamiento d
        INNER JOIN public.rutinas_entrenamiento r
            ON r.id = d.rutina_id
        INNER JOIN public.clientes c
            ON c.id = r.cliente_id
        WHERE d.id = dia_id
          AND c.profesional_id =
              public.obtener_profesional_actual()
    )
);


CREATE POLICY ejercicios_rutina_cliente
ON public.ejercicios_rutina
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.dias_entrenamiento d
        INNER JOIN public.rutinas_entrenamiento r
            ON r.id = d.rutina_id
        WHERE d.id = dia_id
          AND r.cliente_id =
              public.obtener_cliente_actual()
          AND r.estado = 'activo'
    )
);


-- ============================================================
-- 42. POLITICAS RLS - SESIONES
-- ============================================================

CREATE POLICY sesiones_administrador
ON public.sesiones_entrenamiento
FOR ALL
TO authenticated
USING (
    public.obtener_rol_actual() = 'administrador'
)
WITH CHECK (
    public.obtener_rol_actual() = 'administrador'
);


CREATE POLICY sesiones_profesional
ON public.sesiones_entrenamiento
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.clientes c
        WHERE c.id = cliente_id
          AND c.profesional_id =
              public.obtener_profesional_actual()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.clientes c
        WHERE c.id = cliente_id
          AND c.profesional_id =
              public.obtener_profesional_actual()
    )
);


CREATE POLICY sesiones_cliente
ON public.sesiones_entrenamiento
FOR ALL
TO authenticated
USING (
    cliente_id =
        public.obtener_cliente_actual()
)
WITH CHECK (
    cliente_id =
        public.obtener_cliente_actual()
);


-- ============================================================
-- 43. POLITICAS RLS - REGISTROS DE SERIES
-- ============================================================

CREATE POLICY registros_series_administrador
ON public.registros_series
FOR ALL
TO authenticated
USING (
    public.obtener_rol_actual() = 'administrador'
)
WITH CHECK (
    public.obtener_rol_actual() = 'administrador'
);


CREATE POLICY registros_series_profesional
ON public.registros_series
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.sesiones_entrenamiento s
        INNER JOIN public.clientes c
            ON c.id = s.cliente_id
        WHERE s.id = sesion_id
          AND c.profesional_id =
              public.obtener_profesional_actual()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.sesiones_entrenamiento s
        INNER JOIN public.clientes c
            ON c.id = s.cliente_id
        WHERE s.id = sesion_id
          AND c.profesional_id =
              public.obtener_profesional_actual()
    )
);


CREATE POLICY registros_series_cliente
ON public.registros_series
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.sesiones_entrenamiento s
        WHERE s.id = sesion_id
          AND s.cliente_id =
              public.obtener_cliente_actual()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.sesiones_entrenamiento s
        WHERE s.id = sesion_id
          AND s.cliente_id =
              public.obtener_cliente_actual()
    )
);


-- ============================================================
-- 44. POLITICAS RLS - CHECKINS
-- ============================================================

CREATE POLICY checkins_administrador
ON public.checkins_diarios
FOR ALL
TO authenticated
USING (
    public.obtener_rol_actual() = 'administrador'
)
WITH CHECK (
    public.obtener_rol_actual() = 'administrador'
);


CREATE POLICY checkins_profesional
ON public.checkins_diarios
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.clientes c
        WHERE c.id = cliente_id
          AND c.profesional_id =
              public.obtener_profesional_actual()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.clientes c
        WHERE c.id = cliente_id
          AND c.profesional_id =
              public.obtener_profesional_actual()
    )
);


CREATE POLICY checkins_cliente
ON public.checkins_diarios
FOR ALL
TO authenticated
USING (
    cliente_id =
        public.obtener_cliente_actual()
)
WITH CHECK (
    cliente_id =
        public.obtener_cliente_actual()
);


-- ============================================================
-- 45. POLITICAS RLS - BITACORA
-- ============================================================

CREATE POLICY bitacora_administrador
ON public.bitacora_auditoria
FOR SELECT
TO authenticated
USING (
    public.obtener_rol_actual() = 'administrador'
);


-- ============================================================
-- FIN DEL ESQUEMA
-- ============================================================
# Guía de Entrevista Técnica y Preguntas/Respuestas (Interview Q&A)

**Puesto**: Senior Product Engineer / Backend Engineer  
**Empresa**: Zubale  
**Proyecto**: E-Commerce Microservice Refactoring, Concurrency & Resiliency Challenge (`NestJS`, `PostgreSQL`, `Redis`, `TypeORM`, `Jest`)  

---

## 📋 Tabla de Contenidos

1. [Categoría 1: Diagnóstico y Solución de los Issues del Challenge](#1-categoría-1-diagnóstico-y-solución-de-los-issues-del-challenge)
2. [Categoría 2: Nociones Fundamentales de TypeScript, NestJS y Node.js](#2-categoría-2-nociones-fundamentales-de-typescript-nestjs-y-nodejs)
3. [Categoría 3: Nociones Avanzadas de Arquitectura y Senior Product Engineering](#3-categoría-3-nociones-avanzadas-de-arquitectura-y-senior-product-engineering)
4. [Categoría 4: Escenarios de Alta Concurrencia, Sistemas Distribuidos y Mejoras Futuras](#4-categoría-4-escenarios-de-alta-concurrencia-sistemas-distribuidos-y-mejoras-futuras)

---

## 1. Categoría 1: Diagnóstico y Solución de los Issues del Challenge

### ❓ Pregunta 1.1: ¿Cómo identificaste y resolviste el crash de serialización JSON en el endpoint `GET /orders/:id/full`?

* **Respuesta del Candidato**:
  El problema se originaba por una **referencia circular directa** entre las entidades `Order` y `User`. En la relación `Order.user`, el objeto de usuario contenía una propiedad `latestOrder` que apuntaba de nuevo a la orden completa (`Order` $\rightarrow$ `User` $\rightarrow$ `Order`). Al ejecutarse `JSON.parse(JSON.stringify(order))` o al serializar la respuesta HTTP en NestJS, Node.js lanzaba la excepción `TypeError: Converting circular structure to JSON` o silenciaba las relaciones.
  
  **Solución**: Eliminé la llamada redundante y costosa a `JSON.stringify` y apliqué una clonación shallow mediante el operador de propagación (`...order`), sobreescribiendo `order.user` con una estructura de objeto plana no circular que incluye únicamente los atributos primitivos esenciales de la última orden (`id`, `status`, `total`, `createdAt`).

* **Escenario de Entrevista**:
  > *Entrevistador*: "¿Por qué elegiste la clonación con spread operator (`...`) en lugar de utilizar `@Exclude()` de `class-transformer`?"
  >
  > *Candidato*: "Usar `@Exclude()` en la entidad habría ocultado `latestOrder` en todas las consultas de la aplicación. La solución con spread operator a nivel de servicio nos permitió enriquecer contextualmente solo la respuesta de `getOrderWithFullDetails` sin alterar otras consultas más livianas como `findAll` o `findOne`."

---

### ❓ Pregunta 1.2: En un sistema de e-commerce real como Zubale, ¿cómo previenes las condiciones de carrera (*Race Conditions*) en la reserva de inventario durante compras simultáneas?

* **Respuesta del Candidato**:
  En la aplicación original, `OrdersService.create` ejecutaba `updateStock` sin el operador `await` (promesa flotante). Bajo peticiones concurrentes, múltiples solicitudes leían el mismo valor de `product.stock` de PostgreSQL antes de que las actualizaciones en la base de datos se guardaran, provocando sobregiros de inventario negativos.

  Para solucionar esto, aplicamos 3 niveles de defensa:
  1. **Enlace Síncrono `await`**: Forzamos la ejecución secuencial de `await updateStock(...)` antes de confirmar la transacción.
  2. **Validación Atómica de Dominio**: Lanzamos `BadRequestException` si `stock < quantity` o si `quantity < 0`.
  3. **Consolidación de Payloads**: Si un cliente envía items duplicados del mismo `productId` en una sola orden, consolidamos las cantidades en un `Map<number, number>` antes de verificar el stock.

* **Escenario Avanzado**:
  > *Entrevistador*: "Si tenemos 1,000 usuarios intentando comprar el último producto en oferta exactamente al mismo milisegundo, ¿el `await` simple es suficiente?"
  >
  > *Candidato*: "No, en alta concurrencia distribuida con múltiples réplicas de Node.js, se requiere un mecanismo a nivel de Base de Datos o Redis:
  > - **Pessimistic Locking (Bloqueo Pesimista)**: `SELECT * FROM product WHERE id = :id FOR UPDATE` en PostgreSQL para bloquear la fila durante la transacción.
  > - **Optimistic Locking (Bloqueo Optimista)**: Agregar una columna `@VersionColumn() version: number` en la entidad TypeORM. Si otra transacción modifica la fila, TypeORM lanza un `OptimisticLockVersionMismatchError` y el cliente reintenta.
  > - **Distributed Lock con Redis (Redlock)**: Adquirir un candado temporal en Redis antes de procesar el carrito."

---

### ❓ Pregunta 1.3: ¿Por qué la búsqueda de productos causaba contaminación de caché en Redis y cómo la solucionaste?

* **Respuesta del Candidato**:
  `ProductsService.searchProducts` utilizaba una llave estática fija `'products-search'` en `cacheManager`. La primera búsqueda (ej. `?q=laptop`) guardaba sus resultados bajo `'products-search'`. Cuando un segundo usuario buscaba `?q=phone`, Redis retornaba inmediatamente los resultados cacheados de `laptop`.

  **Solución**: Diseñé llaves dinámicas compuestas e independizadas por el término de búsqueda normalizado: `product-search:${searchQuery.toLowerCase()}`. Además, implementé la invalidación de llaves de búsqueda al crear, actualizar o eliminar un producto.

---

### ❓ Pregunta 1.4: ¿Cómo manejaste las excepciones de base de datos no controladas (como el error de email duplicado 23505)?

* **Respuesta del Candidato**:
  Cuando dos usuarios intentaban registrarse con el mismo correo, la restricción única `UQ_user_email` de PostgreSQL arrojaba un `QueryFailedError` (código `23505`). Como no estaba envuelto en un bloque `try-catch`, NestJS lo capturaba como una excepción no controlada y retornaba un error genérico **HTTP 500 Internal Server Error**.

  **Solución**: Capturé el código de error `23505` en `UsersService.create` y lo traduje a una excepción de dominio limpia **`ConflictException` (HTTP 409 Conflict)** con el mensaje `'User with email "..." already exists'`.

---

### ❓ Pregunta 1.5: ¿Qué es el principio Fail-Fast y cómo lo implementaste para validar los identificadores en la aplicación?

* **Respuesta del Candidato**:
  El principio **Fail-Fast** establece que una petición inválida o malformada debe ser interceptada y rechazada en el punto de entrada más externo posible (la frontera del controlador HTTP), evitando gastar recursos en la capa de servicio o ejecutar consultas innecesarias en la base de datos.

  **Implementación**:
  1. Creé un Pipe personalizado **`ParsePositiveIntPipe`** que valida que los parámetros de ruta (`:id`) sean enteros estrictamente mayores a cero ($>0$). Si reciben `0` o `-5`, retornan inmediatamente **HTTP 400 Bad Request**.
  2. Anoté los DTOs con decoradores de `class-validator` (`@Min(1)`) para validar el cuerpo de las peticiones JSON.

---

## 2. Categoría 2: Nociones Fundamentales de TypeScript, NestJS y Node.js

### ❓ Pregunta 2.1: Explica el ciclo de vida de una petición HTTP en NestJS. ¿En qué orden se ejecutan Middleware, Guards, Interceptors, Pipes y Exception Filters?

* **Respuesta del Candidato**:
  El orden exacto de ejecución en NestJS es:

```
Petición HTTP ──► Middleware ──► Guards ──► Interceptors (Pre) ──► Pipes ──► Controller / Handler ──► Interceptors (Post) ──► Exception Filters ──► Respuesta HTTP
```

  1. **Middleware**: Intercepta la petición cruda de Express/Fastify (ej. CORS, logging, parsing de body).
  2. **Guards**: Evalúa autorización y autenticación (ej. JWT, Roles). Retorna `true` o `false`.
  3. **Interceptors (Pre-controller)**: Transforma la petición o inicia temporizadores de trazabilidad.
  4. **Pipes**: Valida y transforma los tipos del payload/parámetros (ej. `ParsePositiveIntPipe`, `ValidationPipe`).
  5. **Controller / Handler**: Ejecuta la lógica de negocio del servicio.
  6. **Interceptors (Post-controller)**: Modifica la respuesta enviada o aplica caché.
  7. **Exception Filters**: Captura excepciones lanzadas en cualquier etapa y las mapea a respuestas JSON formateadas.

---

### ❓ Pregunta 2.2: ¿Cuál es la diferencia en Node.js entre `process.nextTick()`, `setImmediate()`, y `setTimeout()` en relación al Event Loop?

* **Respuesta del Candidato**:
  - **`process.nextTick()`**: Ejecuta el callback en la **Microtask Queue** actual, inmediatamente después de la operación en curso, antes de que el Event Loop avance a cualquier otra fase. Su uso excesivo puede bloquear la I/O.
  - **`Promise.then()` / `async-await`**: También residen en la **Microtask Queue**, ejecutándose justo después de `nextTick`.
  - **`setTimeout(fn, 0)`**: Reside en la fase de **Timers** de la Macrotask Queue. Se ejecuta una vez transcurrido el tiempo mínimo de espera en la siguiente vuelta del Event Loop.
  - **`setImmediate()`**: Reside en la fase de **Check** de la Macrotask Queue. Se ejecuta inmediatamente después de la fase de I/O Polling.

---

### ❓ Pregunta 2.3: ¿Cómo funciona la Inyección de Dependencias (DI) en NestJS y cuáles son los distintos alcances (*Scopes*) de los Providers?

* **Respuesta del Candidato**:
  NestJS utiliza un contenedor IoC (Inversión de Control). Los alcances disponibles son:
  1. **`DEFAULT` (Singleton)**: Se instancia una sola vez al arrancar la aplicación y se comparte entre todas las peticiones HTTP. Es el más eficiente en memoria y rendimiento.
  2. **`REQUEST`**: Se crea una nueva instancia de la clase por cada petición HTTP entrante. Se destruye al finalizar la petición. *(Útil para multitenancy, pero aumenta el consumo de memoria y degrada el rendimiento en alta concurrencia)*.
  3. **`TRANSIENT`**: Se crea una instancia única dedicada para cada proveedor que la inyecte.

---

## 3. Categoría 3: Nociones Avanzadas de Arquitectura y Senior Product Engineer

### ❓ Pregunta 3.1: En Zubale coordinamos repartidores, tiendas y clientes en tiempo real. ¿Cómo diseñarías una arquitectura resiliente para procesar pagos y cambios de estado de órdenes distribuida entre microservicios?

* **Respuesta del Candidato**:
  Utilizaría el patrón **SAGA (Orquestación o Coreografía)** respaldado por un Broker de Mensajes como **RabbitMQ** o **Apache Kafka**:

```
[ Cliente ] ──► [ Orders Service ] ──► (Evento: OrderCreated) ──► [ Event Bus ]
                                                                      │
                                                                      ▼
[ Payment Service ] ◄── (Evento: PaymentProcessed) ◄───────── [ Payment Service ]
        │
        ├─► Si falla el Pago ──► (Evento: PaymentFailed) ──► [ Inventory Service ] (Compensación: Restituir Stock)
        └─► Si el Pago es Exitoso ──► (Evento: PaymentSucceeded) ──► [ Delivery Service ] (Asignar Repartidor Zubale)
```

  1. **Transactional Outbox Pattern**: Para evitar inconsistencias donde la base de datos guarda la orden pero la publicación al broker de mensajes falla, las órdenes y los eventos pendientes se guardan en la **misma transacción local de PostgreSQL** en una tabla `outbox`. Un worker procesa la tabla `outbox` y publica los eventos en Kafka con garantía *At-Least-Once*.
  2. **Transacciones Compensatorias**: Si el servicio de pago o entrega falla, la SAGA ejecuta eventos de compensación que devuelven el dinero y reembolsan el inventario en la base de datos automáticamente.

---

### 3.2 ¿Cómo implementarías Idempotencia en endpoints de pagos o mutación de estados en una API REST?

* **Respuesta del Candidato**:
  1. **Idempotency Key (`X-Idempotency-Key`)**: El cliente envía un UUID único en el encabezado HTTP de la petición (ej. `X-Idempotency-Key: 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d`).
  2. **Registro en Redis / DB**: El servidor consulta si la clave ya existe en Redis antes de procesar el pago.
     - Si la clave está en estado `PROCESSING`, retorna **HTTP 409 Conflict** o espera.
     - Si la clave está en estado `COMPLETED`, retorna inmediatamente la respuesta almacenada en caché con **HTTP 200 OK** sin volver a cobrar.
  3. **Máquina de Estados**: En `OrdersService.updateStatus`, si la orden ya está en estado `SHIPPED`, el servicio retorna la orden actual con **HTTP 200 OK** sin intentar re-ejecutar transiciones ni lanzar errores.

---

## 4. Categoría 4: Escenarios de Alta Concurrencia, Sistemas Distribuidos y Mejoras Futuras

### ❓ Pregunta 4.1: ¿Qué estrategias propondrías para mejorar la escalabilidad y observabilidad del microservicio en producción?

* **Respuesta del Candidato**:

#### 1. Arquitectura de Base de Datos y Lectura/Escritura:
- **Read Replicas en PostgreSQL**: Separar las operaciones de lectura (`findAll`, `searchProducts`) hacia réplicas de lectura de PostgreSQL, reservando el nodo primario para escrituras (`create`, `processPayment`).
- **Connection Pooling**: Utilizar **PgBouncer** frente a PostgreSQL para gestionar de forma eficiente miles de conexiones concurrentes sin agotar la memoria del servidor DB.

#### 2. Cache Stampede / Thundering Herd Prevention:
- En búsquedas de alta demanda, si una llave de caché en Redis expira, miles de peticiones simultáneas podrían golpear PostgreSQL al mismo tiempo.
- **Solución**: Implementar **Probabilistic Early Invalidation (XFetch)** o un candado distribuido simple (*Singleflight*) en Node.js que asegure que solo una petición recalcule la caché mientras las demás esperan la actualización.

#### 3. Observabilidad y Monitoreo (OpenTelemetry & Prometheus):
- Sustituir `console.log` por un logger estructurado en formato JSON como **Pino** o **Winston**.
- Integrar **OpenTelemetry** para rastreo distribuido (*Distributed Tracing*) entre microservicios, midiendo tiempos de respuesta de consultas TypeORM y llamadas HTTP externas.
- Métricas con **Prometheus y Grafana**: Monitorear la tasa de errores HTTP 503, uso del Event Loop, latencia de base de datos y *Cache Hit Ratio* en Redis.

---

## 5. Conclusión

Esta guía recopila el conocimiento técnico, arquitectónico y práctico aplicado durante la resolución del challenge. Demuestra la capacidad de diagnosticar fallos complejos a nivel de código, diseñar pruebas automatizadas con 100% de cobertura y estructurar soluciones escalables listas para producción.

# Guía de Entrevista Técnica y Preguntas/Respuestas (Interview Q&A)

**Puesto**: Senior Product Engineer / Backend Architect  
**Empresa**: Zubale  
**Proyecto**: E-Commerce Microservice Refactoring, Concurrency & Resiliency Challenge (`NestJS`, `PostgreSQL`, `Redis`, `TypeORM`, `Jest`)  

---

## 📋 Tabla de Contenidos

1. [Categoría 1: Diagnóstico y Solución de los Issues del Challenge](#1-categoría-1-diagnóstico-y-solución-de-los-issues-del-challenge)
2. [Categoría 2: Nociones Fundamentales de TypeScript, NestJS y Node.js](#2-categoría-2-nociones-fundamentales-de-typescript-nestjs-y-nodejs)
3. [Categoría 3: Nociones Avanzadas de Arquitectura y Senior Product Engineering](#3-categoría-3-nociones-avanzadas-de-arquitectura-y-senior-product-engineering)
4. [Categoría 4: Escenarios de Alta Concurrencia, Sistemas Distribuidos y Observabilidad](#4-categoría-4-escenarios-de-alta-concurrencia-sistemas-distribuidos-y-observabilidad)
5. [Categoría 5: Resiliencia, Microservicios, Docker, AWS CDK y Kubernetes (K8s)](#5-categoría-5-resiliencia-microservicios-docker-aws-cdk-y-kubernetes-k8s)
6. [Categoría 6: Mejoras Futuras Aplicadas (Protección en Capa de Aplicación, Resiliencia y Robustez de Tipos)](#6-categoría-6-mejoras-futuras-aplicadas-protección-en-capa-de-aplicación-resiliencia-y-robustez-de-tipos)
7. [Conclusión](#7-conclusión)

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

#### 📚 Glosario de Conceptos:
- **Referencia Circular**: Condición en la que dos o más objetos se referencian mutuamente en un ciclo infinito ($A \rightarrow B \rightarrow A$), impidiendo el recorrido completo del árbol de objetos.
- **Serialización JSON**: Proceso de convertir una estructura de datos en memoria a una cadena de texto en formato JSON. En JavaScript, `JSON.stringify` falla si detecta un ciclo.
- **Spread Operator (`...`)**: Operador de ES6 que clona superficialmente (*shallow copy*) las propiedades enumerables de un objeto a uno nuevo sin mantener enlaces por referencia a la raíz.

#### 💻 Ejemplo de Implementación:
```typescript
// src/orders/orders.service.ts
async getOrderWithFullDetails(id: number): Promise<any> {
  const order = await this.ordersRepository.findOne({
    where: { id },
    relations: ['user', 'items', 'items.product'],
  });

  if (!order) throw new NotFoundException(`Order #${id} not found`);

  // Clonación no circular segura
  const enriched: any = { ...order };
  if (order.user) {
    enriched.user = {
      ...order.user,
      latestOrder: {
        id: order.id,
        status: order.status,
        total: order.total,
        createdAt: order.createdAt,
      },
    };
  }
  return enriched;
}
```

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
  > *Candidato*: "No, en alta concurrencia distribuida con múltiples réplicas de Node.js, se requiere un mecanismo a nivel de Base de Datos o Redis: Pessimistic Locking, Optimistic Locking o Distributed Locks."

#### 📚 Glosario de Conceptos:
- **Pessimistic Locking (Bloqueo Pesimista)**: Estrategia que bloquea la fila de la base de datos a nivel de lectura (`SELECT ... FOR UPDATE`), impidiendo que cualquier otra transacción lea o modifique la fila hasta que la transacción actual termine.
- **Optimistic Locking (Bloqueo Optimista)**: Estrategia que asume que los conflictos son raros. Utiliza un número de versión (`version`) en la fila. Al actualizar, verifica `WHERE id = :id AND version = :oldVersion`. Si el número cambió, la transacción falla y se reintenta.
- **Distributed Lock (Redlock con Redis)**: Algoritmo de candado distribuido gestionado en Redis que garantiza que solo una instancia de un clúster de microservicios ejecute una sección crítica de código a la vez.

#### 💻 Ejemplos de Implementación Práctica:

##### 1. Pessimistic Locking en TypeORM:
```typescript
async reserveStockPessimistic(productId: number, quantity: number, manager: EntityManager): Promise<void> {
  // Bloquea la fila con SELECT FOR UPDATE
  const product = await manager.findOne(Product, {
    where: { id: productId },
    lock: { mode: 'pessimistic_write' },
  });

  if (product.stock < quantity) {
    throw new BadRequestException(`Stock insuficiente para ${product.name}`);
  }

  product.stock -= quantity;
  await manager.save(product);
}
```

##### 2. Optimistic Locking con Decorador `@VersionColumn`:
```typescript
// Entidad con versión
@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  stock: number;

  @VersionColumn()
  version: number; // Incrementado automáticamente por TypeORM
}

// Servicio capturando desajuste de versión
try {
  await this.productsRepository.save(product);
} catch (error) {
  if (error instanceof OptimisticLockVersionMismatchError) {
    throw new ConflictException('El inventario cambió durante la compra. Reintente.');
  }
}
```

##### 3. Distributed Lock con Redlock (Redis):
```typescript
import Redlock from 'redlock';

const redlock = new Redlock([redisClient], { retryCount: 3, retryDelay: 200 });

async reserveStockRedlock(productId: number, quantity: number) {
  const lockKey = `locks:product:${productId}`;
  const lock = await redlock.acquire([lockKey], 1000); // Candado por 1 segundo

  try {
    const product = await this.productsService.findOne(productId);
    if (product.stock < quantity) throw new BadRequestException('Sin stock');
    await this.productsService.updateStock(productId, product.stock - quantity);
  } finally {
    await lock.release(); // Liberar candado obligatoriamente
  }
}
```

---

## 2. Categoría 2: Nociones Fundamentales de TypeScript, NestJS y Node.js

### ❓ Pregunta 2.1: Explica el ciclo de vida de una petición HTTP en NestJS. ¿En qué orden se ejecutan Middleware, Guards, Interceptors, Pipes y Exception Filters?

* **Respuesta del Candidato**:
  El orden exacto de ejecución en NestJS es:

```
Petición HTTP ──► [1. Middleware] ──► [2. Guards] ──► [3. Interceptors (Pre)] ──► [4. Pipes] ──► [5. Controller / Handler] ──► [6. Interceptors (Post)] ──► [7. Exception Filters] ──► Respuesta HTTP
```

#### 📚 Glosario y Rol en el Ciclo de Vida:
1. **Middleware**: Función que se ejecuta antes que cualquier otra cosa. Tiene acceso completo a los objetos `req` y `res`. *(Uso: CORS, compresión, logging de headers)*.
2. **Guards**: Evalúan si la petición cumple las reglas de autenticación/autorización. Retornan un booleano `true`/`false`. Se ejecutan **después del Middleware y antes de los Interceptors**. *(Uso: Auth Guard, Roles Guard)*.
3. **Interceptors (Pre-controller)**: Bindean lógica antes de que el controlador reciba la llamada. Pueden transformar la petición o iniciar temporizadores. *(Uso: Logging de latencia, caching)*.
4. **Pipes**: Validan y transforman los argumentos de la petición (`body`, `param`, `query`). Se ejecutan **justo antes del método del controlador**. Si la validación falla, lanzan un `BadRequestException` impidiendo que el controlador se ejecute. *(Uso: `ParsePositiveIntPipe`, `ValidationPipe`)*.
5. **Controller / Handler**: Método encargado de procesar la lógica de negocio y retornar los datos.
6. **Interceptors (Post-controller)**: Interceptan la respuesta retornada por el controlador usando Observables de RxJS (`tap`, `map`). Pueden transformar el JSON de respuesta.
7. **Exception Filters**: Capturan cualquier excepción no controlada en la cadena y la transforman en un formato JSON estándar con el código HTTP correspondiente. *(Uso: `AllExceptionsFilter`)*.

#### 💻 Ejemplo Integrado del Ciclo de Vida en NestJS:
```typescript
// 1. Pipe Personalizado
@Injectable()
export class ParsePositiveIntPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    const val = parseInt(value, 10);
    if (isNaN(val) || val <= 0) throw new BadRequestException('ID debe ser un entero positivo');
    return val;
  }
}

// 2. Guard
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    return req.headers['authorization'] === 'Bearer secret-token';
  }
}

// 3. Interceptor de Medición de Latencia
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();
    return next.handle().pipe(
      tap(() => console.log(`Respuesta enviada en: ${Date.now() - now}ms`))
    );
  }
}

// Uso en Controlador
@Controller('users')
@UseGuards(AuthGuard)
@UseInterceptors(LoggingInterceptor)
export class UsersController {
  @Get(':id')
  findOne(@Param('id', ParsePositiveIntPipe) id: number) {
    return { id, name: 'Juan Perez' };
  }
}
```

---

### ❓ Pregunta 2.2: ¿Cuál es la diferencia en Node.js entre `process.nextTick()`, `Promise.then()`, `setTimeout()`, y `setImmediate()` en relación al Event Loop?

* **Respuesta del Candidato**:
  Node.js utiliza un bucle de eventos de un solo hilo (*Single-threaded Event Loop*). Las tareas asíncronas se dividen en **Microtasks** y **Macrotasks** dentro de distintas fases.

#### 📚 Glosario de Conceptos del Event Loop:
- **Event Loop**: Mecanismo que permite a Node.js realizar operaciones de I/O no bloqueantes mediante la delegación de tareas al kernel del SO o a la piscina de hilos libuv.
- **Microtask Queue**: Cola de máxima prioridad que se procesa **inmediatamente al finalizar la operación actual**, antes de avanzar a la siguiente fase del Event Loop. Contiene callbacks de `process.nextTick()` y `Promise` (`async/await`).
- **Macrotask Queue**: Colas asociadas a fases específicas del Event Loop.
- **Fases del Event Loop**:
  1. **Timers**: Ejecuta callbacks programados por `setTimeout()` y `setInterval()`.
  2. **Pending Callbacks**: Ejecuta callbacks de I/O diferidos.
  3. **Poll**: Recupera eventos de I/O (lectura de archivos, conexiones de red).
  4. **Check**: Ejecuta callbacks de `setImmediate()`.
  5. **Close Callbacks**: Ejecuta callbacks de cierre (`socket.on('close')`).

#### 💻 Ejemplo Práctico de Orden de Ejecución:
```typescript
console.log('1. Síncrono Inicio');

setTimeout(() => {
  console.log('5. Macrotask: setTimeout (Timers Phase)');
}, 0);

setImmediate(() => {
  console.log('6. Macrotask: setImmediate (Check Phase)');
});

Promise.resolve().then(() => {
  console.log('3. Microtask: Promise.then');
});

process.nextTick(() => {
  console.log('2. Microtask: process.nextTick (Máxima prioridad)');
});

console.log('4. Síncrono Fin');

/* SALIDA POR CONSOLA:
   1. Síncrono Inicio
   4. Síncrono Fin
   2. Microtask: process.nextTick (Máxima prioridad)
   3. Microtask: Promise.then
   5. Macrotask: setTimeout (Timers Phase)
   6. Macrotask: setImmediate (Check Phase)
*/
```

---

### ❓ Pregunta 2.3: ¿Cómo funciona la Inyección de Dependencias (DI) en NestJS y cuáles son los distintos alcances (*Scopes*) de los Providers?

* **Respuesta del Candidato**:
  NestJS utiliza el patrón de Inversión de Control (IoC). La inyección de dependencias permite que el framework gestione la creación y vida de los objetos en lugar de instanciarlos manualmente con `new`.

#### 📚 Glosario de Conceptos:
- **Dependency Injection (DI)**: Patrón de diseño donde las dependencias de una clase se reciben desde el exterior (vía constructor) en lugar de instanciarse internamente.
- **IoC Container**: Contenedor central de NestJS que registra, instancia y resuelve las dependencias de los componentes anotados con `@Injectable()`.
- **Provider**: Cualquier clase registrada en el arreglo `providers` de un módulo NestJS (servicios, repositorios, factories).
- **`DEFAULT` Scope (Singleton)**: Se crea **una sola instancia** al iniciar la aplicación y se comparte en todas las peticiones HTTP. Es la opción recomendada por defecto debido a su consumo mínimo de memoria y alto rendimiento.
- **`REQUEST` Scope**: Se crea **una nueva instancia por cada petición HTTP** entrante y se destruye al finalizar.
- **`TRANSIENT` Scope**: Se crea una nueva instancia dedicada cada vez que el provider se inyecta en otra clase.
- **Multitenancy**: Arquitectura donde una sola instancia de software atiende a múltiples clientes (tenants), aislando sus datos. Se suele implementar mediante `REQUEST Scope` para inyectar la conexión de BD según el header `X-Tenant-ID`.

#### 💻 Ejemplo de Implementación con Scopes y Multitenancy:
```typescript
// Provider con Scope REQUEST para Multitenancy
@Injectable({ scope: Scope.REQUEST })
export class TenantService {
  private tenantId: string;

  constructor(@Inject(REQUEST) private request: Request) {
    // Lee el tenant directamente del header de la petición HTTP actual
    this.tenantId = (this.request.headers['x-tenant-id'] as string) || 'default_tenant';
  }

  getTenantDbConnection(): string {
    return `postgres://user:pass@localhost:5432/tenant_${this.tenantId}`;
  }
}
```

---

## 3. Categoría 3: Nociones Avanzadas de Arquitectura y Senior Product Engineer

### ❓ Pregunta 3.1: En Zubale coordinamos repartidores, tiendas y clientes en tiempo real. ¿Cómo diseñarías una arquitectura resiliente para procesar pagos y cambios de estado de órdenes distribuida entre microservicios?

* **Respuesta del Candidato**:
  Diseñaría un sistema basado en eventos utilizando el patrón **SAGA Orquestado** y el patrón **Transactional Outbox**, respaldado por **Apache Kafka** o **RabbitMQ**.

```
[ Orders API ] ──(DB Local)──► [ Tabla Outbox ] ──(Relay Worker)──► [ RabbitMQ / Kafka ]
                                                                             │
                                                                             ▼
[ Payment Service ] ◄── (Escucha: OrderCreatedEvent) ────────────────────────┘
        │
        ├─► Exitoso ──► Publica (PaymentSucceeded) ──► [ Delivery Service ] (Asignar Repartidor)
        └─► Fallido ──► Publica (PaymentFailed)    ──► [ Inventory Service ] (Compensación: Reembolsar Stock)
```

#### 📚 Glosario de Conceptos:
- **Message Broker**: Middleware orientado a mensajes que permite la comunicación asíncrona desacoplada entre microservicios (ej. RabbitMQ, Apache Kafka, AWS SQS).
- **Diferencia RabbitMQ vs Kafka**:
  - **RabbitMQ**: Broker de mensajes tradicional basado en colas de mensajes (AMQP). Excelente para enrutamiento complejo (*smart broker, dumb consumer*), entrega punto a punto y tareas en segundo plano.
  - **Kafka**: Plataforma de transmisión de eventos distribuida (*event streaming*) basada en logs de transacciones (*dumb broker, smart consumer*). Diseñado para alto rendimiento (millones de eventos/seg), retención de eventos e idóneo para event sourcing y analítica.
- **SAGA Orquestada**: Un servicio central (*Orquestador*) dirige el flujo enviando comandos a cada microservicio y manejando las transacciones compensatorias si alguno falla.
- **SAGA Coreografiada**: Cada microservicio escucha eventos de otros servicios y decide autónomamente qué acción ejecutar sin un punto central de control.
- **Transactional Outbox Pattern**: Patrón que garantiza consistencia eventual guardando los eventos en una tabla `outbox` dentro de la **misma transacción de base de datos SQL** que modifica el estado de la entidad. Un worker independiente lee la tabla `outbox` y publica los eventos al broker, previniendo pérdida de eventos si el broker cae.

#### 💻 Ejemplo de Implementación del Transactional Outbox Pattern:
```typescript
async createOrderWithOutbox(createOrderDto: CreateOrderDto, manager: EntityManager) {
  // 1. Guardar la orden en la transacción local
  const order = manager.create(Order, { userId: createOrderDto.userId, status: OrderStatus.PENDING });
  const savedOrder = await manager.save(order);

  // 2. Guardar el evento en la tabla Outbox en la MISMA transacción
  const outboxEvent = manager.create(Outbox, {
    aggregateType: 'ORDER',
    aggregateId: savedOrder.id.toString(),
    eventType: 'ORDER_CREATED',
    payload: JSON.stringify(savedOrder),
    status: 'PENDING',
  });
  await manager.save(outboxEvent);

  // Si la DB falla, ambos hacen ROLLBACK. No hay eventos perdidos ni huérfanos.
}
```

---

## 4. Categoría 4: Escenarios de Alta Concurrencia, Sistemas Distribuidos y Observabilidad

### ❓ Pregunta 4.1: ¿Qué estrategias propondrías para mejorar la escalabilidad, resiliencia y observabilidad del microservicio en producción?

* **Respuesta del Candidato**:
  Implementaría una arquitectura de lectura/escritura separada (*Read Replicas*), pooling de conexiones con **PgBouncer**, mitigación de desbordes de caché con **Singleflight/XFetch** y observabilidad distribuida con **OpenTelemetry, Prometheus y Grafana**.

#### 📚 Glosario de Conceptos:
- **Read Replicas en PostgreSQL**: Copias de solo lectura de la base de datos principal que sincronizan datos mediante replicación de streaming. Permiten derivar el tráfico intensivo de consultas `GET` a las réplicas, liberando al nodo primario para escrituras `INSERT/UPDATE`.
- **Connection Pooling**: Técnica que mantiene un conjunto de conexiones abiertas con la base de datos reutilizables, evitando el costo de abrir y cerrar una conexión TCP en cada petición HTTP.
- **PgBouncer**: Proxy ligero de pooling de conexiones para PostgreSQL que permite a miles de clientes Node.js compartir un número reducido de conexiones reales con el servidor DB.
- **Probabilistic Early Invalidation (XFetch)**: Algoritmo que recalcula de forma probabilística una llave de caché antes de que expire, evitando el desplome del rendimiento (*Cache Stampede*).
- **Singleflight en Node.js**: Patrón que agrupa múltiples peticiones concurrentes simultáneas que solicitan el mismo recurso, ejecutando una sola llamada a la base de datos y compartiendo la respuesta entre todas las peticiones en espera.
- **Pino / Winston**: Bibliotecas de logging estructurado de alto rendimiento para Node.js que emiten logs en JSON comprimido.
- **OpenTelemetry**: Estándar de la CNCF para la recolección de trazas distribuidas, métricas y logs entre microservicios.
- **Prometheus & Grafana**: Prometheus recolecta y almacena métricas numéricas de series temporales; Grafana las visualiza en tableros en tiempo real.

#### 💻 Ejemplo de Implementación del Patrón Singleflight en Node.js:
```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class SingleflightService {
  private inFlightPromises = new Map<string, Promise<any>>();

  async execute<T>(key: string, fetchFn: () => Promise<T>): Promise<T> {
    if (this.inFlightPromises.has(key)) {
      // Retorna la promesa en curso existente para las peticiones concurrentes
      return this.inFlightPromises.get(key);
    }

    const promise = fetchFn().finally(() => {
      this.inFlightPromises.delete(key);
    });

    this.inFlightPromises.set(key, promise);
    return promise;
  }
}
```

---

## 5. Categoría 5: Resiliencia, Microservicios, Docker, AWS CDK y Kubernetes (K8s)

### ❓ Pregunta 5.1: ¿Cómo protegerías la API contra ataques de denegación de servicio (DDoS) y fallos en cascada mediante los patrones Rate Limiter y Circuit Breaker?

* **Respuesta del Candidato**:
  Para la protección perimetral contra DDoS utilizaría **Cloudflare / AWS WAF** combinado con un **Rate Limiter distribuido** en NestJS. Para evitar fallos en cascada hacia servicios de terceros (ej. pasarela de pagos), implementaría un **Circuit Breaker**.

#### 📚 Glosario de Conceptos:
- **Rate Limiting**: Técnica que limita el número de peticiones HTTP que un cliente (IP o usuario) puede realizar en un intervalo de tiempo.
- **Algorithm Token Bucket / Sliding Window**: Algoritmos empleados en Redis para contar peticiones por IP de forma distribuida.
- **Circuit Breaker (Disyuntor)**: Patrón de resiliencia que monitorea las fallas hacia un servicio externo. Si las fallas superan un umbral, el circuito se "abre" y rechaza inmediatamente las peticiones sin intentar conectar con el servicio caído, evitando agotar hilos del servidor. Estados: *Closed* (Normal), *Open* (Rechazando), *Half-Open* (Prueba de recuperación).

#### 💻 Ejemplos de Implementación Práctica:

##### 1. Rate Limiter en NestJS con `@nestjs/throttler`:
```typescript
// app.module.ts
@Module({
  imports: [
    ThrottlerModule.forRoot([{
      ttl: 60000, // 1 minuto
      limit: 10,   // Máximo 10 peticiones por minuto por IP
    }]),
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
```

##### 2. Circuit Breaker con `opossum` en NestJS:
```typescript
import CircuitBreaker from 'opossum';

@Injectable()
export class ExternalPaymentService {
  private breaker: CircuitBreaker;

  constructor() {
    const options = {
      timeout: 3000, // Tiempo límite de espera 3s
      errorThresholdPercentage: 50, // Si el 50% de llamadas falla, abre el circuito
      resetTimeout: 10000, // Espera 10s antes de probar si el servicio se recuperó
    };
    this.breaker = new CircuitBreaker(this.callPaymentProvider, options);
    this.breaker.fallback(() => ({ success: false, reason: 'Servicio de pago no disponible (Circuit Breaker)' }));
  }

  async processPayment(amount: number) {
    return this.breaker.fire(amount);
  }

  private async callPaymentProvider(amount: number) {
    // Petición HTTP externa
  }
}
```

---

### ❓ Pregunta 5.2: ¿Cómo estructurarías la contenedorización con Docker y la separación de este monolito modular en microservicios independientes?

* **Respuesta del Candidato**:
  Para separar el monolito modular NestJS en microservicios independientes (ej. `Users Service`, `Products Service`, `Orders Service`), crearemos imágenes Docker ligeras utilizando **Multi-stage builds** y un archivo `docker-compose.yml` para desarrollo local con PostgreSQL, Redis y PgBouncer.

#### 📚 Glosario de Conceptos:
- **Multi-stage Build**: Técnica en Dockerfile que permite compilar la aplicación en una etapa temporal (*builder*) y copiar solo los artefactos compilados finales (`dist/`) a una imagen final ligera (Alpine Linux), reduciendo el tamaño de la imagen de 1GB a 120MB.

#### 💻 Configuración de Archivos de Contenedorización:

##### 1. `Dockerfile` Multi-Stage Optimizado:
```dockerfile
# Etapa 1: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# Etapa 2: Runner Producción
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --prod --frozen-lockfile
COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/src/main.js"]
```

##### 2. `docker-compose.yml` para Entorno Local Completo:
```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_USER=postgres
      - DB_PASSWORD=postgres
      - DB_NAME=zubale_ecommerce
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: zubale_ecommerce
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

---

### ❓ Pregunta 5.3: ¿Cómo desplegarías este microservicio en la nube (AWS) usando AWS CDK y Kubernetes (K8s)? Proporciona la explicación del manifiesto y la arquitectura futura.

* **Respuesta del Candidato**:
  Para el despliegue en producción en AWS utilizaría **AWS CDK (Cloud Development Kit)** con TypeScript para aprovisionar un clúster **AWS EKS (Elastic Kubernetes Service)**, una base de datos **AWS Aurora Serverless v2 PostgreSQL** y un clúster **ElastiCache Redis**.

#### 📚 Glosario de Conceptos de Kubernetes (K8s):
- **Pod**: La unidad de ejecución más pequeña en K8s. Contiene uno o más contenedores Docker.
- **Deployment**: Objeto que gestiona el estado deseado de los Pods (número de réplicas, actualizaciones rolling-update, reinicios).
- **Service**: Abstracción que expone una dirección IP estable y balanceador de carga interno para acceder a un grupo de Pods.
- **Ingress**: Controlador de entrada que enruta tráfico HTTP/HTTPS externo desde internet hacia los Services internos.
- **HPA (Horizontal Pod Autoscaler)**: Componente que escala automáticamente el número de Pods arriba o abajo basándose en el uso de CPU o memoria.
- **ConfigMap / Secret**: Objetos para inyectar variables de entorno no sensibles y credenciales cifradas en los Pods.

#### 💻 Manifiesto Completo de Kubernetes (`k8s-manifest.yaml`):
```yaml
# 1. Deployment: Gestiona los Pods del Microservicio NestJS
apiVersion: apps/v1
kind: Deployment
metadata:
  name: zubale-ecommerce-api
  namespace: production
spec:
  replicas: 3 # 3 Pods en alta disponibilidad
  selector:
    matchLabels:
      app: zubale-ecommerce-api
  template:
    metadata:
      labels:
        app: zubale-ecommerce-api
    spec:
      containers:
      - name: api
        image: 123456789.dkr.ecr.us-east-1.amazonaws.com/zubale-api:v1.0.0
        ports:
        - containerPort: 3000
        resources:
          requests:
            cpu: "250m"
            memory: "512Mi"
          limits:
            cpu: "1000m"
            memory: "1024Mi"
        envFrom:
        - configMapRef:
            name: api-config
---
# 2. Service: Balanceador Interno de Carga
apiVersion: v1
kind: Service
metadata:
  name: zubale-ecommerce-service
  namespace: production
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: 3000
  selector:
    app: zubale-ecommerce-api
---
# 3. HPA: Autosescalado Automático de Pods
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: zubale-ecommerce-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: zubale-ecommerce-api
  minReplicas: 3
  maxReplicas: 20 # Escala hasta 20 Pods durante eventos de alta demanda
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70 # Escala cuando el uso promedio de CPU supere el 70%
```

---

### 🗺️ Arquitectura Distribuida Futura Sugerida (Target Production Architecture)

```
                                [ Cloudflare WAF / DDoS Protection ]
                                                 │
                                                 ▼
                                [ AWS ALB (Application Load Balancer) ]
                                                 │
                                                 ▼
                             [ AWS EKS Cluster (Kubernetes Namespace) ]
             ┌───────────────────────────────────┼───────────────────────────────────┐
             │                                   │                                   │
             ▼                                   ▼                                   ▼
   [ Users Microservice ]             [ Products Microservice ]           [ Orders Microservice ]
      (3 to 10 Pods)                     (3 to 20 Pods)                     (3 to 15 Pods)
             │                                   │                                   │
             └───────────────────────────────────┼───────────────────────────────────┘
                                                 │
                                                 ▼
                                     [ Apache Kafka Event Bus ]
                                                 │
                        ┌────────────────────────┴────────────────────────┐
                        ▼                                                 ▼
           [ Amazon ElastiCache Redis ]                   [ AWS Aurora PostgreSQL ]
            (Caché y Redlock Cluster)                    (Primary Write + 2 Read Replicas)
```

---

## 6. Categoría 6: Mejoras Futuras Aplicadas (Protección en Capa de Aplicación, Resiliencia y Robustez de Tipos)

### ❓ Pregunta 6.1: ¿Cómo implementaste las mejoras futuras de protección en la capa de aplicación (Rate Limiting con @nestjs/throttler, Circuit Breaker en pagos, filtro centralizado HTTP 429 y tipado estricto en TypeScript)?

* **Respuesta del Candidato**:
  Para blindar las reglas de negocio y prevenir abusos volumétricos o fallas en cascada antes de delegar en defensas perimetrales de infraestructura, implementé un paquete integral de mejoras en la **Capa de Aplicación de NestJS**:

  1. **Instalación e Integración de `@nestjs/throttler`**:
     Configuré `ThrottlerModule.forRoot` en `AppModule` con cuotas base globales (`limit: 100`, `ttl: 60000`) y registré el `ThrottlerGuard` a nivel de aplicación con el token `APP_GUARD`. Para proteger los endpoints más sensibles contra abusos y ataques de fuerza bruta, apliqué el estándar de **Tiered Rate Limiting** con el decorador `@Throttle()`:
     - `POST /orders`: Cuota limitada a 20 peticiones por minuto.
     - `POST /orders/:id/pay`: Cuota estricta de 10 peticiones por minuto para prevenir ataques de *card testing* y cobros redundantes.

  2. **Implementación del Patrón Circuit Breaker en Pagos**:
     Envolví la lógica de llamadas a pasarelas de pago externas en un disyuntor (*Circuit Breaker*). Cuando se registran fallos consecutivos o la tasa de error supera el umbral, el circuito pasa al estado **Open**, rechazando las peticiones de inmediato en **< 1 ms** con una excepción `ServiceUnavailableException` (HTTP `503 Service Unavailable`). Esto evita que el Event Loop y los sockets de red queden colgados reintentando llamadas a un servicio externo caído. Al transcurrir el periodo de enfriamiento, entra en **Half-Open** para probar si el servicio se recuperó.

  3. **Manejo Centralizado de Excepciones HTTP (`HTTP 429 Too Many Requests`)**:
     Creé un `ThrottlerExceptionFilter` dedicado anotado con `@Catch(ThrottlerException)` y registrado globalmente en `AppModule` mediante el token `APP_FILTER`. Transforma las violaciones de tasa en una respuesta JSON estructurada y estándar (RFC 7807) e inyecta la cabecera estándar `Retry-After: 60`, orientando al cliente sobre cuándo puede reanudar el envío de peticiones.

  4. **Modo Estricto de TypeScript (`strict: true`) y Erradicación Total de `any`**:
     - Habilité `"strict": true`, `"noImplicitAny": true`, `"strictNullChecks": true`, `"strictBindCallApply": true` y `"noFallthroughCasesInSwitch": true` en `tsconfig.json`.
     - Reemplacé todas las ocurrencias de `: any`, `<any>` y `as any` en `src/` por interfaces explícitas de dominio: `CategoryTreeNode` para la jerarquía de categorías, y `OrderWithFullDetails` junto con `EnrichedUser` para el endpoint de orden completa.
     - Migré todos los bloques de captura de errores de `catch (error: any)` a `catch (error: unknown)` con guardas de tipo seguras en tiempo de ejecución.
     - Activé la regla estricta de ESLint `'@typescript-eslint/no-explicit-any': 'error'` para todo el directorio `src/**/*.ts`.

* **Escenario de Entrevista**:
  > *Entrevistador*: "¿Por qué decidiste aplicar Rate Limiting en la capa de aplicación de NestJS en lugar de delegarlo exclusivamente a un WAF perimetral como Cloudflare o AWS WAF?"
  >
  > *Candidato*: "Sigue el principio de **Defensa en Profundidad (Defense-in-Depth)**. El WAF perimetral detiene ataques volumétricos masivos a nivel de red (Capas 3 y 4) y bots basados en IP global. Sin embargo, la capa de aplicación en NestJS es la única que tiene el contexto de negocio (Capa 7) para aplicar cuotas semánticas por usuario autenticado, API Key o endpoint específico (como limitar pagos a 10 req/min mientras se permite consultar productos a 100 req/min). Ambas capas son complementarias y no redundantes: la infraestructura filtra el tráfico malicioso masivo y la aplicación protege las reglas de negocio y los costos de pasarelas de pago."

#### 📚 Glosario de Conceptos:
- **Tiered Rate Limiting**: Estrategia recomendada por OWASP (API4:2023) que asigna cuotas de consumo diferenciadas según el costo computacional y la sensibilidad financiera de cada endpoint.
- **Circuit Breaker (Disyuntor de Resiliencia)**: Patrón de estabilidad que monitoriza fallos en integraciones externas. Posee 3 estados:
  - *Closed*: Operación normal, las peticiones pasan al servicio externo.
  - *Open*: Tras superar el umbral de fallos, corta inmediatamente el tráfico devolviendo HTTP 503 sin llamar a la red.
  - *Half-Open*: Prueba un número limitado de peticiones para verificar si el servicio externo se recuperó.
- **HTTP 429 Too Many Requests & Header `Retry-After`**: Código de estado HTTP estándar emitido cuando un cliente supera su cuota permitida. El encabezado `Retry-After` le indica en segundos el tiempo que debe esperar antes de reintentar.
- **TypeScript Strict Mode**: Conjunto de verificaciones estrictas del compilador (`noImplicitAny`, `strictNullChecks`, etc.) que obligan a tipar formalmente cada parámetro, retorno y manejo de `null`/`undefined`.
- **Type Narrowing & `unknown`**: Técnica segura de TypeScript donde variables de tipo indeterminado (`unknown`) solo pueden ser manipuladas después de comprobar su tipo en tiempo de ejecución mediante `instanceof`, `typeof` o guardas de tipo personalizadas.

#### 💻 Ejemplos de Implementación:

##### 1. Configuración de `ThrottlerModule`, `APP_GUARD` y `APP_FILTER` (`src/app.module.ts`):
```typescript
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { ThrottlerExceptionFilter } from './common/filters/throttler-exception.filter';

@Module({
  imports: [
    // Cuota global por defecto: 100 peticiones cada 60 segundos
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 100,
      },
    ]),
    // ...demás módulos
  ],
  providers: [
    AppService,
    // Guard global de Throttling
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Filtro centralizado para HTTP 429
    {
      provide: APP_FILTER,
      useClass: ThrottlerExceptionFilter,
    },
  ],
})
export class AppModule {}
```

##### 2. Filtro Centralizado de Excepciones HTTP 429 (`src/common/filters/throttler-exception.filter.ts`):
```typescript
import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Response } from 'express';

@Catch(ThrottlerException)
export class ThrottlerExceptionFilter implements ExceptionFilter {
  catch(exception: ThrottlerException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    response.header('Retry-After', '60');
    response.status(HttpStatus.TOO_MANY_REQUESTS).json({
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      error: 'Too Many Requests',
      message: exception.message,
      timestamp: new Date().toISOString(),
    });
  }
}
```

##### 3. Aplicación Granular del Decorador `@Throttle` en Endpoints Críticos (`src/orders/orders.controller.ts`):
```typescript
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // Máximo 20 órdenes por minuto
  create(@Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(createOrderDto);
  }

  @Post(':id/pay')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // Máximo 10 intentos de pago por minuto
  processPayment(@Param('id', ParsePositiveIntPipe) id: number) {
    return this.ordersService.processPayment(id);
  }
}
```

##### 4. Configuración Estricta de Compilación (`tsconfig.json`):
```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2023",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictPropertyInitialization": false,
    "forceConsistentCasingInFileNames": true,
    "strictBindCallApply": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

---

## 7. Conclusión

Esta guía completa consolida los fundamentos teóricos, la resolución práctica de fallas de backend, patrones de diseño de sistemas distribuidos, resiliencia con Rate Limiting y Circuit Breaker, tipado estricto en TypeScript y las mejores prácticas de infraestructura moderna en Kubernetes y la nube. Prepara al candidato para responder con solidez a cualquier nivel de entrevista técnica como **Senior Product Engineer**.
